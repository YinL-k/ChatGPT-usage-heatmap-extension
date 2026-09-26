let allData = {};
let currentYear = new Date().getFullYear();
let availableYears = [];
let yearSelectButtonEl;
let yearSelectValueEl;
let yearSelectMenuEl;

/** Hourly chart state (24h line) */
const hourlyChartState = {
  canvas: null,
  points: [],
  hours: new Array(24).fill(0),
  hasDetailed: false,
  hoverIndex: -1,
};

/** Time distribution pie chart state */
const timeDistributionState = {
  canvas: null,
  segments: [],
  total: 0,
  centerX: 0,
  centerY: 0,
  radius: 0,
  innerRadius: 0,
  hoverIndex: -1,
  animationFrameId: null,
};

/** Modal 8h-bucket bar chart state (3 bars) */
const dayModalBarState = {
  canvas: null,
  tooltip: null,
  bins: [0, 0, 0], // Morning(0-8), Noon(8-16), Evening(16-24)
  barRects: [], // hitboxes in CSS px coords: {x,y,w,h,value}
  hoverIndex: -1,
  animFrameId: null,
  animStart: 0,
  animProgress: 1,
  duration: 520,
};

const TIME_BUCKETS = [
  {
    id: "midnight",
    startHour: 0,
    endHour: 4,
    labelKey: "label_midnight",
    rangeKey: "range_midnight",
    descKey: "desc_midnight",
  },
  {
    id: "morning",
    startHour: 4,
    endHour: 8,
    labelKey: "label_morning",
    rangeKey: "range_morning",
    descKey: "desc_morning",
  },
  {
    id: "forenoon",
    startHour: 8,
    endHour: 12,
    labelKey: "label_forenoon",
    rangeKey: "range_forenoon",
    descKey: "desc_forenoon",
  },
  {
    id: "afternoon",
    startHour: 12,
    endHour: 16,
    labelKey: "label_afternoon",
    rangeKey: "range_afternoon",
    descKey: "desc_afternoon",
  },
  {
    id: "evening",
    startHour: 16,
    endHour: 20,
    labelKey: "label_evening",
    rangeKey: "range_evening",
    descKey: "desc_evening",
  },
  {
    id: "night",
    startHour: 20,
    endHour: 24,
    labelKey: "label_night",
    rangeKey: "range_night",
    descKey: "desc_night",
  },
];

/* ---------- Bootstrap ---------- */

document.addEventListener("DOMContentLoaded", () => {
  if (!window.GPTTrackerI18n) {
    console.error("[SakuraMeter] i18n module missing");
    
    bootstrap();
    return;
  }

  function detectBrowserLang() {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith("zh")) return "zh";
    if (lang.startsWith("en")) return "en";
    return "en"; 
  }

  chrome.storage.sync.get("gptTrackerLang", async (res) => {
    const stored = res.gptTrackerLang;
    const lang = stored || detectBrowserLang();

    
    await window.GPTTrackerI18n.initI18n(lang);

    bootstrap();
  });
});

async function bootstrap() {
  
  yearSelectButtonEl = document.getElementById("yearSelectButton");
  yearSelectValueEl = document.getElementById("yearSelectValue");
  yearSelectMenuEl = document.getElementById("yearSelectMenu");

  
  allData = await getStorageData();

  
  initMonthsHeader();
  initThemeToggle();
  initExportImport();
  initModal();
  initDailyChartInteractions();
  initPieChart();

  
  buildYearOptions();
  renderCalendar(currentYear);
  updateDailyChartForToday();
  updateTimeDistribution();

  document.dispatchEvent(new CustomEvent("gpt-heatmap-ready"));

  
  initYearSelectControl();

  
  const langBtn = document.getElementById("languageToggle");
  if (langBtn && window.GPTTrackerI18n) {
    langBtn.addEventListener("click", async () => {
      const current = window.GPTTrackerI18n.currentLang;
      const newLang = current === "zh" ? "en" : "zh";

      chrome.storage.sync.set({ gptTrackerLang: newLang });

      await window.GPTTrackerI18n.initI18n(newLang);
      refreshI18nAndCharts();
    });
  }
}

