(() => {
  const SOURCE = "gpt-usage-heatmap";
  const REQUEST_TYPE = "GPT_TRACKER_USAGE_REQUEST";
  const RESPONSE_TYPE = "GPT_TRACKER_USAGE_RESPONSE";
  const CHAT_SENT_TYPE = "GPT_TRACKER_CHAT_SENT";
  const FETCH_PATCH_FLAG = "__GPT_USAGE_HEATMAP_FETCH_PATCHED__";

  if (window[FETCH_PATCH_FLAG]) return;
  window[FETCH_PATCH_FLAG] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(input, init) {
    const sendProbe = inspectOutgoingChat(input, init);
    const responsePromise = originalFetch(input, init);

    void Promise.all([
      sendProbe,
      responsePromise.then((response) => response.ok).catch(() => false),
    ]).then(([event, requestSucceeded]) => {
      if (event && requestSucceeded) {
        window.postMessage({ source: SOURCE, type: CHAT_SENT_TYPE, payload: event }, "*");
      }
    }).catch(() => {});

    return responsePromise;
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== SOURCE) return;
    if (event.data?.type !== REQUEST_TYPE || !event.data?.requestId) return;

    const requestId = String(event.data.requestId);
    void collectUsageSnapshot()
      .then((snapshot) => {
        window.postMessage({
          source: SOURCE,
          type: RESPONSE_TYPE,
          requestId,
          ok: true,
          snapshot,
        }, "*");
      })
      .catch((error) => {
        window.postMessage({
          source: SOURCE,
          type: RESPONSE_TYPE,
          requestId,
          ok: false,
          error: error instanceof Error ? error.message : "Unable to read usage",
        }, "*");
      });
  });

  async function inspectOutgoingChat(input, init) {
    const method = getRequestMethod(input, init);
    if (method !== "POST") return null;

    const url = getRequestUrl(input);
    if (!url) return null;

    let parsedUrl;
    try {
      parsedUrl = new URL(url, location.href);
    } catch {
      return null;
    }

    const path = parsedUrl.pathname;
    const isConversationSend =
      path === "/backend-api/f/conversation" || path === "/backend-api/conversation";
    if (!isConversationSend) return null;

    const rawBody = await readRequestBody(input, init);
    if (!rawBody) return null;

    let body;
    try {
      body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      return null;
    }
    if (!body || typeof body !== "object") return null;

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userMessage = [...messages].reverse().find((message) => {
      const role = message?.author?.role ?? message?.role;
      return role === "user";
    });

    if (!userMessage && body.action !== "next") return null;

    const model = firstString(
      body.model,
      body.model_slug,
      body.default_model_slug,
      body.model_configuration?.model,
      body.model_configuration?.model_slug,
      body.metadata?.model_slug,
      body.metadata?.model
    );

    const reasoningEffort = firstString(
      body.reasoning_effort,
      body.thinking_effort,
      body.model_configuration?.reasoning_effort,
      body.model_configuration?.thinking_effort,
      body.metadata?.reasoning_effort,
      body.metadata?.thinking_effort,
      userMessage?.metadata?.reasoning_effort,
      userMessage?.metadata?.thinking_effort
    );

    const normalizedModel = String(model || "").toLowerCase();
    const normalizedEffort = String(reasoningEffort || "").toLowerCase();
    const isPro =
      normalizedEffort === "pro" ||
      /(?:^|[-_ ])pro(?:$|[-_ ])/.test(normalizedModel) ||
      normalizedModel.includes("gpt-6-pro") ||
      normalizedModel.includes("sol-pro");

    return {
      id: String(userMessage?.id || crypto.randomUUID()),
      timestamp: Date.now(),
      model: model || "",
      reasoningEffort: reasoningEffort || "",
      isPro,
    };
  }

  function getRequestMethod(input, init) {
    if (init?.method) return String(init.method).toUpperCase();
    if (input instanceof Request) return String(input.method || "GET").toUpperCase();
    return "GET";
  }

  function getRequestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    if (input instanceof Request) return input.url;
    return "";
  }

  async function readRequestBody(input, init) {
    if (typeof init?.body === "string") return init.body;
    if (init?.body && typeof init.body === "object" && !(init.body instanceof FormData)) {
      return init.body;
    }
    if (input instanceof Request) {
      try {
        return await input.clone().text();
      } catch {
        return null;
      }
    }
    return null;
  }

  async function collectUsageSnapshot() {
    const [conversationInit, whamUsage, tasksRateLimit, codexSettings, planInfo] =
      await Promise.all([
        fetchJson("/backend-api/conversation/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
        fetchJson("/backend-api/wham/usage"),
        fetchJson("/backend-api/wham/tasks/rate_limit"),
        fetchJson("/codex/settings/usage"),
        detectPlanInfo(),
      ]);

    const snapshot = {
      updatedAt: Date.now(),
      plan: {
        whamPlanType: cleanString(whamUsage.data?.plan_type),
        subscriptionPlan: cleanString(planInfo.subscriptionPlan),
        premiumSeat: Boolean(planInfo.premiumSeat),
        candidates: Array.isArray(planInfo.candidates) ? planInfo.candidates : [],
      },
      conversation: sanitizeConversationInit(conversationInit.data),
      wham: sanitizeWham(whamUsage.data),
      taskMeters: collectUsageMeters(tasksRateLimit.data, "tasks"),
      codexMeters: collectUsageMeters(codexSettings.data, "codex"),
      status: {
        conversationInit: conversationInit.ok,
        whamUsage: whamUsage.ok,
        tasksRateLimit: tasksRateLimit.ok,
        codexSettings: codexSettings.ok,
        planDetection: planInfo.ok,
      },
    };

    return snapshot;
  }

  async function fetchJson(path, init = {}) {
    try {
      const response = await originalFetch(new URL(path, location.origin).toString(), {
        credentials: "include",
        ...init,
      });
      if (!response.ok) {
        return { ok: false, status: response.status, data: null };
      }
      return { ok: true, status: response.status, data: await response.json() };
    } catch {
      return { ok: false, status: 0, data: null };
    }
  }

  async function detectPlanInfo() {
    const fallback = { ok: false, subscriptionPlan: "", premiumSeat: false, candidates: [] };
    try {
      const sessionResponse = await originalFetch("/api/auth/session", { credentials: "include" });
      if (!sessionResponse.ok) return fallback;
      const session = await sessionResponse.json();
      const accessToken = session?.accessToken;
      if (!accessToken || typeof accessToken !== "string") return fallback;

      const timezoneOffsetMin = -new Date().getTimezoneOffset();
      const accountsResponse = await originalFetch(
        `/backend-api/accounts/check/v4-2023-04-27?timezone_offset_min=${timezoneOffsetMin}`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!accountsResponse.ok) return fallback;

      const payload = await accountsResponse.json();
      const accounts = payload?.accounts && typeof payload.accounts === "object" ? payload.accounts : {};
      const ordering = Array.isArray(payload?.account_ordering) ? payload.account_ordering : Object.keys(accounts);
      const candidates = [];

      for (const accountId of ordering) {
        const account = accounts[accountId];
        if (!account || typeof account !== "object") continue;
        const subscriptionPlan = cleanString(account?.entitlement?.subscription_plan || account?.plan_type);
        const features = Array.isArray(account.features)
          ? account.features.filter((item) => typeof item === "string")
          : [];
        const premiumSeat = features.some((feature) =>
          feature === "self_serve_business_prolite" || feature.includes("premium_seat")
        );
        candidates.push({ subscriptionPlan, premiumSeat });
      }

      const preferred = candidates[0] || {};
      return {
        ok: true,
        subscriptionPlan: cleanString(preferred.subscriptionPlan),
        premiumSeat: Boolean(preferred.premiumSeat),
        candidates,
      };
    } catch {
      return fallback;
    }
  }

  function sanitizeConversationInit(raw) {
    if (!raw || typeof raw !== "object") {
      return { featureLimits: [], meters: [], blockedFeatures: [], defaultModel: "" };
    }

    const featureLimits = Array.isArray(raw.limits_progress)
      ? raw.limits_progress.map((item) => ({
          featureName: cleanString(item?.feature_name) || "unknown_feature",
          remaining: numberOrNull(item?.remaining),
          used: numberOrNull(item?.used),
          total: numberOrNull(item?.total ?? item?.limit),
          resetAt: scalarOrNull(item?.reset_at ?? item?.reset_after),
        }))
      : [];

    return {
      featureLimits,
      meters: collectUsageMeters(raw, "conversation"),
      blockedFeatures: Array.isArray(raw.blocked_features)
        ? raw.blocked_features.filter((item) => typeof item === "string").slice(0, 30)
        : [],
      defaultModel: cleanString(raw.default_model_slug),
    };
  }

  function sanitizeWham(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        planType: "",
        primaryWindow: null,
        secondaryWindow: null,
        codeReviewWindow: null,
        credits: null,
        resetCredits: null,
        meters: [],
      };
    }

    return {
      planType: cleanString(raw.plan_type),
      primaryWindow: sanitizeWindow(raw?.rate_limit?.primary_window),
      secondaryWindow: sanitizeWindow(raw?.rate_limit?.secondary_window),
      codeReviewWindow: sanitizeWindow(raw?.code_review_rate_limit?.primary_window),
      credits: sanitizeCredits(raw.credits),
      resetCredits: raw.rate_limit_reset_credits && typeof raw.rate_limit_reset_credits === "object"
        ? { availableCount: numberOrNull(raw.rate_limit_reset_credits.available_count) }
        : null,
      meters: collectUsageMeters(raw, "wham"),
    };
  }

  function sanitizeWindow(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
      usedPercent: numberOrNull(raw.used_percent ?? raw.usedPercent),
      remainingPercent: numberOrNull(raw.remaining_percent ?? raw.remainingPercent),
      windowSeconds: numberOrNull(
        raw.limit_window_seconds ?? raw.window_seconds ?? raw.windowSeconds
      ),
      resetAt: scalarOrNull(raw.reset_at ?? raw.resets_at ?? raw.resetAt),
      resetAfterSeconds: numberOrNull(raw.reset_after_seconds ?? raw.reset_after),
    };
  }

  function sanitizeCredits(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
      balance: numberOrNull(raw.balance),
      hasCredits: typeof raw.has_credits === "boolean" ? raw.has_credits : null,
      unlimited: typeof raw.unlimited === "boolean" ? raw.unlimited : null,
      approxLocalMessages: numberOrNull(raw.approx_local_messages),
      approxCloudMessages: numberOrNull(raw.approx_cloud_messages),
    };
  }

  function collectUsageMeters(root, prefix) {
    if (!root || typeof root !== "object") return [];
    const queue = [{ value: root, path: prefix, depth: 0 }];
    const meters = [];
    const seen = new Set();

    while (queue.length && meters.length < 24) {
      const current = queue.shift();
      if (!current || current.depth > 5 || !current.value || typeof current.value !== "object") continue;

      if (!Array.isArray(current.value)) {
        const meter = toUsageMeter(current.value, current.path);
        if (meter && !seen.has(meter.key)) {
          seen.add(meter.key);
          meters.push(meter);
        }
      }

      for (const [key, value] of Object.entries(current.value)) {
        if (!value || typeof value !== "object") continue;
        if (Array.isArray(value)) {
          value.slice(0, 30).forEach((entry, index) => {
            if (entry && typeof entry === "object") {
              queue.push({ value: entry, path: `${current.path}.${key}.${index}`, depth: current.depth + 1 });
            }
          });
        } else {
          queue.push({ value, path: `${current.path}.${key}`, depth: current.depth + 1 });
        }
      }
    }

    return meters;
  }

  function toUsageMeter(record, path) {
    const remaining = numberFromKeys(record, ["remaining", "remaining_credits", "remainingCredits"]);
    const total = numberFromKeys(record, ["total", "limit", "quota", "total_credits", "totalCredits"]);
    const used = numberFromKeys(record, ["used", "usage", "used_credits", "usedCredits"]);
    const usedPercent = numberFromKeys(record, ["used_percent", "usedPercent", "utilization"]);
    const remainingPercent = numberFromKeys(record, [
      "remaining_percent", "remainingPercent", "percent_remaining", "percentRemaining"
    ]);
    const resetAt = scalarFromKeys(record, ["reset_at", "resetAt", "resets_at", "resetsAt", "reset_time"]);
    const resetAfterSeconds = numberFromKeys(record, ["reset_after_seconds", "reset_after", "resetAfter"]);
    const windowSeconds = numberFromKeys(record, ["limit_window_seconds", "window_seconds", "windowSeconds"]);

    const hasSignal = [remaining, total, used, usedPercent, remainingPercent, resetAfterSeconds, windowSeconds]
      .some((value) => value !== null) || resetAt !== null;
    if (!hasSignal) return null;

    const label = cleanString(
      record.label || record.title || record.name || record.display_name ||
      record.feature_name || record.limit_name || record.bucket_name ||
      record.model || record.model_name || record.model_slug
    ) || path.split(".").slice(-3).join(" ");

    return {
      key: path,
      label: label.slice(0, 80),
      remaining,
      total,
      used,
      usedPercent,
      remainingPercent,
      resetAt,
      resetAfterSeconds,
      windowSeconds,
    };
  }

  function firstString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim().slice(0, 120) : "";
  }

  function numberFromKeys(record, keys) {
    for (const key of keys) {
      const value = numberOrNull(record?.[key]);
      if (value !== null) return value;
    }
    return null;
  }

  function scalarFromKeys(record, keys) {
    for (const key of keys) {
      const value = scalarOrNull(record?.[key]);
      if (value !== null) return value;
    }
    return null;
  }

  function numberOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function scalarOrNull(value) {
    return typeof value === "string" || (typeof value === "number" && Number.isFinite(value))
      ? value
      : null;
  }
})();