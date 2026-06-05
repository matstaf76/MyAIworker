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
    bookDemoUrl:  '#contact',
    buySetupUrl:  '#buy-setup',
    buyReceptUrl: '#buy-receptionist',
    buyBusyUrl:   '#buy-busybiz',
    teaserDelay:  2000,
    teaserHide:   9000,
    autoOpenDelay: 3500,
    autoGreet:    true,
  };

  const SYSTEM_PROMPT = `You are Max, a confident, straight-talking AI sales guide for ${CONFIG.companyName} — a company that builds and deploys AI workers (voice assistants, receptionists, and chat bots) for small businesses.

Your job: understand the visitor's business, connect their pain points to our solutions, and guide them toward a purchase or demo booking.

## Our Products

**1. Claude Voice Chat Setup** — $350 one-time
- We install and configure a voice + chat AI bot on their website
- Handles FAQs, captures leads, books appointments
- Support available at $95/hr after setup

**2. AI Receptionist** (Full Suite) — $350/month
- 24/7 AI voice receptionist answers calls
- AI sales chat assistant on their website
- Dedicated local + toll-free phone numbers
- Full CRM platform access
- Books appointments, captures leads, handles FAQs
- Was $500/month — savings passed to customers

**3. Busy Business AI** — $1,000/month
- Everything in AI Receptionist PLUS:
- Handles heavy call/order volume (great for restaurants, salons, multi-location businesses)
- Manages multiple employee calendars and schedules
- Takes to-go orders and reservations by phone and chat
- Perfect for restaurants, busy service businesses, or businesses with 2+ staff calendars

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

Always end with something actionable. Never leave them hanging.`;

  // ── STATE ───────────────────────────────────────────────────
  let apiKey      = '';
  let messages    = [];
  let isOpen      = false;
  let isTyping    = false;
  let recognition = null;
  let isListening = false;
  let qrSet       = 0;

  const QUICK_REPLIES = [
    ['What can an AI receptionist do?', 'Tell me about pricing', 'How fast can I get set up?'],
    ['I run a restaurant', 'I have a service business', 'I run a medical / law office'],
    ['Do you offer a free trial?', 'What\'s the ROI?', 'Can it handle calls after hours?'],
  ];

  // ── DOM REFS ─────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── INIT ─────────────────────────────────────────────────────
  function init() {
    bindEvents();
    scheduleTeaserHide();
    if (CONFIG.autoGreet) scheduleAutoOpen();
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

  function scheduleAutoOpen() {
    setTimeout(() => {
      if (!isOpen) openWindow();
    }, CONFIG.autoOpenDelay);
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
    if (!apiKey) { openWindow(); return; }

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

      if ('speechSynthesis' in window) speak(reply);

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
          <a href="${CONFIG.buyReceptUrl}" class="aiw-cta-btn aiw-cta-btn--amber">🤖 Get AI Receptionist — $350/mo</a>
          <a href="${CONFIG.bookDemoUrl}" class="aiw-cta-btn aiw-cta-btn--outline">📅 Book a Free Demo First</a>
        </div>`;
    }

    div.innerHTML = `
      <div class="aiw-mini-avatar">⚙</div>
      <div class="aiw-bubble">${formatted}${ctaHTML}</div>`;

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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addBotMessage('Voice input works in Chrome or Edge. Try typing instead!');
      return;
    }

    const btn = $('aiw-voice-btn');

    if (isListening) {
      if (recognition) recognition.stop();
      return;
    }

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
    const overlay = $('aiw-voice-overlay');
    if (overlay) overlay.classList.remove('active');
    if (recognition) recognition.stop();
  };

  // ── SPEECH SYNTHESIS ──────────────────────────────────────────
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    // Strip markdown and limit length for speech
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/\n/g, ' ')
      .substring(0, 300);

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

    window.speechSynthesis.speak(utter);
  }

  // ── AUTO PAGE LOAD GREETING (VOICE) ──────────────────────────
  // Triggered once on first user interaction to comply with autoplay policy
  let greetedByVoice = false;
  function tryVoiceGreet() {
    if (greetedByVoice) return;
    greetedByVoice = true;
    speak("Hey there! I'm Max, your AI worker guide. Click the chat button and let's find the right AI solution for your business.");
  }

  document.addEventListener('click', tryVoiceGreet, { once: true });
  document.addEventListener('touchstart', tryVoiceGreet, { once: true });
  document.addEventListener('scroll', tryVoiceGreet, { once: true });

  // ── HELPERS ───────────────────────────────────────────────────
  function formatText(text) {
    return text
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
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
