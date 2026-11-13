// ============================================================
// MY CHEATER STATS: logic (no page code, so it can be tested on its own)
// Reads the user's own public Chess.com games, then each opponent's public profile status.
//   status "closed:fair_play_violations"  = closed for cheating
//   any other "closed..." status          = closed for another or unknown reason
// Only runs when the user presses a button on the stats page. Nothing here touches the game pages.
// ============================================================
const CRS_HIST = (() => {
  const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
  const FINAL = new Set(['c', 'x']);
  const HOUR = 3600e3;
  const PROTO = 21;   // raise whenever the background scan changes: the popup compares this with what the running background script reports

  const resultOf = code => code === 'win' ? 'w' : DRAWS.has(code) ? 'd' : 'l';
  // c = closed for cheating, x = closed for another or unknown reason, o = open
  const statusCode = s => s === 'closed:fair_play_violations' ? 'c' : /^closed/.test(String(s || '')) ? 'x' : 'o';
  const monthKey = url => { const m = /\/games\/(\d{4})\/(\d{2})/.exec(url || ''); return m ? m[1] + '/' + m[2] : null; };
  const nowMonth = (now = Date.now()) => { const d = new Date(now); return d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
  const gameId = url => { const m = /chess\.com\/game\/((?:live|daily)\/\d+)/.exec(url || ''); return m ? m[1] : ''; };

  // "Italian-Game-Giuoco-Piano" or "Italian Game: Giuoco Piano" -> "Italian Game"
  function opFamily(raw) {
    let s = String(raw || ''); if (!s) return '';
    s = s.split('/openings/').pop().split('?')[0].replace(/-/g, ' ').split(/[:,]/)[0].trim();
    if (/^Ruy Lopez/.test(s)) return 'Ruy Lopez';
    const m = /^(.*?\b(?:Opening|Game|Defense|Defence|Attack|Gambit|System))\b/.exec(s);
    if (m) s = m[1]; else s = s.split(/\s+\d/)[0].split(/\s+/).slice(0, 3).join(' ');
    if (/^Giuoco Piano/.test(s)) return 'Italian Game';
    return s.replace(/\b(King|Queen|Bishop)s\b/g, "$1's").replace(/^Caro Kann/, 'Caro-Kann').replace(/^Nimzo Indian/, 'Nimzo-Indian');
  }
  // the four groups on the time control filter: Lichess's extra speeds join their nearest one
  const tcGroup = t => ({ ultraBullet: 'bullet', classical: 'rapid', correspondence: 'daily' }[t] || t || '');
  // what to ask Lichess for: it filters by speed itself
  const LI_PERF = { all: 'ultraBullet,bullet,blitz,rapid,classical,correspondence', rapid: 'rapid,classical', blitz: 'blitz', bullet: 'ultraBullet,bullet', daily: 'correspondence' };
  const HOW = { timeout: 'time', outoftime: 'time', checkmated: 'mate', mate: 'mate', resigned: 'resign', resign: 'resign', abandoned: 'abandon' };
  // Rated standard-chess games only (that is where cheating matters). Returns one row per game, newest first.
  function gamesOf(user, games) {
    const me = String(user).toLowerCase(), out = [];
    for (const g of games || []) {
      if (!g || g.rated !== true || g.rules !== 'chess' || !g.white || !g.black) continue;
      const w = String(g.white.username || '').toLowerCase(), b = String(g.black.username || '').toLowerCase();
      const mine = w === me ? g.white : b === me ? g.black : null, theirs = w === me ? g.black : b === me ? g.white : null;
      if (!mine || !theirs || !theirs.username) continue;
      out.push({ k: String(theirs.username).toLowerCase(), u: theirs.username, t: g.end_time || 0, r: resultOf(mine.result), g: gameId(g.url), c: mine === g.white ? 'w' : 'b', rt: mine.rating || 0, or: theirs.rating || 0, tc: g.time_class || '', op: opFamily(g.eco), hw: HOW[resultOf(mine.result) === 'w' ? theirs.result : mine.result] || 'other' });
    }
    return out.sort((a, b) => b.t - a.t);
  }

  // Fold game rows into per-opponent totals: ag[key] = [games, wins, draws, losses, lastTime, lastResult, lastGameId, displayName]
  function addRows(ag, rows) {
    for (const r of rows) {
      const a = ag[r.k] || (ag[r.k] = [0, 0, 0, 0, 0, '', '', r.u]);
      a[0]++; a[r.r === 'w' ? 1 : r.r === 'd' ? 2 : 3]++;
      if (r.t >= a[4]) { a[4] = r.t; a[5] = r.r; a[6] = r.g; a[7] = r.u; }
    }
    return ag;
  }
  const merge = (a, b) => { const o = {}; for (const k in a) o[k] = a[k].slice(); for (const k in b) { const x = b[k], y = o[k]; if (!y) { o[k] = x.slice(); continue; } for (let i = 0; i < 4; i++) y[i] += x[i]; if (x[4] >= y[4]) { y[4] = x[4]; y[5] = x[5]; y[6] = x[6]; y[7] = x[7]; } } return o; };

  // st[key] = [code, hourChecked]; nw[key] = hour it turned from open to closed for cheating
  function setStatus(st, nw, key, status, now = Date.now()) {
    const code = statusCode(status), before = st[key];
    if (code === 'c' && before && before[0] === 'o') nw[key] = Math.floor(now / HOUR);
    st[key] = [code, Math.floor(now / HOUR)];
    return code;
  }
  // Which opponents still need a look: unknown ones and open ones last checked more than maxAgeHours ago. Newest first.
  function toCheck(ag, st, maxAgeHours, now = Date.now()) {
    const h = Math.floor(now / HOUR), keys = [];
    for (const k in ag) { const s = st[k]; if (s && (FINAL.has(s[0]) || h - s[1] < maxAgeHours)) continue; keys.push(k); }
    return keys.sort((a, b) => ag[b][4] - ag[a][4]);
  }

  function summarize(ag, st) {
    const t = { opponents: 0, games: 0, checked: 0, gamesChecked: 0, cheat: { opp: 0, games: 0, w: 0, d: 0, l: 0 }, other: { opp: 0, games: 0 } };
    for (const k in ag) {
      const a = ag[k]; t.opponents++; t.games += a[0];
      const s = st[k]; if (!s) continue; t.checked++; t.gamesChecked += a[0];
      if (s[0] === 'c') { t.cheat.opp++; t.cheat.games += a[0]; t.cheat.w += a[1]; t.cheat.d += a[2]; t.cheat.l += a[3]; }
      else if (s[0] === 'x') { t.other.opp++; t.other.games += a[0]; }
    }
    const n = t.cheat.games; t.cheat.score = n ? (t.cheat.w + t.cheat.d / 2) / n : null;
    return t;
  }

  // Games vs players closed for cheating, newest first (one row per game, from the recent-games list).
  function recentCheaterGames(rc, st, nw, now = Date.now()) {
    const h = Math.floor(now / HOUR);
    return rc.filter(r => st[r.k] && st[r.k][0] === 'c').map(r => ({ ...r, isNew: nw[r.k] != null && h - nw[r.k] < 14 * 24 })).sort((a, b) => b.t - a.t);
  }

  // ── recent performance: needs only your own games, no opponent look-ups ──
  const IDX = { w: 0, d: 1, l: 2 };
  // al = the game after a loss, a2 = after two losses running, aw = after a win, s1 = games 1 to 5 of a sitting, s2 = game 6 onwards
  const FLOW = () => ({ al: [0, 0, 0], a2: [0, 0, 0], aw: [0, 0, 0], s1: [0, 0, 0], s2: [0, 0, 0] }), SITTING_GAP = 3600, SITTING_SHORT = 5;
  const hourBand = t => { const h = new Date(t * 1000).getHours(); return h >= 5 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : h >= 18 && h < 23 ? 2 : 3; };   // morning, afternoon, evening, night, on this computer's clock
  const perfNew = () => ({ n: 0, w: 0, d: 0, l: 0, cw: [0, 0, 0], cb: [0, 0, 0], hi: [0, 0, 0], eq: [0, 0, 0], lo: [0, 0, 0], tc: {}, fm: [], by: {}, ops: {}, opw: {}, opb: {}, how: { w: {}, l: {} }, fl: FLOW(), hr: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] });
  function perfAdd(P, r, sub) {
    if (!sub && r.tc) { P.by = P.by || {}; const g = tcGroup(r.tc); perfAdd(P.by[g] || (P.by[g] = perfNew()), r, true); }
    P.n++; P[r.r]++; const i = IDX[r.r];
    (r.c === 'w' ? P.cw : P.cb)[i]++;
    if (r.rt && r.or) { const diff = r.or - r.rt; (diff >= 50 ? P.hi : diff <= -50 ? P.lo : P.eq)[i]++; }   // opponent rated 50+ above you / 50+ below you / about level
    if (r.tc) { const T = P.tc[r.tc] || (P.tc[r.tc] = { n: 0, a: null, b: null }); T.n++; if (r.rt) { if (!T.a || r.t < T.a[0]) T.a = [r.t, r.rt]; if (!T.b || r.t > T.b[0]) T.b = [r.t, r.rt]; } }   // a = oldest rating seen, b = newest
    P.ops = P.ops || {}; P.opw = P.opw || {}; P.opb = P.opb || {}; P.how = P.how || { w: {}, l: {} };   // a career scan saved by an earlier version
    if (r.op) { (P.ops[r.op] || (P.ops[r.op] = [0, 0, 0]))[i]++; const side = r.c === 'w' ? P.opw : P.opb; (side[r.op] || (side[r.op] = [0, 0, 0]))[i]++; }
    if (r.r !== 'd' && r.hw) { const h = P.how[r.r]; h[r.hw] = (h[r.hw] || 0) + 1; }
    if (r.t && tcGroup(r.tc) !== 'daily') { P.hr = P.hr || [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]; P.hr[hourBand(r.t)][i]++; }
    P.fm.push([r.t, r.r]); if (P.fm.length > 24) { P.fm.sort((x, y) => y[0] - x[0]); P.fm.length = 10; }
    return P;
  }
  // What happens from one game to the next. Needs the games in order, so it takes a batch of them. Daily games are not played in sittings.
  function perfFlow(P, rows) {
    let prev = null, prev2 = null, depth = 0;
    for (const r of rows.slice().sort((a, b) => a.t - b.t)) {
      const g = tcGroup(r.tc); if (g === 'daily' || !r.t) continue;
      const same = !!prev && r.t - prev.t <= SITTING_GAP, i = IDX[r.r]; depth = same ? depth + 1 : 1;
      const add = k => { for (const T of [P, P.by && P.by[g]]) if (T) (T.fl || (T.fl = FLOW()))[k][i]++; };
      if (same && prev.r === 'l') add('al'); if (same && prev.r === 'w') add('aw'); if (same && prev.r === 'l' && prev2 && prev2.r === 'l') add('a2');
      add(depth <= SITTING_SHORT ? 's1' : 's2');
      prev2 = same ? prev : null; prev = r;
    }
    return P;
  }
  const perfRows = rows => { const P = perfNew(); for (const r of rows) perfAdd(P, r); perfFlow(P, rows); return perfDone(P); };
  function perfDone(P) { P.fm.sort((x, y) => y[0] - x[0]); P.fm.length = Math.min(10, P.fm.length); for (const k in P.by || {}) perfDone(P.by[k]); return P; }
  function perfMerge(A, B) {
    if (!A) return B; if (!B) return A;
    const P = perfNew(); for (const k of ['n', 'w', 'd', 'l']) P[k] = A[k] + B[k];
    for (const k of ['cw', 'cb', 'hi', 'eq', 'lo']) P[k] = A[k].map((x, i) => x + B[k][i]);
    for (const k of new Set([...Object.keys(A.tc), ...Object.keys(B.tc)])) { const x = A.tc[k], y = B.tc[k]; if (!x || !y) { P.tc[k] = JSON.parse(JSON.stringify(x || y)); continue; }
      P.tc[k] = { n: x.n + y.n, a: !x.a ? y.a : !y.a ? x.a : (x.a[0] <= y.a[0] ? x.a : y.a), b: !x.b ? y.b : !y.b ? x.b : (x.b[0] >= y.b[0] ? x.b : y.b) }; }
    for (const k of new Set([...Object.keys(A.by || {}), ...Object.keys(B.by || {})])) { const x = (A.by || {})[k], y = (B.by || {})[k]; P.by[k] = x && y ? perfMerge(x, y) : JSON.parse(JSON.stringify(x || y)); }
    for (const X of [A, B]) {
      for (const f of ['ops', 'opw', 'opb']) for (const k in X[f] || {}) { const o = P[f][k] || (P[f][k] = [0, 0, 0]); X[f][k].forEach((v, i) => { o[i] += v; }); }
      for (const side of ['w', 'l']) for (const k in (X.how || {})[side] || {}) P.how[side][k] = (P.how[side][k] || 0) + X.how[side][k];
    }
    for (const X of [A, B]) {
      for (const k in X.fl || {}) X.fl[k].forEach((v, i) => { P.fl[k][i] += v; });
      (X.hr || []).forEach((a, b) => a.forEach((v, i) => { P.hr[b][i] += v; }));
    }
    P.fm = [...A.fm, ...B.fm]; return perfDone(P);
  }
  const score = a => { const n = a[0] + a[1] + a[2]; return n ? (a[0] + a[1] / 2) / n : null; };

  // ── habits: what happens from game to game, as plain numbers ──
  // Tested on 9 players against the same games with shuffled results: at any threshold, gaps like these turned up as often in shuffled games as in real ones.
  // So they are shown as numbers, and only a gap of 3 standard errors or more is ever pointed at.
  const HAB_SD = 0.48, HAB_Z = 3, HAB_MIN = 15, BANDS = ['Mornings', 'Afternoons', 'Evenings', 'Nights'];
  function habits(P) {
    const F = P.fl; if (!F) return null;
    const n3 = a => a[0] + a[1] + a[2], pts = a => a[0] + a[1] / 2, base = F.s1.map((v, i) => v + F.s2[i]), rows = [];
    const row = (label, a) => { const n = n3(a), m = n3(base) - n; if (!n) return; const you = pts(a) / n, rest = m ? (pts(base) - pts(a)) / m : you; rows.push({ label, a, n, you, rest, z: n >= HAB_MIN && m >= HAB_MIN ? Math.abs(you - rest) / (HAB_SD * Math.sqrt(1 / n + 1 / m)) : 0 }); };
    row('After a loss', F.al); row('After two losses', F.a2); row('After a win', F.aw); row('Games 1 to 5', F.s1); row('Game 6 onwards', F.s2);
    (P.hr || []).forEach((a, i) => row(BANDS[i], a));
    return { rows, flag: rows.filter(r => r.z >= HAB_Z).sort((a, b) => b.z - a.z)[0] || null };
  }

  const PERIODS = { d7: 7, d30: 30, d90: 90, d180: 182, d365: 365 };
  // a range as a number of days; today, this week and this month count from local midnight, Monday and the 1st
  function daysOf(mode, now = Date.now()) {
    if (PERIODS[mode]) return PERIODS[mode];
    const d = new Date(now); let start;
    if (mode === 'd1') start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    else if (mode === 'wk') { start = new Date(d.getFullYear(), d.getMonth(), d.getDate()); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
    else if (mode === 'mo') start = new Date(d.getFullYear(), d.getMonth(), 1);
    else return 0;
    return Math.max(1 / 1440, (now - start.getTime()) / 86400e3);
  }
  return { PROTO, daysOf, tcGroup, LI_PERF, opFamily, HOW, perfNew, perfAdd, perfFlow, perfRows, perfDone, perfMerge, habits, score, resultOf, statusCode, monthKey, nowMonth, gameId, gamesOf, addRows, merge, setStatus, toCheck, summarize, recentCheaterGames, HOUR };
})();
if (typeof module !== 'undefined') module.exports = CRS_HIST;
