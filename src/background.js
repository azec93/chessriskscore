// ============================================================
// BACKGROUND SERVICE WORKER
// Handles extension lifecycle and cross-tab messaging
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChessRisk] Extension installed/updated');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse({ status: 'ok' });
  }
  return true;
});
