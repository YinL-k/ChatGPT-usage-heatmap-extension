const PLAN_KEY = "__gpt_plan_selection__";
const LIVE_USAGE_KEY = "__gpt_live_usage__";
const PRO_RESET_KEY = "__gpt_pro_counter_reset_at__";

const PLAN_PRESETS = {
  free: { label: "Free", summary: "GPT-5.6 Luna for everyday chat. Pro mode is not included; tool limits are separate.", proRules: [] },
  go: { label: "Go", summary: "GPT-5.6 Luna with higher usage than Free. Pro mode is not included; tool limits are separate.", proRules: [] },
  plus: { label: "Plus", summary: "GPT-5.6 Sol Medium/High reasoning is available. Extra High and Pro mode are not included.", proRules: [] },
  pro_100: {
    label: "Pro $100 / 5x",
    summary: "Pro mode is available. GPT-6 Pro and GPT-5.6 Sol Pro share 50 included messages per week.",
    proRules: [{ label: "Shared Pro / 7 days", cap: 50, windowMs: days(7), filter: () => true }],
  },
  pro_200: {
    label: "Pro $200 / 20x",
    summary: "Higher Pro allowance: GPT-6 Pro 200/week, GPT-5.6 Sol Pro 170/day, with a 200/day combined Pro cap.",
    proRules: [
      { label: "GPT-6 Pro / 7 days", cap: 200, windowMs: days(7), filter: isGpt6ProEvent },
      { label: "GPT-5.6 Sol Pro / 24h", cap: 170, windowMs: days(1), filter: isSolProEvent },
      { label: "All Pro / 24h", cap: 200, windowMs: days(1), filter: () => true },
    ],
  },
  business_standard: {
    label: "Business Standard",
    summary: "Business Standard includes 15 shared Pro messages per month. Work/Codex usage is tracked separately.",
    proRules: [{ label: "Shared Pro / 30 days", cap: 15, windowMs: days(30), filter: () => true }],
  },
  business_premium: {
    label: "Business Premium",
    summary: "Business Premium includes 50 shared Pro messages per week and 5x the agentic usage of Standard.",
    proRules: [{ label: "Shared Pro / 7 days", cap: 50, windowMs: days(7), filter: () => true }],
  },
  enterprise: {
    label: "Enterprise",
    summary: "Model access and included usage can be workspace-managed. Live server meters are shown when ChatGPT exposes them.",
    proRules: null,
  },
  edu: {
    label: "Edu",
    summary: "Model access and included usage can be workspace-managed. Live server meters are shown when ChatGPT exposes them.",
    proRules: null,
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await renderAll();
  void refreshLiveUsage(true);
});

function bindEvents() {
  document.getElementById("openHeatmap").addEventListener("click", () => chrome.tabs.create({ url: "heatmap.html" }));
  document.getElementById("refreshUsage").addEventListener("click", () => void refreshLiveUsage(false));
  document.getElementById("planSelect").addEventListener("change", async (event) => {
    await storageSet({ [PLAN_KEY]: event.target.value });
    await renderAll();
  });
  document.getElementById("resetProCounter").addEventListener("click", async () => {
    await storageSet({ [PRO_RESET_KEY]: Date.now() });
    setStatus("Local Pro counter now starts from this moment.");
    await renderAll();
  });
}

async function renderAll() {
  const items = await storageGet(null);
  renderActivity(items);

  const snapshot = items[LIVE_USAGE_KEY] || null;
  const selected = typeof items[PLAN_KEY] === "string" ? items[PLAN_KEY] : "auto";
  document.getElementById("planSelect").value = selected;

  const detectedKey = detectPlanKey(snapshot);
  const effectiveKey = selected === "auto" ? detectedKey : selected;
  const preset = PLAN_PRESETS[effectiveKey] || null;

  renderPlan(snapshot, selected, detectedKey, preset);
  renderProAllowance(items, preset);
  renderAgentic(snapshot);
  renderFeatureLimits(snapshot);
}

