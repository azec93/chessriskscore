// ============================================================
// BACKGROUND SCRIPT (service worker in Chrome, event page in Firefox)
// Handles extension lifecycle and cross-tab messaging
// ============================================================

// Let the content script read the per-session flag used to play the BTTW animation once.
// Optional: where the browser does not support it, the animation simply rests from the start.
try {
  const p = chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
  if (p && typeof p.catch === 'function') p.catch(() => {});
} catch (e) {}

// My cheater stats: the scan runs here so it carries on when the popup is closed. Chrome loads the two files with importScripts;
// Firefox lists them before this file in its background scripts. Nothing runs until the popup sends a message.
try { if (typeof importScripts === 'function') importScripts('../history-core.js', 'historyEngine.js', '../skills-core.js', 'skillsEngine.js'); } catch (e) { console.warn('[ChessRisk] stats engine not loaded', e); }
if (typeof CRS_HISTENG !== 'undefined') CRS_HISTENG.init();
if (typeof CRS_SKENG !== 'undefined') CRS_SKENG.init();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChessRisk] Extension installed/updated');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (typeof CRS_HISTENG !== 'undefined' && CRS_HISTENG.handle(msg)) { sendResponse({ ok: true, v: CRS_HIST.PROTO }); return false; }
  if (typeof CRS_SKENG !== 'undefined' && CRS_SKENG.handle(msg)) { sendResponse({ ok: true, v: CRS_HIST.PROTO }); return false; }
  if (msg.type === 'ping') {
    sendResponse({ status: 'ok' }); // synchronous — no need to hold the port open
  }
  // Returning true here would keep the response channel open for EVERY message
  // (including ones this listener ignores), causing "message port closed" noise.
  return false;
});
