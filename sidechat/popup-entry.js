(() => {
  'use strict';
  const button = document.getElementById('scOpen'); if (!button) return;
  let windowId = null;
  chrome.windows.getCurrent().then(w => { windowId = w.id; }).catch(() => {});
  const label = () => { const zh = document.documentElement.lang.startsWith('zh'); button.querySelector('span').textContent = zh ? '\u4fa7\u8fb9\u804a\u5929' : 'Side Chat'; button.title = (zh ? '\u6253\u5f00 ChatGPT \u4fa7\u8fb9\u804a\u5929' : 'Open ChatGPT Side Chat') + ' (Alt + Shift + C)'; };
  label(); document.addEventListener('gpt-language-changed', label);
  button.addEventListener('click', () => {
    if (windowId === null) return;
    // Invoke in the click handler, not after an unrelated async task.
    chrome.sidePanel.open({ windowId }).then(() => window.close()).catch(() => { button.title = 'Open chrome://extensions/shortcuts and assign Side Chat a shortcut.'; });
  });
})();