English | [中文](README.md)

# SakuraMeter — ChatGPT & Codex Usage Tracker

![SakuraMeter](assets/sakurameter-128.png)

**3.5.0**

A Chrome extension for local ChatGPT activity tracking, heatmaps, trends, and read-only Codex allowance information. Sakura dark and pale-pink themes share the same layout and interactions.

## Preview

English Chrome Web Store preview containing six screenshots plus the Small and Large promotional tiles.

![SakuraMeter English store preview](store-assets/en/SakuraMeter-GitHub-Preview.jpg)

## Features

- Confirm sends only after a matching new user message appears; ignore empty, failed, duplicate, and replayed events.
- Overview, Activity, and Usage pages with monthly/weekly columns, daily trends, heatmaps, time-of-day distribution, and manual Pro calibration.
- Consistent membership rows, compact Live badges, themed dropdowns and date/time picker, keyboard navigation, and reduced-motion support.
- Read-only refresh using the existing ChatGPT session, dynamic Codex windows, timeout/backoff, and cached/error states. No chat submission, generation, or automatic page reload.
- Experimental third-party global reset forecasts from codex-reset.com, distinct from personal reset times and official promises.

## Install and update

Download and extract the repository. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the directory containing `manifest.json`. Reload your ChatGPT page normally once to activate activity tracking.

Export activity and back up the existing extension directory before updating. Replace files in the existing loaded path and reload the extension to retain its ID and local data. Do not uninstall first. Loading another path may create a new ID. Activity exports do not include manual plans or calibrations.

## Privacy and permissions

Activity remains local. Chat text is briefly compared in memory to confirm a send, never persisted or exported. Authentication tokens remain in request-local memory. Current permissions are storage, tabs, and the ChatGPT host, unchanged from the optimized 3.4 source but different from the old 2.0.0 repository version.

Personal usage uses GET requests to ChatGPT session and usage endpoints. Public forecasts use credential-free GET requests; the forecast provider receives normal connection metadata such as IP address. No developer backend, telemetry, conversation creation, or model calls. See [Privacy](PRIVACY.md).

Unknown quotas remain unavailable. Calibrated Pro balances are local estimates. Private APIs and markup can change; local fixture tests do not establish real-account compatibility.

## Tests

Run `npm install` and `npm test` in `tests/`. Browser checks require Google Chrome: `npm run browser`, `npm run themes`, `npm run readability`, and `npm run controls`. All regression requests use local fixtures. See the [verification report](verification/3.5.0/report.json) and [testing history](TESTING.md); historical local screenshot paths are not shipped in this repository.


## Brand and icon

SakuraMeter uses the selected Hanbao (blossom bud) icon across the extension, toolbar, popup, and dashboard, with matching light and dark variants. The localized extension names include ChatGPT and Codex usage keywords. This is an independent community extension. See [brand assets](BRANDING.md).
