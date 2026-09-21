(() => {
  const SOURCE = "gpt-usage-heatmap";
  const CHAT_SENT_TYPE = "GPT_TRACKER_CHAT_SENT";
  const REQUEST_TYPE = "GPT_TRACKER_USAGE_REQUEST";
  const RESPONSE_TYPE = "GPT_TRACKER_USAGE_RESPONSE";
  const LIVE_USAGE_KEY = "__gpt_live_usage__";
  const pendingUsageRequests = new Map();

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== SOURCE) return;

    if (event.data.type === CHAT_SENT_TYPE && event.data.payload) {
      recordUsageEvent(event.data.payload);
      return;
    }

    if (event.data.type === RESPONSE_TYPE && event.data.requestId) {
      const pending = pendingUsageRequests.get(event.data.requestId);
      if (!pending) return;
      pendingUsageRequests.delete(event.data.requestId);
      clearTimeout(pending.timeoutId);
      if (event.data.ok && event.data.snapshot) {
        chrome.storage.local.set({ [LIVE_USAGE_KEY]: event.data.snapshot });
        pending.resolve({ ok: true, snapshot: event.data.snapshot });
      } else {
        pending.resolve({ ok: false, error: event.data.error || "Unable to refresh usage" });
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "GPT_TRACKER_REFRESH_USAGE") return false;
    requestUsageSnapshot().then(sendResponse);
    return true;
  });

  async function recordUsageEvent(payload) {
    const timestamp = Number(payload.timestamp) || Date.now();
    const dateKey = new Date(timestamp).toISOString().split("T")[0];
    const eventId = typeof payload.id === "string" && payload.id ? payload.id : `${timestamp}`;

    const result = await storageGet([dateKey]);
    const normalized = normalizeEntry(result[dateKey]);
    if (normalized.events.some((event) => event.id === eventId)) return;

    const event = {
      id: eventId,
      timestamp,
      model: safeString(payload.model),
      reasoningEffort: safeString(payload.reasoningEffort),
      isPro: Boolean(payload.isPro),
    };

    const newEntry = {
      count: normalized.count + 1,
      timestamps: [...normalized.timestamps, timestamp],
      events: [...normalized.events, event],
    };

    await storageSet({ [dateKey]: newEntry });
  }

  function requestUsageSnapshot() {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();
      const timeoutId = setTimeout(() => {
        pendingUsageRequests.delete(requestId);
        resolve({ ok: false, error: "Timed out while reading ChatGPT usage" });
      }, 12000);

      pendingUsageRequests.set(requestId, { resolve, timeoutId });
      window.postMessage({ source: SOURCE, type: REQUEST_TYPE, requestId }, "*");
    });
  }

  function normalizeEntry(raw) {
    if (!raw) return { count: 0, timestamps: [], events: [] };
    if (typeof raw === "number") return { count: raw, timestamps: [], events: [] };
    if (Array.isArray(raw)) return { count: raw.length, timestamps: raw.slice(), events: [] };
    if (typeof raw === "object") {
      const timestamps = Array.isArray(raw.timestamps) ? raw.timestamps.slice() : [];
      const events = Array.isArray(raw.events)
        ? raw.events.filter((item) => item && typeof item === "object")
        : [];
      const count = typeof raw.count === "number" ? raw.count : Math.max(timestamps.length, events.length);
      return { count, timestamps, events };
    }
    return { count: 0, timestamps: [], events: [] };
  }

  function safeString(value) {
    return typeof value === "string" ? value.slice(0, 120) : "";
  }

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageSet(value) {
    return new Promise((resolve) => chrome.storage.local.set(value, resolve));
  }
})();