function refreshI18nAndCharts() {
  if (window.GPTTrackerI18n) {
    window.GPTTrackerI18n.applyI18n(document);
    }

  
  initMonthsHeader();

  
  renderCalendar(currentYear);
  updateDailyChartForToday();
  updateTimeDistribution();
}


/* ---------- Storage helpers ---------- */

function getStorageData() {
  return new Promise((resolve) => chrome.storage.local.get(null, resolve));
}

function isDateKey(key) {
  return !!GPTUsageCore.dateFromKey(key);
}

function normalizeEntry(raw) { return GPTUsageCore.entry(raw); }

function toISODate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; 
}

/* ---------- Months header ---------- */

function initMonthsHeader() {
  const monthsLabel = document.getElementById("monthsLabel");
  if (!monthsLabel) return;

  const t = window.GPTTrackerI18n ? window.GPTTrackerI18n.t : (k, f) => f || k;

  const months = [
    { shortKey: "month_1_short", fallback: "Jan" },
    { shortKey: "month_2_short", fallback: "Feb" },
    { shortKey: "month_3_short", fallback: "Mar" },
    { shortKey: "month_4_short", fallback: "Apr" },
    { shortKey: "month_5_short", fallback: "May" },
    { shortKey: "month_6_short", fallback: "Jun" },
    { shortKey: "month_7_short", fallback: "Jul" },
    { shortKey: "month_8_short", fallback: "Aug" },
    { shortKey: "month_9_short", fallback: "Sep" },
    { shortKey: "month_10_short", fallback: "Oct" },
    { shortKey: "month_11_short", fallback: "Nov" },
    { shortKey: "month_12_short", fallback: "Dec" },
  ];

  monthsLabel.innerHTML = "";
  months.forEach((m) => {
    const span = document.createElement("span");
    span.textContent = t(m.shortKey, m.fallback);
    monthsLabel.appendChild(span);
  });
}

/* ---------- Year select ---------- */

function closeYearSelectMenu({ returnFocus = false } = {}) {
  const shell = yearSelectButtonEl?.closest('.year-select-shell');
  if (!shell || !yearSelectButtonEl || !yearSelectMenuEl) return;
  shell.classList.remove('is-open');
  yearSelectButtonEl.setAttribute('aria-expanded', 'false');
  yearSelectMenuEl.hidden = true;
  if (returnFocus) yearSelectButtonEl.focus({ preventScroll: true });
}

function openYearSelectMenu({ focusSelected = false } = {}) {
  const shell = yearSelectButtonEl?.closest('.year-select-shell');
  if (!shell || !yearSelectButtonEl || !yearSelectMenuEl) return;
  shell.classList.add('is-open');
  yearSelectButtonEl.setAttribute('aria-expanded', 'true');
  yearSelectMenuEl.hidden = false;
  if (focusSelected) {
    const selected = yearSelectMenuEl.querySelector('[aria-selected="true"]') || yearSelectMenuEl.querySelector('button');
    selected?.focus({ preventScroll: true });
  }
}

function applyYearSelection(year, { focusButton = true } = {}) {
  if (!Number.isFinite(year)) return;
  currentYear = year;
  if (yearSelectValueEl) yearSelectValueEl.textContent = String(year);
  yearSelectMenuEl?.querySelectorAll('[role="option"]').forEach((option) => {
    option.setAttribute('aria-selected', option.dataset.year === String(year) ? 'true' : 'false');
  });
  renderCalendar(currentYear);
  closeYearSelectMenu({ returnFocus: focusButton });
}

function syncYearSelectControl() {
  if (!yearSelectMenuEl || !yearSelectValueEl) return;
  yearSelectValueEl.textContent = String(currentYear);
  yearSelectMenuEl.replaceChildren();
  availableYears.forEach((year) => {
    const value = String(year);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'year-select-option';
    button.setAttribute('role', 'option');
    button.dataset.year = value;
    button.textContent = value;
    button.setAttribute('aria-selected', year === currentYear ? 'true' : 'false');
    button.addEventListener('click', () => applyYearSelection(year));
    button.addEventListener('keydown', (e) => {
      const options = Array.from(yearSelectMenuEl.querySelectorAll('.year-select-option'));
      const index = options.indexOf(button);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        options[(index + 1) % options.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        options[(index - 1 + options.length) % options.length]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeYearSelectMenu({ returnFocus: true });
      } else if (e.key === 'Tab') {
        closeYearSelectMenu();
      }
    });
    yearSelectMenuEl.appendChild(button);
  });
}

