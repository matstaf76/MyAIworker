#!/usr/bin/env node
/**
 * max-eval.mjs — regression harness for Max's sales prompt.
 *
 * Runs scripted prospect personas against Max's LIVE system prompt and asserts
 * the rules that cost real money when they break:
 *
 *   R1  no markdown / bullets / emoji (it gets spoken aloud)
 *   R2  replies stay within 3 sentences
 *   R3  the $625 case-study deal is never leaked before turn 5
 *   R4  prices are spoken as "$625" / "$1,250" so the payment button fires
 *   R5  every reply ends actionable (question or directive)
 *   R6  the real bot.js CTA regexes fire on exactly the right turns
 *   R7  never offers a demo, callback, follow-up or trial — none of them exist
 *
 * R6 is the important one: it runs the ACTUAL regexes parsed out of js/bot.js
 * against real model output, so prompt changes and widget changes can't drift
 * apart silently.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...          # or: source backend/secrets.sh
 *   node tools/max-eval.mjs               # all personas
 *   node tools/max-eval.mjs --turns 12    # longer conversations
 *
 * Model must match what Max runs on in the Vapi dashboard.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = process.env.MAX_MODEL || 'gpt-5.4';
const API_KEY = process.env.OPENAI_API_KEY;
const TURNS = Number(process.argv[includesFlag('--turns') + 1]) || 10;

function includesFlag(f) { return process.argv.indexOf(f); }

if (!API_KEY) {
  console.error('ERROR: set OPENAI_API_KEY (or `source backend/secrets.sh`) first.');
  process.exit(1);
}

// ── Load the live prompt and the live CTA regexes ──────────────
const SYSTEM_PROMPT = readFileSync(join(ROOT, 'vapi-max-system-prompt.txt'), 'utf8');

const botSrc = readFileSync(join(ROOT, 'js', 'bot.js'), 'utf8');
const grabRegex = (name) => {
  const m = botSrc.match(new RegExp(`const ${name} = (/.*/[a-z]*);`));
  if (!m) throw new Error(`Could not find ${name} in js/bot.js — did it get renamed?`);
  // eslint-disable-next-line no-eval
  return eval(m[1]);
};
const PRICE_625 = grabRegex('PRICE_625');
const PRICE_1250 = grabRegex('PRICE_1250');

// Canned lookup_business result. Deliberately booby-trapped: the phone number
// and street address both contain "625", and the review count contains "1250".
// If the CTA regexes regress, R6 catches it here.
const LOOKUP_STUB =
  'Business found: Liberty Street Barbershop (Barber shop). Located at 625 E Liberty St, York, SC 29745. ' +
  'Phone: (803) 625-1400. No website listed. That\'s a missed lead-capture opportunity. ' +
  'Google rating: 4.6/5 from 1250 reviews. Hours: Monday: 9:00 AM – 5:00 PM; Saturday: Closed. ' +
  'Closes by 5 PM every weekday — missing every after-hours call. Closed on weekends.';

const PERSONAS = [
  { name: 'eager-barber',    brief: 'You own Liberty Street Barbershop in York, SC. You are interested and move fast. Mention your business name in your first reply.' },
  { name: 'price-pusher',    brief: 'You run a small plumbing company. You like the idea but push hard on price every single turn. Never say yes until the price drops.' },
  { name: 'skeptical-cafe',  brief: 'You own a cafe. You are skeptical that AI can handle real customers. Ask hard practical questions. Warm up slowly.' },
  { name: 'chatty-salon',    brief: 'You own a hair salon. You ramble about unrelated things and rarely answer directly.' },
  { name: 'ready-to-buy',    brief: 'You own a landscaping company and want to buy immediately. Say yes on your second reply and ask how to pay.' },
  { name: 'tire-kicker',     brief: 'You are just curious, not a business owner. You will never buy. Keep asking general questions.' },
];

// ── OpenAI call ────────────────────────────────────────────────
async function chat(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.choices[0].message.content.trim();
}

// ── Rule checks ────────────────────────────────────────────────
const sentenceCount = (t) => (t.match(/[.!?]+(?:\s|$)/g) || []).length || 1;

function checkTurn(text, turnIndex, state) {
  const fails = [];

  if (/^\s*[-*•]\s|\n\s*[-*•]\s|\*\*|^#{1,6}\s/m.test(text)) fails.push('R1 markdown/bullets');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) fails.push('R1 emoji');
  if (sentenceCount(text) > 3) fails.push(`R2 ${sentenceCount(text)} sentences`);

  const mentions625 = /\$\s?625|six\s*hundred.*twenty[\s-]*five|\b625\s*(?:dollars|bucks)/i.test(text);
  if (mentions625) {
    if (turnIndex < 5) fails.push(`R3 leaked $625 on turn ${turnIndex + 1}`);
    state.offered625 = true;
  }

  // Prices must carry a $ and digits, or the widget button never appears.
  if (/\b(?:six hundred twenty|twelve fifty|one thousand two hundred)/i.test(text)) {
    fails.push('R4 price spelled out instead of $digits');
  }

  const last = text.trim().slice(-140);
  if (!/[?]\s*$/.test(text.trim()) && !/\b(tap|click|call|text|reply|tell me|let me know|go ahead|grab)\b/i.test(last)) {
    fails.push('R5 no actionable close');
  }

  // R7 — Max IS the demo. There is nothing to book, schedule or follow up on,
  // and he must not invent one as a soft landing when the sale isn't closing.
  if (/\b(book|schedule|set up|arrange)\s+(a\s+)?(demo|call|meeting|appointment|time)\b|\bcallback\b|\bcall you back\b|\bfollow up with you\b|\bsend you (the |some )?(info|details|an email)\b|\bhave someone reach out\b/i.test(text)) {
    fails.push('R7 offered a demo/callback/follow-up that does not exist');
  }
  // Offering a trial is a violation; the approved reframe ("you're in the free
  // trial right now") is not — match the offer shape, not the bare phrase.
  if (/\b(?:offer|offers|have|provide|start|give you)\s+(?:a\s+)?free trial\b|\bfree trial (?:available|period|option)\b/i.test(text)) {
    fails.push('R7 offered a free trial that does not exist');
  }

  // R6 — run the real widget regexes.
  const fires625 = PRICE_625.test(text);
  const fires1250 = PRICE_1250.test(text);
  if (mentions625 && !fires625) fails.push('R6 said $625 but the $625 button would NOT fire');
  if (!mentions625 && fires625) fails.push('R6 $625 button fires on a turn that never offered it');
  if (state.offered625 === false && fires1250 && turnIndex === 0) {
    fails.push('R6 $1,250 button fires on the opening turn');
  }

  return fails;
}

// ── Run one persona ────────────────────────────────────────────
async function runPersona(p) {
  const maxMsgs = [{ role: 'system', content: SYSTEM_PROMPT }];
  const proMsgs = [{
    role: 'system',
    content: `You are a small business owner talking OUT LOUD to an AI sales agent on a website. ${p.brief} ` +
             `Reply in 1-2 short spoken sentences. Never break character. Never mention you are an AI.`,
  }];

  const results = [];
  const state = { offered625: false };
  let prospect = 'Hey, what is this?';

  for (let i = 0; i < TURNS; i++) {
    maxMsgs.push({ role: 'user', content: prospect });
    let reply = await chat(maxMsgs);

    // Crude tool simulation: if Max asks about the business by name, feed him
    // the booby-trapped lookup result once.
    if (i === 1 && p.name === 'eager-barber') {
      maxMsgs.push({ role: 'assistant', content: reply });
      maxMsgs.push({ role: 'user', content: `[lookup_business result: ${LOOKUP_STUB}]` });
      reply = await chat(maxMsgs);
    }

    maxMsgs.push({ role: 'assistant', content: reply });
    results.push({ turn: i + 1, text: reply, fails: checkTurn(reply, i, state) });

    proMsgs.push({ role: 'user', content: reply });
    prospect = await chat(proMsgs);
    proMsgs.push({ role: 'assistant', content: prospect });
  }
  return { persona: p.name, results, state };
}

// ── Main ───────────────────────────────────────────────────────
const runs = [];
for (const p of PERSONAS) {
  process.stdout.write(`running ${p.name}… `);
  try {
    runs.push(await runPersona(p));
    console.log('done');
  } catch (e) {
    console.log(`ERROR ${e.message}`);
  }
}

let total = 0;
let failed = 0;
console.log('\n══════════ RESULTS ══════════');
for (const r of runs) {
  const bad = r.results.filter((x) => x.fails.length);
  total += r.results.length;
  failed += bad.length;
  console.log(`\n▸ ${r.persona} — ${r.results.length - bad.length}/${r.results.length} clean` +
              (r.state.offered625 ? '  [offered $625]' : ''));
  for (const b of bad) {
    console.log(`   turn ${b.turn}: ${b.fails.join(' | ')}`);
    console.log(`      "${b.text.replace(/\s+/g, ' ').slice(0, 150)}"`);
  }
}
console.log(`\n${total - failed}/${total} turns clean across ${runs.length} personas.`);
process.exit(failed > 0 ? 1 : 0);