function renderPlan(snapshot, selected, detectedKey, preset) {
  const detected = PLAN_PRESETS[detectedKey]?.label || planSignalLabel(snapshot) || "Unknown";
  document.getElementById("detectedPlan").textContent = `Detected: ${detected}`;

  const sourceBadge = document.getElementById("planSource");
  sourceBadge.textContent = selected === "auto" ? "auto" : "manual";
  sourceBadge.className = `badge ${selected === "auto" ? "official" : "local"}`;

  document.getElementById("planSummary").textContent = preset
    ? preset.summary
    : "Plan could not be mapped automatically. Pick a membership above; live usage meters will still work independently.";
}

function renderProAllowance(items, preset) {
  const container = document.getElementById("proCards");
  container.innerHTML = "";

  if (!preset) {
    container.innerHTML = emptyCard("Choose a plan to calculate the local Pro counter.");
    return;
  }
  if (preset.proRules === null) {
    container.innerHTML = emptyCard("Workspace-managed allowance — no fixed Pro cap is assumed.");
    return;
  }
  if (preset.proRules.length === 0) {
    container.innerHTML = emptyCard("This membership does not include Pro mode.");
    return;
  }

  const events = collectProEvents(items);
  const resetAt = finiteNumber(items[PRO_RESET_KEY]) || 0;
  const now = Date.now();

  for (const rule of preset.proRules) {
    const cutoff = Math.max(resetAt, now - rule.windowMs);
    const used = events.filter((event) => event.timestamp >= cutoff && rule.filter(event)).length;
    const remaining = Math.max(0, rule.cap - used);
    container.appendChild(createCard({
      title: rule.label,
      value: `${remaining} / ${rule.cap}`,
      note: `${used} locally observed. Rolling-window estimate; legacy messages before v2.1 are not model-aware.`,
      badge: "local",
      percent: rule.cap > 0 ? (used / rule.cap) * 100 : 0,
    }));
  }
}

function renderAgentic(snapshot) {
  const container = document.getElementById("agenticCards");
  container.innerHTML = "";
  const primary = snapshot?.wham?.primaryWindow;
  const secondary = snapshot?.wham?.secondaryWindow;
  const credits = snapshot?.wham?.credits;

  if (primary) container.appendChild(windowCard("Primary window", primary));
  if (secondary) container.appendChild(windowCard("Weekly window", secondary));
  if (credits && (credits.balance !== null || credits.unlimited === true)) {
    container.appendChild(createCard({
      title: "Workspace credits",
      value: credits.unlimited === true ? "Unlimited" : formatNumber(credits.balance),
      note: credits.hasCredits === false ? "No spendable credits reported." : "Read from ChatGPT usage endpoint.",
      badge: "official",
    }));
  }
  if (!container.children.length) {
    container.innerHTML = emptyCard("Open ChatGPT in the active tab and press Refresh to read Work/Codex usage.");
  }
}

function windowCard(title, windowData) {
  const usedPercent = normalizePercent(windowData.usedPercent);
  const remainingPercent = normalizePercent(
    windowData.remainingPercent !== null && windowData.remainingPercent !== undefined
      ? windowData.remainingPercent
      : usedPercent !== null ? 100 - usedPercent : null
  );
  const value = remainingPercent !== null ? `${remainingPercent.toFixed(0)}% left` : "Active";
  const reset = formatReset(windowData.resetAt, windowData.resetAfterSeconds);
  return createCard({
    title,
    value,
    note: reset ? `Resets ${reset}` : "Server-reported rate-limit window.",
    badge: "official",
    percent: usedPercent,
  });
}

function renderFeatureLimits(snapshot) {
  const container = document.getElementById("featureLimits");
  container.innerHTML = "";
  const limits = Array.isArray(snapshot?.conversation?.featureLimits) ? snapshot.conversation.featureLimits : [];

  if (!limits.length) {
    container.innerHTML = '<div class="empty">No feature counter was returned. ChatGPT only exposes some limits on some plans/accounts.</div>';
    return;
  }

  const seen = new Set();
  for (const limit of limits) {
    const name = featureLabel(limit.featureName);
    if (seen.has(name)) continue;
    seen.add(name);

    const valueBits = [];
    if (limit.remaining !== null && limit.remaining !== undefined) valueBits.push(`${formatNumber(limit.remaining)} remaining`);
    if (limit.total !== null && limit.total !== undefined) valueBits.push(`of ${formatNumber(limit.total)}`);
    const reset = formatReset(limit.resetAt, null);
    if (reset) valueBits.push(`reset ${reset}`);

    const row = document.createElement("div");
    row.className = "feature-row";
    row.innerHTML = '<span class="name"></span><span class="value"></span>';
    row.querySelector(".name").textContent = name;
    row.querySelector(".value").textContent = valueBits.join(" · ") || "limit reported";
    container.appendChild(row);
  }
}