function initYearSelectControl() {
  if (!yearSelectButtonEl || !yearSelectMenuEl) return;
  const shell = yearSelectButtonEl.closest('.year-select-shell');

  yearSelectButtonEl.addEventListener('click', () => {
    if (shell?.classList.contains('is-open')) closeYearSelectMenu();
    else openYearSelectMenu();
  });

  yearSelectButtonEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openYearSelectMenu({ focusSelected: true });
    } else if (e.key === 'Escape') {
      closeYearSelectMenu();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!shell?.contains(e.target)) closeYearSelectMenu();
  }, { capture: true });

  window.addEventListener('blur', () => closeYearSelectMenu());
  syncYearSelectControl();
}

function buildYearOptions() {
  const years = new Set();
  const todayYear = new Date().getFullYear();
  years.add(todayYear);

  Object.keys(allData).forEach((key) => {
    if (!isDateKey(key)) return;
    const y = parseInt(key.split("-")[0], 10);
    if (!Number.isNaN(y)) years.add(y);
  });

  availableYears = Array.from(years).sort((a, b) => b - a);
  if (!availableYears.includes(currentYear)) {
    currentYear = availableYears[0] || todayYear;
  }
  syncYearSelectControl();
}

/* ---------- Calendar rendering ---------- */

function renderCalendar(year) {
  const grid = document.getElementById("heatmapGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  let totalCount = 0;
  let activeDays = 0;
  let maxCount = 0;
  const dailyCounts = {};
  const positiveCounts = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = toISODate(d);
    const entry = normalizeEntry(allData[dateStr]);
    const count = dateStr>toISODate(new Date())?0:entry.count || 0;

    dailyCounts[dateStr] = count;

    if (count > 0) {
      totalCount += count;
      activeDays++;
      if (count > maxCount) maxCount = count;
      positiveCounts.push(count);
    }
  }

  const t = window.GPTTrackerI18n ? window.GPTTrackerI18n.t : (k, f) => f || k;

  // Stats
  const yearTotalEl = document.getElementById("yearTotal");
  const activeDaysEl = document.getElementById("activeDays");
  const avgDailyEl = document.getElementById("avgDaily");
  const currentStreakEl = document.getElementById("currentStreak");
  const longestStreakEl = document.getElementById("longestStreak");

  if (yearTotalEl) yearTotalEl.textContent = String(totalCount);
  if (activeDaysEl) activeDaysEl.textContent = String(activeDays);
  if (avgDailyEl) {
    avgDailyEl.textContent = activeDays
      ? (totalCount / activeDays).toFixed(1)
      : "0";
  }

  const streaks = computeStreaks(year, startDate, endDate, dailyCounts);
  if (currentStreakEl) currentStreakEl.textContent = String(streaks.current);
  if (longestStreakEl) longestStreakEl.textContent = String(streaks.longest);

  // Color scale based on percentiles (with log fallback)
  const colorScale = buildColorScale(positiveCounts, maxCount);

  // Empty cells to align first week (Mon-based)
  const firstDay = startDate.getDay(); // 0 Sun - 6 Sat
  const emptyCells = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < emptyCells; i++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.style.visibility = "hidden";
    cell.style.pointerEvents = "none";
    grid.appendChild(cell);
  }

  // Actual days
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = toISODate(d);
    const count = dailyCounts[dateStr] || 0;

    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.dataset.date = dateStr;
    const tooltipLabel = t("heatmap_cell_tooltip", "{date}: {count} chats")
      .replace("{date}", dateStr)
      .replace("{count}", String(count));
    cell.dataset.tooltip = tooltipLabel;
    cell.setAttribute('role','button');cell.setAttribute('aria-label',tooltipLabel);cell.tabIndex=dateStr===toISODate(new Date())||d.getTime()===startDate.getTime()?0:-1;
    cell.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();handleDayClick(dateStr);return;}
      const steps={ArrowRight:7,ArrowLeft:-7,ArrowDown:1,ArrowUp:-1};if(!(e.key in steps))return;
      e.preventDefault();const cells=[...grid.querySelectorAll('[data-date]')],next=cells[cells.indexOf(cell)+steps[e.key]];if(next){cells.forEach(x=>x.tabIndex=-1);next.tabIndex=0;next.focus();}
    });
    cell.dataset.level = getColorLevel(count, colorScale);
    cell.addEventListener("click", () => handleDayClick(dateStr));
    grid.appendChild(cell);
  }

  let heatmapTooltip = document.getElementById("heatmapTooltip");
  if (!heatmapTooltip) {
    heatmapTooltip = document.createElement("div");
    heatmapTooltip.id = "heatmapTooltip";
    heatmapTooltip.className = "tooltip tooltip-hidden";
    document.body.appendChild(heatmapTooltip);
  }
  heatmapTooltip = ensureFloatingTooltip(heatmapTooltip);

  
  grid.onmousemove = (e) => {
    const cell = e.target.closest(".day-cell");
    if (!cell || !cell.dataset.tooltip) return;

    heatmapTooltip.textContent = cell.dataset.tooltip;
    heatmapTooltip.classList.remove("tooltip-hidden");
    heatmapTooltip.classList.add("tooltip-visible");

    placeTooltipNearPointer(heatmapTooltip, e.clientX, e.clientY, {
      gapX: 14,
      gapY: 14,
      pad: 10,
    });
  };

  grid.onmouseleave = () => {
    heatmapTooltip.classList.add("tooltip-hidden");
    heatmapTooltip.classList.remove("tooltip-visible");
  };

  renderTrendSection(year, startDate, endDate, dailyCounts);
  requestAnimationFrame(()=>updateHeatmapNavigation(year));
}

