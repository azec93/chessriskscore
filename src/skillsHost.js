// ============================================================
// SKILLS: runs the chess engine (Stockfish 19 Lite, in vendor/stockfish) over games, in Web Workers. Service workers cannot start workers, so in Chrome this
// lives in an offscreen page (skills-host.html); in Firefox it runs inside the background page. Only moves are handled here, nothing is sent anywhere.
// ============================================================
const CRS_SKHOST = (() => {
  const SK = CRS_SK, FILE = 'vendor/stockfish/stockfish-19-lite-single.js';
  let live = null;
  function engine() {
    const w = new Worker(chrome.runtime.getURL(FILE)); let on = null;
    w.onmessage = e => { if (on) on(String(e.data)); };
    w.onerror = e => { if (on) on('ERROR ' + e.message); };
    const until = re => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('The engine stopped answering.')), 60000); on = l => { if (/^ERROR/.test(l)) { clearTimeout(t); on = null; rej(new Error(l)); } else if (re.test(l)) { clearTimeout(t); on = null; res(l); } }; });
    return {
      kill: () => w.terminate(),
      async init() { let a = until(/^uciok/); w.postMessage('uci'); await a; w.postMessage('setoption name Threads value 1'); w.postMessage('setoption name Hash value 32'); a = until(/^readyok/); w.postMessage('isready'); await a; w.postMessage('ucinewgame'); },
      analyse(fen, depth) {
        return new Promise((res, rej) => {
          let last = null; const t = setTimeout(() => rej(new Error('The engine stopped answering.')), 120000);
          on = l => {
            if (/^ERROR/.test(l)) { clearTimeout(t); on = null; rej(new Error(l)); }
            else if (l.startsWith('info') && / score /.test(l) && !/ lowerbound| upperbound/.test(l)) { const m = / score (cp|mate) (-?\d+)/.exec(l); if (m) last = m; }
            else if (l.startsWith('bestmove')) { clearTimeout(t); on = null; let v = 0; if (last) { const n = +last[2]; v = last[1] === 'cp' ? n : (n > 0 ? 10000 - n : -10000 - n); } res(fen.split(' ')[1] === 'w' ? v : -v); }
          };
          w.postMessage('position fen ' + fen); w.postMessage('go depth ' + depth);
        });
      },
    };
  }
  // onRow(row) per finished game; onEnd(error or null) once. A game that cannot be read is skipped, not fatal.
  async function run(games, workers, onRow, onEnd) {
    stop();
    const me = live = { engines: [], stopped: false }; let next = 0;
    try {
      for (let i = 0; i < workers; i++) { const e = engine(); me.engines.push(e); await e.init(); if (me.stopped) return; }
      await Promise.all(me.engines.map(async e => {
        while (next < games.length && !me.stopped) {
          const g = games[next++]; let P; try { P = SK.replay(g.san); } catch (err) { onRow(null, g.id); continue; }
          const ev = [];
          for (let i = 0; i < P.fens.length; i++) { if (me.stopped) return; ev.push(P.fens[i] ? await e.analyse(P.fens[i], SK.DEPTH) : P.value[i]); }
          if (!me.stopped) onRow(SK.gameRow({ ...g, ev, pcs: P.pcs }), g.id);
        }
      }));
      if (!me.stopped) onEnd(null);
    } catch (err) { if (!me.stopped) onEnd(String(err && err.message || err)); }
    finally { me.engines.forEach(e => e.kill()); if (live === me) live = null; }
  }
  function stop() { if (live) { live.stopped = true; live.engines.forEach(e => e.kill()); live = null; } }
  return { run, stop };
})();