function renderActivity(items) {
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];
  let today = 0, week = 0, month = 0, total = 0;

  for (const [dateKey, raw] of Object.entries(items)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const count = normalizeEntry(raw).count;
    total += count;
    const date = new Date(dateKey);
    if (Number.isNaN(date.getTime())) continue;
    if (dateKey === todayKey) today = count;
    if (isSameWeek(date, now)) week += count;
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) month += count;
  }

  document.getElementById("today").textContent = today;
  document.getElementById("week").textContent = week;
  document.getElementById("month").textContent = month;
  document.getElementById("total").textContent = total;
}

async function refreshLiveUsage(silent) {
  const button = document.getElementById("refreshUsage");
  button.disabled = true;
  button.textContent = "Reading…";
  if (!silent) setStatus("Reading live usage from the active ChatGPT tab…");

  try {
    const tabs = await queryTabs({ active: true, currentWindow: true });
    const tab = tabs[0];
    const url = tab?.url || "";
    if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url)) {
      setStatus("Open chatgpt.com in the active tab, then press Refresh. Cached values remain available.");
      return;
    }

    const response = await sendTabMessage(tab.id, { type: "GPT_TRACKER_REFRESH_USAGE" });
    if (!response?.ok) {
      setStatus(response?.error || "ChatGPT did not return usage data.");
      return;
    }

    setStatus(`Live usage updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
    await renderAll();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to refresh usage.");
  } finally {
    button.disabled = false;
    button.textContent = "Refresh";
  }
}

function detectPlanKey(snapshot) {
  if (!snapshot) return "";
  const wham = String(snapshot?.plan?.whamPlanType || snapshot?.wham?.planType || "").toLowerCase();
  if (wham === "prolite" || wham.includes("prolite")) return "pro_100";
  if (wham === "pro") return "pro_200";
  if (wham.includes("self_serve_business_prolite")) return "business_premium";
  if (wham.includes("business") || wham === "team") return snapshot?.plan?.premiumSeat ? "business_premium" : "business_standard";
  if (wham.includes("enterprise")) return "enterprise";
  if (wham.includes("edu")) return "edu";
  if (wham.includes("plus")) return "plus";
  if (wham.includes("go")) return "go";
  if (wham.includes("free")) return "free";

  if (snapshot?.plan?.premiumSeat) return "business_premium";
  const subscription = String(snapshot?.plan?.subscriptionPlan || "").toLowerCase();
  if (subscription.includes("business") || subscription.includes("team")) return snapshot?.plan?.premiumSeat ? "business_premium" : "business_standard";
  if (subscription.includes("enterprise")) return "enterprise";
  if (subscription.includes("edu")) return "edu";
  if (subscription.includes("plus")) return "plus";
  if (subscription.includes("go")) return "go";
  if (subscription.includes("free")) return "free";
  return "";
}

function planSignalLabel(snapshot) {
  return snapshot?.plan?.whamPlanType || snapshot?.plan?.subscriptionPlan || "";
}

function collectProEvents(items) {
  const result = [];
  for (const [key, raw] of Object.entries(items)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    for (const event of normalizeEntry(raw).events) {
      if (!event || typeof event !== "object") continue;
      if (!event.isPro && String(event.reasoningEffort || "").toLowerCase() !== "pro") continue;
      result.push({
        timestamp: finiteNumber(event.timestamp) || 0,
        model: String(event.model || "").toLowerCase(),
        reasoningEffort: String(event.reasoningEffort || "").toLowerCase(),
      });
    }
  }
  return result;
}

function isGpt6ProEvent(event) {
  return event.model.includes("gpt-6") || event.model.includes("gpt6");
}

function isSolProEvent(event) {
  return event.model.includes("5.6") || event.model.includes("5-6") || event.model.includes("sol");
}

function createCard({ title, value, note, badge, percent }) {
  const card = document.createElement("div");
  card.className = "card";
  const titleRow = document.createElement("div");
  titleRow.className = "card-title";
  const titleSpan = document.createElement("span");
  titleSpan.textContent = title;
  titleRow.appendChild(titleSpan);
  if (badge) {
    const badgeSpan = document.createElement("span");
    badgeSpan.className = `badge ${badge}`;
    badgeSpan.textContent = badge;
    titleRow.appendChild(badgeSpan);
  }
  card.appendChild(titleRow);

  const valueEl = document.createElement("div");
  valueEl.className = "card-value";
  valueEl.textContent = value;
  card.appendChild(valueEl);

  if (Number.isFinite(percent)) {
    const progress = document.createElement("div");
    progress.className = "progress";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progress.appendChild(fill);
    card.appendChild(progress);
  }
  if (note) {
    const noteEl = document.createElement("div");
    noteEl.className = "card-note";
    noteEl.textContent = note;
    card.appendChild(noteEl);
  }
  return card;
}

function emptyCard(text) {
  return `<div class="card" style="grid-column:1/-1"><div class="empty">${escapeHtml(text)}</div></div>`;
}

function featureLabel(value) {
  const labels = { deep_research: "Deep Research", image_gen: "Image Generation", file_upload: "File Upload", odyssey: "Odyssey", voice: "Voice" };
  if (labels[value]) return labels[value];
  return String(value || "Feature").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatReset(resetAt, resetAfterSeconds) {
  if (typeof resetAfterSeconds === "number" && Number.isFinite(resetAfterSeconds) && resetAfterSeconds >= 0) return `in ${formatDuration(resetAfterSeconds)}`;
  if (typeof resetAt === "string") {
    const parsed = Date.parse(resetAt);
    if (Number.isFinite(parsed)) return new Date(parsed).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return resetAt.slice(0, 40);
  }
  if (typeof resetAt === "number" && Number.isFinite(resetAt)) {
    if (resetAt > 1e12) return new Date(resetAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    if (resetAt > 1e9) return new Date(resetAt * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    if (resetAt >= 0) return `in ${formatDuration(resetAt)}`;
  }
  return "";
}

function formatDuration(seconds) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const daysValue = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (daysValue > 0) return `${daysValue}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function normalizePercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 1 ? value * 100 : Math.max(0, Math.min(100, value));
}

