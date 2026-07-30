# Max — Vapi Assistant Setup (copy-paste guide)

Create the assistant at **dashboard.vapi.ai → Assistants → Create Assistant** (blank template), then copy each section below into the matching field.

---

## 1. First Message

```
Hey, I'm Max — the AI receptionist you just read about on the flyer. You're talking to the actual product right now. So tell me — what kind of business do you run?
```

## 2. System Prompt (Model → System Message)

⚠️ **Do not copy a prompt from this file.** An outdated copy used to live here and it
contradicted the live agent (it told Max to offer "booking a demo," which the live
prompt forbids). Prompts are maintained in exactly two places now:

| Copy | Location | Used by |
|---|---|---|
| **Canonical** | `vapi-max-system-prompt.txt` | Vapi assistant (dashboard → Max → Model → System Message) |
| **Fallback** | `js/bot.js` → `SYSTEM_PROMPT` (~line 36) | Anthropic text-chat path, only when `CONFIG.apiKey` is set |

**These two must be kept in sync.** They intentionally differ in only one respect: the
fallback copy omits the `lookup_business` tool section, because no tool is available on
that path. Everything else — pricing, activation-fee rules, value framing, the $625
floor, qualify-out rules, medical/law handoff — should match word for word.

Last synced: 2026-07-29 (canonical 11,670 chars).
Pre-change backup: `vapi-max-system-prompt-v1-BACKUP-2026-07-29.txt`

## 3. Recommended Settings

| Setting | Value |
|---|---|
| Model | Claude (Anthropic) or GPT-4o — temperature 0.7, max tokens ~150 |
| Voice | ElevenLabs (included in Vapi — no separate account needed). Pick a confident male US voice, e.g. "Harry" or browse and preview |
| Transcriber | Deepgram Nova (default) — best accuracy/latency |
| First message mode | Assistant speaks first |
| Max call duration | 600 seconds (10 min) — protects your credits |
| Silence timeout | ~30 seconds |

## 4. Final Wiring

1. Save the assistant, copy its **Assistant ID**.
2. Open `js/bot.js`, paste the ID into `vapiAssistantId: ''` (line ~20). The public key is already in place.
3. Commit + push. Done — the site tap-to-talk overlay starts a live Vapi call with Max.

## 5. Tools attached to Max

| Tool | ID | Type | Purpose |
|---|---|---|---|
| `lookup_business` | inline on the assistant | function | Google lookup of the caller's business |
| `handoff_to_riley` | `05e5f0a4-580d-4474-8cf7-3be6925a8d5b` | handoff | Routes medical/dental/law callers to Riley (`ec057da0-5b36-41e2-b0b5-0fefdee886c8`) |

Attached 2026-07-29. **Heads-up:** the assistant-level **Tools tab in the Vapi dashboard
hangs on a loading skeleton and never renders.** It cannot be used to attach tools. Use
the API instead — `PATCH https://api.vapi.ai/assistant/{id}` with
`{"model": {...existing model..., "toolIds": ["..."]}}`. Send the *whole* model object;
a partial model will drop the inline `lookup_business` tool.

Note also that the dashboard's prompt editor hangs on bulk programmatic typing. Set the
textarea via the native value setter plus an `input` event, or just paste manually.

### Handoff behavior
The handoff passes **all messages** to Riley, so Max must establish the caller's industry
*before* discussing price — otherwise a dentist arrives at Riley already anchored on
$1,250 or $625, neither of which Riley is permitted to honor. Riley's prompt enforces
**no setup discounts, ever** for medical and law (setup is at cost: $1,500 legal or $600
medical compliance, plus $530+ activation).

## Notes
- **Never** put the **private** key in any website file — only the public key (already done).
- Each web call burns Vapi credits — the 10-minute cap and silence timeout keep tire-kickers from draining the account.
- Typed messages during a live call are sent into the call; Max answers by voice.
- When Max says "$1,250" or "$625", the matching Stripe payment button automatically appears in the chat window.
