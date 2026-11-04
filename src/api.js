// ============================================================
// CHESS.COM API CLIENT v3
// v3 speed changes (same data as v2, fewer round trips):
//  - the two newest monthly archives are requested straight away, in parallel
//    with the archive list, instead of waiting for the list first
//  - identical requests that are already in flight are shared, not repeated
// v1.7: a player's downloads can be cancelled (cancel(username)) when the page moves on to someone else
// ============================================================

class ChessAPI {
  constructor() {
    this.base = 'https://api.chess.com/pub';
    this.cache = new Map();    // url -> { data, ts }
    this.inflight = new Map(); // url -> Promise
    this.controllers = new Map(); // lower-case username -> AbortController for that player's downloads
    this.CACHE_TTL_MS = 5 * 60 * 1000; // rematches should see fresh data
  }

  async _fetch(url, signal) {
    const hit = this.cache.get(url);
    if (hit && (Date.now() - hit.ts) < this.CACHE_TTL_MS) return hit.data;
    this.cache.delete(url); // expired — also keeps the Map from growing unbounded
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const p = (async () => {
      // Chess.com refuses requests (429) when it is busy or an IP asks too fast, and requests
      // can fail in transit. Try again a few times before giving up: a missing answer must
      // not be mistaken for "this player has no games".
      const WAITS = [0, 400, 1000, 2000];
      let lastError = new Error('Network error');
      for (const wait of WAITS) {
        if (wait) await new Promise(r => setTimeout(r, wait));
        if (signal && signal.aborted) throw this._abortError();
        let res;
        try { res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, credentials: 'omit', signal }); }
        catch (e) { if (e && e.name === 'AbortError') throw e; lastError = e; continue; }
        if (res.status === 404) throw new Error('Player not found');
        if (res.status === 429 || res.status >= 500) { lastError = new Error(`API ${res.status}`); continue; }
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        this.cache.set(url, { data, ts: Date.now() });
        return data;
      }
      throw lastError;
    })();
    this.inflight.set(url, p);
    try { return await p; } finally { this.inflight.delete(url); }
  }

  _abortError() { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; }

  // Stop every download still running for this player (the page has moved on to someone else).
  cancel(username) {
    const c = this.controllers.get(String(username || '').toLowerCase());
    if (c) c.abort();
  }

  async getProfile(username, signal) {
    return this._fetch(`${this.base}/player/${encodeURIComponent(username)}`, signal);
  }

  async getStats(username, signal) {
    return this._fetch(`${this.base}/player/${encodeURIComponent(username)}/stats`, signal);
  }

  async getArchives(username, signal) {
    const data = await this._fetch(`${this.base}/player/${encodeURIComponent(username)}/games/archives`, signal);
    return data.archives || [];
  }

  async getMonthGames(archiveUrl, signal) {
    try {
      const data = await this._fetch(archiveUrl, signal);
      return data.games || [];
    } catch (e) {
      if (e && e.name === 'AbortError') return [];
      // "Player not found" here just means no games that month. Anything else is a real failure.
      if (!/not found/i.test(String(e && e.message))) this._gamesFailed = true;
      return [];
    }
  }

  // Archive URLs for the current month and the ones before it, oldest first.
  _guessArchiveUrls(username, months) {
    const u = encodeURIComponent(username.toLowerCase());
    const now = new Date();
    const urls = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      urls.push(`${this.base}/player/${u}/games/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return urls;
  }

  // Fetch the last N monthly archives (the player's most recent months with games).
  async getRecentGames(username, months = 2, signal) {
    // Start the likely archives now; for an active player these are exactly the ones we need.
    const guessed = this._guessArchiveUrls(username, months);
    const guessedGames = guessed.map(url => this.getMonthGames(url, signal));

    let archives;
    try { archives = await this.getArchives(username, signal); }
    catch { this._gamesFailed = true; return (await Promise.all(guessedGames)).flat(); }
    if (!archives.length) return [];

    // Same selection as before: the newest `months` archives on record. Reuse a guess when it matches.
    const recentUrls = archives.slice(-months);
    const lower = guessed.map(u => u.toLowerCase());
    const batches = await Promise.all(recentUrls.map(url => {
      const i = lower.indexOf(String(url).toLowerCase());
      return i >= 0 ? guessedGames[i] : this.getMonthGames(url, signal);
    }));
    return batches.flat();
  }

  // Fetch all data in parallel
  async fetchAllData(username) {
    this._gamesFailed = false;
    const missing = [];
    const key = String(username).toLowerCase(), ctl = new AbortController(), signal = ctl.signal;
    this.controllers.set(key, ctl);
    let profile, stats, recentGames;
    try {
      [profile, stats, recentGames] = await Promise.all([
        this.getProfile(username, signal).catch(() => { missing.push('profile'); return null; }),
        this.getStats(username, signal).catch(() => { missing.push('stats'); return null; }),
        this.getRecentGames(username, CONFIG.RECENT_MONTHS, signal).catch(() => { missing.push('games'); return []; }),
      ]);
    } finally { if (this.controllers.get(key) === ctl) this.controllers.delete(key); }
    if (signal.aborted) throw this._abortError();
    if (this._gamesFailed && !missing.includes('games')) missing.push('games');

    // If profile failed but stats worked, we can still score
    if (!profile && !stats && !recentGames.length) {
      throw new Error(missing.length ? 'Chess.com did not answer. Try Refresh in a moment.' : 'No data found for this player');
    }

    // missing: the parts Chess.com did not return. statsLoaded tells the calculator whether
    // an absent record means "never played this format" or "we do not know".
    return { username, profile, stats: stats || {}, recentGames: recentGames || [], missing, statsLoaded: !!stats };
  }
}
