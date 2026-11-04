// ============================================================
// INSIGHTS INJECTOR v2
// Injects the score ring and a W/L/D chip beside the player
// usernames on chess.com / lichess.
//
// v2 fixes
//  - the chip always shows the chosen time interval (it used to fall back to
//    all-time totals across every format when the interval had no games)
//  - only rated standard games are counted, like the overlay table
//  - pieces are re-attached if the site re-renders the player bar
//  - ring always sits before the chip
// ============================================================

class InsightsInjector {
  constructor() {
    this._injected = new Map();   // key ('stats-top', 'score-bottom', ...) -> element
    this._keepAlive = null;
  }

  // ── placement ─────────────────────────────────────────────
  _attach(key, side, node) {
    const el = this._findUsernameElement(side);
    const parent = el && el.parentElement;
    if (!parent) return false;
    const isScore = key.startsWith('score-');
    const chip = parent.querySelector(`.crs-insights-badge[data-side="${side}"]`);
    if (isScore && chip && chip.parentElement === parent) parent.insertBefore(node, chip);   // ring before chip
    else parent.appendChild(node);
    this._injected.set(key, node);
    this._startKeepAlive();
    return true;
  }

  // chess.com and lichess re-render the player bar (game start, rematch, clock
  // changes) and drop foreign nodes. Put ours back when that happens.
  _startKeepAlive() {
    if (this._keepAlive) return;
    this._keepAlive = setInterval(() => {
      if (!this._injected.size) { clearInterval(this._keepAlive); this._keepAlive = null; return; }
      for (const [key, node] of this._injected) {
        if (node.isConnected) continue;
        const side = node.dataset.side;
        const el = this._findUsernameElement(side);
        if (el && el.parentElement) this._attach(key, side, node);
      }
    }, 1000);
  }

  _remove(key, selector) {
    const old = this._injected.get(key);
    if (old) old.remove();
    this._injected.delete(key);
    document.querySelectorAll(selector).forEach(e => e.remove());
  }

  removeAll() {
    for (const [, el] of this._injected) el.remove();
    this._injected.clear();
    if (this._keepAlive) { clearInterval(this._keepAlive); this._keepAlive = null; }
    document.querySelectorAll('.crs-insights-badge,.crs-embed-score').forEach(e => e.remove());
  }

  removeStat(side) { this._remove('stats-' + side, `.crs-insights-badge[data-side="${side}"]`); }
  removeScore(side) { this._remove('score-' + side, `.crs-embed-score[data-side="${side}"]`); }
  removeSide(side) { this.removeStat(side); this.removeScore(side); }

  // ── W/L/D chip ────────────────────────────────────────────
  // opts: { format, timeInterval, colorHighlight }
  injectStats(username, filtered, side, opts = {}) {
    this._remove('stats-' + side, `.crs-insights-badge[data-side="${side}"]`);
    const badge = this._createBadge(filtered, side, opts);
    if (badge) this._attach('stats-' + side, side, badge);
  }

  // Legacy wrappers
  injectOpponentStats(username, insights) { this.injectStats(username, insights, 'top'); }
  injectSelfStats(username, insights) { this.injectStats(username, insights, 'bottom'); }

