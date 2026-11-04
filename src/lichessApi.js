// ============================================================
// LICHESS API CLIENT v4
// v4: Lichess sends games as a stream at roughly 12 games a second, so 80 games
// take about 7 seconds. The stream is now read as it arrives and a first result
// is reported after 15 games (~1.5s) and again after 40 (~3.5s), then the full
// set. Same single request and the same final data as before.
// v1.7: a player's downloads can be cancelled (cancel(username)) when the page moves on to someone else.
// Games already downloaded are kept on this computer (a slim copy, newest 25 players), so a player seen
// before only needs the games played since: rematches and your own bar load in well under a second.
// On lichess.org the requests carry your Lichess login when you are signed in, which Lichess serves
// faster (30 games a second instead of 20). Only public data is requested either way.
// ============================================================

class LichessAPI {
  constructor() {
    this.base = 'https://lichess.org/api';
    this.cache = new Map(); // url -> { data, ts }
    this.inflight = new Map(); // url -> Promise (identical requests in flight are shared)
    this.controllers = new Map(); // lower-case username -> AbortController for that player's downloads
    this.skipStored = new Set();  // players whose saved games must be ignored once (Refresh)
    this.STORE_KEY = 'crsLichessGames_v1';
    // Signed-in requests only from lichess.org itself (same site); everywhere else, no cookies.
    this.credentials = (typeof location !== 'undefined' && /(^|\.)lichess\.org$/.test(location.hostname)) ? 'include' : 'omit';
    this.CACHE_TTL_MS = 5 * 60 * 1000;
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

  _abortError() { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; }

  cancel(username) {
    const c = this.controllers.get(String(username || '').toLowerCase());
    if (c) c.abort();
  }

  async _fetch(url, isNdjson = false, signal) {
    const hit = this.cache.get(url);
    if (hit && (Date.now() - hit.ts) < this.CACHE_TTL_MS) return hit.data;
    this.cache.delete(url);
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const p = this._request(url, isNdjson, signal);
    this.inflight.set(url, p);
    try { return await p; } finally { this.inflight.delete(url); }
  }

  async _request(url, isNdjson, signal) {
    const headers = { 'Accept': isNdjson ? 'application/x-ndjson' : 'application/json' };
    const res = await fetch(url, { method: 'GET', headers, credentials: this.credentials, signal });
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
    this.cache.set(url, { data, ts: Date.now() });
    return data;
  }

  async getProfile(username, signal) {
    return this._fetch(`${this.base}/user/${encodeURIComponent(username)}`, false, signal);
  }

  async getRecentGames(username, months = 2, onGames = null, signal) {
    // Rounded to the hour: an exact timestamp made every URL unique, so the 5-minute
    // cache below never matched and each lookup re-downloaded all 80 games (~7s).
    const HOUR = 60 * 60 * 1000;
    const since = Math.floor(Date.now() / HOUR) * HOUR - (months * 30 * 24 * HOUR);
    // NO analysed=true — fetch all rated games, with evals for ACPL when available
    const url = `${this.base}/games/user/${encodeURIComponent(username)}?max=80&rated=true&since=${since}&evals=true&pgnInJson=false&opening=false&clocks=false`;
    const hit = this.cache.get(url);
    if (hit && (Date.now() - hit.ts) < this.CACHE_TTL_MS) return hit.data;
    this.cache.delete(url);
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const p = this._recentGames(username, since, url, onGames, signal);
    this.inflight.set(url, p);
    try { return await p; } finally { this.inflight.delete(url); }
  }

  // Refresh: ignore this player's saved games once and download everything again.
  forget(username) { this.skipStored.add(String(username || '').toLowerCase()); }

  async _recentGames(username, since, url, onGames, signal) {
    const key = String(username).toLowerCase();
    const stored = this.skipStored.delete(key) ? null : await this._loadStored(key);
    let games;
    if (stored && stored.games.length) {
      // Only the games started after the newest saved one (unfinished games are never in the export, so nothing is skipped).
      const newest = stored.games.reduce((m, g) => Math.max(m, g.createdAt || 0), 0);
      const from = Math.max(since, newest + 1);
      const fresh = await this._streamGames(`${this.base}/games/user/${encodeURIComponent(username)}?max=80&rated=true&since=${from}&evals=true&pgnInJson=false&opening=false&clocks=false`, null, signal);
      const byId = new Map();
      for (const g of stored.games) if ((g.createdAt || 0) >= since) byId.set(g.id, g);
      for (const g of fresh) byId.set(g.id, this._slim(g));
      // Keep as many as a full download would: Lichess sends somewhat more than max= asks for, so the count is learned from it.
      games = [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, stored.cap || Infinity);
    } else {
      games = (await this._streamGames(url, onGames, signal)).map(g => this._slim(g));
    }
    this.cache.set(url, { data: games, ts: Date.now() });
    // cap: how many games a full download returned for a busy player (null when the 2-month window, not the limit, ended it)
    this._saveStored(key, games, stored ? stored.cap : (games.length >= 80 ? games.length : null));
    return games;
  }

  // The fields the score uses, nothing else (keeps the saved copy small).
  _slim(g) {
    const p = c => { const x = g.players?.[c] || {}; return { user: x.user ? { id: x.user.id, name: x.user.name } : undefined, rating: x.rating, analysis: x.analysis ? { acpl: x.analysis.acpl } : undefined }; };
    return { id: g.id, rated: g.rated, speed: g.speed, perf: g.perf, createdAt: g.createdAt, lastMoveAt: g.lastMoveAt, status: g.status, winner: g.winner, players: { white: p('white'), black: p('black') } };
  }

  async _loadStored(key) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;
      const all = (await chrome.storage.local.get(this.STORE_KEY))[this.STORE_KEY] || {};
      return all[key] && Array.isArray(all[key].games) ? all[key] : null;
    } catch (e) { return null; }
  }

  async _saveStored(key, games, cap) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      const all = (await chrome.storage.local.get(this.STORE_KEY))[this.STORE_KEY] || {};
      all[key] = { ts: Date.now(), games, cap: cap || null };
      const keys = Object.keys(all).sort((a, b) => all[b].ts - all[a].ts);
      for (const k of keys.slice(25)) delete all[k];                 // the 25 most recently seen players
      await chrome.storage.local.set({ [this.STORE_KEY]: all });
    } catch (e) {}
  }

  // Reads the NDJSON game stream line by line. onGames(gamesSoFar) is called after every
  // chunk that completed at least one game (newest games arrive first).
  async _streamGames(url, onGames, signal) {
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/x-ndjson' }, credentials: this.credentials, signal });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Player not found on Lichess');
      if (res.status === 429) throw new Error('Rate limited — try again shortly');
      throw new Error(`Lichess API ${res.status}`);
    }
    const games = [];
    const add = (line) => { const t = line.trim(); if (!t) return; try { games.push(JSON.parse(t)); } catch (e) {} };
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let i, grew = false;
        while ((i = buf.indexOf('\n')) >= 0) { add(buf.slice(0, i)); buf = buf.slice(i + 1); grew = true; }
        if (grew && onGames) { try { onGames(games); } catch (e) {} }
      }
      add(buf + decoder.decode());
    } else {
      (await res.text()).split('\n').forEach(add);
    }
    this.cache.set(url, { data: games, ts: Date.now() });
    return games;
  }

  // Highest rating ever reached in bullet, blitz and rapid (the perf endpoint's exact peak; rating-history
  // only keeps each day's closing rating, which can be up to ~30 points lower).
  async getPeakRatings(username, signal) {
    const one = async (perf) => {
      try {
        const data = await this._fetch(`${this.base}/user/${encodeURIComponent(username)}/perf/${perf}`, false, signal);
        return data?.stat?.highest?.int || null;
      } catch (e) { if (e && e.name === 'AbortError') throw e; return null; }
    };
    const [bullet, blitz, rapid] = await Promise.all([one('bullet'), one('blitz'), one('rapid')]);
    return { bullet, blitz, rapid };
  }

  _transformStats(profile, games, username, peakRatings) {
    const stats = {};
    const userL = username.toLowerCase();

    for (const fmt of ['bullet', 'blitz', 'rapid', 'daily']) {
      const perf = profile?.perfs?.[fmt === 'daily' ? 'correspondence' : fmt];
      let wins = 0, losses = 0, draws = 0;
      // Use the real peak from the perf endpoint, fall back to current rating
      let peakRating = peakRatings?.[fmt] || perf?.rating || 0;

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
      if (!['bullet','blitz','rapid','daily'].includes(speed)) return null;

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

  _build(username, profile, rawGames, peakRatings) {
    return {
      username,
      profile: { joined: profile.createdAt ? Math.round(profile.createdAt / 1000) : null, title: profile.title || null },
      stats: this._transformStats(profile, rawGames, username, peakRatings),
      recentGames: this._transformGames(rawGames, username),
    };
  }

  // onPartial(data) is optional: it receives the same shape as the final result, built from
  // the games that have arrived so far, once 15 and once 40 games are in.
  async fetchAllData(username, onPartial = null) {
    const PARTIAL_AT = [15, 40];
    let profile = null, next = 0;
    const key = String(username).toLowerCase(), ctl = new AbortController(), signal = ctl.signal;
    this.controllers.set(key, ctl);
    const profileP = this.getProfile(username, signal).catch(() => null).then(p => (profile = p));
    const onGames = onPartial ? (games) => {
      if (signal.aborted || !profile || next >= PARTIAL_AT.length || games.length < PARTIAL_AT[next]) return;
      while (next < PARTIAL_AT.length && games.length >= PARTIAL_AT[next]) next++;
      onPartial(this._build(username, profile, games.slice(), {}));
    } : null;

    // Profile, recent games and peak ratings all start together.
    let rawGames, peaks;
    try {
      [, rawGames, peaks] = await Promise.all([
        profileP,
        this.getRecentGames(username, CONFIG.RECENT_MONTHS, onGames, signal).catch(() => []),
        this.getPeakRatings(username, signal).catch(() => ({})),
      ]);
    } finally { if (this.controllers.get(key) === ctl) this.controllers.delete(key); }
    if (signal.aborted) throw this._abortError();
    if (!profile) throw new Error('Player not found on Lichess');
    return this._build(username, profile, rawGames, peaks);
  }
}
