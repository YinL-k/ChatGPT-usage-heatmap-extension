# GPT Tracker 3.5.0 — Data semantics and inherited references

This build preserves the numeric plan presets from the supplied 3.4.0.22 source. They were not revalidated against current commercial entitlements in this task. The account UI/contract takes precedence. The reference dates and source links in the original source are historical metadata, not a new verification claim.

No generic Pro price tier or unknown Business seat is inferred. A missing numeric field never means zero or unlimited. Remaining Pro messages require a user-entered calibration and are explicitly estimates; expired baselines become unavailable rather than resetting automatically.

Codex usage is parsed from `/backend-api/wham/usage`. Percentages are percentage points, so `used_percent: 1` means one percent used. Window durations are taken from `limit_window_seconds`. Primary and secondary are identifiers, not promises about duration. Credits represent only the returned balance.

Only the session and usage GET endpoints are called. Legacy `resolveAccount`, `normalizeInit` and `modelInfo` pure parsers remain for compatibility; this build does not fetch conversation/init or intercept conversation requests.

Historical preset source link retained from input: https://help.openai.com/en/articles/20001354
