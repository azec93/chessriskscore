// ============================================================
// INSIGHTS INJECTOR
// Injects W/L/D + accuracy stats directly into the chess.com
// player username elements (inspired by chess-com-insights)
// ============================================================

class InsightsInjector {
  constructor() {
    this._injected = new Map(); // username -> element
  }

  // Inject stats badge next to the opponent's username element
  injectOpponentStats(username, insights) {
    // Find the top player username element
    const el = this._findUsernameElement('top');
    if (!el) return;

    this._removeExisting('top');

    const badge = this._createBadge(username, insights, 'top');
    if (!badge) return;

    // Insert after the username element (or append to its parent)
    const parent = el.parentElement || el;
    parent.insertAdjacentElement('afterend', badge);
    this._injected.set('top', badge);
  }

  // Optionally inject your own stats at bottom (for self-awareness)
  injectSelfStats(username, insights) {
    const el = this._findUsernameElement('bottom');
    if (!el) return;

    this._removeExisting('bottom');

    const badge = this._createBadge(username, insights, 'bottom');
    if (!badge) return;

    const parent = el.parentElement || el;
    parent.insertAdjacentElement('afterend', badge);
    this._injected.set('bottom', badge);
  }

  _removeExisting(side) {
    const old = this._injected.get(side);
    if (old && old.parentElement) old.remove();
    this._injected.delete(side);
    // Also clean up any leftover badges
    document.querySelectorAll(`.crs-insights-badge[data-side="${side}"]`).forEach(e => e.remove());
  }

  removeAll() {
    for (const [, el] of this._injected) {
      if (el && el.parentElement) el.remove();
    }
    this._injected.clear();
    document.querySelectorAll('.crs-insights-badge').forEach(e => e.remove());
  }

  _findUsernameElement(side) {
    // board-layout-top or board-layout-bottom
    const zone = side === 'top' ? '.board-layout-top' : '.board-layout-bottom';

    return (
      document.querySelector(`${zone} cc-user-username-component`) ||
      document.querySelector(`${zone} .user-tagline-compact-username`) ||
      document.querySelector(`${zone} .user-tagline-username`) ||
      document.querySelector(`${zone} .username`)
    );
  }

  _createBadge(username, insights, side) {
    if (!insights) return null;

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
      // Fall back to showing overall stats
      return this._createOverallBadge(insights, side);
    }

    const d = insights[bestFmt];
    const { wins, losses, draws, total } = d.recent;
    const acc = d.avgAccuracy;
    const accStr = acc !== null ? ` (${acc}%)` : '';
    const gamesStr = d.accuracyGames > 0 ? ` · ${d.accuracyGames} reviewed` : '';

    const badge = document.createElement('div');
    badge.className = 'crs-insights-badge';
    badge.dataset.side = side;
    badge.title = `Recent ${bestFmt} games (${total} total)${gamesStr}`;
    badge.innerHTML = `
      <span class="crs-ins-w">${wins}W</span>
      <span class="crs-ins-sep">/</span>
      <span class="crs-ins-l">${losses}L</span>
      <span class="crs-ins-sep">/</span>
      <span class="crs-ins-d">${draws}D</span>
      ${acc !== null ? `<span class="crs-ins-acc">${accStr}</span>` : ''}
      <span class="crs-ins-fmt">${bestFmt}</span>
    `;

    return badge;
  }

  _createOverallBadge(insights, side) {
    // Aggregate overall stats across all formats from the stats API
    let totalWins = 0, totalLosses = 0, totalDraws = 0;
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
    badge.innerHTML = `
      <span class="crs-ins-w">${totalWins}W</span>
      <span class="crs-ins-sep">/</span>
      <span class="crs-ins-l">${totalLosses}L</span>
      <span class="crs-ins-sep">/</span>
      <span class="crs-ins-d">${totalDraws}D</span>
      <span class="crs-ins-fmt">all</span>
    `;
    return badge;
  }
}
