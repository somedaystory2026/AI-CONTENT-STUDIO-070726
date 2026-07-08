// sidepanel.js
// v0.4.1: 1초 자동 확인 제거. 패널 열 때 1회 로드 + 사용자가 새로고침 버튼 클릭 시에만 로드.

const emptyEl = document.getElementById("pending-empty");
const cardEl = document.getElementById("pending-card");
const titleEl = document.getElementById("song-title");
const metaEl = document.getElementById("song-meta");
const styleEl = document.getElementById("song-style");
const lyricsEl = document.getElementById("song-lyrics");
const statusEl = document.getElementById("status");

const btnInject = document.getElementById("btn-inject");
const btnInjectCreate = document.getElementById("btn-inject-create");
const btnClear = document.getElementById("btn-clear");
const btnCopyStyle = document.getElementById("btn-copy-style");
const btnCopyLyrics = document.getElementById("btn-copy-lyrics");
const btnReload = document.getElementById("btn-reload");

let currentSong = null;

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = type;
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text || "");
    setStatus(`${label} 복사됨`, "success");
    setTimeout(() => setStatus(""), 1600);
  } catch (err) {
    setStatus("복사 실패", "error");
  }
}

function render(song) {
  currentSong = song;
  if (!song) {
    emptyEl.style.display = "block";
    cardEl.style.display = "none";
    return;
  }
  emptyEl.style.display = "none";
  cardEl.style.display = "block";
  titleEl.textContent = `🎵 ${song.songTitle || song.title || "제목 없음"}`;
  metaEl.textContent = song.receivedAt
    ? `받은 시각: ${new Date(song.receivedAt).toLocaleTimeString()}`
    : "";
  styleEl.textContent = song.sunoStylePrompt || "(없음)";
  lyricsEl.textContent = song.lyrics || "(없음)";
}

async function loadPending(showMessage = false) {
  try {
    const res = await chrome.runtime.sendMessage({ action: "GET_PENDING_SONG" });
    render(res && res.success ? res.data : null);
    if (showMessage) {
      setStatus(res && res.success && res.data ? "최신 곡을 불러왔습니다." : "저장된 곡이 없습니다.", res && res.data ? "success" : "");
      setTimeout(() => setStatus(""), 1600);
    }
  } catch (err) {
    setStatus("곡을 불러오지 못했습니다.", "error");
  }
}

async function doInject(clickCreate) {
  if (!currentSong) return;
  btnInject.disabled = true;
  btnInjectCreate.disabled = true;
  setStatus("Suno 탭에 입력 중...");

  try {
    const res = await chrome.runtime.sendMessage({
      action: "INJECT_TO_ACTIVE_TAB",
      data: currentSong,
      clickCreate,
    });
    if (res && res.success) {
      setStatus(clickCreate ? "입력 + 곡 만들기 완료!" : "입력 완료!", "success");
    } else {
      setStatus((res && res.error) || "입력에 실패했습니다.", "error");
    }
  } catch (err) {
    setStatus("확장프로그램과 통신 중 오류가 발생했습니다.", "error");
  } finally {
    btnInject.disabled = false;
    btnInjectCreate.disabled = false;
  }
}

btnCopyStyle.addEventListener("click", () => copyText(currentSong?.sunoStylePrompt || "", "Style"));
btnCopyLyrics.addEventListener("click", () => copyText(currentSong?.lyrics || "", "Lyrics"));
btnReload?.addEventListener("click", () => loadPending(true));

btnInject.addEventListener("click", () => doInject(false));
btnInjectCreate.addEventListener("click", () => {
  if (!confirm("Suno에서 실제로 '곡 만들기' 버튼까지 클릭할까요? (크레딧이 소모될 수 있어요)")) return;
  doInject(true);
});

btnClear.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "CLEAR_PENDING_SONG" });
  setStatus("");
  render(null);
});

// 패널을 처음 열 때만 1회 로드합니다. 자동 반복 확인 없음.
loadPending(false);