let heatmapNavigationYear=null;
function updateHeatmapNavigation(year,force=false){
  const box=document.getElementById('heatmapScroll'),nav=document.getElementById('heatmapNavigation'),button=document.getElementById('heatmapCurrent');
  if(!box||!box.clientWidth)return;
  nav.hidden=box.scrollWidth<=box.clientWidth+2;
  const current=year===new Date().getFullYear();button.hidden=!current;
  button.onclick=()=>updateHeatmapNavigation(year,true);
  if(!nav.hidden&&(force||heatmapNavigationYear!==year)){
    const target=current?document.querySelector('[data-date="'+toISODate(new Date())+'"]'):document.querySelector('#heatmapGrid [data-date]');
    if(target)box.scrollLeft+=target.getBoundingClientRect().left-box.getBoundingClientRect().left-box.clientWidth*.6;
    heatmapNavigationYear=year;
  }
}

/* ---------- Color scale ---------- */

function buildColorScale(counts, maxCount) {
  const positive = counts.filter((c) => c > 0);
  if (!positive.length) {
    return { type: "none", thresholds: null, max: 0 };
  }

  const sorted = positive.slice().sort((a, b) => a - b);

  const percentile = (p) => {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    const weight = idx - lower;
    return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
  };

  let thresholds = [
    Math.round(percentile(0.2)),
    Math.round(percentile(0.4)),
    Math.round(percentile(0.6)),
    Math.round(percentile(0.8)),
  ];

  // Ensure non-decreasing and at least 1
  let last = 1;
  thresholds = thresholds.map((t) => {
    if (!Number.isFinite(t) || t < last) {
      return last;
    }
    last = t;
    return t;
  });

  return {
    type: "percentile",
    thresholds,
    max: maxCount || sorted[sorted.length - 1] || 1,
  };
}

function getColorLevel(count, scale) {
  if (!scale || count === 0) return 0;

  if (scale.type === "percentile" && scale.thresholds) {
    const [p20, p40, p60, p80] = scale.thresholds;

    if (count <= p20) return 1;
    if (count <= p40) return 2;
    if (count <= p60) return 3;
    if (count <= p80) return 4;
    return 4;
  }

  if (!scale.max || scale.max <= 0) return 1;

  const normalized = Math.log(count + 1) / Math.log(scale.max + 1);
  if (normalized <= 0.25) return 1;
  if (normalized <= 0.5) return 2;
  if (normalized <= 0.75) return 3;
  return 4;
}

/* ---------- Streaks ---------- */

