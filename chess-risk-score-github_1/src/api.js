// ============================================================
// CHESS.COM API CLIENT v2
// Fixed: correct archive fetching, rated-only filtering,
//        proper accuracy extraction from game objects
// ============================================================

class ChessAPI {
  constructor() {
    this.base = 'https://api.chess.com/pub';
    this.cache = new Map();
  }

  async _fetch(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'omit'
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Player not found');
      throw new Error(`API ${res.status}`);
    }
    const data = await res.json();
    this.cache.set(url, data);
    return data;
  }

  async getProfile(username) {
    return this._fetch(`${this.base}/player/${encodeURIComponent(username)}`);
  }

  async getStats(username) {
    return this._fetch(`${this.base}/player/${encodeURIComponent(username)}/stats`);
  }

  async getArchives(username) {
    const data = await this._fetch(`${this.base}/player/${encodeURIComponent(username)}/games/archives`);
    return data.archives || [];
  }

  async getMonthGames(archiveUrl) {
    try {
      const data = await this._fetch(archiveUrl);
      return data.games || [];
    } catch {
      return [];
    }
  }

  // Fetch last N months of games (most recent archives)
  async getRecentGames(username, months = 2) {
    const archives = await this.getArchives(username);
    if (!archives.length) return [];

    // Take the last `months` archive URLs (most recent months)
    const recentUrls = archives.slice(-months);
    const batches = await Promise.all(recentUrls.map(url => this.getMonthGames(url)));
    return batches.flat();
  }

  // Fetch all data in parallel
  async fetchAllData(username) {
    const [profile, stats, recentGames] = await Promise.all([
      this.getProfile(username).catch(() => null),
      this.getStats(username).catch(() => ({})),
      this.getRecentGames(username, CONFIG.RECENT_MONTHS).catch(() => []),
    ]);

    // If profile failed but stats worked, we can still score
    if (!profile && !Object.keys(stats).length && !recentGames.length) {
      throw new Error('No data found for this player');
    }

    return { username, profile, stats: stats || {}, recentGames: recentGames || [] };
  }
}
