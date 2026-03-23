// ============================================================
// INSIGHTS INJECTOR
// Injects W/L/D stats directly into the chess.com / lichess
// player username elements (inspired by chess-com-insights)
// ============================================================

class InsightsInjector {
  constructor() {
    this._injected = new Map();
  }

  // Inject stats badge next to a player's username element
  // opts: { format, timeInterval, colorHighlight }
  injectStats(username, insights, side, opts = {}) {
    const el = this._findUsernameElement(side);
    if (!el) return;

    this._removeExisting(side);

    const badge = this._createBadge(username, insights, side, opts);
    if (!badge) return;

    const parent = el.parentElement;
    if (parent) {
      parent.appendChild(badge);
    }
    this._injected.set(side, badge);
  }

  // Legacy wrappers
  injectOpponentStats(username, insights) { this.injectStats(username, insights, 'top'); }
  injectSelfStats(username, insights) { this.injectStats(username, insights, 'bottom'); }

  _removeExisting(side) {
    const old = this._injected.get(side);
    if (old && old.parentElement) old.remove();
    this._injected.delete(side);
    document.querySelectorAll(`.crs-insights-badge[data-side="${side}"]`).forEach(e => e.remove());
  }

  removeAll() {
    for (const [, el] of this._injected) {
      if (el && el.parentElement) el.remove();
    }
    this._injected.clear();
    document.querySelectorAll('.crs-insights-badge,.crs-embed-score').forEach(e => e.remove());
  }

  // Inject a small risk score circle next to a player's username
  injectScoreCircle(score, level, side = 'top') {
    const el = this._findUsernameElement(side);
    if (!el) return;

    document.querySelectorAll(`.crs-embed-score[data-side="${side}"]`).forEach(e => e.remove());

    const { color } = level;
    const CIRC = 69.12;
    const offset = CIRC - (score / 100) * CIRC;

    const circle = document.createElement('div');
    circle.className = 'crs-embed-score';
    circle.dataset.side = side;
    circle.title = `Risk Score: ${score}/100 - ${level.label}`;
    const fontSize = score >= 100 ? '9' : '12';
    circle.innerHTML = `
      <svg viewBox="0 0 28 28" width="1.5em" height="1.5em" style="vertical-align:middle">
        <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2.5"/>
        <circle cx="14" cy="14" r="11" fill="none" stroke="${color}" stroke-width="2.5"
          stroke-dasharray="${CIRC}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 14 14)"
          style="filter:drop-shadow(0 0 3px ${level.glow})"/>
        <text x="14" y="14" text-anchor="middle" dominant-baseline="central"
          fill="${color}" font-size="${fontSize}" font-weight="700" font-family="'JetBrains Mono',monospace">${score}</text>
      </svg>`;

    const parent = el.parentElement;
    if (parent) {
      parent.appendChild(circle);
    }
    this._injected.set('score-' + side, circle);
  }

