// ============================================================
// SKILLS: logic (no page code, so it can be tested on its own)
// Replays a game from its moves, turns engine evaluations into per-game tallies, and compares a sample of games with what is
// typical at the same rating (src/skillsBench.js). The tallies must stay identical to the script that built the benchmarks, or the comparison means nothing.
//   big mistake = gives away 15% or more of your winning chances (decided positions are skipped)
//   opening = first 15 moves, endgame = 6 or fewer pieces left (not counting kings and pawns), winning/losing = 2 pawns up/down after move 5
// ============================================================
const CRS_SK = (() => {
  const DEPTH = 10, MIN_GAMES = 30, RANK = { p: 0, n: 1, b: 1, r: 1, q: 1, k: 0 };
  const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
  const engines = cores => Math.max(1, Math.min(8, Math.floor((cores || 2) * 2 / 3)));      // leaves a third of the computer free
  const secondsPerGame = n => n >= 8 ? .3 : n >= 4 ? .4 : n >= 2 ? .7 : 1.1;      // measured at this depth
  const wp = cp => 50 + 50 * (2 / Math.PI) * Math.atan(0.00368208 * Math.max(-1000, Math.min(1000, cp)));

  // ── moves ──
  // Chess.com PGN -> moves and clock after each move
  function parsePgn(pgn) {
    const body = String(pgn || '').replace(/^\[[^\]]*\]\s*$/gm, ''), san = [], clk = [];
    const re = /\{([^}]*)\}|(\d+\.+)|((?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#]?)/g;
    for (let m; (m = re.exec(body));) {
      if (m[3]) { san.push(m[3]); clk.push(null); }
      else if (m[1] && clk.length) { const c = /%clk (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(m[1]); if (c) clk[clk.length - 1] = Math.round((+c[1] * 3600 + +c[2] * 60 + +c[3]) * 10) / 10; }
    }
    return { san, clk };
  }
  const FILES = 'abcdefgh', sq = s => (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97), name = i => FILES[i & 7] + ((i >> 4) + 1);
  const STEPS = { n: [33, 31, 18, 14, -33, -31, -18, -14], b: [17, 15, -17, -15], r: [16, 1, -16, -1], q: [17, 15, -17, -15, 16, 1, -16, -1], k: [17, 15, -17, -15, 16, 1, -16, -1] };
  const on = i => !(i & 0x88), whiteP = p => p === p.toUpperCase();
  function attacked(b, t, byWhite) {
    for (const [p, ds] of [['n', STEPS.n], ['k', STEPS.k]]) for (const d of ds) { const i = t + d; if (on(i) && b[i] === (byWhite ? p.toUpperCase() : p)) return true; }
    const pw = byWhite ? 'P' : 'p', from = byWhite ? [t - 15, t - 17] : [t + 15, t + 17];
    for (const i of from) if (on(i) && b[i] === pw) return true;
    for (const [ds, kinds] of [[STEPS.r, 'rq'], [STEPS.b, 'bq']]) for (const d of ds) for (let i = t + d; on(i); i += d) { const x = b[i]; if (!x) continue; if (whiteP(x) === byWhite && kinds.includes(x.toLowerCase())) return true; break; }
    return false;
  }
  const kingAt = (b, white) => b.indexOf(white ? 'K' : 'k');
  function legalAfter(b, from, to, white, epCap) { const c = b.slice(); c[to] = c[from]; c[from] = null; if (epCap != null) c[epCap] = null; return !attacked(c, kingAt(c, white), !white); }
  // pseudo-legal origin squares of a piece type reaching a target
  function origins(b, kind, to, white, ep) {
    const out = [], me = white ? kind.toUpperCase() : kind;
    if (kind === 'p') {
      const dir = white ? 16 : -16, tgt = b[to];
      if (tgt || to === ep) { for (const i of [to - dir - 1, to - dir + 1]) if (on(i) && b[i] === me) out.push(i); }
      else { const i = to - dir; if (on(i) && b[i] === me) out.push(i); else if (on(i) && !b[i]) { const j = i - dir; if (on(j) && b[j] === me && (j >> 4) === (white ? 1 : 6)) out.push(j); } }
      return out;
    }
    for (const d of STEPS[kind]) {
      if (kind === 'n' || kind === 'k') { const i = to - d; if (on(i) && b[i] === me) out.push(i); continue; }
      for (let i = to - d; on(i); i -= d) { const x = b[i]; if (!x) continue; if (x === me) out.push(i); break; }
    }
    return out;
  }
  function anyLegal(b, white, ep) {
    for (let from = 0; from < 128; from++) {
      const p = b[from]; if (!on(from) || !p || whiteP(p) !== white) continue;
      const kind = p.toLowerCase();
      if (kind === 'p') {
        const dir = white ? 16 : -16, tries = [from + dir, from + dir - 1, from + dir + 1];
        if (on(from + dir) && !b[from + dir] && legalAfter(b, from, from + dir, white)) return true;
        const two = from + 2 * dir; if ((from >> 4) === (white ? 1 : 6) && !b[from + dir] && on(two) && !b[two] && legalAfter(b, from, two, white)) return true;
        for (const t of tries.slice(1)) { if (!on(t)) continue; if (b[t] && whiteP(b[t]) !== white && legalAfter(b, from, t, white)) return true; if (t === ep && legalAfter(b, from, t, white, t - dir)) return true; }
        continue;
      }
      for (const d of STEPS[kind]) for (let t = from + d; on(t); t += d) { const x = b[t]; if (x && whiteP(x) === white) break; if (legalAfter(b, from, t, white)) return true; if (x || kind === 'n' || kind === 'k') break; }
    }
    return false;
  }
  function deadDrawn(b) {
    let minor = 0; for (let i = 0; i < 128; i++) { const p = on(i) && b[i]; if (!p) continue; const k = p.toLowerCase(); if (k === 'k') continue; if (k === 'b' || k === 'n') { if (++minor > 1) return false; } else return false; }
    return true;
  }
  function fenOf(b, white, cas, ep, half, full) {
    let s = '';
    for (let r = 7; r >= 0; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = b[r * 16 + f]; if (p) { if (e) { s += e; e = 0; } s += p; } else e++; } if (e) s += e; if (r) s += '/'; }
    return `${s} ${white ? 'w' : 'b'} ${cas || '-'} ${ep == null ? '-' : name(ep)} ${half} ${full}`;
  }
  // Every position after every move. fens[i] is null when the game is over there (evaluated by rule, not by the engine); value[i] is then its score for White.
  function replay(sans) {
    const b = new Array(128).fill(null), back = 'rnbqkbnr';
    for (let f = 0; f < 8; f++) { b[f] = back[f].toUpperCase(); b[16 + f] = 'P'; b[96 + f] = 'p'; b[112 + f] = back[f]; }
    let white = true, cas = 'KQkq', ep = null, half = 0, full = 1; const fens = [], pcs = [], value = [];
    const dropCas = t => { const m = { 0: 'Q', 7: 'K', 112: 'q', 119: 'k' }[t]; if (m) cas = cas.replace(m, ''); };
    for (let n = 0; n < sans.length; n++) {
      const s = sans[n].replace(/[+#!?]+$/, ''); let from, to, promo = null, epCap = null, capture = false, pawn = false;
      if (s === 'O-O' || s === 'O-O-O') {
        const rank = white ? 0 : 112, ks = s === 'O-O'; from = rank + 4; to = rank + (ks ? 6 : 2); b[rank + (ks ? 5 : 3)] = b[rank + (ks ? 7 : 0)]; b[rank + (ks ? 7 : 0)] = null;
      } else {
        const m = /^([KQRBN]?)([a-h]?)([1-8]?)x?([a-h][1-8])(?:=([QRBN]))?$/.exec(s); if (!m) throw new Error('Unreadable move ' + sans[n]);
        const kind = (m[1] || 'p').toLowerCase(); to = sq(m[4]); promo = m[5] || null; pawn = kind === 'p';
        let opts = origins(b, kind, to, white, ep);
        if (m[2]) opts = opts.filter(i => FILES[i & 7] === m[2]); if (m[3]) opts = opts.filter(i => (i >> 4) + 1 === +m[3]);
        if (pawn && to === ep && !b[to]) epCap = to + (white ? -16 : 16);
        if (opts.length > 1) opts = opts.filter(i => legalAfter(b, i, to, white, epCap));
        if (opts.length !== 1) throw new Error('Ambiguous move ' + sans[n]);
        from = opts[0]; capture = !!b[to] || epCap != null;
      }
      const piece = b[from], kindNow = piece.toLowerCase();
      if (kindNow === 'k') cas = cas.replace(white ? /[KQ]/g : /[kq]/g, ''); dropCas(from); dropCas(to);
      b[to] = promo ? (white ? promo : promo.toLowerCase()) : piece; b[from] = null; if (epCap != null) b[epCap] = null;
      let nextEp = null;
      if (pawn && Math.abs(to - from) === 32) { const mid = (to + from) / 2, enemy = white ? 'p' : 'P'; for (const i of [to - 1, to + 1]) if (on(i) && b[i] === enemy) nextEp = mid; }
      half = pawn || capture ? 0 : half + 1; if (!white) full++; white = !white; ep = nextEp;
      let count = 0; for (let i = 0; i < 128; i++) if (on(i) && b[i] && RANK[b[i].toLowerCase()]) count++;
      pcs.push(count);
      let over = null;
      if (/#$/.test(sans[n])) over = white ? -10000 : 10000;
      else if (deadDrawn(b)) over = 0;
      else if (n === sans.length - 1 && !anyLegal(b, white, ep)) over = attacked(b, kingAt(b, white), !white) ? (white ? -10000 : 10000) : 0;
      fens.push(over == null ? fenOf(b, white, cas, ep, half, full) : null); value.push(over);
    }
    return { fens, pcs, value };
  }

  // ── tallies for one side of one game, same rules as the benchmark script ──
  const baseOf = tc => { const m = /^(\d+)/.exec(String(tc || '')); return m ? +m[1] : 0; };
  function tallies(g, side) {
    const { ev, clk, pcs } = g, s = side === 'w' ? 1 : -1, B = g.base, res = side === 'w' ? g.wres : g.bres, ores = side === 'w' ? g.bres : g.wres;
    const R = { g: 1, moves: 0, big: 0, ol: 0, on: 0, el: 0, en: 0, chance: 0, took: 0, reach: 0, conv: 0, worse: 0, saved: 0, low: 0, lostT: 0, winT: 0, s20: 0, s20n: 0 };
    let up = false, down = false, low = false;
    for (let i = 0; i < ev.length; i++) {
      const mover = i % 2 === 0 ? 'w' : 'b', cl = clk[i], pov = s * ev[i];
      if (i >= 10 && pov >= 200) up = true;
      if (i >= 10 && pov <= -200) down = true;
      if (mover === side) {
        if (cl != null && cl < 15) low = true;
        if (cl != null && B && Math.floor(i / 2) === 19) { R.s20n++; R.s20 += cl / B; }
        const before = s * (i ? ev[i - 1] : 20), wb = wp(before), loss = Math.max(0, wb - wp(pov));
        if (wb >= 97 || wb <= 3) continue;
        R.moves++; if (loss >= 15) R.big++;
        if (i < 30) { R.ol += loss; R.on++; } else if (pcs[i] <= 6) { R.el += loss; R.en++; }
      } else if (i + 1 < ev.length) {
        const b = -s * (i ? ev[i - 1] : 20), a = -s * ev[i], wb = wp(b), ol = Math.max(0, wb - wp(a));
        if (!(wb >= 97 || wb <= 3) && ol >= 15) { R.chance++; if (Math.max(0, wp(s * ev[i]) - wp(s * ev[i + 1])) < 8) R.took++; }
      }
    }
    const win = res === 'win', lost = !win && !DRAWS.has(res);
    if (up) R.reach++; if (up && win) R.conv++; if (down) R.worse++; if (down && !lost) R.saved++; if (low) R.low++; if (res === 'timeout') R.lostT++; if (ores === 'timeout') R.winT++;
    return R;
  }
  const FIELDS = ['g', 'moves', 'big', 'ol', 'on', 'el', 'en', 'chance', 'took', 'reach', 'conv', 'worse', 'saved', 'low', 'lostT', 'winT', 's20', 's20n'];
  const pack = R => FIELDS.map(k => Math.round(R[k] * 1000) / 1000);
  const unpack = a => { const R = {}; FIELDS.forEach((k, i) => { R[k] = a[i]; }); return R; };

  // One saved row per game: what the numbers and sentences on the Skills tab need, and nothing else. The moves and evaluations are not kept.
  function gameRow(g) {
    const c = g.c, s = c === 'w' ? 1 : -1, { ev, clk, pcs } = g, res = c === 'w' ? g.wres : g.bres, r = res === 'win' ? 'w' : DRAWS.has(res) ? 'd' : 'l';
    let lowN = 0, lowB = 0, hiN = 0, hiB = 0, first = 0, bigs = 0, bigE = 0, bigUp = 0, reached = false, up = false, down = false, endEv = null, myI = -1, theirI = -1, theirFirst = 0;
    const timed = g.base > 0 && clk.some(v => v != null), inc = g.inc || 0, tB = [0, 0, 0], tN = [0, 0, 0];
    for (let i = 0; i < ev.length; i++) {
      const pov = s * ev[i];
      if (i >= 10 && pov >= 200) up = true;
      if (i >= 10 && pov <= -200) down = true;
      if (pcs[i] <= 6 && !reached) { reached = true; endEv = Math.round(Math.max(-600, Math.min(600, pov))); }
      if ((i % 2 === 0 ? 'w' : 'b') !== c) {
        // the opponent's first big mistake, by the same rule
        const ob = wp(-s * (i ? ev[i - 1] : 20));
        if (theirI < 0 && ob < 97 && ob > 3 && ob - wp(-pov) >= 15) { theirI = i; theirFirst = Math.floor(i / 2) + 1; }
        continue;
      }
      const before = s * (i ? ev[i - 1] : 20), wb = wp(before); if (wb >= 97 || wb <= 3) continue;
      const big = wb - wp(pov) >= 15;
      if (clk[i] != null) { if (clk[i] < 30) { lowN++; if (big) lowB++; } else { hiN++; if (big) hiB++; } }
      if (big) { bigs++; if (!first) { first = Math.floor(i / 2) + 1; myI = i; } if (i >= 30 && pcs[i] <= 6) bigE++; if (before >= 100) bigUp++; }
      // how long the move took: your clock before it, plus the increment, minus your clock after it
      const prev = i >= 2 ? clk[i - 2] : g.base;
      if (timed && clk[i] != null && prev != null) { const spent = prev + inc - clk[i], b = spent < 3 ? 0 : spent < 20 ? 1 : 2; tN[b]++; if (big) tB[b]++; }
    }
    const last = s * ev[ev.length - 1] >= 100, who = myI < 0 && theirI < 0 ? 0 : theirI < 0 || (myI >= 0 && myI < theirI) ? 1 : -1;
    return { id: g.id, t: g.t, tc: g.tc, c, r, rt: g.rt, u: g.u, op: g.op || '', me: pack(tallies(g, c)), th: pack(tallies(g, c === 'w' ? 'b' : 'w')),
      x: [lowN, lowB, hiN, hiB, first, bigs, bigE, bigUp, reached ? 1 : 0, res === 'timeout' && last ? 1 : 0, up ? 1 : 0, down ? 1 : 0, res === 'timeout' ? 1 : 0, ev.length > 29 ? Math.round(s * Math.max(-600, Math.min(600, ev[29]))) : null,
        ev.length, ...(timed ? tB : [null, null, null]), endEv, who, theirFirst, ...(timed ? tN : [null, null, null])] };
  }
  // x[15..17] big mistakes by think time (under 3 s, 3–20 s, 20 s+), x[18] your evaluation as the endgame starts, x[19] who made the first big mistake (1 you, -1 them, 0 neither), x[20] their first big mistake's move, x[21..23] moves by think time
  const XLEN = 24;      // rows saved with fewer numbers than this are analysed again on the next Search

  // ── the comparison ──
  const MET = {
    opening: [R => R.ol / Math.max(1, R.on), false], tactics: [R => 100 * R.big / Math.max(1, R.moves), false], punish: [R => 100 * R.took / Math.max(1, R.chance), true],
    convert: [R => 100 * R.conv / Math.max(1, R.reach), true], save: [R => 100 * R.saved / Math.max(1, R.worse), true], endgame: [R => R.el / Math.max(1, R.en), false],
    timeloss: [R => 100 * R.lostT / Math.max(1, R.g), false], low: [R => 100 * R.low / Math.max(1, R.g), false], clock20: [R => 100 * R.s20 / Math.max(1, R.s20n), true],
  };
  const addUp = (rows, key) => { const T = {}; for (const k of FIELDS) T[k] = 0; for (const r of rows) r[key].forEach((v, i) => { T[FIELDS[i]] += v; }); return T; };
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const verdict = rel => rel <= 90 ? 'behind' : rel >= 110 ? 'ahead' : 'level';
  // bench = one site's benchmarks by time control. Each game is compared with its own time control at your rating in that time control; a mix is weighted by games.
  function report(rows, bench) {
    rows = rows.slice().sort((a, b) => b.t - a.t).filter(r => bench[r.tc]);
    const groups = {}; for (const r of rows) (groups[r.tc] || (groups[r.tc] = { tc: r.tc, n: 0, rt: r.rt })).n++;
    const me = addUp(rows, 'me'), rating = rows[0].rt, list = Object.values(groups).sort((a, b) => b.n - a.n);
    const atOf = g => Math.max(bench[g.tc].lo, Math.min(bench[g.tc].hi, g.rt));
    const num = k => {
      const [f, hi] = MET[k], gs = list.filter(g => bench[g.tc].m[k]), use = rows.filter(r => bench[r.tc].m[k]); if (!use.length) return null;
      const y = f(addUp(use, 'me')), t = gs.reduce((s, g) => s + g.n * (bench[g.tc].m[k][0] + bench[g.tc].m[k][1] * atOf(g)), 0) / gs.reduce((s, g) => s + g.n, 0), rel = hi ? (t ? y / t : 1) : (y ? t / y : 2);
      return { k, you: y, typ: t, opp: f(addUp(use, 'th')), rel: Math.round(Math.min(2, Math.max(0, rel)) * 100) };
    };
    const M = {}; for (const k in MET) M[k] = num(k);
    const X = i => rows.reduce((s, r) => s + r.x[i], 0);
    const firsts = rows.map(r => r.x[4]).filter(Boolean), byCol = c => median(rows.filter(r => r.c === c && r.x[13] != null).map(r => r.x[13] / 100));
    const ops = {}; for (const r of rows) { if (!r.op) continue; const k = r.op + '|' + r.c, o = ops[k] || (ops[k] = { name: r.op, c: r.c, n: 0, w: 0, d: 0, l: 0, e: [] }); o.n++; o[r.r]++; if (r.x[13] != null) o.e.push(r.x[13] / 100); }
    const lines = Object.values(ops).filter(o => o.n >= 5 && o.e.length).map(o => ({ ...o, ev: median(o.e), e: undefined })).sort((a, b) => a.ev - b.ev);
    const pick = f => rows.filter(f).map(r => ({ g: r.id, u: r.u, r: r.r, time: !!r.x[12] }));
    const lost = rows.filter(r => r.r === 'l' && r.x[14] != null), thought = rows.filter(r => r.x.length >= XLEN && r.x[15] != null), T = i => thought.reduce((s, r) => s + r.x[i], 0);
    const full = rows.filter(r => r.x.length >= XLEN), pts = a => a.reduce((s, r) => s + (r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0), 0);
    const grp = f => { const a = full.filter(f); return { n: a.length, w: a.filter(r => r.r === 'w').length, d: a.filter(r => r.r === 'd').length, l: a.filter(r => r.r === 'l').length, s: a.length ? pts(a) / a.length : null }; };
    return {
      n: rows.length, rating, groups: list, atEdge: list.some(g => g.rt !== atOf(g)), me, M,
      low: { n: X(0), b: X(1) }, high: { n: X(2), b: X(3) }, firstBig: median(firsts), bigs: X(5), bigE: X(6), bigUp: X(7), endN: X(8), endScore: rows.reduce((s, r) => s + (r.x[8] ? (r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0) : 0), 0),
      aheadT: pick(r => r.x[9]), blown: pick(r => r.x[10] && r.r !== 'w'), saved: pick(r => r.x[11] && r.r !== 'l'), evW: byCol('w'), evB: byCol('b'), lines,
      short: { n: lost.length, s: lost.filter(r => r.x[14] <= 48).length }, think: { g: thought.length, fast: T(15), mid: T(16), slow: T(17), n: [T(21), T(22), T(23)] },
      // who cracked first, and how each side did with an extra pawn or more as the endgame started
      crack: { me: grp(r => r.x[19] === 1), them: grp(r => r.x[19] === -1), none: grp(r => r.x[19] === 0), myMove: median(full.filter(r => r.x[19] === 1).map(r => r.x[4])), theirMove: median(full.filter(r => r.x[19] === -1).map(r => r.x[20])) },
      endB: { up: grp(r => r.x[18] != null && r.x[18] >= 100), even: grp(r => r.x[18] != null && Math.abs(r.x[18]) < 100), down: grp(r => r.x[18] != null && r.x[18] <= -100), slipped: pick(r => r.x.length >= XLEN && r.x[18] >= 100 && r.r !== 'w') },
    };
  }

  // ── games as each site sends them ──
  const TCS = ['rapid', 'blitz', 'bullet', 'daily'], LI_GROUP = { ultraBullet: 'bullet', bullet: 'bullet', blitz: 'blitz', rapid: 'rapid', classical: 'rapid', correspondence: 'daily' };
  function fromChessCom(user, g) {
    if (!g || g.rated !== true || g.rules !== 'chess' || !TCS.includes(g.time_class) || !g.pgn || !g.white || !g.black) return null;
    const me = String(user).toLowerCase(), c = String(g.white.username || '').toLowerCase() === me ? 'w' : String(g.black.username || '').toLowerCase() === me ? 'b' : null; if (!c) return null;
    const daily = g.time_class === 'daily', P = parsePgn(g.pgn), san = P.san, clk = daily ? san.map(() => null) : P.clk; if (san.length < 10) return null;      // a daily clock counts days, so its clock numbers mean nothing here
    const mine = c === 'w' ? g.white : g.black, them = c === 'w' ? g.black : g.white, id = (/chess\.com\/game\/((?:live|daily)\/\d+)/.exec(g.url || '') || [])[1]; if (!id) return null;
    return { id, tc: g.time_class, t: g.end_time || 0, c, rt: mine.rating || 0, u: them.username || '', op: typeof CRS_HIST !== 'undefined' ? CRS_HIST.opFamily(g.eco) : '', wres: g.white.result, bres: g.black.result, base: daily ? 0 : baseOf(g.time_control), inc: daily ? 0 : +(/\+(\d+)/.exec(String(g.time_control || '')) || [0, 0])[1], san, clk };
  }
  function fromLichess(user, g) {
    const tc = LI_GROUP[g && g.speed]; if (!g || !g.rated || !tc || (g.variant && g.variant !== 'standard') || typeof g.moves !== 'string') return null;
    const w = g.players && g.players.white, b = g.players && g.players.black; if (!w || !b || !w.user || !b.user) return null;
    const me = String(user).toLowerCase(), c = w.user.id === me ? 'w' : b.user.id === me ? 'b' : null; if (!c) return null;
    if (['aborted', 'noStart', 'unknownFinish', 'cheat', 'variantEnd'].includes(g.status)) return null;
    const san = g.moves.split(' ').filter(Boolean); if (san.length < 10) return null;
    const clk = san.map((_, i) => (tc !== 'daily' && g.clocks && g.clocks[i] != null ? Math.round(g.clocks[i]) / 100 : null));
    const lose = g.status === 'outoftime' ? 'timeout' : 'resigned', res = side => !g.winner ? 'agreed' : g.winner === side ? 'win' : lose;
    return { id: g.id, tc, t: Math.floor((g.createdAt || 0) / 1000), c, rt: (c === 'w' ? w : b).rating || 0, u: (c === 'w' ? b : w).user.name || '', op: typeof CRS_HIST !== 'undefined' ? CRS_HIST.opFamily(g.opening && g.opening.name) : '', wres: res('white'), bres: res('black'), base: tc === 'daily' ? 0 : (g.clock && g.clock.initial) || 0, inc: tc === 'daily' ? 0 : (g.clock && g.clock.increment) || 0, san, clk };
  }

  return { DEPTH, MIN_GAMES, XLEN, engines, secondsPerGame, parsePgn, replay, baseOf, tallies, gameRow, report, verdict, fromChessCom, fromLichess, unpack, MET, wp };
})();
if (typeof module !== 'undefined') module.exports = CRS_SK;
