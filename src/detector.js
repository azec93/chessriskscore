// ============================================================
// OPPONENT DETECTOR v4
// Multi-strategy with aggressive polling + URL-based fallback
// v4: Uses CONFIG.DETECTION timing for much faster popup
// ============================================================

class OpponentDetector {
  constructor(onDetected, onGameEnd) {
    this.onDetected  = onDetected;
    this.onGameEnd   = onGameEnd;
    this.currentOpponent = null;
    this.observer    = null;
    this.pollTimer   = null;
    this.debounce    = null;
    this.lastUrl     = location.href;
    this._active     = false;
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
    this._active = true;
    this._startMutationObserver();
    this._startPolling();
    this._startUrlWatcher();
    // Immediate first check — much faster now
    setTimeout(() => this._check(), this._timing.INITIAL_CHECK_DELAY);
  }

  stop() {
    this._active = false;
    if (this.observer)  { this.observer.disconnect(); this.observer = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  // ── Polling as primary trigger — now ~600ms ────────────────
  _startPolling() {
    this.pollTimer = setInterval(() => {
      if (this._active) this._check();
    }, this._timing.POLL_INTERVAL);
  }

  // ── MutationObserver as secondary trigger — now 250ms debounce
  _startMutationObserver() {
    this.observer = new MutationObserver(() => {
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => { if (this._active) this._check(); }, this._timing.MUTATION_DEBOUNCE);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── URL watcher for SPA navigation — now 300ms interval ────
  _startUrlWatcher() {
    setInterval(() => {
      if (!this._active) return;
      if (location.href !== this.lastUrl) {
        this.lastUrl = location.href;
        this.currentOpponent = null;
        setTimeout(() => this._check(), this._timing.URL_CHANGE_DELAY);
      }
    }, this._timing.URL_WATCH_INTERVAL);
  }

  // ── Is this a live game page? ───────────────────────────────
  _isGamePage() {
    const url = location.href;
    return (
      /chess\.com\/(live|game\/live|play\/online|game\/daily)/.test(url) ||
      !!document.querySelector(
        'chess-board, wc-chess-board, #board-layout-main, .board-layout-main'
      )
    );
  }

  // ── Master check ────────────────────────────────────────────
  _check() {
    if (!this._isGamePage()) {
      if (this.currentOpponent) {
        this.currentOpponent = null;
        this.onGameEnd?.();
      }
      return;
    }

    const username = this._findOpponent();
    if (!username) return;
    if (username.toLowerCase() === this.currentOpponent?.toLowerCase()) return;

    this.currentOpponent = username;
    this.onDetected(username);
  }

  // ── Username extraction — 8 strategies ─────────────────────
  _findOpponent() {

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
        if (name && name !== this._getMyUsername()) return name;
      }
      if (ccEls.length === 1) {
        const name = this._nameFromEl(ccEls[0]);
        if (name) return name;
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
      if (name && name.length > 1) return name;
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
      if (name && name.length > 1) return name;
    }

    // ── 5. Any element with class containing "username" in top zone ──
    if (topZone) {
      const anyUsername = topZone.querySelector('[class*="username"]');
      if (anyUsername) {
        const name = (anyUsername.textContent || '').trim();
        if (name && name.length > 1) return name;
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
      if (name) return name;
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

  _getMyUsername() {
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
      return this._nameFromEl(ccEls[0]);
    }

    return null;
  }
}
