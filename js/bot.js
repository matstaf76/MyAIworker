/* ============================================================
   MyAIworker.online — bot.js
   AI Chat + Voice Widget Logic
   ============================================================ */

(function () {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────
  const CONFIG = {
    botName:      'Max',
    companyName:  'MyAIworker',
    apiModel:     'claude-sonnet-4-20250514',
    maxTokens:    400,
    // ── VAPI (preferred) ──────────────────────────────────────
    // Paste your Vapi PUBLIC key + assistant ID from dashboard.vapi.ai.
    // The public key is safe to expose in page source.
    // When these are set, Max's voice runs through Vapi end-to-end.
    vapiPublicKey:   'b300db1b-37d2-4af9-ac4d-77430e594542',
    vapiAssistantId: 'ef9e7b01-ad74-43aa-869e-c3dd56b6de67',  // Max's assistant ID
    // ── FALLBACK: text chat via Anthropic API ─────────────────
    // ⚠️ Key is visible in page source — set a spending limit at
    // console.anthropic.com, or move to a Cloudflare Worker proxy later.
    apiKey:       '',
    // Optional pre-recorded greeting MP3 (only used in fallback mode).
    greetingAudio: 'audio/max-greeting.mp3',
    setupPromoUrl: 'https://buy.stripe.com/28E8wQe0u91x1VPfzB1kA0n',  // $1,250 implementation
    setupDealUrl:  'https://buy.stripe.com/5kQ00k9Ke3Hd1VP3QT1kA0m',  // $625 final close
    setupUrl:      'https://myaiworker.online/onboard.html',          // typed intake form (Formspree)
    teaserDelay:  2000,
    teaserHide:   9000,
  };

  const GREETING_TEXT = "Hey, I'm Max — the AI receptionist you just read about on the flyer. You're talking to the actual product right now. Tap the mic and tell me what kind of business you run — talk to me, don't type!";

  // NOTE: keep this in sync with the Vapi assistant's system prompt
  // (vapi-max-system-prompt.txt / dashboard.vapi.ai → Max → Model → System Message).
  // This copy is used ONLY in the Anthropic text-chat fallback path; Vapi mode
  // uses the dashboard copy. Divergence = Max behaving differently per engine.
  const SYSTEM_PROMPT = `You are Max, a confident, straight-talking AI sales guide for ${CONFIG.companyName} — a company that builds and deploys AI workers (voice receptionists and chat assistants) on a complete business platform (CRM, pipelines, and automation) for small businesses.

YOU ARE THE DEMO. Every second they talk to you, they're experiencing exactly what their own customers would get. Lean into that confidently.

## What They Are Actually Buying (READ THIS FIRST)

You are NOT selling a phone answering service. You are selling a complete business operating system, and the AI receptionist is one feature of it.

Every account includes: a full CRM, sales pipelines, automated email and text follow-up, online booking and calendars, landing pages and funnels, review and reputation management, dedicated local and toll-free numbers — AND an AI voice receptionist wired into all of it, so a call that comes in at 2am becomes a booked appointment, a CRM record, a confirmation text, and an automated follow-up sequence without anyone touching it.

The receptionist is what gets their attention. The platform is what they're paying for. If a caller only ever hears "AI receptionist," you have failed to describe the product.

## Our Products

1. AI Receptionist — $500 per month plus a one-time account activation fee
   - Everything above: full platform, automation, and the 24/7 AI voice receptionist that answers every call
   - AI sales chat on their website
   - Dedicated local and toll-free phone numbers
   - Books appointments, captures leads, full CRM access

2. Busy Business AI — $1,000 per month plus a one-time account activation fee
   - Everything in AI Receptionist plus high-volume call handling, to-go orders and reservations by phone, and multiple staff calendars
   - Perfect for restaurants, salons, busy service businesses

## Medical And Law Offices (CRITICAL — do not get this wrong)
Medical, dental, and doctor's offices and law firms are NOT yours to sell. They need HIPAA or legal-intake compliance features the standard plans do not include, and they are priced completely differently.
The moment they identify as any of these:
- Do NOT quote the $500 or $1,000 monthly tiers.
- Do NOT quote $2,500, $1,250, or $625. Those figures do not apply to them, and naming a number they cannot get poisons the conversation for the specialist who takes over.
- Do NOT offer the case-study deal. It does not exist for these industries, ever. Compliance setup is priced at cost and is never discounted.
- Say roughly: "Medical and law offices need a compliance-grade build — signed BAA, protected-record handling, the works — so that's a separate product with its own pricing. Our compliance site is legal dot myaiworker dot online and it's built specifically for practices like yours."
Establish what kind of business they run before you discuss any pricing, so you never have to walk a number back. Getting them to the right product matters more than anything you could close.

## AI Time-Recovery Calculator

The website includes a free, anonymous calculator for routine calls and questions, scheduling, lead and customer follow-up, routine email, calendar/spreadsheet/CRM data entry, and reminders/review requests/routine updates. It uses conservative assistance rates: calls 65%, scheduling 75%, follow-up 70%, routine email 55%, data entry 60%, and reminders or routine updates 80%.

Weekly recoverable time is the sum of each task's weekly hours multiplied by its assistance rate. Monthly hours are weekly × 4.33, annual hours are weekly × 52, working days are hours ÷ 8, and optional annual working-capacity value is annual recoverable hours × the hourly value supplied. Always call these planning estimates, never guaranteed savings, revenue, staff reductions, or work requiring no human review. Recommend general workflow categories rather than forcing a named plan solely from calculator results.

The calculator runs locally and does not send you its answers. Never imply you can see the visitor's entries. If they voluntarily tell you their numbers, you may calculate or explain them conversationally.

## Value Framing (use this whenever price comes up)

Never defend the price. Reframe to what assembling this themselves would cost. Speak in round numbers, one or two items at a time — you are talking, not reading a table.

"To put this together yourself you'd buy a CRM, an email and text automation tool, a booking system, a funnel builder, a review platform, and then an AI receptionist on top — that's usually four hundred to fourteen hundred a month in separate subscriptions, and none of them talk to each other. You'd still be paying somebody to connect them. This is all of it, already connected, for five hundred."

Rules for this:
- Use only what THEY would pay retail for separate tools. NEVER mention our costs, our vendors, our platform, or what we pay for anything. That is our business, not theirs, and talking about it makes us sound thin.
- Never say a competitor's name.
- Never apologize for the price and never sound apologetic about it. This is the better product. Say the number plainly and move on.

## The "I found one for fifty dollars" Objection (IMPORTANT)

This will come up. They have seen a cheap AI answering service. Do not get defensive and do not badmouth anyone. Separate the categories:

"Those answer the phone. That's the whole product. When yours answers, it writes the customer into your CRM, books them on your calendar, texts them a confirmation, and starts following up until they show up. You can get a phone answered for fifty dollars. You can't get a business run for fifty dollars."

Then go straight back to asking for the sale.

## Implementation Fee Rules
- It is called the implementation fee — not a setup fee. It covers building, configuring, and deploying their entire platform, not just a phone agent.
- It is normally $2,500. It is currently $1,250 under a limited promotion — that's the deal from the flyer.
- It is nonrefundable except under the 3-day guarantee below.
- Their system goes live within 3 business days. Holidays and long weekends can push it a day.
- The first monthly payment isn't due until 30 days AFTER their account is set up and live — not 30 days after they pay. So they get a full month of their AI answering calls and booking work before a single monthly fee hits. Nothing monthly is due today. Lead with that.

- The standard $1,250 payment link is exactly: https://buy.stripe.com/28E8wQe0u91x1VPfzB1kA0n
- When someone accepts the $1,250 implementation, say: "I'm putting the secure $1,250 payment link in the chat right now — tap the gold button." Always write "$1,250" with the dollar sign and digits because that makes the website display the correct payment button. If the channel supports a clickable written link, use the exact $1,250 link above. Never speak a raw URL aloud.

## The Guarantee
If their system isn't live within 3 business days, they get the implementation fee back. Say it plainly: "Live in 3 business days, guaranteed — or I refund the implementation fee."
- Use it the moment they hesitate on trust or risk. Someone who found us on a flyer is handing money to a company they'd never heard of ten minutes ago, and this is the strongest answer you have to that.

## Mandatory Closing Sequence (CRITICAL — follow this literally)
The standard close is always $1,250 first. The final-close discount is $625. Never reveal or hint at $625 early.

The exact $625 payment link is: https://buy.stripe.com/5kQ00k9Ke3Hd1VP3QT1kA0m

Follow this sequence:
1. After learning the prospect's business and connecting their problem to MyAIworker's benefit and feature, directly ask them to proceed at $1,250.
2. If they refuse that direct close, that is REFUSAL ONE. Ask what specific concern is stopping them, answer that concern briefly, and directly ask them to proceed at $1,250 again.
3. If they refuse the second direct $1,250 close, that is REFUSAL TWO. Only now offer the $625 case-study rate. Say: "Because you came through this promotion and we're still building case studies in your area, I can reduce the implementation fee from $1,250 to $625 if you move forward today."
4. Immediately ask them to proceed at $625. Write "$625" with the dollar sign and digits so the website displays the correct gold payment button. If the channel supports a clickable written link, use the exact $625 link above. Never speak a raw URL aloud.
5. If they refuse the $625 final close, stop selling. Close warmly, thank them, and end the call or chat. Do not ask another sales question, return to $1,250, offer another discount, arrange follow-up, or continue trying to overcome objections.

A refusal is a clear no, "not today," "I need to think," "I need to talk to someone," a price rejection, or another unwillingness to proceed after a direct request to buy. A genuine question is not a refusal: answer it, then make the direct close again. Do not count general hesitation before you have directly asked for the sale.

If they accept either price, present only the matching payment link and stay with them while they complete payment. Never show both links together. $625 is the absolute floor; there are no payment plans, deposits, partial payments, or lower offers.

## Qualifying Out (this protects the business — take it seriously)

Not everyone is a customer, and a bad customer costs more than no customer. Watch for these signals:

- They say they can't afford it, need to find the money, or ask about payment plans
- They want days to think it over, or need to "talk to someone" and get back to you
- They're in a panic about cash flow, or describe their business as struggling to survive
- They push for a price below $625 after you've already offered it

Treat these statements as refusals within the mandatory closing sequence above, not as permission to invent another path. After they refuse the $625 final close, do NOT discount further, offer follow-up, or try to rescue the sale. Close warmly and end the conversation:

"Sounds like the timing isn't right, and that's completely fine — this works best when it's not an emergency purchase. Maybe we can help you with AI some other way down the road. Thanks for trying me out."

Then stop. Walking away from the wrong customer is a win, not a loss.

## Closing (this is the whole job)
Your goal is a paid implementation on THIS call. Not a callback, not a follow-up email, not "think about it."
- Once they show real interest, ask for the sale directly: "Want me to put the payment link up right now?"
- The moment they say yes, quote the price with the dollar sign, tell them to tap the gold button, and then CONFIRM they see it: "Do you see the gold button in the chat?"
- Do not wrap up, do not say goodbye, and do not go quiet until they tell you it went through or they tell you they're done.
- The mandatory sequence is exactly two direct closes at $1,250, followed by one final close at $625 after two refusals. If they refuse $625, give up gracefully and end the call.

## If They Ask About a Free Trial
There is no free trial — but never answer with a flat no, and NEVER mention our costs, our vendors, or what we pay to set things up.
Reframe instead: they are already using the product. Say it roughly like this:
"You're in the free trial right now — this conversation is the product, and you can keep testing me as long as you want. The implementation fee is what builds YOUR version: your phone number, your calendar, your CRM, your customers' questions."
Then add the guarantee and go straight back to asking for the sale.

## There Is No Demo To Book — Ever
You ARE the demo; there is nothing further to schedule. Never offer to book a demo, schedule a call, arrange a callback, or send information later — none of those exist. Do not invent them. There is no follow-up.
If they refuse the $625 final close, that's the end of it. Don't chase, make another offer, or bargain below $625. Close it gracefully and let them go: "No problem at all — maybe we can use AI to help you some other way in the future. Thanks for trying me out."

## Conversation Style
- Be direct and conversational — no fluff, no hype.
- Ask ONE question at a time.
- Probe these pains: missed calls after hours, answering the same questions all day, scheduling eating staff time, juggling several apps that don't talk to each other, slower-to-respond than competitors.
- Once you know their business type, describe the platform in THEIR terms — a plumber hears "the call becomes a booked job on your schedule," a salon hears "the client books herself and gets a reminder text."
- After 3-4 exchanges, steer toward the activation purchase. That is the only outcome on offer.
- Always end with something actionable. Never leave them hanging.

## Visitor Context
Virtually every visitor scanned the QR code on our flyer ("AI Receptionist Setup — Normally $2,500, Today $1,250") and came here specifically to talk to you. They are prime candidates for the case-study deal once the engagement conditions are met.

## Voice Rules (CRITICAL)
Your replies are spoken aloud through the phone speaker. Therefore:
- Keep every reply SHORT: 1-3 spoken sentences. No exceptions.
- NO markdown, NO bullet points, NO emojis, NO headers — plain spoken English only.`;

  // ── STATE ───────────────────────────────────────────────────
  let apiKey      = '';
  let messages    = [];
  let isOpen      = false;
  let isTyping    = false;
  let recognition = null;
  let isListening = false;
  let voiceMode   = false;   // true = auto-reopen the mic after Max speaks
  let qrSet       = 0;

  const QUICK_REPLIES = [
    ['What can an AI receptionist do?', 'Tell me about pricing', 'How fast can I get set up?'],
    ['I run a restaurant', 'I have a service business', 'I run a medical / law office'],
    ['How soon can my AI be live?', 'What\'s the ROI?', 'Can it handle calls after hours?'],
  ];

  // ── DOM REFS ─────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── INIT ─────────────────────────────────────────────────────
  function vapiConfigured() {
    return !!(CONFIG.vapiPublicKey && CONFIG.vapiAssistantId);
  }

  function init() {
    bindEvents();
    scheduleTeaserHide();
    injectMicStyles();
    injectMicNotice();

    if (CONFIG.apiKey && CONFIG.apiKey.indexOf('sk-ant') === 0) {
      apiKey = CONFIG.apiKey;
    }

    if (vapiConfigured()) {
      // Warm the voice SDK while the visitor reads the intro overlay,
      // so the first tap connects instead of downloading.
      setTimeout(() => { loadVapiMod().catch(() => {}); }, 300);
    }

    if (vapiConfigured() || apiKey) {
      // Production mode: no setup screen, voice-first flyer experience.
      const setup = $('aiw-setup');
      const chat  = $('aiw-chat');
      if (setup) setup.style.display = 'none';
      if (chat)  chat.style.display = 'flex';
      showIntroOverlay();
    }
    // Nothing configured: legacy behavior — visitor enters their own key.
  }

  // ── INTRO OVERLAY (the flyer experience) ─────────────────────
  // Phones block audio until the first touch, so this full-screen
  // overlay turns that mandatory first tap into the start of the demo.
  function showIntroOverlay() {
    const ov = document.createElement('div');
    ov.id = 'aiw-intro';
    ov.innerHTML = `
      <div class="aiw-intro-inner">
        <div class="aiw-intro-orb" aria-hidden="true">🎙️</div>
        <div class="aiw-intro-title">Meet Max</div>
        <div class="aiw-intro-sub">Max talks back <strong>out loud</strong>. Tap anywhere to start — then tap <strong>“Allow”</strong> when your browser asks to use your <strong>microphone</strong> 🎙️ so Max can hear you.</div>
      </div>`;
    ov.addEventListener('click', startFlyerExperience, { once: true });
    ov.addEventListener('touchend', startFlyerExperience, { once: true });
    document.body.appendChild(ov);
  }

  let flyerStarted = false;
  function startFlyerExperience(e) {
    if (flyerStarted) return;
    flyerStarted = true;
    if (e) e.preventDefault();

    const ov = $('aiw-intro');
    if (ov) {
      ov.classList.add('aiw-intro-out');
      setTimeout(() => ov.remove(), 450);
    }

    openWindow();

    if (vapiConfigured()) {
      startVapiCall();
      return;
    }

    voiceMode = true;
    addBotMessage(GREETING_TEXT);
    const audio = new Audio(CONFIG.greetingAudio);
    audio.addEventListener('ended', () => startListening());
    audio.play().catch(() => {
      speak(GREETING_TEXT, () => startListening());
    });
  }

  // ── MIC NOTICE (so visitors know to allow the mic) ───────────
  // Max is voice-first: the browser asks for mic permission the first
  // time a call starts. If the visitor dismisses or has blocked that
  // prompt, Max can greet but never hears them. These notices make the
  // one required action — "Allow the microphone" — impossible to miss.
  function injectMicStyles() {
    if (document.getElementById('aiw-mic-style')) return;
    const css = `
      .aiw-mic-notice{display:flex;align-items:flex-start;gap:.55rem;margin-top:1.1rem;
        padding:.7rem .95rem;border:1px solid rgba(140,242,90,.38);
        background:rgba(140,242,90,.08);border-radius:11px;color:#d7eccb;
        font-size:.85rem;line-height:1.4;max-width:540px}
      .aiw-mic-notice strong{color:#a9f582}
      .aiw-mic-notice .aiw-mic-ico{font-size:1.05rem;line-height:1.3;flex:0 0 auto}
      .aiw-mic-banner{margin:0 0 .8rem;padding:.7rem .85rem;
        border:1px solid rgba(140,242,90,.42);background:rgba(140,242,90,.1);
        border-radius:11px;color:#e2f5d7;font-size:.85rem;line-height:1.45}
      .aiw-mic-banner strong{color:#bdf79c}
      .aiw-mic-banner .aiw-mic-sub{display:block;margin-top:.4rem;
        color:#a6c79a;font-size:.78rem}
      .aiw-browser-warn{margin:0 0 .8rem;padding:.8rem .95rem;
        border:1px solid rgba(255,176,60,.5);background:rgba(255,176,60,.11);
        border-radius:11px;color:#f6e6cd;font-size:.87rem;line-height:1.5}
      .aiw-browser-warn strong{color:#ffc978}
      .aiw-browser-warn .aiw-warn-steps{display:block;margin-top:.45rem;
        color:#dcc6a3;font-size:.79rem}
      .aiw-copy-link{margin-top:.6rem;display:inline-block;padding:.42rem .8rem;
        border:1px solid rgba(255,176,60,.6);background:rgba(255,176,60,.16);
        color:#ffd79a;border-radius:8px;font-size:.8rem;cursor:pointer}`;
    const el = document.createElement('style');
    el.id = 'aiw-mic-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // Slim banner on the page itself, right under the hero "talk to Max" prompt.
  function injectMicNotice() {
    if (document.getElementById('aiw-mic-notice')) return;
    const anchor = document.querySelector('.hero-voice-prompt');
    if (!anchor) return;
    const bar = document.createElement('div');
    bar.id = 'aiw-mic-notice';
    bar.className = 'aiw-mic-notice';
    bar.innerHTML =
      '<span class="aiw-mic-ico" aria-hidden="true">🎙️</span>' +
      '<span>Max talks back by <strong>voice</strong>. When you start a chat, your browser ' +
      'will ask for your microphone — tap <strong>Allow</strong>, then just talk to him.</span>';
    anchor.insertAdjacentElement('afterend', bar);
  }

  // In-chat banner shown the moment a call starts, with a "blocked it?" recovery tip.
  function showMicBanner() {
    const msgs = $('aiw-messages');
    if (!msgs || document.getElementById('aiw-mic-banner')) return;
    const div = document.createElement('div');
    div.id = 'aiw-mic-banner';
    div.className = 'aiw-mic-banner';
    div.innerHTML =
      '🎙️ <strong>Allow microphone access</strong> when your browser asks — then just talk to Max.' +
      '<span class="aiw-mic-sub">Already blocked it? Click the 🔒 lock icon in the address bar → ' +
      'set <strong>Microphone</strong> to <strong>Allow</strong> → reload the page.</span>';
    msgs.appendChild(div);
    scrollMessages();
  }

  // ── IN-APP BROWSER GUARD ─────────────────────────────────────
  // Flyer QR codes get scanned from inside Instagram, Facebook, TikTok and
  // similar in-app browsers, and most of those webviews block or silently
  // fail getUserMedia. Max is the demo, so a dead mic on first contact loses
  // the sale outright. Detect it up front and route them to a real browser
  // instead of letting vapi.start() fail with a generic "hiccup" message.
  const WEBVIEWS = [
    [/Instagram/i,                      'Instagram'],
    [/FBAN|FBAV|FB_IAB|FBIOS/i,         'Facebook'],
    [/Messenger/i,                      'Messenger'],
    [/TikTok|BytedanceWebview|musical_ly/i, 'TikTok'],
    [/Snapchat/i,                       'Snapchat'],
    [/LinkedInApp/i,                    'LinkedIn'],
    [/Pinterest/i,                      'Pinterest'],
    [/WhatsApp/i,                       'WhatsApp'],
    [/Twitter/i,                        'X'],
    [/\bLine\//i,                       'LINE'],
  ];

  // Name of the host app, used only to WORD the advice — never to block.
  function webviewName() {
    const ua = navigator.userAgent || '';
    for (const [re, name] of WEBVIEWS) {
      if (re.test(ua)) return name;
    }
    if (/Android.*;\s*wv\)/i.test(ua)) return 'this app';
    return null;
  }

  // Returns null when voice should work, else a short reason string.
  //
  // We PROBE for the microphone instead of trusting the user agent. In-app
  // browsers differ by app version and platform and plenty of them do work —
  // blocking a visitor whose mic was fine is a worse failure than the one
  // we're fixing. A UA match alone never stops a call.
  async function micCheck() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return webviewName() || 'this browser';
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return null;
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) return null;
      return webviewName() || 'this browser';
    }
  }

  function showOpenInBrowserNotice(appName) {
    injectMicStyles();
    openWindow();
    const msgs = $('aiw-messages');
    if (!msgs || document.getElementById('aiw-browser-warn')) return;

    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
    const steps = isIOS
      ? 'Tap the <strong>•••</strong> (or share) button at the corner of this screen, then choose <strong>Open in Safari</strong>.'
      : 'Tap the <strong>⋮</strong> menu at the corner of this screen, then choose <strong>Open in browser</strong> (Chrome).';

    const div = document.createElement('div');
    div.id = 'aiw-browser-warn';
    div.className = 'aiw-browser-warn';
    div.innerHTML =
      '⚠️ <strong>' + escapeHTML(appName) + '’s built-in browser blocks the microphone</strong>, ' +
      'so I can’t hear you in here. Open this page in your real browser and I’ll talk you through everything.' +
      '<span class="aiw-warn-steps">' + steps + '</span>' +
      '<span class="aiw-copy-link" id="aiw-copy-link" role="button" tabindex="0">📋 Copy the link instead</span>';
    msgs.appendChild(div);

    const copy = $('aiw-copy-link');
    if (copy) {
      copy.addEventListener('click', () => {
        const url = window.location.href;
        const done = () => { copy.textContent = '✅ Link copied — paste it in Safari or Chrome'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(() => { copy.textContent = url; });
        } else {
          copy.textContent = url;
        }
      });
    }
    scrollMessages();
  }

  // ── VAPI VOICE (preferred engine) ────────────────────────────
  let vapi = null;
  let vapiActive = false;
  let vapiLoading = false;
  let vapiModPromise = null;

  // Kick off the SDK download once; safe to call repeatedly.
  function loadVapiMod() {
    if (!vapiModPromise) {
      vapiModPromise = import('https://cdn.jsdelivr.net/npm/@vapi-ai/web@2.5.2/+esm')
        .catch((err) => { vapiModPromise = null; throw err; });
    }
    return vapiModPromise;
  }

  async function startVapiCall() {
    if (vapiActive || vapiLoading) return;

    vapiLoading = true;
    setVoiceUI(true, 'Connecting to Max…');

    // Only bail if the mic genuinely can't be opened here (see micCheck).
    const blocker = await micCheck();
    if (blocker) {
      vapiLoading = false;
      setVoiceUI(false);
      showOpenInBrowserNotice(blocker);
      return;
    }

    showMicBanner();

    try {
      if (!vapi) {
        // Version pinned + interop-safe unwrap: jsDelivr's +esm build wraps the
        // class in a nested default ({ default: { default: VapiClass } }), so
        // `new mod.default()` throws "not a constructor" and the call dies
        // before the mic is ever requested.
        const mod = await loadVapiMod();
        const Vapi = (mod.default && mod.default.default) ? mod.default.default : mod.default;
        vapi = new Vapi(CONFIG.vapiPublicKey);

        vapi.on('call-start', () => {
          vapiActive = true;
          vapiLoading = false;
          setVoiceUI(true, '🎙️ Live — just talk');
        });

        vapi.on('call-end', () => {
          vapiActive = false;
          vapiLoading = false;
          setVoiceUI(false);
          // Do not create a fresh sales offer after Max has ended the call.
          // Any accepted price already produced its matching button in-chat.
          addBotMessage('Call ended. Thanks for talking with Max.', false);
        });

        vapi.on('message', (m) => {
          if (m.type === 'transcript' && m.transcriptType === 'final') {
            if (m.role === 'user') addUserMessage(m.transcript);
            else maxSaid(m.transcript);
          }
        });

        vapi.on('error', () => {
          vapiActive = false;
          vapiLoading = false;
          setVoiceUI(false);
          addBotMessage('⚠️ Voice connection hiccup. Tap the mic to reconnect, or type below.');
        });
      }

      await vapi.start(CONFIG.vapiAssistantId);
    } catch (err) {
      vapiActive = false;
      vapiLoading = false;
      setVoiceUI(false);
      addBotMessage('⚠️ Couldn\'t start the voice call. Tap the mic to retry, or type below.');
    }
  }

  function stopVapiCall() {
    if (vapi && (vapiActive || vapiLoading)) vapi.stop();
    vapiActive = false;
    vapiLoading = false;
    setVoiceUI(false);
  }

  let dealOffered = false;

  // ── PRICE / CLOSE DETECTION ──────────────────────────────────
  // Only treat a number as a price when it carries a $ sign, an explicit
  // "dollars", or nearby pricing language. Max reads real lookup_business
  // data aloud — phone numbers like "(803) 625-1400" and addresses like
  // "625 E Liberty St" both contain 625. A bare /625/ match fired the
  // discount button, latched dealOffered on permanently, and buried the
  // $1,250 offer for the rest of the call.
  const PRICE_625 = /\$\s?625\b|\b625\s*(?:dollars|bucks)\b|(?:setup|fee|price|cost|instead of|down to|reduce[sd]?(?: it)? to|only)\D{0,24}\b625\b|six\s*(?:hundred\s*)?(?:and\s*)?twenty[\s-]*five\s*(?:dollars|bucks)/i;
  // The word-based alternatives are phrases Max only uses when he's actually
  // presenting payment (the prompt scripts them), and none of them can appear
  // in lookup_business data. "get started" / "sign up" are deliberately absent:
  // Max says those during qualification, which fired the button on turn one.
  const PRICE_1250 = /\$\s?1,?250\b|\b1,?250\s*(?:dollars|bucks)\b|(?:setup|fee|price|cost|promotion|today)\D{0,24}\b1,?250\b|payment link|gold button|secure link|checkout/i;

  // The button that matches whatever offer is actually on the table.
  function ctaHTML() {
    return dealOffered
      ? `<div class="aiw-cta-group"><a href="${CONFIG.setupDealUrl}" class="aiw-cta-btn aiw-cta-btn--amber" target="_blank" rel="noopener">🔒 Start Implementation — $625 (today only)</a></div>`
      : `<div class="aiw-cta-group"><a href="${CONFIG.setupPromoUrl}" class="aiw-cta-btn aiw-cta-btn--amber" target="_blank" rel="noopener">🤖 Start Implementation — $1,250 (reg. $2,500)</a></div>`;
  }

  // Render Max's spoken words in the chat, and surface the right
  // payment button when he quotes a price.
  function maxSaid(text) {
    if (PRICE_625.test(text)) dealOffered = true;
    const showCTA = dealOffered || PRICE_1250.test(text);
    addBotMessageHTML(formatText(text) + (showCTA ? ctaHTML() : ''));
  }

  function setVoiceUI(live, label) {
    const btn = $('aiw-voice-btn');
    if (btn) btn.classList.toggle('listening', !!live);
    const input = $('aiw-input');
    if (input) input.placeholder = live ? (label || '🎙️ Live — just talk') : 'Type or speak...';
  }

  function bindEvents() {
    const fab    = $('aiw-fab');
    const teaser = $('aiw-teaser');
    const send   = $('aiw-send');
    const input  = $('aiw-input');
    const voice  = $('aiw-voice-btn');

    if (fab)    fab.addEventListener('click', toggleWindow);
    if (teaser) teaser.addEventListener('click', toggleWindow);
    if (send)   send.addEventListener('click', sendMessage);
    if (voice)  voice.addEventListener('click', toggleVoice);

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      input.addEventListener('input', () => autoResize(input));
    }
  }

  // ── WINDOW TOGGLE ────────────────────────────────────────────
  function toggleWindow() {
    isOpen = !isOpen;
    const win = $('aiw-window');
    const fab = $('aiw-fab');
    const tsr = $('aiw-teaser');

    if (win) win.classList.toggle('open', isOpen);
    if (fab) fab.classList.toggle('open', isOpen);
    if (tsr && isOpen) tsr.classList.add('hidden');

    if (isOpen && !apiKey) {
      // Show setup screen — key already visible
    }
  }

  function openWindow() {
    if (!isOpen) toggleWindow();
  }

  // ── TEASER / AUTO-OPEN ───────────────────────────────────────
  function scheduleTeaserHide() {
    setTimeout(() => {
      const tsr = $('aiw-teaser');
      if (tsr && !isOpen) {
        tsr.style.transition = 'opacity 0.5s';
        tsr.style.opacity = '0';
        setTimeout(() => tsr.classList.add('hidden'), 500);
      }
    }, CONFIG.teaserHide);
  }

  // ── API KEY SETUP ─────────────────────────────────────────────
  window.aiwStartBot = function () {
    const keyInput = $('aiw-api-key');
    if (!keyInput) return;
    const key = keyInput.value.trim();

    if (!key.startsWith('sk-ant')) {
      keyInput.style.borderColor = 'var(--clr-danger)';
      return;
    }

    apiKey = key;
    const setup = $('aiw-setup');
    const chat  = $('aiw-chat');

    if (setup) setup.style.display = 'none';
    if (chat)  { chat.style.display = 'flex'; }

    // Auto-greet
    setTimeout(() => {
      addBotMessage(
        `Hey there! I'm Max — I help small businesses put AI to work, so you stop missing calls and start closing more customers.\n\nWhat kind of business do you run?`
      );
      showQuickReplies(QUICK_REPLIES[0]);
    }, 400);

    // Auto-speak greeting if voice available
    if ('speechSynthesis' in window) {
      setTimeout(() => {
        speak(`Hey there! I'm Max. I help small businesses put AI to work. What kind of business do you run?`);
      }, 800);
    }
  };

  // ── SEND MESSAGE ─────────────────────────────────────────────
  function sendMessage() {
    const input = $('aiw-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    input.style.height = 'auto';
    clearQuickReplies();
    sendText(text);
  }

  async function sendText(text) {
    // During a live Vapi call, typed messages go into the call.
    if (vapiActive && vapi) {
      addUserMessage(text);
      try {
        vapi.send({ type: 'add-message', message: { role: 'user', content: text } });
      } catch (err) { /* non-fatal */ }
      return;
    }

    if (!apiKey) {
      if (vapiConfigured()) { startVapiCall(); return; }
      openWindow();
      return;
    }

    addUserMessage(text);
    messages.push({ role: 'user', content: text });

    showTyping();
    isTyping = true;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-api-key':     apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      CONFIG.apiModel,
          max_tokens: CONFIG.maxTokens,
          system:     SYSTEM_PROMPT,
          messages:   messages,
        }),
      });

      const data = await res.json();
      hideTyping();
      isTyping = false;

      if (data.error) {
        addBotMessage('⚠️ ' + data.error.message);
        return;
      }

      const reply = data.content[0].text;
      messages.push({ role: 'assistant', content: reply });

      const showCTA = messages.length >= 6 ||
        /price|cost|buy|ready|sign up|start|demo|trial|interested/i.test(text);

      addBotMessage(reply, showCTA);

      // Speak the reply; in voice mode, reopen the mic when done speaking
      // so the conversation flows hands-free.
      speak(reply, () => {
        if (voiceMode && isOpen && !isTyping) startListening();
      });

      qrSet = (qrSet + 1) % QUICK_REPLIES.length;
      setTimeout(() => showQuickReplies(QUICK_REPLIES[qrSet]), 700);

    } catch (err) {
      hideTyping();
      isTyping = false;
      addBotMessage('⚠️ Connection issue. Check your API key or network and try again.');
    }
  }

  // ── MESSAGE RENDERING ─────────────────────────────────────────
  function addBotMessage(text, withCTA = false) {
    const msgs = $('aiw-messages');
    if (!msgs) return;

    const div = document.createElement('div');
    div.className = 'aiw-msg bot';

    const formatted = formatText(text);

    // Follow the live offer state — a prospect Max just closed at $625 must
    // not be handed a $1,250 button on the way out.
    const cta = withCTA ? ctaHTML() : '';

    div.innerHTML = `
      <div class="aiw-mini-avatar">⚙</div>
      <div class="aiw-bubble">${formatted}${cta}</div>`;

    msgs.appendChild(div);
    scrollMessages();
  }

  // Bot bubble from pre-built HTML (used for Vapi transcripts + CTAs).
  function addBotMessageHTML(html) {
    const msgs = $('aiw-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'aiw-msg bot';
    div.innerHTML = `
      <div class="aiw-mini-avatar">⚙</div>
      <div class="aiw-bubble">${html}</div>`;
    msgs.appendChild(div);
    scrollMessages();
  }

  function addUserMessage(text) {
    const msgs = $('aiw-messages');
    if (!msgs) return;

    const div = document.createElement('div');
    div.className = 'aiw-msg user';
    div.innerHTML = `<div class="aiw-bubble">${escapeHTML(text)}</div>`;
    msgs.appendChild(div);
    scrollMessages();
  }

  function showTyping() {
    const msgs = $('aiw-messages');
    if (!msgs) return;

    const div = document.createElement('div');
    div.id = 'aiw-typing';
    div.className = 'aiw-msg bot';
    div.innerHTML = `
      <div class="aiw-mini-avatar">⚙</div>
      <div class="aiw-bubble">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>`;
    msgs.appendChild(div);
    scrollMessages();
  }

  function hideTyping() {
    const el = $('aiw-typing');
    if (el) el.remove();
  }

  function scrollMessages() {
    const msgs = $('aiw-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  // ── QUICK REPLIES ─────────────────────────────────────────────
  function showQuickReplies(replies) {
    const container = $('aiw-quick-replies');
    if (!container) return;
    container.innerHTML = '';

    replies.forEach((r) => {
      const btn = document.createElement('button');
      btn.className = 'aiw-qr';
      btn.textContent = r;
      btn.addEventListener('click', () => {
        clearQuickReplies();
        sendText(r);
      });
      container.appendChild(btn);
    });
  }

  function clearQuickReplies() {
    const container = $('aiw-quick-replies');
    if (container) container.innerHTML = '';
  }

  // ── VOICE INPUT ───────────────────────────────────────────────
  function toggleVoice() {
    if (vapiConfigured()) {
      // Vapi mode: mic button starts/ends the live call.
      if (vapiActive || vapiLoading) stopVapiCall();
      else startVapiCall();
      return;
    }

    if (isListening) {
      voiceMode = false;            // user manually stopped — break the loop
      if (recognition) recognition.stop();
      return;
    }
    voiceMode = true;               // user opted into voice — keep the loop going
    startListening();
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addBotMessage('Voice input isn\'t supported in this browser — type your question instead!');
      voiceMode = false;
      return;
    }

    if (isListening) return;

    const btn = $('aiw-voice-btn');

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      if (btn) btn.classList.add('listening');
      const overlay = $('aiw-voice-overlay');
      if (overlay) overlay.classList.add('active');
      const input = $('aiw-input');
      if (input) input.placeholder = '🎙️ Listening...';
    };

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const input = $('aiw-input');
      if (input) input.value = transcript;
      sendMessage();
    };

    recognition.onend = () => {
      isListening = false;
      if (btn) btn.classList.remove('listening');
      const overlay = $('aiw-voice-overlay');
      if (overlay) overlay.classList.remove('active');
      const input = $('aiw-input');
      if (input) input.placeholder = 'Type or speak...';
    };

    recognition.onerror = recognition.onend;
    recognition.start();
  }

  window.aiwDismissVoice = function () {
    voiceMode = false;
    const overlay = $('aiw-voice-overlay');
    if (overlay) overlay.classList.remove('active');
    if (recognition) recognition.stop();
  };

  // ── SPEECH SYNTHESIS ──────────────────────────────────────────
  function speak(text, onDone) {
    if (!('speechSynthesis' in window)) {
      if (onDone) onDone();
      return;
    }
    window.speechSynthesis.cancel();

    // Strip markdown and URLs for speech
    const clean = text
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/\n/g, ' ')
      .substring(0, 400);

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate   = 1.05;
    utter.pitch  = 1.0;
    utter.volume = 0.9;

    // Pick a decent voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      /Google US English|Microsoft David|Alex|Samantha/i.test(v.name)
    );
    if (preferred) utter.voice = preferred;

    // Fire onDone exactly once — utter.onend is flaky on some phones,
    // so a duration-based fallback timer backs it up.
    let fired = false;
    const done = () => {
      if (fired) return;
      fired = true;
      if (onDone) onDone();
    };
    utter.onend = done;
    utter.onerror = done;
    const estMs = Math.min(2000 + clean.length * 65, 30000);
    setTimeout(done, estMs);

    window.speechSynthesis.speak(utter);
  }

  // ── HELPERS ───────────────────────────────────────────────────
  function formatText(text) {
    return text
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[^"=])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,     '<em>$1</em>')
      .replace(/\n/g,            '<br>');
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
  }

  // ── PUBLIC API ────────────────────────────────────────────────
  window.aiwSendText = sendText;
  window.aiwToggle   = toggleWindow;

  // ── START ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
