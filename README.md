# Dayline

**One conversation. Everything organised.**

Dayline is a multilingual productivity workspace. Users can type or speak naturally, and the app organises the conversation into:

- **Tasks** — action items, owners, due dates and progress.
- **Email drafts** — editable subject lines and message bodies for review; copy them when ready. Dayline does not send them.
- **Calendar events** — suggested events with an `.ics` export.
- **Business desk** — lightweight job, expense and invoice records.

## What makes it different

Dayline uses the conversation as the starting point. Users do not choose a language first: the AI detects the language from the text and is instructed to keep generated content in that language. Each generated item includes an exact source quote. The app checks whether that quote exists in the original text and flags unmatched evidence.

A matching quote is evidence that the words appeared in the conversation; it is **not** proof that the AI interpreted them correctly. The server also drops generated items whose quote is not an exact substring of the submitted text. Users must review suggestions before acting on them.

## AI

The server endpoint uses Google's Gemini API with structured JSON output. The default model is `gemini-3.5-flash-lite`. Model availability and free-tier limits can change.

For Cloudflare Pages, add `GEMINI_API_KEY` as an environment variable. For local testing, a user may enter a Gemini key in Settings; it is kept in page memory only and is not written to local storage. Never commit an API key to the repository or expose a shared key in client-side code.

## Voice and language support

- Typed input is sent to Gemini for language detection and extraction.
- Voice capture uses the browser's Web Speech API and its current browser language setting. Browser speech recognition language coverage and accuracy vary; typing is the fallback.
- Do not claim every language or dialect is equally supported. Test each target language with native speakers before describing it as supported.

## Quality checks

Run `npm run check` to syntax-check the browser scripts and Cloudflare Pages Function with Node.js 22 or newer. A GitHub Actions workflow runs this check on pushes and pull requests.

## Run locally

This project uses Cloudflare Pages Functions for the AI endpoint. Install Wrangler, set a local secret with `wrangler pages secret put GEMINI_API_KEY`, then run `npx wrangler pages dev .`. Without the server secret, enter a Gemini key in Settings for a local test session.

## Hackathon scope

Built for Teens Hack Houston (Triple H) 2026 — productivity theme. The demo should show one conversation generating multiple useful outputs, then show the user reviewing and exporting them.

## Privacy and safety notes

- Voice recognition is handled by the browser's speech service; browser vendors may have their own processing practices.
- Text submitted for AI processing is sent to Google's Gemini API. Google's free tier may use submitted content to improve its products; do not enter sensitive or confidential information.
- Email drafts are not sent automatically.
- Calendar events are not added to an account automatically; users export an `.ics` file.
- Business records are local to the current page session in this MVP. No cloud sync or accounting compliance is claimed.
