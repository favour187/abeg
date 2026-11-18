# Abeg

Speak am. We write am. Code check am.

Talk to your phone the way you actually talk — Naija English, pidgin, Yorùbá, Igbo, Hausa, or any of ten languages — and Abeg turns the breath into tasks with owners, deadlines, money and done-markers. Then code re-checks every single task against your exact words before it is allowed to wear a verified badge.

## The rule the app lives by

A claim without its quote is not a task. Every line Abeg shows you carries the exact substring of your speech that proves it. If the AI returns a task whose quote does not appear word-for-word in your transcript, it is flagged **unverified** and shown dimmed. If the pidgin grammar engine finds the same task independently, it wears an **AI + grammar agree** badge.

## Three layers, in order of trust

1. **Your browser's ear.** Speech-to-text happens on device via the Web Speech API. No audio ever leaves your phone through Abeg.
2. **Free keyless AI.** The transcript goes to a free OpenAI-compatible endpoint (or your own Grok / OpenAI key under ⚙ AI) to understand any language.
3. **Deterministic pidgin grammar engine.** Runs always, offline, with zero keys. It understands `make I...`, `tell Ada to...`, `X go buy...`, `X don pay` (done), `no forget to...`, `make we...`, vocative `o`, naira amounts, and day/time deadlines. Its self-test score (22 pidgin sentences) is displayed in the app at all times.

If layer 2 dies, layer 3 carries the app alone and tells you so.

## Provability

- Grammar self-test badge: sentences in, expected owners/deadlines/done-markers out, score on screen.
- Per-task quote disclosure: "the exact words".
- Date-clash detection when one breath gives two deadlines for the same task.
- Digest counts computed live: tasks heard, open, done, due today, no owner, clashes, unverified.

## Run it

No build step, no dependencies.

```
python3 -m http.server 3000
```

Open http://localhost:3000, tap the mic (Chrome on Android speaks all ten languages), or type. Tasks persist in this browser only. Export deadlines as `.ics`, copy the digest back into your group chat.

## Accessibility

Easy read, high contrast, larger text, reduced motion — four toggles always visible. Keyboard-only usable throughout.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | Design and the four accessibility modes |
| `understand.js` | Pidgin grammar engine, deadline resolver, verifier, self-test runner |
| `data.js` | Languages, demo speech, 22-sentence self-test set |
| `app.js` | Mic, free-AI layer, rendering, exports |
| `functions/ai-proxy.js` | Optional edge relay used only if a provider blocks browser calls. Allowlisted hosts, stores nothing |

## Built for

Teens Hack Houston (TripleH) 2026 — theme: productivity.

## Licence

MIT
