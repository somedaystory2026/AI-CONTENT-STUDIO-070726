// content-suno.js — Suno v5.5 대응판
// Suno.com의 Create 화면에 제목 / Style of Music / Lyrics를 자동 입력합니다.
// Suno UI가 자주 바뀌므로 textarea, input, contenteditable, role=textbox를 모두 fallback 탐색합니다.

const SELECTORS = {
  titleInput: [
    'input[placeholder*="Song Title"]',
    'input[placeholder*="곡 제목"]',
    'input[placeholder*="Title"]',
    'input[aria-label*="Song Title"]',
  ],
  styleBox: [
    '[data-testid="create-form-styles-wrapper"] textarea',
    '[data-testid="create-form-styles-wrapper"] [role="textbox"]',
    'textarea[placeholder*="Describe the sound"]',
    'textarea[placeholder*="breakdown"]',
  ],
  lyricsBox: [
    'textarea[data-testid="lyrics-textarea"]',
    '[aria-label="Lyrics editor"]',
    '[aria-label*="Lyrics"][contenteditable="true"]',
    '.lyrics-editor-content[contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
  ],
  createButton: [
    'button[aria-label="Create song"]',
    'button[aria-label*="Create"]',
    'button[aria-label*="노래"]',
  ],
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function q(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && isVisible(el)) return el;
  }
  return null;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.suno-bridge-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'suno-bridge-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    top: '24px',
    right: '24px',
    background: type === 'error' ? 'rgba(220, 38, 38, 0.96)' : 'rgba(17, 24, 39, 0.96)',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '700',
    zIndex: '2147483647',
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    maxWidth: '520px',
    lineHeight: '1.45',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : el instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : null;

  if (proto) {
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  } else {
    el.value = value;
  }

  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setContentEditableValue(el, value) {
  el.focus();
  el.click();

  // React/Lexical/ProseMirror 계열을 최대한 깨우기 위해 selection + beforeinput/input 이벤트 사용
  const range = document.createRange();
  range.selectNodeContents(el);
  range.deleteContents();
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    document.execCommand('insertText', false, value);
  } catch (_) {
    el.textContent = value;
  }

  if ((el.textContent || '').trim() !== value.trim()) {
    el.textContent = value;
  }

  el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: value }));
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
}

function setValue(el, value) {
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.focus();
  el.click();
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    setContentEditableValue(el, value);
  } else {
    setNativeValue(el, value);
  }
  return true;
}

function allVisibleTextareas() {
  return Array.from(document.querySelectorAll('textarea')).filter(isVisible);
}

function allVisibleTextboxes() {
  return Array.from(document.querySelectorAll('[role="textbox"], [contenteditable="true"]')).filter(isVisible);
}

function findTitleInput() {
  return q(SELECTORS.titleInput) || Array.from(document.querySelectorAll('input')).find((el) => {
    const txt = `${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
    return isVisible(el) && /song|title|제목/.test(txt);
  });
}

function findStyleBox() {
  const direct = q(SELECTORS.styleBox);
  if (direct) return direct;

  const wrapper = document.querySelector('[data-testid="create-form-styles-wrapper"]');
  if (wrapper) {
    const inside = Array.from(wrapper.querySelectorAll('textarea,[role="textbox"],[contenteditable="true"]')).find(isVisible);
    if (inside) return inside;
  }

  return allVisibleTextareas().find((el) => {
    const txt = `${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
    return /style|sound|genre|instrument|breakdown|스타일|장르/.test(txt);
  }) || allVisibleTextareas().at(-1);
}

function findLyricsBox() {
  const direct = q(SELECTORS.lyricsBox);
  if (direct) return direct;

  // 사용자가 보내준 최신 Suno 요소: div[aria-label="Lyrics editor"].lyrics-editor-content[contenteditable="true"][role="textbox"]
  const exact = document.querySelector('div.lyrics-editor-content[contenteditable="true"][role="textbox"]');
  if (exact && isVisible(exact)) return exact;

  const boxes = allVisibleTextboxes();
  const byLabel = boxes.find((el) => {
    const txt = `${el.getAttribute('aria-label') || ''} ${el.className || ''}`.toLowerCase();
    return /lyrics|lyric|가사/.test(txt);
  });
  if (byLabel) return byLabel;

  const areas = allVisibleTextareas();
  const byPlaceholder = areas.find((el) => {
    const txt = `${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
    return /lyrics|lyric|가사|writing/.test(txt);
  });
  if (byPlaceholder) return byPlaceholder;

  // Create 화면에서 보통 가장 큰 contenteditable이 가사창입니다.
  return boxes.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return (br.width * br.height) - (ar.width * ar.height);
  })[0] || null;
}

function injectTitle(text) {
  const el = findTitleInput();
  if (!el) return { success: false, error: '제목 입력창을 찾지 못했습니다.' };
  setValue(el, text);
  return { success: true, selector: describeEl(el) };
}

function injectStyle(text) {
  const el = findStyleBox();
  if (!el) return { success: false, error: '스타일 입력창을 찾지 못했습니다.' };
  setValue(el, text);
  return { success: true, selector: describeEl(el) };
}

function injectLyrics(text) {
  const el = findLyricsBox();
  if (!el) return { success: false, error: '가사 입력창을 찾지 못했습니다.' };
  setValue(el, text);
  return { success: true, selector: describeEl(el) };
}

function clickCreateButton() {
  let btn = q(SELECTORS.createButton);
  if (!btn) {
    btn = Array.from(document.querySelectorAll('button')).find((b) =>
      isVisible(b) && /create|곡 만들기|만들기/i.test(b.textContent || b.getAttribute('aria-label') || '')
    );
  }
  if (!btn) return { success: false, error: '곡 만들기 버튼을 찾지 못했습니다.' };
  if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
    return { success: false, error: '곡 만들기 버튼이 비활성화되어 있습니다.' };
  }
  btn.click();
  return { success: true };
}

function describeEl(el) {
  if (!el) return '';
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className ? `.${el.className.split(/\s+/).slice(0, 2).join('.')}` : '';
  const aria = el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '';
  return `${el.tagName.toLowerCase()}${id}${cls}${aria}`;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'INJECT_SONG') return;

  (async () => {
    const { songTitle, sunoStylePrompt, lyrics } = msg.data || {};
    const results = {};

    try {
      if (songTitle) results.title = injectTitle(songTitle);
      await sleep(220);
      if (sunoStylePrompt) results.style = injectStyle(sunoStylePrompt);
      await sleep(220);
      if (lyrics) results.lyrics = injectLyrics(lyrics);
      await sleep(120);

      const failed = Object.entries(results).filter(([, r]) => r && r.success === false);
      if (failed.length > 0) {
        const errorMsg = failed.map(([field, r]) => `${field}: ${r.error}`).join(' / ');
        showToast(`일부 입력 실패 — ${errorMsg}`, 'error');
        sendResponse({ success: false, error: errorMsg, results });
        return;
      }

      showToast('제목 / 스타일 / 가사 입력 완료');

      if (msg.clickCreate) {
        await sleep(400);
        const createResult = clickCreateButton();
        if (!createResult.success) {
          showToast(createResult.error, 'error');
          sendResponse({ success: true, results, createResult });
          return;
        }
        showToast('곡 만들기 버튼 클릭 완료');
        sendResponse({ success: true, results, createResult });
        return;
      }

      sendResponse({ success: true, results });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`입력 오류: ${message}`, 'error');
      sendResponse({ success: false, error: message, results });
    }
  })();

  return true;
});