function computeStreaks(year, startDate, endDate, dailyCounts) {
  let longest = 0;
  let current = 0;
  let streak = 0;

  // Longest streak within the selected year
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = toISODate(d);
    const count = dailyCounts[dateStr] || 0;
    if (count > 0) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 0;
    }
  }

  // Current streak (GitHub-style: ending at today if same year, otherwise end of that year)
  const today = new Date();
  const todayYear = today.getFullYear();
  let endForCurrent;

  if (year === todayYear) {
    endForCurrent = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
  } else {
    endForCurrent = new Date(year, 11, 31);
  }

  current = 0;
  for (
    let d = new Date(endForCurrent);
    d >= startDate;
    d.setDate(d.getDate() - 1)
  ) {
    if (year === todayYear && d > today) continue;

    const dateStr = toISODate(d);
    const count = dailyCounts[dateStr] || 0;

    if (count > 0) {
      current++;
    } else {
      if (year === todayYear && d.toDateString() === today.toDateString()) {
        current = 0;
      }
      break;
    }
  }

  return { current, longest };
}

/* ---------- Trend charts & stats ---------- */

function renderTrendSection(year, startDate, endDate, dailyCounts) {
  // 24h chart for today (or latest day with timestamps)
  updateDailyChartForToday();

  const weeklyTotals = new Map();
  const monthlyTotals = new Map();
  const weekdayTotals = new Array(7).fill(0); // 0 Sun - 6 Sat

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = toISODate(d);
    const count = dailyCounts[dateStr] || 0;

    const weekKey = getWeekStartISO(d);
    weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + count);

    const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + count);

    weekdayTotals[d.getDay()] += count;
  }

  renderWeeklyStats(weeklyTotals);
  renderMonthlyStats(year, monthlyTotals);
  renderBusiestWeekday(weekdayTotals);

  updateTimeDistribution();
}

function getWeekStartISO(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun - 6 Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return toISODate(d);
}

/* ---------- Canvas helpers ---------- */

function getCanvasContext(canvas) {
  const ctx = canvas.getContext("2d");

  
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return {ctx, width:0, height:0};
  if (!canvas.style.height) canvas.style.height = rect.height + "px";

  
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  
  ctx.scale(dpr, dpr);

  return {
    ctx,
    width: canvas.width / dpr,
    height: canvas.height / dpr,
  };
}

/* ---------- 24h Daily Activity chart ---------- */

function initDailyChartInteractions() {
  const canvas = document.getElementById("dailyChart");
  if (!canvas) return;
  hourlyChartState.canvas = canvas;

  const tooltip = document.getElementById("dailyTooltip");
  canvas.addEventListener("mousemove", (event) =>
    handleDailyChartHover(event, tooltip)
  );
  canvas.addEventListener("mouseleave", () => handleDailyChartLeave(tooltip));
}

function updateDailyChartForToday() {
  const t = window.GPTTrackerI18n ? window.GPTTrackerI18n.t : (k, f) => f || k;
  const todayStr = toISODate(new Date());
  const entry = normalizeEntry(allData[todayStr]);

  const hours = new Array(24).fill(0);
  const timestamps = entry.timestamps.filter(ts=>ts<=Date.now()&&toISODate(ts)===todayStr);
  let hasDetailed = timestamps.length > 0;

  if (hasDetailed) {
    timestamps.forEach((ts) => {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())||ts>Date.now()) return;
      const dateStr = toISODate(d);
      if (dateStr !== todayStr) return;
      const h = d.getHours();
      if (h >= 0 && h < 24) {
        hours[h] = (hours[h] || 0) + 1;
      }
    });
  }

  hourlyChartState.hours = hours;
  hourlyChartState.hasDetailed = hasDetailed;
  hourlyChartState.total = entry.count;
  hourlyChartState.hoverIndex = -1;

  renderDailyChart();
}

