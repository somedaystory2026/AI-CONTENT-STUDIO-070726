// content-site.js
// v0.4.2: 자동 감시/자동 전송/자동 준비 알림 완전 제거
// - setInterval 없음
// - localStorage polling 없음
// - storage 이벤트 감시 없음
// - DOMContentLoaded/페이지 로드 자동 전송 없음
// - Extension ready 자동 토스트 없음
// - Studio의 [확장으로 보내기] 버튼 클릭에서 manual:true로 온 메시지만 1회 저장

const DAVID_MELODY_BRIDGE_CONTENT_SITE_VERSION = "0.4.2";
const ALLOWED_SOURCES = ["playlist-maker", "david-melody-studio", "david-melody-ai-studio"];
let lastSavedSignature = "";
let lastSaveAt = 0;

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const songTitle = String(payload.songTitle || payload.title || "").trim();
  const sunoStylePrompt = String(payload.sunoStylePrompt || payload.style || payload.stylePrompt || "").trim();
  const lyrics = String(payload.lyrics || payload.lyric || "").trim();
  if (!songTitle || !sunoStylePrompt || !lyrics) return null;
  return { ...payload, songTitle, sunoStylePrompt, lyrics };
}

function signature(payload) {
  return JSON.stringify({
    songTitle: payload.songTitle,
    sunoStylePrompt: payload.sunoStylePrompt,
    lyrics: payload.lyrics
  });
}

async function savePayload(rawPayload, via = "manual-postMessage", requestId = "") {
  const payload = normalizePayload(rawPayload);
  if (!payload) return;

  const sig = signature(payload);
  const now = Date.now();
  if (sig === lastSavedSignature && now - lastSaveAt < 3000) return;
  lastSavedSignature = sig;
  lastSaveAt = now;

  try {
    await chrome.runtime.sendMessage({
      action: "SAVE_PENDING_SONG",
      data: { ...payload, sentFrom: location.href, via, requestId }
    });
  } catch (err) {
    console.warn("[Suno Bridge] save failed", err);
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || !ALLOWED_SOURCES.includes(msg.source)) return;
  if (msg.type !== "SEND_TO_SUNO_BRIDGE") return;

  // 핵심 수정: 버튼 클릭에서 보낸 manual:true 메시지만 처리합니다.
  // 이전 버전/다른 코드의 자동 postMessage는 모두 무시합니다.
  if (msg.manual !== true) return;

  savePayload(msg.payload, "manual-postMessage", msg.requestId || "");
});