  // ── score ring ────────────────────────────────────────────
  injectScoreCircle(score, level, side = 'top') {
    this._remove('score-' + side, `.crs-embed-score[data-side="${side}"]`);
    const label = (level?.label || '').toUpperCase();
    const band = label.startsWith('LOW') ? 'low' : label.startsWith('MOD') ? 'mod' : label.startsWith('HIGH') ? 'high' : 'ext';
    const CIRC = 69.12, offset = CIRC - (score / 100) * CIRC;
    const ring = document.createElement('span');
    ring.className = `crs-embed-score crs-${band}` + (score >= 100 ? ' crs-3d' : '');
    ring.dataset.side = side;
    ring.title = `Risk Score: ${score}/100 · ${level.label}`;
    // Built with DOM methods, not an HTML string, so nothing from the page or API is parsed as markup.
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 28 28'); svg.setAttribute('aria-hidden', 'true');
    for (const cls of ['crs-er-t', 'crs-er-f']) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', cls); c.setAttribute('cx', '14'); c.setAttribute('cy', '14'); c.setAttribute('r', '11');
      if (cls === 'crs-er-f') { c.setAttribute('stroke-dasharray', String(CIRC)); c.setAttribute('stroke-dashoffset', String(offset)); }
      svg.appendChild(c);
    }
    const num = document.createElement('b'); num.textContent = String(score);
    ring.append(svg, num);
    this._attach('score-' + side, side, ring);
  }

  _findUsernameElement(side) {
    // Chess.com selectors
    const zone = side === 'top' ? '.board-layout-top' : '.board-layout-bottom';

    // Compact mode
    const compactRow = document.querySelector(`${zone} .user-tagline-compact-row`);
    if (compactRow) {
      return compactRow.querySelector('.user-tagline-compact-username') || compactRow.firstElementChild || compactRow;
    }

    // Normal mode chess.com
    const chesscomEl = (
      document.querySelector(`${zone} cc-user-username-component`) ||
      document.querySelector(`${zone} .cc-user-username-component`) ||
      document.querySelector(`${zone} .user-tagline-username`) ||
      document.querySelector(`${zone} .username`)
    );
    if (chesscomEl) return chesscomEl;

    // Lichess selectors — .ruser-top/.ruser-bottom with a[href*="/@/"] links
    const lichessZone = side === 'top' ? '.ruser-top' : '.ruser-bottom';
    const lichessLink = document.querySelector(`${lichessZone} a[href*="/@/"]`);
    if (lichessLink) return lichessLink;

    // Lichess round page fallback
    const roundLinks = document.querySelectorAll('.round__app a[href*="/@/"], .ruser a[href*="/@/"], .game__meta a[href*="/@/"]');
    if (roundLinks.length > 0) {
      // Sort by Y position — top half of page = top player, bottom = bottom player
      const sorted = Array.from(roundLinks).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      return side === 'top' ? sorted[0] : sorted[sorted.length - 1];
    }

    return null;
  }

  // W/L/D inside the chosen interval. Returns { format, wins, losses, draws, total, interval }.
  // With a known format the result is always for that format, even when it is 0/0/0.
  // Without one, the format with the most games in the interval is used.
  // opts: { format, timeInterval (seconds) }
  filterByTime(insights, recentGames, username, opts = {}) {
    const interval = opts.timeInterval || 86400;
    const empty = { format: opts.format || null, wins: 0, losses: 0, draws: 0, total: 0, interval };
    if (!recentGames) return empty;

    const userL = username.toLowerCase();
    const cutoff = (Date.now() / 1000) - interval;
    const byFormat = {};
    for (const game of recentGames) {
      if (!game.time_class || (game.end_time || 0) < cutoff) continue;
      if (game.rated === false) continue;
      if (game.rules && game.rules !== 'chess') continue;
      const isW = (game.white?.username || '').toLowerCase() === userL;
      const isB = (game.black?.username || '').toLowerCase() === userL;
      if (!isW && !isB) continue;
      const p = isW ? game.white : game.black; if (!p) continue;
      const r = byFormat[game.time_class] || (byFormat[game.time_class] = { wins: 0, losses: 0, draws: 0, total: 0 });
      if (p.result === 'win') r.wins++;
      else if (['resigned', 'timeout', 'checkmated', 'abandoned', 'lose'].includes(p.result)) r.losses++;
      else r.draws++;
      r.total++;
    }

    let fmt = opts.format || null;
    if (!fmt) {
      for (const [f, r] of Object.entries(byFormat)) if (!fmt || r.total > byFormat[fmt].total) fmt = f;
    }
    return { ...empty, format: fmt, ...(byFormat[fmt] || {}) };
  }

  // Legacy alias
  _filter24h(insights, recentGames, username) {
    return this.filterByTime(insights, recentGames, username, { timeInterval: 86400 });
  }

  // Convert time interval in seconds to human-readable label
  _intervalLabel(seconds) {
    const labels = { 3600: 'last 1 hour', 21600: 'last 6 hours', 43200: 'last 12 hours', 86400: 'last 24 hours', 259200: 'last 3 days', 604800: 'last 7 days' };
    return labels[seconds] || `last ${Math.round(seconds / 3600)}h`;
  }

  _createBadge(rec, side, opts = {}) {
    if (!rec) return null;
    const colorHL = opts.colorHighlight !== false;
    const when = this._intervalLabel(rec.interval || opts.timeInterval || 86400);
    const fmt = rec.format ? rec.format.charAt(0).toUpperCase() + rec.format.slice(1) : '';
    const badge = document.createElement('span');
    badge.className = 'crs-insights-badge' + (colorHL ? ' crs-hl' : '') + (rec.total ? '' : ' crs-empty');
    badge.dataset.side = side;
    badge.title = rec.total
      ? `${fmt ? fmt + ' · ' : ''}rated games, ${when}`
      : `No rated ${fmt ? fmt.toLowerCase() + ' ' : ''}games in the ${when}`;
    const part = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; };
    badge.append(
      part('i', 'crs-ins-w', rec.wins + 'W'), part('span', 'crs-ins-sep', '/'),
      part('i', 'crs-ins-l', rec.losses + 'L'), part('span', 'crs-ins-sep', '/'),
      part('i', 'crs-ins-d', rec.draws + 'D'));
    if (opts.reportUser) {
      // Flag at the end of the opponent's chip: opens the site's own report window.
      const NS = 'http://www.w3.org/2000/svg';
      const flag = document.createElement('button');
      flag.type = 'button'; flag.className = 'crs-chip-rep';
      flag.title = 'Report ' + opts.reportUser; flag.setAttribute('aria-label', flag.title);
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M5 21V4M5 4h11l-2 4 2 4H5'); svg.appendChild(p);
      flag.appendChild(svg);
      flag.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); crsOpenReport(opts.reportUser); });
      badge.classList.add('crs-flagged'); badge.appendChild(flag);
    }
    return badge;
  }
}
