// ============================================================
// CONTENT SCRIPT v10 — Settings, Zen Mode, Semi-Zen Mode
// v10: v10 calculator, instant display from a short-lived result cache,
//      embedded pieces that follow settings changes and survive Refresh
// ============================================================

(function () {
  'use strict';

  let api, calculator, overlay, detector, injector;
  const cache = new Map();
  let viewingSelf = false;
  let platform = 'chesscom';
  let settings = { autoShow: true, ratedOnly: true, zenMode: false, semiZenMode: false, embeddedRiskScore: false, embeddedStats: false, embedTimeInterval: 86400, embedHideOwnStats: false, embedColorHighlight: true, overlayScale: 1, verdictBadges: true, showReport: true, soundOn: false, soundFrom: 'high', soundPick: 'harp', soundVol: 'mid' };
  let pendingZenResult = null;
  let gameOverObserver = null;
  // What is embedded beside each username, so it can be redrawn when a setting changes.
  const soundedFor = new Set();                     // opponents already announced on this game page (a Refresh never repeats the sound)
  const embedState = { top: null, bottom: null };   // { username, result, games, format }
  let selfEmbedFor = null;                          // username whose bottom-bar embed is loaded/loading
  let analysisSeq = 0;                              // newest analyzePlayer call; older partial results are dropped
  let oppLoading = null;                            // lower-case name of the opponent being looked up (its downloads can be cancelled)
  // Run fn when the page is idle (at most ~1.5 s later), so scoring never competes with the first moves of a game.
  const whenIdle = () => new Promise(r => (window.requestIdleCallback ? window.requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 50)));

  // Stop the downloads for an opponent the page has moved on from (never your own).
  function cancelOpponent(exceptKey) {
    const me = (detector && detector._getMyUsername() || '').toLowerCase();
    if (oppLoading && oppLoading !== exceptKey && oppLoading !== me && api && api.cancel) api.cancel(oppLoading);
    oppLoading = null;
  }

  // ── Result cache: lets the overlay appear instantly for a player seen in the last
  // few minutes (page reload, rematch), while fresh data loads in the background. ──
  const RESULT_CACHE_KEY = 'crsResults_v160';
  const RESULT_TTL_MS = 10 * 60 * 1000;
  async function readCachedResult(key) {
    try {
      const all = (await chrome.storage.local.get(RESULT_CACHE_KEY))[RESULT_CACHE_KEY] || {};
      const hit = all[platform + ':' + key];
      return hit && (Date.now() - hit.ts) < RESULT_TTL_MS ? hit.result : null;
    } catch (e) { return null; }
  }
  async function writeCachedResult(key, result) {
    try {
      const all = (await chrome.storage.local.get(RESULT_CACHE_KEY))[RESULT_CACHE_KEY] || {};
      all[platform + ':' + key] = { ts: Date.now(), result };
      const keys = Object.keys(all).sort((a, b) => all[b].ts - all[a].ts);
      for (const k of keys.slice(30)) delete all[k];                    // keep the 30 newest
      await chrome.storage.local.set({ [RESULT_CACHE_KEY]: all });
    } catch (e) {}
  }

  // Draw (or remove) the embedded ring and W/L/D chip for one side from embedState.
  function applyEmbed(side) {
    const st = embedState[side];
    const hidden = side === 'bottom' && settings.embedHideOwnStats;
    if (!st || hidden) { injector.removeSide(side); return; }
    if (settings.embeddedRiskScore) injector.injectScoreCircle(st.result.score, st.result.level, side);
    else injector.removeScore(side);
    if (settings.embeddedStats) {
      const me = detector && detector._getMyUsername();
      const opts = { format: st.format, timeInterval: settings.embedTimeInterval, colorHighlight: settings.embedColorHighlight,
        reportUser: settings.showReport !== false && (!me || st.username.toLowerCase() !== me.toLowerCase()) ? st.username : null };
      injector.injectStats(st.username, injector.filterByTime(st.result.insights, st.games, st.username, opts), side, opts);
    } else injector.removeStat(side);
  }
  const embedsOn = () => settings.embeddedStats || settings.embeddedRiskScore;

  // Zen mode reveals the stored result when the game-over modal appears.
  // The observer is only attached while a Zen result is pending, so the busy
  // chess.com DOM isn't watched during normal (non-Zen) play.
  const GAME_OVER_SELECTOR = {
    chesscom: '[class*="game-over"],[class*="gameOver"],.board-modal-container',
    // Lichess: .result-wrap / .status render the result text; .follow-up shows
    // the rematch/new-game buttons once the game is over.
    lichess: '.rcontrols .follow-up, .result-wrap, .round__app .status',
  };
  function startGameOverWatch() {
    if (gameOverObserver) return;
    const selector = GAME_OVER_SELECTOR[platform] || GAME_OVER_SELECTOR.chesscom;
    gameOverObserver = new MutationObserver(() => {
      if (!pendingZenResult || !settings.zenMode) return;
      const gameOver = document.querySelector(selector);
      if (gameOver) {
        const { username, result, isSelf, oppName, myName } = pendingZenResult;
        overlay.showResult(username, result, isSelf, oppName, myName);
        pendingZenResult = null;
        stopGameOverWatch();
      }
    });
    gameOverObserver.observe(document.body, { childList: true, subtree: true });
  }
  function stopGameOverWatch() {
    if (gameOverObserver) { gameOverObserver.disconnect(); gameOverObserver = null; }
  }

  function applyOverlayScale() {
    const el = document.getElementById('chess-risk-overlay');
    if (el) {
      el.style.setProperty('--crs-scale', settings.overlayScale || 1);
    }
  }

  async function loadSettings() {
    try {
      const s = await chrome.storage.sync.get({ autoShow: true, ratedOnly: true, zenMode: false, semiZenMode: false, embeddedRiskScore: false, embeddedStats: false, embedTimeInterval: 86400, embedHideOwnStats: false, embedColorHighlight: true, overlayScale: 1, verdictBadges: true, showReport: true, soundOn: false, soundFrom: 'high', soundPick: 'harp', soundVol: 'mid' });
      settings = s;
      applyOverlayScale();
      if (overlay) { overlay.showBadges = settings.verdictBadges !== false; overlay.showReport = settings.showReport !== false; }
    } catch (e) {}
  }

  // Listen for settings changes in real-time
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in settings) settings[key] = newValue;
      }
      if (changes.overlayScale) applyOverlayScale();
      // Embedded pieces follow their settings immediately (they used to wait for the next game).
      if (injector && (changes.embeddedStats || changes.embeddedRiskScore || changes.embedTimeInterval || changes.embedHideOwnStats || changes.embedColorHighlight || changes.showReport)) {
        if (embedState.top || embedState.bottom) {
          applyEmbed('top'); applyEmbed('bottom');
          // Own bar was hidden or never loaded: fetch it now if it should be showing.
          if (embedsOn() && !settings.embedHideOwnStats && !embedState.bottom && detector) loadSelfEmbed(embedState.top ? embedState.top.format : null);
        } else if (embedsOn() && detector) {
          const opp = detector._findOpponent();
          if (opp) analyzePlayer(opp, false);
        }
      }
      if (overlay) { overlay.showBadges = settings.verdictBadges !== false; overlay.showReport = settings.showReport !== false; }
      // Live-refresh the open overlay when the badges setting is toggled
      if ((changes.verdictBadges || changes.showReport) && overlay && detector) {
        const name = viewingSelf ? detector._getMyUsername() : detector._findOpponent();
        const cached = name && cache.get(name.toLowerCase());
        const el = document.getElementById('chess-risk-overlay');
        if (cached && el && el.classList.contains('visible') && settings.autoShow && !settings.zenMode && !settings.semiZenMode) {
          const { oppName, myName } = resolveNames(name, viewingSelf);
          overlay.showResult(name, cached, viewingSelf, oppName, myName);
        }
      }
    });
  } catch (e) {}

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
        if (t.includes('correspondence') || t.includes('daily')) return 'daily';
      }
      // Check page title
      const title = document.title.toLowerCase();
      if (title.includes('bullet')) return 'bullet';
      if (title.includes('blitz')) return 'blitz';
      if (title.includes('rapid')) return 'rapid';
      if (title.includes('correspondence')) return 'daily';
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

  async function init() {
    platform = detectPlatform();
    await loadSettings();

    // Listen for popup asking which platform we're on
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'get-platform') {
        sendResponse({ platform: platform || 'chesscom' });
      }
    });

    if (platform === 'lichess') {
      api = new LichessAPI();
      detector = new LichessOpponentDetector((u) => onOpponentDetected(u), () => onGameEnd(), () => onNavigate());
    } else {
      api = new ChessAPI();
      detector = new OpponentDetector((u) => onOpponentDetected(u), () => onGameEnd(), () => onNavigate(), () => onNoOpponent());
    }
    calculator = new RiskCalculatorV11(CONFIG);
    overlay = new OverlayUI();
    injector = new InsightsInjector();
    overlay.create();
    overlay.showBadges = settings.verdictBadges !== false;
    overlay.showReport = settings.showReport !== false;
    applyOverlayScale();
    detector.start();
    console.log(`[ChessRisk] Running on ${platform === 'lichess' ? 'Lichess' : 'Chess.com'}`);

    // Navigation cleanup is driven by the detector's (single) pathname watcher via
    // onNavigate() — no separate URL-polling timer here.

    // Zen-mode game-over watch is attached lazily (see startGameOverWatch)
    window.addEventListener('crs:refresh', (e) => {
      cache.delete(e.detail.username.toLowerCase());
      if (api && api.cache) api.cache.clear(); // bust API URL cache so Refresh truly refetches
      if (api && api.forget) api.forget(e.detail.username);   // Lichess: download every game again, not just new ones
      injector.removeAll();
      embedState.top = embedState.bottom = null;
      selfEmbedFor = null;                     // so the own-bar embed is rebuilt too
      analyzePlayer(e.detail.username, viewingSelf, true);
    });
    window.addEventListener('crs:report', (e) => crsOpenReport(e.detail.username));
    if (platform === 'chesscom') crsReportFromProfile();
    window.addEventListener('crs:toggle-view', () => {
      viewingSelf = !viewingSelf;
      const name = viewingSelf ? detector._getMyUsername() : detector._findOpponent();
      if (!name) {
        if (viewingSelf) { overlay.showError('?', 'Could not detect your username'); viewingSelf = false; }
        return;
      }
      // Fast path: reuse the cached analysis for an instant toggle — no refetch, no loading flicker
      const cached = cache.get(name.toLowerCase());
      if (cached && settings.autoShow && !settings.zenMode && !settings.semiZenMode) {
        const { oppName, myName } = resolveNames(name, viewingSelf);
        overlay.showResult(name, cached, viewingSelf, oppName, myName);
        return;
      }
      analyzePlayer(name, viewingSelf);
    });
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'c') {
        const opp = detector._findOpponent();
        if (opp) { cache.delete(opp.toLowerCase()); analyzePlayer(opp, false); }
        else overlay.showError('?', 'Could not detect opponent.');
      }
    });
  }

  function onOpponentDetected(username) {
    if (!settings.autoShow && !settings.embeddedStats && !settings.embeddedRiskScore) return;
    viewingSelf = false;                       // may have been switched to "me" while the opponent was unknown
    analyzePlayer(username, false);
  }

  // No opponent yet (menu, lobby, empty seat): show the player's own score instead of nothing.
  function onNoOpponent() {
    if (!settings.autoShow && !settings.embeddedStats && !settings.embeddedRiskScore) return;
    fallBackToSelf(null);
  }

  // The opponent could not be scored (a stand-in name that is not a player, Chess.com not answering, ...).
  // Your own score must not depend on that: draw your own bar and open the overlay on your own tab.
  function fallBackToSelf(failedName) {
    if (detector && detector.rejectName && failedName) detector.rejectName(failedName);   // keep watching for the real name
    const me = detector && detector._getMyUsername();
    if (!me || me.length < 2 || me.toLowerCase() === String(failedName).toLowerCase()) return false;
    if (embedsOn() && !settings.embedHideOwnStats) loadSelfEmbed(null);
    if (settings.autoShow && !settings.zenMode) { viewingSelf = true; analyzePlayer(me, true); }
    return true;
  }

  // Called by the detector on real navigation (pathname change) — reset per-game state.
  function onNavigate() {
    cancelOpponent(null);
    cache.clear();
    viewingSelf = false;
    pendingZenResult = null;
    embedState.top = embedState.bottom = null;
    selfEmbedFor = null;
    stopGameOverWatch();
  }

  function onGameEnd() {
    injector.removeAll();
    embedState.top = embedState.bottom = null;
    selfEmbedFor = null;
    // If zen mode, reveal the stored result now
    if (settings.zenMode && pendingZenResult) {
      const { username, result, isSelf, oppName, myName } = pendingZenResult;
      overlay.showResult(username, result, isSelf, oppName, myName);
      pendingZenResult = null;
      stopGameOverWatch();
    }
  }

  // Resolve the two name-tab labels. Use the reliably-detected `username` for the
  // side being analyzed so its name shows instantly, even before the other player's
  // element has fully populated in the DOM (fixes placeholder labels when spectating).
  function resolveNames(username, isSelf) {
    const opp = detector._findOpponent();
    const me = detector._getMyUsername();
    return {
      oppName: (isSelf ? opp : username) || opp || 'Opponent',
      myName:  (isSelf ? username : me) || me || 'Me',
    };
  }

  // While a Stats search runs in the background, it holds its own requests until this player is scored, so the overlay goes first.
  // Nothing is sent when no search is running.
  async function statsHold(busy) {
    try { const o = await chrome.storage.local.get(['crsHistRun', 'crsHistRunLi', 'crsSkRun']); if (Object.values(o).some(r => r && r.running)) chrome.runtime.sendMessage({ type: 'hist-overlay', busy }).catch(() => {}); } catch (e) {}
  }

  async function analyzePlayer(username, isSelf, forceFresh = false) {
    if (!username || username.length < 2) return;
    const key = username.toLowerCase();
    const { oppName, myName } = resolveNames(username, isSelf);
    if (!isSelf) { cancelOpponent(key); oppLoading = key; }

    // Detect format from DOM as a hint (may be wrong)
    let domFormat = detectTimeFormat();

    // Start the network requests before anything else. On Lichess the games arrive as a
    // slow stream, so a first result is drawn from the newest games and refined as the rest
    // come in (see lichessApi.js). Chess.com answers in one go and never calls onPartial.
    const seq = ++analysisSeq;
    let shownStale = false;
    const pickFormat = (d) => {
      let newest = null;
      for (const g of (d.recentGames || [])) { if (!newest || (g.end_time || 0) > (newest.end_time || 0)) newest = g; }
      return domFormat || newest?.time_class || null;
    };
    const onPartial = (partial) => {
      if (seq !== analysisSeq || shownStale || settings.zenMode || !settings.autoShow) return;
      if (!partial.recentGames.length) return;
      const r = calculator.calculate(partial, pickFormat(partial), platform);
      r._partial = true;
      if (settings.semiZenMode) overlay.showSemiZen(username, r, oppName, myName);
      else overlay.showResult(username, r, isSelf, oppName, myName);
    };
    statsHold(true);
    const dataPromise = api.fetchAllData(username, onPartial);
    dataPromise.catch(() => {}).finally(() => statsHold(false));   // handled below

    // Don't show anything in zen mode or when autoShow is off (embedded-only mode).
    // If this player was scored in the last few minutes, show that result at once
    // and replace it when the fresh data arrives; otherwise show the loading state.
    if (!settings.zenMode && settings.autoShow) {
      const stale = forceFresh ? null : await readCachedResult(key);
      if (stale) {
        shownStale = true;
        if (settings.semiZenMode) overlay.showSemiZen(username, stale, oppName, myName);
        else overlay.showResult(username, stale, isSelf, oppName, myName);
      } else overlay.showLoading(username);
    }

    try {
      const data = await dataPromise;
      if (!isSelf && oppLoading === key) oppLoading = null;

      // The DOM reflects the CURRENT game's time control, so it takes priority.
      // The API archive can't contain the in-progress game, so it's only a fallback
      // when DOM detection fails — and we use the opponent's most recent game, which
      // is the best guess for the current session. (Previously the archive was trusted
      // first, which mislabeled the format whenever your last game used a different
      // time control than the one you're currently playing.)
      let apiFormat = null;
      let newest = null;
      for (const g of (data.recentGames || [])) { if (!newest || (g.end_time || 0) > (newest.end_time || 0)) newest = g; }
      if (newest?.time_class) apiFormat = newest.time_class;

      const currentFormat = domFormat || apiFormat || null;
      const result = calculator.calculate(data, currentFormat, platform);
      result._scoredFormat = currentFormat;
      // Parts Chess.com did not return (profile / stats / games). Shown on the overlay, and such a
      // result is not kept, so the next look at this player asks again.
      result._missing = data.missing || [];
      if (!result._missing.length) { cache.set(key, result); writeCachedResult(key, result); }

      // Embedded elements — independent of overlay mode. Remembered per side so they
      // can be redrawn when a setting changes.
      const side = isSelf ? 'bottom' : 'top';
      embedState[side] = { username, result, games: data.recentGames, format: currentFormat };
      if (isSelf) selfEmbedFor = key;
      applyEmbed(side);

      // If this is an opponent analysis and embedded features are on, also load the own bar
      if (!isSelf && !settings.embedHideOwnStats && embedsOn()) loadSelfEmbed(currentFormat);

      // Sound alert: once per opponent per game page. Never for your own account, never with a partial result,
      // and never in full zen mode (the sound would give the result away).
      if (!isSelf && !settings.zenMode && !result._missing.length && CRS_SOUND.shouldPlay(settings, result.score)) {
        const gameKey = location.pathname.replace(/\/(white|black)$/, '') + ':' + key;
        if (!soundedFor.has(gameKey)) {
          if (soundedFor.size > 50) soundedFor.clear();
          soundedFor.add(gameKey);
          CRS_SOUND.play(settings.soundPick, CRS_SOUND.levelOf(result.score), settings.soundVol);
        }
      }

      // Skip overlay display if autoShow is off (embedded-only mode)
      if (!settings.autoShow) return;

      // Zen Mode: store result, don't show overlay until game ends
      if (settings.zenMode) {
        pendingZenResult = { username, result, isSelf, oppName, myName };
        startGameOverWatch();
        overlay.hide();
        return;
      }

      // Semi-Zen Mode: show only the score ring in overlay
      if (settings.semiZenMode) {
        overlay.showSemiZen(username, result, oppName, myName);
        return;
      }

      // Normal mode: show full result
      overlay.showResult(username, result, isSelf, oppName, myName);
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // cancelled: the page has moved on to another player
      if (!isSelf && oppLoading === key) oppLoading = null;
      console.error('[ChessRisk]', err);
      // Keep a cached result on screen if the refresh failed; otherwise show the error.
      // A failed opponent never hides your own score: it is shown instead, and detection carries on.
      if (!isSelf && !shownStale && seq === analysisSeq && fallBackToSelf(username)) return;
      if (!settings.zenMode && settings.autoShow && !shownStale) overlay.showError(username, err.message || 'Failed to fetch player data');
    }
  }

  // Lightweight analysis for the embedded pieces on the own (bottom) player bar.
  function loadSelfEmbed(detectedFormat) {
    const selfName = detector._getMyUsername();
    if (!selfName || selfEmbedFor === selfName.toLowerCase()) return;
    selfEmbedFor = selfName.toLowerCase();
    analyzePlayerEmbed(selfName, detectedFormat);
  }

  async function analyzePlayerEmbed(username, detectedFormat) {
    if (!username || username.length < 2) return;
    try {
      statsHold(true);
      const data = await api.fetchAllData(username).finally(() => statsHold(false));
      await whenIdle();                                           // your own bar can wait for a quiet moment
      let domFormat = detectTimeFormat();
      let apiFormat = null;
      let newest = null;
      for (const g of (data.recentGames || [])) { if (!newest || (g.end_time || 0) > (newest.end_time || 0)) newest = g; }
      if (newest?.time_class) apiFormat = newest.time_class;
      // Same priority as analyzePlayer: DOM reflects the CURRENT game, so it
      // beats the API archive (which can't contain the in-progress game).
      const currentFormat = detectedFormat || domFormat || apiFormat || null;
      const result = calculator.calculate(data, currentFormat, platform);
      if (selfEmbedFor !== username.toLowerCase()) return;        // navigated away meanwhile
      embedState.bottom = { username, result, games: data.recentGames, format: currentFormat };
      applyEmbed('bottom');
    } catch (err) {
      selfEmbedFor = null;                                        // allow a retry
      console.error('[ChessRisk] Self embed error:', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
