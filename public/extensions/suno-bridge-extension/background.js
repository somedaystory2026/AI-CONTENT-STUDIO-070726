// background.js — 서비스 워커
// 역할: 플레이리스트 메이커 사이트에서 온 곡 데이터를 저장하고,
//       팝업/컨텐츠 스크립트 사이의 메시지를 중계합니다.

const PENDING_KEY = "pendingSong";

// 툴바 아이콘을 클릭하면 팝업 대신 사이드패널이 열리도록 설정
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error("[Background] setPanelBehavior failed:", err));
}

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});


async function setPendingSong(song) {
  const record = {
    ...song,
    receivedAt: Date.now(),
  };
  await chrome.storage.local.set({ [PENDING_KEY]: record });
  chrome.action.setBadgeText({ text: "1" });
  chrome.action.setBadgeBackgroundColor({ color: "#7C3AED" });
  return record;
}

async function getPendingSong() {
  const { [PENDING_KEY]: song } = await chrome.storage.local.get(PENDING_KEY);
  return song || null;
}

async function clearPendingSong() {
  await chrome.storage.local.remove(PENDING_KEY);
  chrome.action.setBadgeText({ text: "" });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true; // 비동기 응답을 위해 true 반환
});

async function handleMessage(msg, sender) {
  switch (msg.action) {
    case "SAVE_PENDING_SONG": {
      const record = await setPendingSong(msg.data);
      // 사이트에 저장 성공 알림 (뱃지/토스트 용도)
      return { success: true, data: record };
    }

    case "GET_PENDING_SONG": {
      const song = await getPendingSong();
      return { success: true, data: song };
    }

    case "CLEAR_PENDING_SONG": {
      await clearPendingSong();
      return { success: true };
    }

    // 팝업 → 현재 활성 탭(Suno)으로 주입 요청 전달
    case "INJECT_TO_ACTIVE_TAB": {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          return { success: false, error: "활성 탭을 찾을 수 없습니다." };
        }
        if (!tab.url || !/suno\.com/.test(tab.url)) {
          return { success: false, error: "현재 탭이 Suno.com이 아닙니다. Suno 곡 만들기 화면에서 다시 시도해주세요." };
        }
        const result = await chrome.tabs.sendMessage(tab.id, {
          action: "INJECT_SONG",
          data: msg.data,
          clickCreate: !!msg.clickCreate,
        });
        return result || { success: false, error: "컨텐츠 스크립트로부터 응답이 없습니다." };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "주입 실패" };
      }
    }

    default:
      return { success: false, error: `알 수 없는 액션: ${msg.action}` };
  }
}