function normalizeEntry(raw) {
  if (!raw) return { count: 0, timestamps: [], events: [] };
  if (typeof raw === "number") return { count: raw, timestamps: [], events: [] };
  if (Array.isArray(raw)) return { count: raw.length, timestamps: raw.slice(), events: [] };
  if (typeof raw === "object") {
    const timestamps = Array.isArray(raw.timestamps) ? raw.timestamps.slice() : [];
    const events = Array.isArray(raw.events) ? raw.events.slice() : [];
    const count = typeof raw.count === "number" ? raw.count : Math.max(timestamps.length, events.length);
    return { count, timestamps, events };
  }
  return { count: 0, timestamps: [], events: [] };
}

function isSameWeek(d1, d2) {
  return weekStart(d1).getTime() === weekStart(d2).getTime();
}

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function days(value) { return value * 24 * 60 * 60 * 1000; }
function finiteNumber(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function formatNumber(value) { return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "—"; }
function setStatus(text) { document.getElementById("statusText").textContent = text || ""; }

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function storageGet(keys) { return new Promise((resolve) => chrome.storage.local.get(keys, resolve)); }
function storageSet(value) { return new Promise((resolve) => chrome.storage.local.set(value, resolve)); }
function queryTabs(query) { return new Promise((resolve) => chrome.tabs.query(query, resolve)); }

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: "Reload the ChatGPT tab once after updating the extension, then try Refresh again." });
        return;
      }
      resolve(response || { ok: false, error: "No response from the ChatGPT tab." });
    });
  });
}
