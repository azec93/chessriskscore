// ============================================================
// MY CHEATER STATS, Lichess side: downloads the user's game list on request.
// Lichess only answers game-export requests that come from its own pages, so the stats scan (src/historyEngine.js, in the background
// script) asks an open lichess.org tab to do the download and sends the games back in batches. Nothing here runs by itself: it only
// answers a connection from this extension, and only for /api/games/user/<name>?... on lichess.org.
// ============================================================
(() => {
  if (!/(^|\.)lichess\.org$/.test(location.hostname)) return;
  const ALLOWED = /^\/api\/games\/user\/[A-Za-z0-9_-]{2,30}\?/;
  const slim = g => {
    const side = p => (p && p.user ? { user: { id: p.user.id, name: p.user.name }, rating: p.rating } : {});
    return { ...(g.moves != null ? { moves: g.moves, clocks: g.clocks, clock: g.clock } : {}), id: g.id, rated: g.rated, variant: g.variant, status: g.status, speed: g.speed, opening: g.opening ? { name: g.opening.name } : undefined, createdAt: g.createdAt, winner: g.winner, players: { white: side(g.players && g.players.white), black: side(g.players && g.players.black) } };
  };
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'crs-hist') return;
    let ctl = null;
    port.onDisconnect.addListener(() => { try { if (ctl) ctl.abort(); } catch (e) {} });
    port.onMessage.addListener(async msg => {
      if (msg && msg.type === 'abort') { try { if (ctl) ctl.abort(); } catch (e) {} return; }
      if (!msg || msg.type !== 'games' || typeof msg.path !== 'string' || !ALLOWED.test(msg.path)) { try { port.postMessage({ done: 'error' }); } catch (e) {} return; }
      ctl = new AbortController();
      const say = m => { try { port.postMessage(m); } catch (e) {} };
      try {
        const res = await fetch(msg.path, { headers: { Accept: 'application/x-ndjson' }, credentials: 'omit', signal: ctl.signal });
        if (res.status === 404) return say({ done: 'gone' });
        if (res.status === 429) return say({ done: 'limited' });
        if (!res.ok) return say({ done: 'error' });
        const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', batch = [], last = Date.now();
        const feed = line => { line = line.trim(); if (!line) return; try { batch.push(slim(JSON.parse(line))); } catch (e) {} };
        const flush = () => { if (batch.length) { say({ games: batch }); batch = []; } last = Date.now(); };
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true }); let i;
          while ((i = buf.indexOf('\n')) >= 0) { feed(buf.slice(0, i)); buf = buf.slice(i + 1); }
          if (batch.length >= 200 || Date.now() - last > 400) flush();
        }
        feed(buf); flush(); say({ done: 'ok' });
      } catch (e) { say({ done: ctl.signal.aborted ? 'aborted' : 'error' }); }
    });
  });
})();