  _findUsernameElement(side) {
    // Chess.com selectors
    const zone = side === 'top' ? '.board-layout-top' : '.board-layout-bottom';

    // Compact mode
    const compactRow = document.querySelector(`${zone} .user-tagline-compact-row`);
    if (compactRow) {
      return compactRow.querySelector('.user-tagline-compact-username') || compactRow;
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

  // Filter insights by time interval and optionally by format
  // opts: { format, timeInterval (seconds), colorHighlight }
  filterByTime(insights, recentGames, username, opts = {}) {
    if (!insights || !recentGames) return insights;

    const userL = username.toLowerCase();
    const interval = opts.timeInterval || 86400;
    const cutoff = (Date.now() / 1000) - interval;
    const targetFormat = opts.format || null;

    // If a format is detected, only process that format; otherwise process all
    const formatsToProcess = targetFormat ? [targetFormat] : Object.keys(insights);

    const filtered = {};
    for (const fmt of formatsToProcess) {
      if (!insights[fmt]) continue;
      let wins = 0, losses = 0, draws = 0;
      for (const game of recentGames) {
        if (!game.time_class || game.time_class !== fmt) continue;
        const ts = game.end_time || 0;
        if (ts < cutoff) continue;
        const isW = (game.white?.username || '').toLowerCase() === userL;
        const isB = (game.black?.username || '').toLowerCase() === userL;
        if (!isW && !isB) continue;
        const p = isW ? game.white : game.black; if (!p) continue;
        if (p.result === 'win') wins++;
        else if (['resigned','timeout','checkmated','abandoned'].includes(p.result)) losses++;
        else draws++;
      }
      filtered[fmt] = {
        ...insights[fmt],
        recent: { wins, losses, draws, total: wins + losses + draws },
      };
    }

    // If format was specified but no data, fall back to all-format combined
    if (targetFormat && (!filtered[targetFormat] || filtered[targetFormat].recent.total === 0)) {
      return this.filterByTime(insights, recentGames, username, { ...opts, format: null });
    }

    return filtered;
  }

  // Legacy alias
  _filter24h(insights, recentGames, username) {
    return this.filterByTime(insights, recentGames, username, { timeInterval: 86400 });
  }

  // Convert time interval in seconds to human-readable label
  _intervalLabel(seconds) {
    const labels = { 3600: 'Last 1 hour', 21600: 'Last 6 hours', 43200: 'Last 12 hours', 86400: 'Last 24 hours', 259200: 'Last 3 days', 604800: 'Last 7 days' };
    return labels[seconds] || `Last ${Math.round(seconds / 3600)}h`;
  }

  _createBadge(username, insights, side, opts = {}) {
    if (!insights) return null;
    const colorHL = opts.colorHighlight !== false;
    const intervalLabel = this._intervalLabel(opts.timeInterval || 86400);

    // Find the best format (highest total recent games)
    let bestFmt = null;
    let bestTotal = 0;
    for (const [fmt, data] of Object.entries(insights)) {
      if (data.recent.total > bestTotal) {
        bestTotal = data.recent.total;
        bestFmt = fmt;
      }
    }

    if (!bestFmt || bestTotal === 0) {
      return this._createOverallBadge(insights, side, opts);
    }

    const d = insights[bestFmt];
    const { wins, losses, draws, total } = d.recent;

    const badge = document.createElement('div');
    badge.className = 'crs-insights-badge';
    badge.dataset.side = side;
    badge.title = intervalLabel;

    if (colorHL) {
      badge.innerHTML = `
        <span class="crs-ins-w">${wins}W</span>
        <span class="crs-ins-sep">/</span>
        <span class="crs-ins-l">${losses}L</span>
        <span class="crs-ins-sep">/</span>
        <span class="crs-ins-d">${draws}D</span>
      `;
    } else {
      badge.innerHTML = `<span class="crs-ins-plain">${wins}W / ${losses}L / ${draws}D</span>`;
    }

    return badge;
  }

  _createOverallBadge(insights, side, opts = {}) {
    let totalWins = 0, totalLosses = 0, totalDraws = 0;
    const colorHL = opts.colorHighlight !== false;
    for (const data of Object.values(insights)) {
      if (data.overall) {
        totalWins   += data.overall.wins || 0;
        totalLosses += data.overall.losses || 0;
        totalDraws  += data.overall.draws || 0;
      }
    }

    if (totalWins + totalLosses + totalDraws === 0) return null;

    const badge = document.createElement('div');
    badge.className = 'crs-insights-badge';
    badge.dataset.side = side;
    badge.title = 'Overall stats';

    if (colorHL) {
      badge.innerHTML = `
        <span class="crs-ins-w">${totalWins}W</span>
        <span class="crs-ins-sep">/</span>
        <span class="crs-ins-l">${totalLosses}L</span>
        <span class="crs-ins-sep">/</span>
        <span class="crs-ins-d">${totalDraws}D</span>
      `;
    } else {
      badge.innerHTML = `<span class="crs-ins-plain">${totalWins}W / ${totalLosses}L / ${totalDraws}D</span>`;
    }
    return badge;
  }
}
