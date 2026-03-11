// ============================================================
// LICHESS API CLIENT v3
// Fixes: removed analysed=true (too restrictive), use evals=true
// to get ACPL when available, sequential fetch, peak rating fix
// ============================================================

class LichessAPI {
  constructor() {
    this.base = 'https://lichess.org/api';
    this.cache = new Map();
  }

  _acplToAccuracy(acpl) {
    if (acpl === null || acpl === undefined || isNaN(acpl)) return null;
    // Correct formula: acc ≈ 103.1668 × e^(-0.00453 × ACPL)
    // At 0 ACPL → 100%, 30 ACPL → 90%, 50 ACPL → 82%, 80 ACPL → 72%, 100 ACPL → 66%
    return Math.min(100, Math.round(103.1668 * Math.exp(-0.00453 * acpl) * 10) / 10);
  }

  _mapSpeed(speed) {
    // Map classical → rapid so it's included in scoring
    return { ultraBullet:'bullet', bullet:'bullet', blitz:'blitz', rapid:'rapid', classical:'rapid', correspondence:'daily' }[speed] || speed;
  }

  async _fetch(url, isNdjson = false) {
    if (this.cache.has(url)) return this.cache.get(url);
    const headers = { 'Accept': isNdjson ? 'application/x-ndjson' : 'application/json' };
    const res = await fetch(url, { method: 'GET', headers, credentials: 'omit' });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Player not found on Lichess');
      if (res.status === 429) throw new Error('Rate limited — try again shortly');
      throw new Error(`Lichess API ${res.status}`);
    }
    let data;
    if (isNdjson) {
      const text = await res.text();
      data = text.trim().split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } else {
      data = await res.json();
    }
    this.cache.set(url, data);
    return data;
  }

  async getProfile(username) {
    return this._fetch(`${this.base}/user/${encodeURIComponent(username)}`);
  }

  async getRecentGames(username, months = 2) {
    const since = Date.now() - (months * 30 * 24 * 60 * 60 * 1000);
    // NO analysed=true — fetch all rated games, with evals for ACPL when available
    const url = `${this.base}/games/user/${encodeURIComponent(username)}?max=80&rated=true&since=${since}&evals=true&pgnInJson=false&opening=false&clocks=false`;
    return this._fetch(url, true);
  }

  _transformStats(profile, games, username) {
    const stats = {};
    const userL = username.toLowerCase();

    for (const fmt of ['bullet', 'blitz', 'rapid']) {
      const perf = profile?.perfs?.[fmt];
      let wins = 0, losses = 0, draws = 0;
      let peakRating = perf?.rating || 0;

      for (const game of games) {
        const speed = this._mapSpeed(game.speed || game.perf);
        if (speed !== fmt) continue;
        const wId = (game.players?.white?.user?.id || '').toLowerCase();
        const bId = (game.players?.black?.user?.id || '').toLowerCase();
        const isWhite = wId === userL;
        const isBlack = bId === userL;
        if (!isWhite && !isBlack) continue;
        const myColor = isWhite ? 'white' : 'black';
        if (game.winner === myColor) wins++;
        else if (game.winner && game.winner !== myColor) losses++;
        else draws++;

        // Track peak rating from games
        const gameRating = isWhite ? (game.players?.white?.rating || 0) : (game.players?.black?.rating || 0);
        if (gameRating > peakRating) peakRating = gameRating;
      }

      // Also check profile's all-time game count for overall record
      const perfGames = perf?.games || 0;
      const perfWins = perf?.win || 0;
      const perfLosses = perf?.loss || 0;
      const perfDraws = perf?.draw || 0;

      stats[`chess_${fmt}`] = {
        record: {
          // Use profile totals if we have them and they're larger (covers full history)
          win: perfGames > 0 && perfWins > wins ? perfWins : wins,
          loss: perfGames > 0 && perfLosses > losses ? perfLosses : losses,
          draw: perfGames > 0 && perfDraws > draws ? perfDraws : draws,
        },
        last: { rating: perf?.rating || 0 },
        best: { rating: peakRating },
      };
    }
    return stats;
  }

  _transformGames(games, username) {
    const userL = username.toLowerCase();
    return games.map(game => {
      const speed = this._mapSpeed(game.speed || game.perf);
      if (!['bullet','blitz','rapid'].includes(speed)) return null;

      const wId = (game.players?.white?.user?.id || '').toLowerCase();
      const isWhite = wId === userL;
      const myColor = isWhite ? 'white' : 'black';
      const oppColor = isWhite ? 'black' : 'white';

      let myResult, oppResult;
      if (game.winner === myColor) { myResult = 'win'; oppResult = 'checkmated'; }
      else if (game.winner === oppColor) { myResult = 'checkmated'; oppResult = 'win'; }
      else { myResult = 'draw'; oppResult = 'draw'; }

      // ACPL → accuracy (available when game has been analysed)
      const wAcpl = game.players?.white?.analysis?.acpl ?? null;
      const bAcpl = game.players?.black?.analysis?.acpl ?? null;
      const wAcc = this._acplToAccuracy(wAcpl);
      const bAcc = this._acplToAccuracy(bAcpl);
      const accuracies = (wAcc !== null || bAcc !== null) ? { white: wAcc, black: bAcc } : null;

      return {
        time_class: speed,
        rated: game.rated !== false,
        end_time: Math.round((game.lastMoveAt || game.createdAt || 0) / 1000),
        white: {
          username: game.players?.white?.user?.name || game.players?.white?.user?.id || 'Anonymous',
          result: isWhite ? myResult : oppResult,
          rating: game.players?.white?.rating || 0,
          '@rating': game.players?.white?.rating || 0,
        },
        black: {
          username: game.players?.black?.user?.name || game.players?.black?.user?.id || 'Anonymous',
          result: isWhite ? oppResult : myResult,
          rating: game.players?.black?.rating || 0,
          '@rating': game.players?.black?.rating || 0,
        },
        accuracies,
      };
    }).filter(Boolean);
  }

  async fetchAllData(username) {
    const profile = await this.getProfile(username).catch(() => null);
    if (!profile) throw new Error('Player not found on Lichess');

    const rawGames = await this.getRecentGames(username, CONFIG.RECENT_MONTHS).catch(() => []);
    const recentGames = this._transformGames(rawGames, username);
    const stats = this._transformStats(profile, rawGames, username);

    return {
      username,
      profile: { joined: profile.createdAt ? Math.round(profile.createdAt / 1000) : null },
      stats,
      recentGames,
    };
  }
}
