// ============================================================
// LICHESS OPPONENT DETECTOR v3
// Key fix: uses document.body.dataset.user for reliable self ID
// ============================================================

class LichessOpponentDetector {
  constructor(onDetected, onGameEnd) {
    this.onDetected = onDetected;
    this.onGameEnd = onGameEnd;
    this.currentOpponent = null;
    this.observer = null;
    this.pollTimer = null;
    this.debounce = null;
    this.lastUrl = location.href;
    this._active = false;
    this._timing = CONFIG?.DETECTION || {
      INITIAL_CHECK_DELAY: 200, POLL_INTERVAL: 600,
      MUTATION_DEBOUNCE: 250, URL_WATCH_INTERVAL: 300, URL_CHANGE_DELAY: 800,
    };
  }

  start() {
    this._active = true;
    this.observer = new MutationObserver(() => {
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => { if (this._active) this._check(); }, this._timing.MUTATION_DEBOUNCE);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.pollTimer = setInterval(() => { if (this._active) this._check(); }, this._timing.POLL_INTERVAL);
    setInterval(() => {
      if (!this._active) return;
      if (location.href !== this.lastUrl) {
        this.lastUrl = location.href;
        this.currentOpponent = null;
        setTimeout(() => this._check(), this._timing.URL_CHANGE_DELAY);
      }
    }, this._timing.URL_WATCH_INTERVAL);
    setTimeout(() => this._check(), this._timing.INITIAL_CHECK_DELAY);
  }

  stop() {
    this._active = false;
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  _isGamePage() {
    return /lichess\.org\/[a-zA-Z0-9]{8,12}(\/|$)/.test(location.href) ||
      !!document.querySelector('.round__app, cg-board');
  }

  _check() {
    if (!this._isGamePage()) {
      if (this.currentOpponent) { this.currentOpponent = null; this.onGameEnd?.(); }
      return;
    }
    const username = this._findOpponent();
    if (!username) return;
    if (username.toLowerCase() === this.currentOpponent?.toLowerCase()) return;
    this.currentOpponent = username;
    this.onDetected(username);
  }

  _getMyUsername() {
    // Get both game players
    const players = this._getGamePlayers();
    const loggedIn = document.body?.dataset?.user;
    
    // If logged-in user is one of the players, that's "me"
    if (loggedIn && players.length > 0) {
      const match = players.find(p => p.toLowerCase() === loggedIn.toLowerCase());
      if (match) return match;
    }
    
    // If spectating: bottom player is "me" for toggle purposes
    if (players.length >= 2) return players[1];
    
    // Fallback to logged-in user
    if (loggedIn) return loggedIn;

    const dasher = document.querySelector('#user_tag');
    if (dasher) {
      const text = (dasher.textContent || '').trim();
      if (text && text.length > 1 && text.length < 30) return text;
    }

    const bottomUser = document.querySelector('.ruser-bottom a[href*="/@/"]');
    if (bottomUser) {
      const m = (bottomUser.getAttribute('href') || '').match(/\/@\/([^/?#]+)/);
      if (m && m[1]) return m[1];
    }

    return null;
  }

  // Get both players in the current game [top, bottom]
  _getGamePlayers() {
    const players = [];

    // ruser-top and ruser-bottom are the most reliable
    const topEl = document.querySelector('.ruser-top a[href*="/@/"]');
    const botEl = document.querySelector('.ruser-bottom a[href*="/@/"]');
    
    if (topEl) {
      const m = (topEl.getAttribute('href') || '').match(/\/@\/([^/?#]+)/);
      if (m && m[1]) players.push(m[1]);
    }
    if (botEl) {
      const m = (botEl.getAttribute('href') || '').match(/\/@\/([^/?#]+)/);
      if (m && m[1]) players.push(m[1]);
    }

    if (players.length >= 2) return players;

    // Fallback: all user links in round app, sorted by Y position
    const links = Array.from(document.querySelectorAll('.round__app a[href*="/@/"], .ruser a[href*="/@/"], .game__meta a[href*="/@/"]'));
    const seen = new Set(players.map(p => p.toLowerCase()));
    links.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    for (const link of links) {
      const m = (link.getAttribute('href') || '').match(/\/@\/([^/?#]+)/);
      if (m && m[1] && !seen.has(m[1].toLowerCase()) && m[1] !== 'me') {
        players.push(m[1]);
        seen.add(m[1].toLowerCase());
      }
      if (players.length >= 2) break;
    }

    return players;
  }

  _findOpponent() {
    const players = this._getGamePlayers();
    const myName = this._getMyUsername()?.toLowerCase();

    // If we have both players, opponent is the one that isn't me
    if (players.length >= 2 && myName) {
      for (const p of players) {
        if (p.toLowerCase() !== myName) return p;
      }
    }

    // If we only have one player and it's not me, return it
    if (players.length >= 1 && myName) {
      if (players[0].toLowerCase() !== myName) return players[0];
    }

    // Fallback: first ruser-top
    if (players.length >= 1) return players[0];

    return null;
  }
}
