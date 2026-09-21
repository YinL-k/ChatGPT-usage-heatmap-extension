[English](README_en.md) | [中文](README.md)

# GPT Tracker – Usage Heatmap + Usage Dashboard

A local-first Chrome extension that keeps the original ChatGPT activity heatmap and adds membership detection, a local Pro Chat allowance estimate, and usage meters exposed by ChatGPT Web.

## v2.1

### Membership selector
The popup supports Auto-detect, Free, Go, Plus, Pro $100 / 5x, Pro $200 / 20x, Business Standard, Business Premium, Enterprise, and Edu. Auto-detection uses current ChatGPT plan/seat signals, with manual override as a fallback.

### Pro Chat
ChatGPT does not normally expose a stable remaining-message counter for Pro Chat. The extension therefore observes successful conversation requests, records only model/reasoning metadata locally, and estimates the remaining allowance. These cards are explicitly labeled `local`.

Current presets:
- Pro $100 / 5x: 50 shared Pro messages / 7 days
- Pro $200 / 20x: GPT-6 Pro 200 / 7 days; GPT-5.6 Sol Pro 170 / 24h; all Pro combined 200 / 24h
- Business Standard: 15 shared Pro messages / 30 days
- Business Premium: 50 shared Pro messages / 7 days
- Enterprise / Edu: no generic fixed cap is assumed

Pre-v2.1 history has no model metadata and cannot be retroactively classified as Pro. Use **Reset local Pro count** for a clean starting point.

### Server-side usage meters
From an already signed-in ChatGPT tab, the extension performs read-only requests and persists only sanitized quota values:

- `POST /backend-api/conversation/init`: feature `limits_progress`, potentially Deep Research, Image Generation, File Upload, etc.
- `GET /backend-api/wham/usage`: Work/Codex windows, used percentage, reset time, credits, and plan type
- `GET /backend-api/wham/tasks/rate_limit`
- `GET /codex/settings/usage`
- `GET /backend-api/accounts/check/v4-2023-04-27`: plan/seat signals only

These are internal ChatGPT Web endpoints, not a stable public API, and can change without notice. The extension fails closed and never bypasses authentication or security controls.

### More accurate activity tracking
v2.1 observes actual ChatGPT conversation requests and increments activity only after a successful response. Send-button submissions are counted too. Prompt and response text are never stored.

## Existing features
- GitHub-style yearly heatmap
- Today / week / month / total activity
- Daily activity trends
- JSON import/export
- Dark mode

## Privacy
- No prompt or response content is stored
- Cookies, access tokens, email addresses, and account IDs are not persisted
- Usage reads only contact ChatGPT first-party endpoints
- No developer backend and no telemetry upload
- Local data lives in `chrome.storage.local`

## Installation
1. Download the repository.
2. Open `chrome://extensions/`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the project directory.
6. After updating to v2.1, reload any already-open ChatGPT tab once.

## License
MIT License.
