# GPT Tracker 3.5.0 — Privacy

Activity is stored on this browser profile. There is no developer backend or telemetry.

Stored fields: daily counts and timestamps, a SHA-256 identifier derived from the page message ID, observed model labels, local plan/calibration settings, normalized usage percentages/window/reset/credit metadata and sanitized error status/time/failure count. Existing historical fields are retained for compatibility.

The composer and a newly displayed user message are briefly compared in RAM to confirm a local send. Their text is never sent to the extension background, persisted, exported or logged. Pending comparisons expire after approximately 20 seconds.

Authentication: automatic page polling may read the existing ChatGPT session token from page bootstrap data. UI refresh renews it with GET `/api/auth/session`. If the page bridge is missing or unavailable, the service worker may perform the same read-only session and usage requests using the existing ChatGPT host permission and browser session cookies. The token remains in request-local memory and is used only for GET `https://chatgpt.com/backend-api/wham/usage`. It is never stored, logged, exported or sent to third parties. Redirects are rejected.

The extension does not initiate chat submissions, conversation creation, model generation, POST requests, or Pro model calls. It does not store passwords, cookies, raw account IDs, email addresses, or chat bodies. Activity exports contain only date-key counts and timestamps plus format metadata.

The extension is unofficial. Private usage endpoints and page markup may change. Fixture tests do not establish current real-account compatibility.

## Dashboard surface: public global reset forecast

Opening the Overview dashboard requests `https://codex-reset.com/api/forecast` with GET, `credentials: omit`, `referrerPolicy: no-referrer`, and rejected redirects. It sends no account identifiers, tokens, cookies, chat text or local activity. The third-party server receives ordinary connection metadata such as the IP address. This is an independent experimental forecast, not an OpenAI account endpoint.

The dashboard caches only selected public forecast fields (probabilities, timestamps, confidence, signal category/source link) and retry state in extension-page localStorage under `gptTrackerResetForecastV1`. This cache is not part of activity exports. No new extension permission or remote code is introduced. Polling runs only while Overview is visible and stops when it is hidden or closed.
