// ============================================================
// OPPONENT DETECTOR v4
// Multi-strategy with aggressive polling + URL-based fallback
// v4: Uses CONFIG.DETECTION timing for much faster popup
// ============================================================

// Translations of the words chess.com shows in an empty player bar ("Opponent", "You", "Guest", "Anonymous").
// This list is only a SECONDARY signal: the primary test is the default grey silhouette avatar, which needs no language.
// A word from this list is rejected unless the bar shows an uploaded avatar (so a real account with such a name still works).
const CRS_PLACEHOLDER_WORDS = new Set((
  'gegner,gegnerin,adversaire,adversario,adversário,avversario,avversaria,oponente,oponent,rival,contrincante,tegenstander,motståndare,motstander,modstander,vastustaja,' +
  'przeciwnik,przeciwniczka,soupeř,súper,ellenfél,adversar,protivnik,protivnica,nasprotnik,priešininkas,pretinieks,vastane,rakip,lawan,musuh,' +
  'противник,соперник,суперник,опонент,противнік,αντίπαλος,יריב,الخصم,خصم,المنافس,حریف,प्रतिद्वंदी,प्रतिद्वंद्वी,对手,對手,相手,対戦相手,상대,상대방,đối thủ,คู่ต่อสู้,প্রতিপক্ষ,' +
  'du,tú,tu,vous,voi,você,voce,jij,je,ty,sen,kamu,anda,ви,вы,ти,あなた,你,您,당신,أنت,אתה,εσύ,' +
  'gast,invité,invitado,ospite,convidado,gość,gosť,host,гость,gäst,gæst,vieras,konuk,tamu,guest,' +
  'anónimo,anonym,anonyme,anonimo,anônimo,anoniem,anonimowy,аноним,анонім,匿名,访客,ゲスト,ανώνυμος,مجهول'
).split(','));

class OpponentDetector {
  constructor(onDetected, onGameEnd, onNavigate, onNoOpponent) {
    this.onNoOpponent = onNoOpponent;
    this._noOppSince = null; this._noOppFired = false;
    this.onDetected  = onDetected;
    this.onGameEnd   = onGameEnd;
    this.onNavigate  = onNavigate;
    this.currentOpponent = null;
    this.observer    = null;
    this._observerActive = false;
    this.pollTimer   = null;
    this.urlTimer    = null;
    this.debounce    = null;
    this.lastUrl     = location.href;
    this.lastPath    = location.pathname;
    this._active     = false;
    this._analyzedUser = null; // one-shot lock for analysis pages (by username)
    this._lockTimer  = null;   // short re-check after a name is locked (names can load late or change)
    this._rejected   = new Map(); // names the page showed that turned out not to be a player (name -> expiry)
    // Use CONFIG detection timings (with fallback defaults)
    this._timing = (typeof CONFIG !== 'undefined' && CONFIG.DETECTION) ? CONFIG.DETECTION : {
      INITIAL_CHECK_DELAY: 200,
      POLL_INTERVAL: 600,
      MUTATION_DEBOUNCE: 250,
      URL_WATCH_INTERVAL: 300,
      URL_CHANGE_DELAY: 800,
    };
  }

  start() {
    if (this._active) return; // guard against double-start
    this._active = true;
    this._connectObserver();
    this._startPolling();
    this._startUrlWatcher();
    // Immediate first check — much faster now
    setTimeout(() => this._check(), this._timing.INITIAL_CHECK_DELAY);
  }

