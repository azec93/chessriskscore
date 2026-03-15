// ============================================================
// CONTENT SCRIPT v8
// ============================================================

(function () {
  'use strict';

  let api, calculator, overlay, detector, injector;
  const cache = new Map();
  let viewingSelf = false;
  let platform = 'chesscom';

  function detectPlatform() { return location.hostname.includes('lichess.org') ? 'lichess' : 'chesscom'; }

  function detectTimeFormat() {
    if (platform === 'lichess') {
      // Lichess: check game info elements for speed text
      const speedEls = document.querySelectorAll('.setup .header, .game-infos .header, .round__app .setup, [class*="game-infos"], .crosstable__users');
      for (const el of speedEls) {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('bullet') || t.includes('ultrabullet')) return 'bullet';
        if (t.includes('blitz')) return 'blitz';
        if (t.includes('rapid')) return 'rapid';
      }
      // Check page title
      const title = document.title.toLowerCase();
      if (title.includes('bullet')) return 'bullet';
      if (title.includes('blitz')) return 'blitz';
      if (title.includes('rapid')) return 'rapid';
      // Check time control text like "1+0", "3+0", "10+0"
      const tcEls = document.querySelectorAll('.setup, .game-infos, .round__app');
      for (const el of tcEls) {
        const t = (el.textContent || '');
        if (/\b1\+0\b|\b2\+1\b|\b1\s*[•·]\s*0\b/.test(t)) return 'bullet';
        if (/\b3\+0\b|\b5\+0\b|\b3\+2\b|\b5\+3\b/.test(t)) return 'blitz';
        if (/\b10\+0\b|\b15\+10\b|\b10\+5\b|\b30\+0\b/.test(t)) return 'rapid';
      }
      return null;
    }

    // Chess.com detection — images/icons first, then text, then clocks
    const url = location.href;
    if (/\/daily/.test(url)) return 'daily';

    // 1. HIGHEST PRIORITY: Look for time control icon images (the stopwatch/lightning/bullet icons)
    // Chess.com renders these as img tags or elements with class containing the format name
    const iconImgs = document.querySelectorAll('img[src*="bullet"], img[src*="blitz"], img[src*="rapid"], img[src*="lightning"], img[src*="stopwatch"], img[alt*="Bullet"], img[alt*="Blitz"], img[alt*="Rapid"]');
    for (const img of iconImgs) {
      const src = ((img.getAttribute('src') || '') + ' ' + (img.getAttribute('alt') || '')).toLowerCase();
      if (src.includes('bullet')) return 'bullet';
      if (src.includes('blitz') || src.includes('lightning')) return 'blitz';
      if (src.includes('rapid') || src.includes('stopwatch')) return 'rapid';
    }

    // 2. Look for chess.com's time-selector/time-control elements with exact text matches
    const tcEls = document.querySelectorAll('[class*="time-selector"] *, [class*="time-control"] *, [class*="game-over"] *, [class*="header-title"] *');
    for (const el of tcEls) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'bullet') return 'bullet';
      if (t === 'blitz') return 'blitz';
      if (t === 'rapid') return 'rapid';
    }

    // 3. Look in broader game info areas for format name or time control string
    const infoSels = [
      '[class*="game-info"]', '[class*="gameInfo"]', '[class*="game-over"]',
      '[class*="timeControl"]', '.board-layout-top', '[class*="observing"]',
      '[class*="game-result"]',
    ];
    for (const sel of infoSels) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const t = (el.textContent || '').toLowerCase();
        if (/\bbullet\b/.test(t) || /\(1 min\)|\(1\+0\)|\(2\+1\)/.test(t)) return 'bullet';
        if (/\bblitz\b/.test(t) || /\(3 min\)|\(5 min\)|\(3\+0\)|\(5\+0\)|\(3\+2\)|\(5\+5\)/.test(t)) return 'blitz';
        if (/\brapid\b/.test(t) || /\(10 min\)|\(15 min\)|\(10\+0\)|\(15\+10\)|\(30 min\)/.test(t)) return 'rapid';
      }
    }

    // 4. Page title often contains format
    const pageTitle = document.title.toLowerCase();
    if (/bullet/.test(pageTitle)) return 'bullet';
    if (/blitz/.test(pageTitle)) return 'blitz';
    if (/rapid/.test(pageTitle)) return 'rapid';

    // 5. URL path
    if (/\/bullet/.test(url)) return 'bullet';
    if (/\/blitz/.test(url)) return 'blitz';
    if (/\/rapid/.test(url)) return 'rapid';

    // NO clock fallback — remaining time ≠ starting time
    return null;
  }

  function init() {
    platform = detectPlatform();

    // Listen for popup asking which platform we're on
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'get-platform') {
        sendResponse({ platform: platform || 'chesscom' });
      }
    });

    if (platform === 'lichess') {
      api = new LichessAPI();
      detector = new LichessOpponentDetector((u) => analyzePlayer(u, false), () => injector.removeAll());
    } else {
      api = new ChessAPI();
      detector = new OpponentDetector((u) => analyzePlayer(u, false), () => injector.removeAll());
    }
    calculator = new RiskCalculator(CONFIG);
    overlay = new OverlayUI();
    injector = new InsightsInjector();
    overlay.create();
    detector.start();
    console.log(`[ChessRisk] Running on ${platform === 'lichess' ? 'Lichess' : 'Chess.com'}`);

    // Watch for URL changes (spectating different games) — clear cache and re-detect
    let lastContentUrl = location.href;
    setInterval(() => {
      if (location.href !== lastContentUrl) {
        lastContentUrl = location.href;
        cache.clear();
        viewingSelf = false;
      }
    }, 400);
    window.addEventListener('crs:refresh', (e) => {
      cache.delete(e.detail.username.toLowerCase()); injector.removeAll();
      analyzePlayer(e.detail.username, viewingSelf);
    });
    window.addEventListener('crs:toggle-view', () => {
      viewingSelf = !viewingSelf;
      if (viewingSelf) {
        const myName = detector._getMyUsername();
        if (myName) analyzePlayer(myName, true);
        else { overlay.showError('?', 'Could not detect your username'); viewingSelf = false; }
      } else {
        const opp = detector._findOpponent();
        if (opp) analyzePlayer(opp, false);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'c') {
        const opp = detector._findOpponent();
        if (opp) { cache.delete(opp.toLowerCase()); analyzePlayer(opp, false); }
        else overlay.showError('?', 'Could not detect opponent.');
      }
    });
  }

  async function analyzePlayer(username, isSelf) {
    if (!username || username.length < 2) return;
    const key = username.toLowerCase();
    const oppName = detector._findOpponent() || 'Opponent';
    const myName = detector._getMyUsername() || 'Me';

    // Detect format from DOM as a hint (may be wrong)
    let domFormat = detectTimeFormat();

    overlay.showLoading(username);
    try {
      const data = await api.fetchAllData(username);

      // RELIABLE FORMAT DETECTION: find the current game in API data
      // by matching both players (opponent + self) in the recent games
      let apiFormat = null;
      const otherPlayer = isSelf ? oppName : myName;
      if (otherPlayer && data.recentGames && data.recentGames.length > 0) {
        const otherL = otherPlayer.toLowerCase();
        // Sort by most recent first
        const sorted = [...data.recentGames].sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
        for (const game of sorted) {
          const wName = (game.white?.username || '').toLowerCase();
          const bName = (game.black?.username || '').toLowerCase();
          if ((wName === otherL || bName === otherL) && game.time_class) {
            apiFormat = game.time_class;
            break;
          }
        }
      }

      // If no match by opponent, use the most recent game's format
      if (!apiFormat && data.recentGames && data.recentGames.length > 0) {
        const sorted = [...data.recentGames].sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
        if (sorted[0]?.time_class) apiFormat = sorted[0].time_class;
      }

      // API format takes priority, DOM format as fallback
      const currentFormat = apiFormat || domFormat || null;

      const result = calculator.calculate(data, currentFormat, platform);
      result._scoredFormat = currentFormat;
      cache.set(key, result);
      overlay.showResult(username, result, isSelf, oppName, myName);
      if (!isSelf) injector.injectOpponentStats(username, result.insights);
    } catch (err) {
      console.error('[ChessRisk]', err);
      overlay.showError(username, err.message || 'Failed to fetch player data');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
