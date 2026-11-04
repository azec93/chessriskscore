// Offscreen page (Chrome): passes work from the background script to the engine host, and results back.
chrome.runtime.onMessage.addListener(m => {
  if (!m || typeof m.type !== 'string') return;
  const say = x => { try { chrome.runtime.sendMessage(x).catch(() => {}); } catch (e) {} };
  if (m.type === 'skh-run') CRS_SKHOST.run(m.games, m.workers, (row, id) => say({ type: 'sk-row', row, id }), error => say({ type: 'sk-end', error }));
  else if (m.type === 'skh-stop') CRS_SKHOST.stop();
});
try { chrome.runtime.sendMessage({ type: 'sk-hostready' }).catch(() => {}); } catch (e) {}