  stop() {
    this._active = false;
    this._disconnectObserver();
    this._stopLockWatch();
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.urlTimer)  { clearInterval(this.urlTimer);  this.urlTimer = null; }
  }

  // ── Polling as the always-on, cheap detection backstop (~600ms) ──
  _startPolling() {
    this.pollTimer = setInterval(() => {
      if (this._active) this._check();
    }, this._timing.POLL_INTERVAL);
  }

  // ── MutationObserver: only attached while we still need to detect a player.
  // It fires on every DOM mutation (clock ticks, move list), so we disconnect it
  // the moment detection succeeds and reconnect on navigation. Polling backstops it.
  _connectObserver() {
    if (this._observerActive) return;
    if (!this.observer) {
      this.observer = new MutationObserver(() => {
        if (this.debounce) return;   // throttle: a pending check is not pushed back by later mutations
        this.debounce = setTimeout(() => { this.debounce = null; if (this._active) this._check(); }, this._timing.MUTATION_DEBOUNCE);
      });
    }
    this.observer.observe(document.body, { childList: true, subtree: true });
    this._observerActive = true;
  }
  _disconnectObserver() {
    if (!this._observerActive) return;
    if (this.observer) this.observer.disconnect();
    clearTimeout(this.debounce); this.debounce = null;
    this._observerActive = false;
  }

  // ── URL watcher for SPA navigation. Compares pathname (not full href) so that
  // stepping through analysis moves — which rewrites the query/hash — does NOT count
  // as navigation. A real game/page change resets detection and notifies content.js.
  _startUrlWatcher() {
    if (this.urlTimer) return; // guard against double-start
    this.urlTimer = setInterval(() => {
      if (!this._active) return;
      if (location.pathname !== this.lastPath) {
        this.lastPath = location.pathname;
        this.lastUrl = location.href;
        this._prevOpponent = this.currentOpponent ? this.currentOpponent.toLowerCase() : null;
        this._navAt = Date.now();
        this._stopLockWatch();
        this.currentOpponent = null;
        this._analyzedUser = null;
        this._noOppSince = null; this._noOppFired = false;
        this._connectObserver();
        this.onNavigate?.();
        setTimeout(() => this._check(), this._timing.URL_CHANGE_DELAY);
      }
    }, this._timing.URL_WATCH_INTERVAL);
  }

  // ── Is this a live game page? ───────────────────────────────
  _isGamePage() {
    const url = location.href;
    // Exclude analysis, review, and explorer pages
    if (/chess\.com\/(analysis|game\/review|explorer)/.test(url)) return false;
    return (
      /chess\.com\/(live|game\/live|play\/online|game\/daily)/.test(url) ||
      !!document.querySelector(
        'chess-board, wc-chess-board, #board-layout-main, .board-layout-main'
      )
    );
  }

  // ── Analysis / game-review pages (show once, don't re-run per move) ──
  _isAnalysisPage() {
    return /chess\.com\/(analysis|game\/review)/.test(location.href);
  }

  // ── Master check ────────────────────────────────────────────
  _check() {
    const analysis = this._isAnalysisPage();
    if (!analysis) this._analyzedUser = null; // reset one-shot lock when off analysis

    if (!analysis && !this._isGamePage()) {
      this._disconnectObserver(); // not on a game page — stop watching the DOM
      if (this.currentOpponent) {
        this.currentOpponent = null;
        this.onGameEnd?.();
      }
      return;
    }

    // Already detected the player for this game/analysis → stop watching; the
    // expensive DOM scan (and the MutationObserver) aren't needed until navigation.
    if (analysis ? this._analyzedUser : this.currentOpponent) { this._disconnectObserver(); return; }

    // Still looking for a player — make sure the observer is on for fast detection.
    this._connectObserver();

    const username = this._findOpponent();
    if (!username) {
      // Still a placeholder after 2 s (menu, lobby, empty seat): let the page owner show the player's own score meanwhile.
      if (!analysis && this.onNoOpponent && !this._noOppFired) {
        if (!this._noOppSince) this._noOppSince = Date.now();
        else if (Date.now() - this._noOppSince > 2000 && this._getMyUsername()) { this._noOppFired = true; this.onNoOpponent(); }
      }
      return;
    }
    this._noOppSince = null; this._noOppFired = false;
    // Just navigated and the page still shows the previous opponent: wait for it to settle.
    if (this._prevOpponent && username.toLowerCase() === this._prevOpponent && Date.now() - (this._navAt || 0) < this._timing.URL_CHANGE_DELAY - 30) return;

    if (analysis) {
      // Wait until BOTH player names are in the DOM before locking, so the overlay's
      // name tabs render correctly on first show. Analysis pages populate the player
      // names a moment after the board — without this we'd freeze placeholder labels.
      if (!this._getMyUsername()) return;
      this._analyzedUser = username;
    }
    this.currentOpponent = username;
    this.onDetected(username);
    this._disconnectObserver(); // detected — no need to keep watching
    this._startLockWatch();
  }

  // Names can still change just after the board appears (an archived game re-renders its player bars,
  // a placeholder gives way to the real player). For ~20 s after locking, re-read the bar twice a second
  // (one cheap query, no MutationObserver) and report the new name if it differs.
  _startLockWatch() {
    this._stopLockWatch();
    const until = Date.now() + 20000;
    this._lockTimer = setInterval(() => {
      if (!this._active || !this.currentOpponent || Date.now() > until) { this._stopLockWatch(); return; }
      const now = this._findOpponent();                       // null while the bar shows a placeholder
      if (!now || now.toLowerCase() === this.currentOpponent.toLowerCase()) return;
      if (this._isAnalysisPage()) this._analyzedUser = now;
      this.currentOpponent = now;
      this.onDetected(now);
    }, 500);
  }
  _stopLockWatch() { if (this._lockTimer) { clearInterval(this._lockTimer); this._lockTimer = null; } }

  // content.js calls this when a looked-up name turned out not to exist: ignore it for a minute and keep looking.
  rejectName(name) {
    if (!name) return;
    this._rejected.set(String(name).toLowerCase(), Date.now() + 60000);
    if (this.currentOpponent && this.currentOpponent.toLowerCase() === String(name).toLowerCase()) {
      this._stopLockWatch(); this.currentOpponent = null; this._analyzedUser = null; this._connectObserver();
    }
  }

  // chess.com shows placeholder labels in the player bars until the real names load.
  // They must never be looked up: "Opponent" is also a real account's username.
  _isPlaceholder(name) {
    return !name || /^(opponent|white|black|player|you|me|guest|anonymous|loading|searching|[.]+|…)$/i.test(String(name).trim());
  }

  // Language-free test: chess.com fills an empty player bar with its default grey silhouette (black_400.png / white_400.png).
  _hasDefaultAvatar(root) {
    if (!root || !root.querySelector) return false;
    const img = root.querySelector('img.cc-avatar-img, img[class*="avatar"]');
    return !!img && /\/bundles\/web\/images\/(?:black|white)_\d+(?:@\dx)?\.(?:png|webp|jpe?g|svg)/i.test(img.getAttribute('src') || '');
  }
  _playerRoot(el) {
    return el && el.closest ? el.closest('.player-component, .board-layout-player, [class*="player-top"], [class*="player-bottom"]') : null;
  }
  // Is the name in this element a stand-in rather than a player?
  _isPlaceholderEl(el, name) {
    const root = this._playerRoot(el);
    if (root && this._hasDefaultAvatar(root)) return true;                       // nobody there yet, whatever the language
    if (name && CRS_PLACEHOLDER_WORDS.has(String(name).trim().toLowerCase().normalize('NFC'))) {
      const img = root && root.querySelector ? root.querySelector('img.cc-avatar-img') : null;
      return !(img && /\/uploads\//i.test(img.getAttribute('src') || ''));       // a translated word is trusted only with an uploaded avatar
    }
    return false;
  }

  _findOpponent() {
    const name = this._findOpponentRaw();
    if (this._isPlaceholder(name)) return null;
    const until = name && this._rejected.get(name.toLowerCase());
    if (until) { if (until > Date.now()) return null; this._rejected.delete(name.toLowerCase()); }
    return name;
  }

  _getMyUsername() {
    const name = this._getMyUsernameRaw();
    return this._isPlaceholder(name) ? null : name;
  }

  // ── Username extraction — 8 strategies ─────────────────────
  _findOpponentRaw() {

    // ── 1. board-layout-top with modern web component ──
    const topZone = document.querySelector(
      '#board-layout-top, .board-layout-top'
    );
    if (topZone) {
      const name = this._extractFromZone(topZone);
      if (name) return name;
    }

    // ── 2. Scan ALL cc-user-username-component elements ──
    const ccEls = Array.from(
      document.querySelectorAll('cc-user-username-component')
    );
    if (ccEls.length >= 1) {
      ccEls.sort((a, b) =>
        a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
      for (const el of ccEls) {
        const name = this._nameFromEl(el);
        if (name && name !== this._getMyUsername() && !this._isPlaceholderEl(el, name)) return name;
      }
      if (ccEls.length === 1) {
        const name = this._nameFromEl(ccEls[0]);
        // Don't return our own name — a lone element is often the bottom (self)
        // player rendering first.
        const mine = this._getMyUsername();
        if (name && (!mine || name.toLowerCase() !== mine.toLowerCase()) && !this._isPlaceholderEl(ccEls[0], name)) return name;
      }
    }

    // ── 3. user-tagline-username (older layout) ──
    const taglines = Array.from(
      document.querySelectorAll('.user-tagline-username')
    );
    if (taglines.length >= 1) {
      taglines.sort((a, b) =>
        a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
      const name = (taglines[0].textContent || '').trim();
      if (name && name.length > 1 && !this._isPlaceholderEl(taglines[0], name)) return name;
    }

    // ── 4. user-tagline-compact-username ──
    const compacts = Array.from(
      document.querySelectorAll('.user-tagline-compact-username')
    );
    if (compacts.length >= 1) {
      compacts.sort((a, b) =>
        a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
      const name = (compacts[0].textContent || '').trim();
      if (name && name.length > 1 && !this._isPlaceholderEl(compacts[0], name)) return name;
    }

    // ── 5. Any element with class containing "username" in top zone ──
    if (topZone) {
      const anyUsername = topZone.querySelector('[class*="username"]');
      if (anyUsername) {
        const name = (anyUsername.textContent || '').trim();
        if (name && name.length > 1 && !this._isPlaceholderEl(anyUsername, name)) return name;
      }
    }

    // ── 6. data-player attribute ──
    const dataPlayer = document.querySelector('[data-player-username]');
    if (dataPlayer) {
      const name = dataPlayer.getAttribute('data-player-username');
      if (name && name.length > 1) return name;
    }

    // ── 7. Member links in top zone ──
    if (topZone) {
      const memberLink = topZone.querySelector('a[href*="/member/"]');
      if (memberLink) {
        const m = (memberLink.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
        if (m && m[1]) return m[1];
      }
    }

    // ── 8. Scan ALL member links on page ──
    const allMemberLinks = Array.from(
      document.querySelectorAll('a[href*="/member/"]')
    );
    if (allMemberLinks.length >= 1) {
      allMemberLinks.sort((a, b) =>
        a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
      const myName = this._getMyUsername()?.toLowerCase();
      for (const link of allMemberLinks) {
        const m = (link.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
        if (m && m[1] && m[1].toLowerCase() !== myName) return m[1];
      }
    }

    return null;
  }

  _extractFromZone(zone) {
    if (this._hasDefaultAvatar(zone)) return null;                              // empty bar: no player yet
    const selectors = [
      'cc-user-username-component',
      '.user-tagline-username',
      '.user-tagline-compact-username',
      '[class*="username"]',
      'a[href*="/member/"]',
    ];

    for (const sel of selectors) {
      const el = zone.querySelector(sel);
      if (!el) continue;

      if (el.tagName === 'A') {
        const m = (el.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
        if (m && m[1]) return m[1];
      }

      const name = this._nameFromEl(el);
      if (name && !this._isPlaceholderEl(el, name)) return name;
    }
    return null;
  }

  _nameFromEl(el) {
    if (!el) return null;

    if (el.shadowRoot) {
      const shadowText = this._deepText(el.shadowRoot);
      if (shadowText) return shadowText;
    }

    const links = el.querySelectorAll('a[href*="/member/"]');
    for (const link of links) {
      const m = (link.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
      if (m && m[1]) return m[1];
    }

    const child = el.querySelector('[class*="username"]');
    if (child) {
      const t = (child.textContent || '').trim();
      if (t && t.length > 1) return t;
    }

    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t && t.length > 1 && t.length < 30 && !t.includes('\n')) return t;

    return null;
  }

  _deepText(root) {
    if (!root) return null;
    const links = root.querySelectorAll('a[href*="/member/"]');
    for (const link of links) {
      const m = (link.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
      if (m && m[1]) return m[1];
    }
    const usernameEl = root.querySelector('[class*="username"]');
    if (usernameEl) {
      const t = (usernameEl.textContent || '').trim();
      if (t && t.length > 1) return t;
    }
    return null;
  }

  _getMyUsernameRaw() {
    const bottomZone = document.querySelector(
      '#board-layout-bottom, .board-layout-bottom'
    );
    if (bottomZone) {
      const name = this._extractFromZone(bottomZone);
      if (name) return name;
    }

    const ccEls = Array.from(
      document.querySelectorAll('cc-user-username-component')
    );
    if (ccEls.length >= 2) {
      ccEls.sort((a, b) =>
        b.getBoundingClientRect().top - a.getBoundingClientRect().top
      );
      const name = this._nameFromEl(ccEls[0]);
      return name && !this._isPlaceholderEl(ccEls[0], name) ? name : null;
    }

    return null;
  }
}