function renderDailyChart() {
  const canvas = hourlyChartState.canvas;
  if (!canvas) return;

  const tooltip = document.getElementById("dailyTooltip");
  const empty=document.getElementById('dailyEmpty');
  canvas.parentElement.classList.toggle('is-empty',!hourlyChartState.hasDetailed);
  empty.hidden=hourlyChartState.hasDetailed;
  empty.textContent=GPTTrackerI18n.t(hourlyChartState.total?'chart_daily_no_detail':'chart_daily_empty');
  const { ctx, width, height } = getCanvasContext(canvas);
  ctx.clearRect(0, 0, width, height);

  const margin = { top: 10, right: 12, bottom: 24, left: 32 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const styles = getComputedStyle(document.body);
  const axisColor =
    (styles.getPropertyValue("--muted-text-color") || "#656d76").trim();
  const lineColor =
    (styles.getPropertyValue("--accent-color") || "#f06292").trim();
  const gridColor =
    (styles.getPropertyValue("--border-color") || "#d0d7de").trim();

  ctx.font =
    '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = axisColor;
  ctx.fillStyle = axisColor;

  // Axes
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, height - margin.bottom);
  ctx.lineTo(width - margin.right, height - margin.bottom);
  ctx.stroke();

  const t = window.GPTTrackerI18n ? window.GPTTrackerI18n.t : (k, f) => f || k;
  const hours = hourlyChartState.hours.slice();
  const hasDetailed = hourlyChartState.hasDetailed;

  const maxCount = hours.reduce((max, v) => (v > max ? v : max), 0);
  hourlyChartState.points = [];

  if (!hasDetailed) {
    ctx.clearRect(0,0,width,height);
    if(tooltip)tooltip.classList.add("tooltip-hidden");
    return;
  }

  if (maxCount === 0) {
    ctx.fillStyle = axisColor;
    ctx.textAlign = "left";
    ctx.fillText(
      t("chart_daily_no_data", "No activity recorded today."),
      margin.left + 4,
      margin.top + 20
    );
    if (tooltip) {
      tooltip.classList.add("tooltip-hidden");
      tooltip.classList.remove("tooltip-visible");
    }
    return;
  }

  // Y-axis grid
  const yStep = Math.max(Math.ceil(maxCount / 4), 1);
  for (let v = 0; v <= maxCount; v += yStep) {
    const ratio = v / maxCount;
    const y = margin.top + (1 - ratio) * plotHeight;

    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.fillText(String(v), margin.left - 4, y);
  }

  // X-axis ticks: 0, 6, 12, 18, 23
  const tickHours = [0, 6, 12, 18, 23];
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  tickHours.forEach((h) => {
    const ratio = 23 > 0 ? h / 23 : 0.5;
    const x = margin.left + ratio * plotWidth;
    const label = `${String(h).padStart(2, "0")}:00`;
    ctx.fillStyle = axisColor;
    ctx.fillText(label, x, height - margin.bottom + 4);
  });

  // Line
  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.6;

  hours.forEach((count, hour) => {
    const ratioX = 23 > 0 ? hour / 23 : 0.5;
    const x = margin.left + ratioX * plotWidth;
    const y = margin.top + (1 - count / maxCount) * plotHeight;

    hourlyChartState.points[hour] = { hour, x, y, value: count };

    if (hour === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Highlight point / vertical guide under hover
  const hoverIndex = hourlyChartState.hoverIndex;
  if (hoverIndex >= 0 && hourlyChartState.points[hoverIndex]) {
    const pt = hourlyChartState.points[hoverIndex];

    // vertical guide line
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = lineColor + "66";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pt.x, margin.top);
    ctx.lineTo(pt.x, height - margin.bottom);
    ctx.stroke();
    ctx.restore();

    // glow point
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = lineColor;
    ctx.beginPath();
    ctx.fillStyle = lineColor;
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // outer ring
    ctx.beginPath();
    ctx.strokeStyle = lineColor + "88";
    ctx.lineWidth = 2;
    ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function handleDailyChartHover(event, tooltip) {
  const canvas = hourlyChartState.canvas;
  if (!canvas || !tooltip) return;
  if (!hourlyChartState.hasDetailed) return;
  if (!hourlyChartState.points.length) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  
  
  const marginLeft = 32;
  const marginRight = 12;
  const plotWidth = rect.width - marginLeft - marginRight;

  if (plotWidth <= 0 || x < marginLeft || x > rect.width - marginRight) {
    if (hourlyChartState.hoverIndex !== -1) {
      hourlyChartState.hoverIndex = -1;
      renderDailyChart();
    }
    tooltip.classList.add("tooltip-hidden");
    tooltip.classList.remove("tooltip-visible");
    return;
  }

  let nearestIndex = -1;
  let minDx = Infinity;

  hourlyChartState.points.forEach((pt, index) => {
    if (!pt) return;
    const dx = Math.abs(pt.x - x);
    if (dx < minDx) {
      minDx = dx;
      nearestIndex = index;
    }
  });

  const stepX = 23 > 0 ? plotWidth / 23 : plotWidth;
  const thresholdX = stepX * 0.6; 

  if (nearestIndex === -1 || minDx > thresholdX) {
    if (hourlyChartState.hoverIndex !== -1) {
      hourlyChartState.hoverIndex = -1;
      renderDailyChart();
    }
    tooltip.classList.add("tooltip-hidden");
    tooltip.classList.remove("tooltip-visible");
    return;
  }

  if (nearestIndex !== hourlyChartState.hoverIndex) {
    hourlyChartState.hoverIndex = nearestIndex;
    renderDailyChart();
  }

  const pt = hourlyChartState.points[nearestIndex];
  if (!pt) return;

  const t = window.GPTTrackerI18n ? window.GPTTrackerI18n.t : (k, f) => f || k;
  const range = formatHourRange(pt.hour);
  const unit = t("unit_prompt_suffix", " times");
  tooltip.textContent = `${range} · ${pt.value}${unit}`;

  tooltip = ensureFloatingTooltip(tooltip);

  tooltip.classList.remove("tooltip-hidden");
  tooltip.classList.add("tooltip-visible");

  placeTooltipNearPointer(tooltip, event.clientX, event.clientY, {
    gapX: 14,
    gapY: 14,
    pad: 10,
  });
  return;
}

function handleDailyChartLeave(tooltip) {
  if (!tooltip) return;
  hourlyChartState.hoverIndex = -1;
  renderDailyChart();
  tooltip.classList.add("tooltip-hidden");
  tooltip.classList.remove("tooltip-visible");
}

function formatHourRange(hour) {
  const start = String(hour).padStart(2, "0");
  const end = String(Math.min(hour + 1, 24)).padStart(2, "0");
  return `${start}:00–${end}:00`;
}

/* ---------- Weekly / monthly / weekday stats ---------- */

function renderWeeklyStats(weeklyTotals) {
  const list=document.getElementById('weeklyTotals'),avg=document.getElementById('weeklyAverage');if(!list||!avg)return;
  const entries=[...weeklyTotals.entries()].sort((a,b)=>a[0].localeCompare(b[0])).filter(([,total])=>total>0);
  renderSummaryColumns(list,entries.map(([key,total])=>({label:key.slice(5).replace('-','/'),full:key,total})), 'weekly');
  avg.textContent=entries.length?Math.round(entries.reduce((sum,[,n])=>sum+n,0)/entries.length)+GPTTrackerI18n.t('unit_per_week'):'—';
}

function getMonthShortName(index) {
  const t = window.GPTTrackerI18n ? window.GPTTrackerI18n.t : (k, f) => f || k;
  const keys = [
    "month_1_short",
    "month_2_short",
    "month_3_short",
    "month_4_short",
    "month_5_short",
    "month_6_short",
    "month_7_short",
    "month_8_short",
    "month_9_short",
    "month_10_short",
    "month_11_short",
    "month_12_short",
  ];
  const fallbacks = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return t(keys[index] || "", fallbacks[index] || "");
}

function renderMonthlyStats(year,monthlyTotals) {
  const list=document.getElementById('monthlyTotals'),avg=document.getElementById('monthlyAverage');if(!list)return;
  const now=new Date(),entries=Array.from({length:12},(_,month)=>({label:getMonthShortName(month),full:getMonthShortName(month)+' '+year,total:monthlyTotals.get(`${year}-${String(month+1).padStart(2,'0')}`)||0,current:year===now.getFullYear()&&month===now.getMonth()}));
  renderSummaryColumns(list,entries,'monthly');
  const active=entries.filter(x=>x.total>0);if(avg)avg.textContent=active.length?Math.round(active.reduce((sum,x)=>sum+x.total,0)/active.length)+GPTTrackerI18n.t('unit_per_month'):'—';