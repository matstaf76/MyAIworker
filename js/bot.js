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
    bookDemoUrl:  '#contact',
    setupPromoUrl: 'https://buy.stripe.com/eVq4gA6y2cdJ1VP0EH1kA0a',  // $1,250 setup
    setupDealUrl:  'https://buy.stripe.com/fZu00k2hM3Hdaslafh1kA0b',  // $625 closer deal
    teaserDelay:  2000,
    teaserHide:   9000,
  };

  const GREETING_TEXT = "Hey, I'm Max — the AI receptionist you just read about on the flyer. You're talking to the actual product right now. Tap the mic and tell me what kind of business you run — talk to me, don't type!";

  const SYSTEM_PROMPT = `You are Max, a confident, straight-talking AI sales guide for ${CONFIG.companyName} — a company that builds and deploys AI workers (voice assistants, receptionists, and chat bots) for small businesses.

Your job: understand the visitor's business, connect their pain points to our solutions, and guide them toward a purchase or demo booking.

## Our Products

**1. AI Receptionist** (Full Suite) — $500/month + one-time setup fee
- 24/7 AI voice receptionist answers calls
- AI sales chat assistant on their website
- Dedicated local + toll-free phone numbers
- Full CRM platform access
- Books appointments, captures leads, handles FAQs

**2. Busy Business AI** — $1,000/month + one-time setup fee
- Everything in AI Receptionist PLUS:
- Handles heavy call/order volume (great for restaurants, salons, multi-location businesses)
- Manages multiple employee calendars and schedules
- Takes to-go orders and reservations by phone and chat
- Perfect for restaurants, busy service businesses, or businesses with 2+ staff calendars

## Setup Fee & Pricing Rules
- The setup fee is normally **$2,500**. It is currently **$1,250** under a limited promotion (50% off).
- Setup covers building, configuring, and deploying their AI worker. The monthly fee starts only when their AI goes live.
- Payment link for the $1,250 setup: ${CONFIG.setupPromoUrl}
- Share the payment link as a plain URL when someone is ready to buy.

## The Case-Study Deal (IMPORTANT — read carefully)
You are authorized to offer ONE deeper discount: setup at **$625** instead of $1,250.
Strict rules:
- NEVER mention this deal exists until the conditions below are met. Never open with it.
- Only offer it after a real conversation: at least 5-6 back-and-forth exchanges where you've learned their business type, probed their pain points, and they're showing buying interest OR hesitating on price.
- Frame it exactly like this: "Because you came through this promotion and we're still building case studies in your area, I can reduce the setup fee from $1,250 to $625 if you move forward today."
- It is a today-only offer. Offer it once, confidently. Don't beg, don't repeat it more than twice, don't apologize for it.
- Payment link for the $625 deal: ${CONFIG.setupDealUrl} — only share this link when making this offer.

## Conversation Style
- Be direct and conversational — no fluff, no hype
- Ask ONE question at a time to understand their situation
- Keep responses to 2-4 sentences max unless explaining a product
- Lead with value, not features
- After 3-4 exchanges naturally introduce booking a demo or buying

## Key Pain Points to Probe
- Are they missing calls after hours?
- Do they spend time answering the same questions repeatedly?
- Is scheduling/booking eating up staff time?
- Are they losing customers to competitors who respond faster?

## When They Seem Ready
Offer a clear next step: demo booking OR direct purchase. Don't waffle — give them the choice and let them decide.

Always end with something actionable. Never leave them hanging.

## Visitor Context
Virtually every visitor scanned the QR code on our flyer ("AI Receptionist Setup — Normally $2,500, Today $1,250") and came here specifically to talk to you. YOU are the product demo — every second they talk to you, they're experiencing exactly what their own customers would get. Lean into that. They are prime candidates for the case-study deal once the engagement conditions are met.

## Voice Rules (CRITICAL)
Your replies are spoken aloud through the phone speaker. Therefore:
- Keep every reply SHORT: 1-3 spoken sentences. No exceptions.
- NO markdown, NO bullet points, NO emojis, NO headers — plain spoken English only.
- When sharing a payment link, say "I'm putting the secure payment link in the chat right now" and put the bare URL on its own line at the end of your reply.`;

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
    ['Do you offer a free trial?', 'What\'s the ROI?', 'Can it handle calls after hours?'],
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
    if (flyerStarted) return;        // touchend + click can both fire — run once
    flyerStarted = true;
    if (e) e.preventDefault();

    const ov = $('aiw-intro');
    if (ov) {
      ov.classList.add('aiw-intro-out');
      setTimeout(() => ov.remove(), 450);
    }

    openWindow();

    if (vapiConfigured()) {
      // Vapi mode: the assistant's firstMessage is the greeting.
      startVapiCall();
      return;
    }

    // Fallback mode: browser TTS + speech recognition.
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
        color:#a6c79a;font-size:.78rem}`;
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
          addBotMessage('Call ended. Tap the mic to talk to me again — or use the buttons below.', true);
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

  // Render Max's spoken words in the chat, and surface the right
  // payment button when he quotes a price.
  function maxSaid(text) {
    let cta = '';
    if (/625/.test(text)) {
      cta = `<div class="aiw-cta-group"><a href="${CONFIG.setupDealUrl}" class="aiw-cta-btn aiw-cta-btn--amber" target="_blank" rel="noopener">🔒 Claim It — $625 Setup (today only)</a></div>`;
    } else if (/1,?250|payment link|sign up|get started/i.test(text)) {
      cta = `<div class="aiw-cta-group"><a href="${CONFIG.setupPromoUrl}" class="aiw-cta-btn aiw-cta-btn--amber" target="_blank" rel="noopener">🤖 Start Setup — $1,250 (reg. $2,500)</a></div>`;
    }
    addBotMessageHTML(formatText(text) + cta);
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

    let ctaHTML = '';
    if (withCTA) {
      ctaHTML = `
        <div class="aiw-cta-group">
          <a href="${CONFIG.setupPromoUrl}" class="aiw-cta-btn aiw-cta-btn--amber" target="_blank" rel="noopener">🤖 Start Setup — $1,250 (reg. $2,500)</a>
          <a href="${CONFIG.bookDemoUrl}" class="aiw-cta-btn aiw-cta-btn--outline">📅 Book a Free Demo First</a>
        </div>`;
    }

    div.innerHTML = `
      <div class="aiw-mini-avatar">⚙</div>
      <div class="aiw-bubble">${formatted}${ctaHTML}</div>`;

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
