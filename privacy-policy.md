# Privacy Policy

This extension tracks ChatGPT usage frequency and displays available usage limits for the currently signed-in ChatGPT account.

## Data Collection
- The extension records successful message-submission events: timestamp, selected model identifier when available, and reasoning mode when available.
- It does **not** collect or store prompt text, response text, passwords, cookies, access tokens, email addresses, or ChatGPT account IDs.
- For usage limits, it makes read-only requests to ChatGPT first-party endpoints from the already signed-in page. Only normalized quota values, reset times, and non-identifying plan signals are passed to extension storage.

## Data Storage
- Usage history, the selected membership preset, and normalized quota snapshots are stored locally in `chrome.storage.local`.
- The extension has no developer-operated server and sends no analytics or telemetry to the developer.

## Network Access
- Requests are limited to ChatGPT first-party origins and reuse the user's existing ChatGPT session.
- Internal ChatGPT endpoints can change without notice. If a read fails, the extension keeps cached values and does not bypass authentication or security controls.

## Data Sharing
The extension does not sell, transfer, or share user data with third parties.

## Contact
yinling3039@gmail.com
