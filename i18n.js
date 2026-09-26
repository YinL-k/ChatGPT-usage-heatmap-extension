(function () {
  const state = {
    currentLang: "zh",
    messages: {},
  };

  let generation=0;
  async function initI18n(lang) {
    const request=++generation;
    state.currentLang = lang === "en" ? "en" : "zh";
    try {
      const url = chrome.runtime.getURL(`locales/${state.currentLang}.json`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load locale file");
      }
      const messages=await res.json();if(request!==generation)return;state.messages=messages;
    } catch (err) {
      if(request!==generation)return;
      console.error("[SakuraMeter] i18n load failed:", err);
      state.messages = {};
    }

    if(request!==generation)return;
    applyI18n(document);
    document.documentElement.lang = state.currentLang === "zh" ? "zh-CN" : "en";
    document.dispatchEvent(new CustomEvent("gpt-language-changed"));
  }

  function applyI18n(root) {
    const target = root || document;
    target.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));
    const elements = target.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const text = t(key, el.textContent || "");
      if (text != null) {
        el.textContent = text;
      }
    });
  }

  function t(key, fallback) {
    if (!key) return fallback || "";
    const value = state.messages[key];
    if (typeof value === "string") return value;
    return fallback !== undefined ? fallback : key;
  }

  window.GPTTrackerI18n = {
    initI18n,
    applyI18n,
    t,
    get currentLang() {
      return state.currentLang;
    },
  };
})();