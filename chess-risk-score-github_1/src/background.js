// ============================================================
// BACKGROUND SERVICE WORKER
// Handles extension lifecycle and cross-tab messaging
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChessRisk] Extension installed/updated');
});

// Handle messages from content script if needed in future
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse({ status: 'ok' });
  }
  return true;
});
