// ============================================================
// MY STATS v2: board checks behind the new Skills and Insights numbers (no page code, so it can be tested on its own)
// Runs where the engine runs (skills-host.html / the Firefox background page) on each analysed game, and in the popup to add the games up.
// Input per game: the moves (g.all = every position as FEN), White-view evaluations (g.ev) and the engine's best reply in each position (g.bm).
// Measures: warning signs of a tactic, how missed moves hide, textbook rook endings, pawn structures, trading when ahead,
//   opening rules, named mates and time on critical moves.
// Every comparison is with something real: your opponents in the same games, or your own other games. Nothing here is a guess.
// ============================================================
const CRS_SX = (() => {
  const SK = CRS_SK, { attacked, kingAt, on, sq, STEPS, whiteP } = SK._b, wp = SK.wp;
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 50 }, START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const THEMES = ['fork', 'pin', 'skewer', 'discovered', 'promotion', 'quiet', 'defensive', 'exposed', 'sacrifice', 'advanced', 'rookEnd', 'kingside', 'bishopEnd', 'clearance', 'deflection', 'hanging', 'castling'];
  const SIGNS = ['king', 'loose', 'line', 'knight', 'trapped', 'overload', 'far'];       // exposed king, loose piece, pieces on one line, knight-fork distance, trapped piece, overloaded defender, defenders too far
  const HIDE = ['quiet', 'back', 'long', 'side', 'between'];                             // quiet, backward, long-range, sideways, in-between move
  const POS = ['Isolated pawn', 'Gave up the long diagonal', 'Permanent hole', 'Backward pawn', 'Trapped piece', 'Weak colour complex', 'King stuck in the centre', "Hole in the king's pawn shield", 'Gave the opponent an open file', 'Gave up castling', 'Allowed connected passers', 'Allowed a protected passer'];
  const MATES = ['Back rank', 'Queen next to king', 'Ladder', 'Corridor', 'Smothered', 'Epaulette', 'Arabian', 'Anastasia', 'Hook', "Boden's", 'Two minor pieces', 'Pawn-supported', 'Other'];
  const file = s => s & 7, rank = s => s >> 4, cheb = (a, b) => Math.max(Math.abs(file(a) - file(b)), Math.abs(rank(a) - rank(b)));
  const kindOf = p => p && p.toLowerCase(), mine = (p, w) => !!p && whiteP(p) === w;

  function parse(fen) {
    const b = new Array(128).fill(null), [rows, turn] = String(fen).split(' '); let r = 7, f = 0;
    for (const ch of rows) { if (ch === '/') { r--; f = 0; } else if (/\d/.test(ch)) f += +ch; else { b[r * 16 + f] = ch; f++; } }
    return { b, white: turn === 'w', cas: String(fen).split(' ')[2] || '-' };
  }
  const place = b => b.map(x => x || '.').join('');
  // squares a piece on s attacks (pawns: captures only)
  function attacksFrom(b, s) {
    const p = b[s]; if (!p) return []; const k = kindOf(p), w = whiteP(p), out = [];
    if (k === 'p') { for (const d of (w ? [15, 17] : [-15, -17])) if (on(s + d)) out.push(s + d); return out; }
    for (const d of STEPS[k]) { if (k === 'n' || k === 'k') { if (on(s + d)) out.push(s + d); continue; } for (let t = s + d; on(t); t += d) { out.push(t); if (b[t]) break; } }
    return out;
  }
  const attackersOf = (b, t, byWhite) => { const out = []; for (let s = 0; s < 128; s++) if (on(s) && mine(b[s], byWhite) && attacksFrom(b, s).includes(t)) out.push(s); return out; };
  // play a move given as UCI (e2e4, e7e8q) on a copy of the board
  function apply(b, uci) {
    const from = sq(uci.slice(0, 2)), to = sq(uci.slice(2, 4)), c = b.slice(), p = c[from]; if (!p) return null;
    const k = kindOf(p), w = whiteP(p); let cap = c[to];
    if (k === 'k' && Math.abs(file(to) - file(from)) === 2) { const rk = rank(from) * 16, ks = file(to) === 6; c[rk + (ks ? 5 : 3)] = c[rk + (ks ? 7 : 0)]; c[rk + (ks ? 7 : 0)] = null; }
    if (k === 'p' && file(to) !== file(from) && !c[to]) { const e = to + (w ? -16 : 16); cap = c[e]; c[e] = null; }
    c[to] = uci[4] ? (w ? uci[4].toUpperCase() : uci[4]) : p; c[from] = null;
    return { c, from, to, p, k, w, cap };
  }
  // what kind of move the engine's best move is
  function classify(b, uci) {
    const m = apply(b, uci); if (!m) return null; const { c, from, to, k, w } = m;
    const check = attacked(c, kingAt(c, !w), w), capture = !!m.cap, promo = !!uci[4];
    const defended = t => attacked(c, t, !w);
    let fork = false, pin = false, skewer = false, disc = false;
    const hits = attacksFrom(c, to).filter(t => mine(c[t], !w) && kindOf(c[t]) !== 'p' && (kindOf(c[t]) === 'k' || VAL[kindOf(c[t])] > VAL[k] || !defended(t)));
    if (hits.length >= 2) fork = true;
    if ('brq'.includes(k)) for (const d of STEPS[k]) {
      let x = null; for (let t = to + d; on(t); t += d) { if (!c[t]) continue; if (!x) { if (!mine(c[t], !w)) break; x = t; continue; } if (mine(c[t], !w)) { const X = kindOf(c[x]), Y = kindOf(c[t]); if (VAL[Y] > VAL[X] && 'kqr'.includes(Y)) pin = true; else if (VAL[X] > VAL[Y] && 'kq'.includes(X)) skewer = true; } break; }
    }
    for (let s = 0; s < 128 && !disc; s++) {
      if (s === to || !on(s) || !mine(c[s], w) || !'brq'.includes(kindOf(c[s]))) continue;
      for (const d of STEPS[kindOf(c[s])]) { let through = false; for (let t = s + d; on(t); t += d) { if (t === from) through = true; if (!c[t]) continue; if (through && mine(c[t], !w) && (VAL[kindOf(c[t])] >= 5)) disc = true; break; } if (disc) break; }
    }
    const type = promo ? 'promotion' : fork ? 'fork' : disc ? 'discovered' : pin ? 'pin' : skewer ? 'skewer' : null;
    // castling, a pawn reaching your 6th or 7th rank, taking a piece nobody guarded, giving material that can be taken at once
    const castle = k === 'k' && Math.abs(file(to) - file(from)) === 2, rel = r => w ? r : 7 - r, adv = k === 'p' && !promo && rel(rank(to)) >= 5;
    const hang = !!m.cap && !'pk'.includes(kindOf(m.cap)) && !attacked(b, to, !w);
    let sac = false; if (k !== 'k' && !promo) { const gain = m.cap ? VAL[kindOf(m.cap)] : 0, att = attackersOf(c, to, !w).map(t => VAL[kindOf(c[t])]); if (att.length && VAL[k] - gain >= 2) sac = !attacked(c, to, w) || VAL[k] - gain - Math.min(...att) >= 2; }
    // clearance: the moved piece goes with check or a capture, and one of your line pieces that stood behind it now reaches their king's squares or a loose piece
    let clear = false; if ((check || capture) && !disc) for (let s0 = 0; s0 < 128 && !clear; s0++) { if (s0 === to || !on(s0) || !mine(c[s0], w) || !'brq'.includes(kindOf(c[s0]))) continue;
      const K = kingAt(c, !w); for (const d of STEPS[kindOf(c[s0])]) { let through = false; for (let t = s0 + d; on(t); t += d) { if (t === from) through = true; if (through && t !== from && ((K >= 0 && cheb(t, K) <= 1) || (mine(c[t], !w) && kindOf(c[t]) !== 'p' && !attacked(c, t, !w)))) { clear = true; break; } if (c[t]) break; } if (clear) break; } }
    // deflection: a check or capture whose only defender is also the only guard of another of their pieces you attack
    let defl = false; if (check || capture) { const D = attackersOf(c, to, !w); if (D.length === 1) for (let x = 0; x < 128 && !defl; x++) if (on(x) && x !== to && x !== D[0] && mine(c[x], !w) && VAL[kindOf(c[x])] >= 3 && kindOf(c[x]) !== 'k' && attacked(c, x, w)) { const g = attackersOf(c, x, !w); if (g.length === 1 && g[0] === D[0]) defl = true; } }
    const back = w ? rank(to) < rank(from) : rank(to) > rank(from);
    const Kq = kingAt(c, !w), threat = !check && !capture && !promo && (hits.length >= 1 || disc || (Kq >= 0 && k !== 'k' && cheb(to, Kq) <= 1));
    return { type, fork, pin, skewer, disc, threat, castle, adv, hang, sac, clear, defl, check, capture, promo, forcing: check || capture || promo, quiet: !check && !capture && !promo, back, long: cheb(from, to) >= 4, side: 'rq'.includes(k) && rank(to) === rank(from), to, from, c };
  }
  // only kings, rooks and pawns (or bishops) left on the board
  const endTags = b => { const has = k => { for (let s0 = 0; s0 < 128; s0++) if (on(s0) && kindOf(b[s0]) === k) return true; return false; }, both = k => { let W = false, Bk = false; for (let s0 = 0; s0 < 128; s0++) if (on(s0) && kindOf(b[s0]) === k) { if (whiteP(b[s0])) W = true; else Bk = true; } return W && Bk; };
    return !has('q') && !has('n') && !has('b') && both('r') ? ['rookEnd'] : !has('q') && !has('n') && !has('r') && both('b') ? ['bishopEnd'] : []; };
  const heavy = (b, w) => { let v = 0; for (let s0 = 0; s0 < 128; s0++) if (on(s0) && mine(b[s0], w) && !'pk'.includes(kindOf(b[s0]))) v += VAL[kindOf(b[s0])]; return v; };
  const CORE = new Set(['fork', 'pin', 'skewer', 'discovered', 'promotion', 'quiet', 'sacrifice', 'advanced', 'clearance', 'deflection', 'hanging', 'castling']);
  function tagsOf(b, cl, w) {
    const t = []; if (cl.fork) t.push('fork'); if (cl.pin) t.push('pin'); if (cl.skewer) t.push('skewer'); if (cl.disc) t.push('discovered'); if (cl.promo) t.push('promotion');
    if (cl.threat) t.push('quiet'); if (cl.sac) t.push('sacrifice'); if (cl.adv) t.push('advanced'); if (cl.clear) t.push('clearance'); if (cl.defl) t.push('deflection'); if (cl.hang) t.push('hanging'); if (cl.castle) t.push('castling');
    const K = kingAt(b, !w); if (K >= 0 && heavy(b, w) >= 8) { const up = w ? -16 : 16, near = cl.check || cheb(cl.to, K) <= 2;      // their pawns stand in front of their king, toward you
      let cover = 0; for (const r of [1, 2]) for (const df of [-1, 0, 1]) { const x = K + r * up + df; if (on(x) && x >= 0 && b[x] && kindOf(b[x]) === 'p' && mine(b[x], !w)) cover++; }
      if (cover <= 1 && near) t.push('exposed');
      const back = w ? 7 : 0; if (file(K) >= 6 && Math.abs(rank(K) - back) <= 1 && near) t.push('kingside'); }
    return t.concat(endTags(b));
  }
  // a real threat to you: you are in check, a rook or queen of yours is en prise, or two of your pieces are at once
  // (en prise = attacked and not guarded, or attacked by something cheaper)
  function threatened(b, w) { const K = kingAt(b, w); if (K >= 0 && attacked(b, K, !w)) return true; let n = 0;
    for (let s0 = 0; s0 < 128; s0++) { if (!on(s0) || !mine(b[s0], w) || 'pk'.includes(kindOf(b[s0]))) continue; const a = attackersOf(b, s0, !w); if (!a.length) continue;
      if (!attacked(b, s0, w) || Math.min(...a.map(x => VAL[kindOf(b[x])])) < VAL[kindOf(b[s0])]) { if (VAL[kindOf(b[s0])] >= 5) return true; n++; } }
    return n >= 2; }
  // the seven warning signs, read on the board before the move, for the side to move (w) looking at the other side's pieces
  function signs(b, w) {
    const e = !w, K = kingAt(b, e), out = {}; if (K < 0) return out;
    const dir = e ? 16 : -16, kf = file(K); let shield = 0;
    for (let df = -1; df <= 1; df++) for (const st of [1, 2]) { const s = K + dir * st + df; if (on(s) && b[s] === (e ? 'P' : 'p')) { shield++; break; } }
    const homeRank = e ? 0 : 7; out.king = shield < 2 || Math.abs(rank(K) - homeRank) > 1;
    const big = [], pieces = [];
    for (let s = 0; s < 128; s++) { if (!on(s) || !mine(b[s], e)) continue; const k = kindOf(b[s]); if ('kqr'.includes(k)) big.push(s); if ('nbrq'.includes(k)) pieces.push(s); }
    out.loose = pieces.some(s => !attacked(b, s, e));
    // pieces on one line: their king or queen with another of their pieces in front of it, and one of your long-range pieces can already reach that line beyond the front piece
    out.line = false; const myReach = {};
    for (let s = 0; s < 128; s++) if (on(s) && mine(b[s], w) && 'brq'.includes(kindOf(b[s]))) for (const t of attacksFrom(b, s)) (myReach[t] || (myReach[t] = [])).push(kindOf(b[s]));
    for (let s = 0; s < 128 && !out.line; s++) { if (!on(s) || !mine(b[s], e) || !'kq'.includes(kindOf(b[s]))) continue;
      for (const d of STEPS.q) { const diag = Math.abs(d) === 15 || Math.abs(d) === 17; let x = null;
        for (let t = s + d; on(t); t += d) { if (!x) { if (!b[t]) continue; if (!mine(b[t], e) || kindOf(b[t]) === 'p') break; x = t; continue; }
          if (b[t] && !mine(b[t], w)) break; if ((myReach[t] || []).some(k => k === 'q' || (diag ? k === 'b' : k === 'r'))) { out.line = true; break; } if (b[t]) break; }
        if (out.line) break; } }
    // knight-fork distance: a square one of your knights can jump to that hits two of their king, queen and rooks
    out.knight = false; const myN = []; for (let s = 0; s < 128; s++) if (on(s) && b[s] === (w ? 'N' : 'n')) myN.push(s);
    for (const n0 of myN) { for (const d0 of STEPS.n) { const s = n0 + d0; if (!on(s) || mine(b[s], w)) continue; let n = 0; for (const d of STEPS.n) if (big.includes(s + d)) n++; if (n >= 2) { out.knight = true; break; } } if (out.knight) break; }
    out.trapped = pieces.some(s => attacked(b, s, w) && attacksFrom(b, s).filter(t => !mine(b[t], e)).every(t => attacked(b, t, w)));
    const soleFor = {}; for (const s of pieces) { if (!attacked(b, s, w)) continue; const d = attackersOf(b, s, e); if (d.length === 1) soleFor[d[0]] = (soleFor[d[0]] || 0) + 1; }
    out.overload = Object.values(soleFor).some(n => n >= 2);
    out.far = !pieces.some(s => cheb(s, K) <= 2);
    return out;
  }
  const developed = (b, w) => { const home = w ? [[1, 'N'], [6, 'N'], [2, 'B'], [5, 'B']] : [[113, 'n'], [118, 'n'], [114, 'b'], [117, 'b']]; return home.filter(([s, p]) => b[s] !== p).length; };
  const phaseOf = (i, pcs) => i < 30 ? 'opening' : pcs[i] <= 6 ? 'endgame' : 'middle';
  const kindsOf = (b, w) => { const ks = []; for (let s = 0; s < 128; s++) if (on(s) && mine(b[s], w) && 'nbrq'.includes(kindOf(b[s]))) ks.push(kindOf(b[s]).toUpperCase()); return ks.sort((a, b) => 'QRBN'.indexOf(a) - 'QRBN'.indexOf(b)).join('') || 'P'; };
  function egCategory(a, b) { const set = new Set((a + b).replace(/P/g, '').split('').filter(Boolean)); const k = [...set].sort().join(''); return !k ? 'Pawn' : k === 'R' ? 'Rook' : k === 'Q' ? 'Queen' : k === 'QR' ? 'Queen and rook' : k === 'B' ? 'Bishop' : k === 'N' ? 'Knight' : 'Mixed pieces'; }
  const pawnsOf = (b, w) => { const P = []; for (let s = 0; s < 128; s++) if (on(s) && b[s] === (w ? 'P' : 'p')) P.push(s); return P; };
  // pawn structure on a board: name, owner colour (true = White). Owner = the side the structure is named for.
  function structure(b) {
    const P = { true: pawnsOf(b, true), false: pawnsOf(b, false) };
    const has = (w, f, rr) => P[w].some(s => file(s) === f && (rr == null || (w ? rank(s) : 7 - rank(s)) === rr));
    const none = (w, f) => !has(w, f);
    // closed centres first: they are the most specific
    if (has(true, 3, 3) && has(true, 4, 4) && has(false, 3, 3) && has(false, 4, 2)) return { k: 'French Advance chain', owner: true };
    if (has(true, 3, 4) && has(true, 4, 3) && has(false, 3, 2) && has(false, 4, 3)) return { k: "King's Indian centre", owner: false };
    if (has(true, 3, 4) && none(true, 4) && has(false, 2, 3) && has(false, 3, 2) && none(false, 4)) return { k: 'Benoni', owner: false };
    for (const X of [true, false]) if (has(X, 2, 2) && has(X, 3, 3) && has(X, 4, 2) && has(X, 5, 3)) return { k: 'Stonewall', owner: X };
    for (const X of [true, false]) { const Y = !X; if ((has(X, 2, 2) || has(X, 2, 1)) && has(X, 3, 3) && none(X, 4) && has(Y, 3, 3) && has(Y, 4) && none(Y, 2)) return { k: 'Carlsbad', owner: X }; }
    if (has(false, 0, 2) && has(false, 1, 2) && has(false, 3, 2) && has(false, 4, 2) && none(false, 2) && has(true, 2, 3) && has(true, 4, 3)) return { k: 'Hedgehog', owner: false };
    if (has(true, 2, 3) && has(true, 4, 3) && none(true, 3) && none(false, 2) && has(false, 3)) return { k: 'Maroczy bind', owner: true };
    if (none(true, 3) && has(true, 4) && none(false, 2) && has(false, 3) && has(false, 4)) return { k: 'Open Sicilian', owner: false };
    if (has(false, 2, 2) && has(false, 3, 3) && has(false, 4, 2) && has(true, 3, 3) && (has(true, 2, 3) || has(true, 4, 2))) return { k: 'Slav formation', owner: false };
    for (const X of [true, false]) if (has(X, 2, 3) && has(X, 3, 3) && none(X, 1) && none(X, 4)) return { k: 'Hanging pawns', owner: X };
    for (const X of [true, false]) if (has(X, 3) && none(X, 2) && none(X, 4)) return { k: "Isolated queen's pawn", owner: X };
    // broader centres (2026-11-08); owner true on the symmetric ones means "split by your colour"
    if (has(true, 3) && none(true, 4) && has(false, 4) && none(false, 3) && has(false, 2)) return { k: 'Caro-Kann and Scandinavian centre', owner: false };
    if (has(true, 4) && none(true, 3) && has(false, 3) && none(false, 4) && has(false, 2)) return { k: 'Scotch and Philidor centre', owner: true };
    if (has(true, 3, 3) && has(true, 4, 2) && has(false, 3, 3) && has(false, 4, 2)) return { k: "Queen's pawn centre", owner: true };
    if (has(true, 4, 3) && has(false, 4, 3) && has(true, 3) && has(false, 3)) return { k: 'e4 v e5 centre', owner: true };
    if (has(true, 3) && has(false, 3) && none(true, 4) && none(false, 4)) return { k: 'Open e-file', owner: true };
    if (none(true, 3) && none(true, 4) && none(false, 3) && none(false, 4)) return { k: 'Open centre', owner: true };
    return null;
  }
  // the structure the game spent longest in between moves 12 and 40 (ties: the earlier one), and where it first appeared
  function structureOf(Bi, n) { const cnt = {}, first = {};
    for (let i = 23; i < Math.min(n, 80); i += 2) { const k = structure(Bi(i)); if (!k) continue; cnt[k.k] = (cnt[k.k] || 0) + 1; if (!first[k.k]) first[k.k] = { ...k, at: i }; }
    const ks = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || first[a].at - first[b].at); return ks.length ? first[ks[0]] : null; }
  // weaknesses on one side (w) of a board, for the positional themes
  function weak(b, w, cas) {
    const e = !w, mineP = pawnsOf(b, w), theirP = pawnsOf(b, e), rel = (s, side) => side ? rank(s) : 7 - rank(s), color = s => (file(s) + rank(s)) % 2;
    const iso = mineP.filter(s => !mineP.some(t => Math.abs(file(t) - file(s)) === 1)).length;
    const back = mineP.filter(s => { const st = s + (w ? 16 : -16); return on(st) && !mineP.some(t => Math.abs(file(t) - file(s)) === 1 && rel(t, w) <= rel(s, w)) && theirP.some(t => attacksFrom(b, t).includes(st)); }).length;
    let holes = 0; for (let r = 2; r <= 3; r++) for (let f = 2; f <= 5; f++) { const s = (w ? r : 7 - r) * 16 + f; if (!mineP.some(t => Math.abs(file(t) - f) === 1 && rel(t, w) < r)) holes++; }
    const trapped = !!signs(b, e).trapped;
    const myB = [], theirB = []; for (let s = 0; s < 128; s++) if (on(s) && b[s] && kindOf(b[s]) === 'b') (mine(b[s], w) ? myB : theirB).push(color(s));
    const weakC = [0, 1].some(c => !myB.includes(c) && theirB.includes(c) && mineP.filter(s => color(s) !== c).length >= 4);
    const K = kingAt(b, w), rights = w ? /[KQ]/.test(cas) : /[kq]/.test(cas), kf = file(K), kr = K >= 0 ? rel(K, w) : 0;
    const kingCentre = K >= 0 && (kf === 3 || kf === 4) && kr === 0 && !rights && (!mineP.some(t => file(t) === 3) || !mineP.some(t => file(t) === 4));
    let shield = null; if (K >= 0 && kr <= 1 && (kf <= 2 || kf >= 5)) { shield = 0; for (let df = -1; df <= 1; df++) for (const st of [1, 2]) { const t = K + (w ? 16 : -16) * st + df; if (on(t) && b[t] === (w ? 'P' : 'p')) { shield++; break; } } }
    let diag = false; for (let s = 0; s < 128 && !diag; s++) { if (!on(s) || !mine(b[s], e) || !'bq'.includes(kindOf(b[s]))) continue; if (file(s) === rank(s) || file(s) + rank(s) === 7) { const d = file(s) === rank(s) ? 17 : 15; let free = 0; for (const dd of [d, -d]) for (let t = s + dd; on(t) && !b[t]; t += dd) free++; if (free >= 4) diag = true; } }
    let open = 0; for (let s = 0; s < 128; s++) if (on(s) && mine(b[s], e) && kindOf(b[s]) === 'r' && !theirP.some(t => file(t) === file(s))) open++;
    const passed = theirP.filter(s => !mineP.some(t => Math.abs(file(t) - file(s)) <= 1 && rel(t, e) > rel(s, e)));
    const conn = passed.some(s => passed.some(t => Math.abs(file(t) - file(s)) === 1)), prot = passed.some(s => theirP.some(t => attacksFrom(b, t).includes(s)));
    return { iso, back, holes, trapped, weakC, kingCentre, shield, diag, open, rights, conn, prot };
  }
  // which themes a mistake by side w produced: compare its weaknesses before the move and after the reply
  function themes(a, z, w, castled) {
    return [z.iso > a.iso, z.diag && !a.diag, z.holes > a.holes, z.back > a.back, z.trapped && !a.trapped, z.weakC && !a.weakC, z.kingCentre && !a.kingCentre,
      a.shield != null && z.shield != null && z.shield < a.shield, z.open > a.open, a.rights && !z.rights && !castled, z.conn && !a.conn, z.prot && !a.prot];
  }
  // how the game was mated, from the final position (true = White gave mate)
  function matePattern(F, prev, materW) {
    const K = kingAt(F, !materW); if (K < 0) return 'Other';
    const chk = attackersOf(F, K, materW); if (!chk.length) return 'Other';
    const c = chk.find(s => F[s] !== prev[s]) ?? chk[0], k = kindOf(F[c]), own = s => mine(F[s], !materW);
    const nb = STEPS.k.map(d => K + d).filter(on), kf = file(K), kr = rank(K), back = materW ? 7 : 0;
    const defBy = (s, kind) => attackersOf(F, s, materW).some(a => kindOf(F[a]) === kind);
    const others = (kinds) => { const o = []; for (let s = 0; s < 128; s++) if (s !== c && on(s) && mine(F[s], materW) && kinds.includes(kindOf(F[s]))) o.push(s); return o; };
    if (k === 'n' && nb.every(s => own(s))) return 'Smothered';
    if ('rq'.includes(k) && kr === back && rank(c) === kr) { const front = [-1, 0, 1].map(df => K + (materW ? -16 : 16) + df).filter(on); if (front.filter(own).length >= 2) return 'Back rank'; }
    if (k === 'r' && cheb(c, K) === 1 && defBy(c, 'n') && (kf === 0 || kf === 7) && (kr === 0 || kr === 7)) return 'Arabian';
    if ('rq'.includes(k) && (kf === 0 || kf === 7) && file(c) === kf && others('n').some(s => cheb(s, K) <= 2)) return 'Anastasia';
    if (k === 'b' && others('b').some(s => attacksFrom(F, s).some(t => nb.includes(t)))) return "Boden's";
    if (k === 'q' && file(c) === kf && [K - 1, K + 1].filter(on).length === 2 && [K - 1, K + 1].every(s => F[s] === (materW ? 'r' : 'R'))) return 'Epaulette';      // queen in front, the king's own rooks on both shoulders
    if (k === 'r' && cheb(c, K) === 1 && defBy(c, 'n')) return 'Hook';
    if (k === 'q' && cheb(c, K) === 1) return 'Queen next to king';
    const edge = kf === 0 || kf === 7 || kr === 0 || kr === 7, onLine = file(c) === kf || rank(c) === kr;
    if ('rq'.includes(k) && edge && onLine && others('rq').some(s => (file(c) === kf ? Math.abs(file(s) - kf) === 1 : Math.abs(rank(s) - kr) === 1))) return 'Ladder';
    if ('rq'.includes(k) && edge && onLine && nb.filter(s => file(c) === kf ? file(s) !== kf : rank(s) !== kr).every(s => own(s) || attacked(F, s, materW))) return 'Corridor';
    if ('nb'.includes(k) && others('nb').some(s => attacksFrom(F, s).some(t => nb.includes(t)))) return 'Two minor pieces';
    if (defBy(c, 'p')) return 'Pawn-supported';
    return 'Other';
  }
  // which textbook rook ending this is, if any (stronger = the side with the pawn)
  function rookEnding(b) {
    const pc = w => { const o = []; for (let s = 0; s < 128; s++) if (on(s) && mine(b[s], w) && kindOf(b[s]) !== 'k') o.push(kindOf(b[s])); return o.sort().join(''); };
    const W = pc(true), B = pc(false); let st = null;
    if (W === 'pr' && B === 'r') st = true; else if (B === 'pr' && W === 'r') st = false; else return null;
    const P = pawnsOf(b, st)[0], rr = st ? rank(P) : 7 - rank(P), pf = file(P), aK = kingAt(b, st), dK = kingAt(b, !st);
    const relR = s => st ? rank(s) : 7 - rank(s);
    if (rr === 6 && Math.abs(file(aK) - pf) <= 1 && relR(aK) >= 6 && Math.abs(file(dK) - pf) >= 1 && relR(dK) < 7 + (file(dK) === pf ? 0 : 1)) return { k: 'lucena', st };
    if (Math.abs(file(dK) - pf) <= 1 && relR(dK) > rr) return { k: 'philidor', st };
    if ((pf === 0 || pf === 7) && relR(dK) <= rr) return { k: 'vancura', st };
    if (Math.abs(file(dK) - pf) >= 2 && pf !== 0 && pf !== 7) return { k: 'cutoff', st };
    return null;
  }

  // ── style, read from the moves only (no engine), so the same code reads your games and the grandmasters' games for "Plays most like" ──
  // one number per measure for side W (null when it does not apply to this game)
  const SV = ['e4', 'e5reply', 'c5reply', 'd4', 'aggression', 'queensOff', 'castleMove', 'castleLong', 'oppCastle', 'storm', 'length', 'decisive', 'longWin', 'tension', 'centrePawns', 'sacrifice', 'earlyTrades'];
  const MATV = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function styleOf(all, san, W, res) {
    const n = all.length, v = new Array(SV.length).fill(null), Bd = i => parse(all[i]).b, me = i => (i % 2 === 0) === W;
    if (n < 20) return v;
    v[0] = W ? (san[0] === 'e4' ? 1 : 0) : null; v[3] = W ? (san[0] === 'd4' ? 1 : 0) : null;
    if (!W && san[0] === 'e4') { v[1] = san[1] === 'e5' ? 1 : 0; v[2] = san[1] === 'c5' ? 1 : 0; }
    let a = 0, an = 0; for (let i = W ? 0 : 1; i < Math.min(n, 50); i += 2) { an++; if (/[x+#]/.test(san[i] || '')) a++; } v[4] = an ? a / an : null;
    if (n > 40) { const b = Bd(39); v[5] = !b.includes('Q') && !b.includes('q') ? 1 : 0; let c = 0; for (const f of [3, 4]) for (let r = 0; r < 8; r++) if (kindOf(b[r * 16 + f]) === 'p') c++; v[14] = c; }
    let cm = null, cs = null, ocs = null; for (let i = 0; i < n; i++) { if (!/^O-O/.test(san[i] || '')) continue; const long = /^O-O-O/.test(san[i]); if (me(i)) { if (cm == null) { cm = Math.floor(i / 2) + 1; cs = long; } } else if (ocs == null) ocs = long; }
    v[6] = cm == null ? (n > 40 ? 30 : null) : cm; v[7] = cs == null ? null : cs ? 1 : 0; v[8] = cs != null && ocs != null ? (cs !== ocs ? 1 : 0) : null;
    if (n > 50) { const b = Bd(49), K = kingAt(b, !W); if (K >= 0 && file(K) >= 5) { let st = 0; for (let x = 0; x < 128; x++) if (on(x) && b[x] === (W ? 'P' : 'p') && file(x) >= 5 && (W ? rank(x) : 7 - rank(x)) >= 4) st = 1; v[9] = st; } }
    v[10] = Math.ceil(n / 2); v[11] = res === 'd' ? 0 : 1; v[12] = res === 'w' ? (n > 80 ? 1 : 0) : null;
    let t = 0, tn = 0, down = 0, sac = 0, run = 0; const mat = b => { let d = 0; for (let x = 0; x < 128; x++) if (on(x) && b[x]) d += (whiteP(b[x]) === W ? 1 : -1) * MATV[kindOf(b[x])]; return d; };
    for (let i = W ? 20 : 21; i < Math.min(n, 60); i += 2) { const b = Bd(i); let k = 0; for (let x = 0; x < 128; x++) if (on(x) && b[x] && !'pk'.includes(kindOf(b[x])) && attacked(b, x, !whiteP(b[x]))) k++; t += k; tn++;
      const d = mat(b); run = d <= -2 ? run + 1 : 0; if (run >= 3) down = 1; }
    v[13] = tn ? t / tn : null;
    if (down) { const end = mat(Bd(n - 1)); sac = res === 'w' || end >= -1 ? 1 : 0; } v[15] = n > 30 ? sac : null;
    let caps = 0; for (let i = 0; i < Math.min(n, 30); i++) if (/x/.test(san[i] || '')) caps++; v[16] = caps;
    return v.map(x => x == null ? null : Math.round(x * 1000) / 1000);
  }

  // ── one game ──
  // opening habits for one side: [minor pieces still on their first squares after move 12, castled by move 12 (1/0),
  // queen moves in the first 10 moves, non-capturing moves before move 10 by a piece that had already moved]. null when the game ends before move 12.
  const fmap = fen => { const m = {}; fen.split(' ')[0].split('/').forEach((r, ri) => { let f = 0; for (const ch of r) { if (/\d/.test(ch)) f += +ch; else { m['abcdefgh'[f] + (8 - ri)] = ch; f++; } } }); return m; };
  function habits(all, san, w) {
    const ply = k => w ? 2 * (k - 1) : 2 * (k - 1) + 1, mine = c => !!c && (w ? c === c.toUpperCase() : c === c.toLowerCase());
    if (!all || !san || all.length <= ply(12)) return null;
    const home = w ? { b1: 'N', g1: 'N', c1: 'B', f1: 'B' } : { b8: 'n', g8: 'n', c8: 'b', f8: 'b' }, b12 = fmap(all[ply(12)]);
    let castled = 0, q = 0, twice = 0; const landed = new Set();
    for (let k = 1; k <= 12; k++) { const i = ply(k), s = san[i] || ''; if (/^O-O/.test(s)) castled = 1; if (k > 10) continue;
      if (s[0] === 'Q') q++;
      if (/^[NBRQ]/.test(s)) { const a = fmap(i ? all[i - 1] : START), b = fmap(all[i]); let from = null, to = null;
        for (const x in a) if (mine(a[x]) && a[x] !== b[x]) from = x; for (const x in b) if (mine(b[x]) && a[x] !== b[x]) to = x;
        if (from && landed.has(from) && !s.includes('x')) twice++; if (to) landed.add(to); } }
    return [Object.entries(home).filter(([x, p]) => b12[x] === p).length, castled, q, twice]; }
  function extra(g, r) {
    const ev = g.ev, bm = g.bm || [], all = g.all, pcs = g.pcs, clk = g.clk || [], n = all.length, meW = g.c === 'w', sMe = meW ? 1 : -1;
    const B = i => i < 0 ? parse(START).b : parse(all[i]).b;
    const T = { me: {}, th: {} }; for (const w of ['me', 'th']) for (const t of THEMES) T[w][t] = [0, 0];      // [found, chances]
    const TN = { me: [0, 0], th: [0, 0] };                                                                    // tactic chances, each counted once
    const S = { me: SIGNS.map(() => 0), th: SIGNS.map(() => 0) }, SN = { me: 0, th: 0 };
    const Hd = { me: HIDE.map(() => 0), th: HIDE.map(() => 0) }, HN = { me: 0, th: 0 };
    const PS = { me: POS.map(() => 0), th: POS.map(() => 0) }, PN = { me: 0, th: 0 };
    const MP = { me: {}, th: {} };      // missed mates in one, by the pattern the engine's move would have given
    const EX = [];      // your missed tactics, for the quiz on Profile: ply, themes, position before, best move (UCI), your move, evaluation before and after
    const MM = { me: [0, 0], th: [0, 0] }, CT = { me: [0, 0, 0, 0], th: [0, 0, 0, 0] };       // mates [missed, allowed]; time [critical s, n, quiet s, n]
    const timed = g.base > 0 && clk.some(v => v != null), inc = g.inc || 0;
    let prevB = B(-1);
    for (let i = 0; i < n; i++) {
      const b0 = prevB, b1 = B(i); prevB = b1;
      const moverW = i % 2 === 0, who = moverW === meW ? 'me' : 'th', s = moverW ? 1 : -1;
      const evB = s * (i ? ev[i - 1] : 20), evA = s * ev[i];
      if (evB >= 9000 && evA < 9000 && Math.abs(ev[i]) !== 10000) MM[who][0] = 1;
      if (evB > -9000 && evA <= -9000) MM[who][1] = 1;
      const best = i ? bm[i - 1] : null, wb = wp(evB), loss = wb - wp(evA);
      let cl = null; try { cl = best ? classify(b0, best) : null; } catch (e) { cl = null; }
      if (best && evB === 9999 && evA < 9000 && Math.abs(ev[i]) !== 10000) { try { const m = apply(b0, best); if (m) { const p = matePattern(m.c, b0, moverW); MP[who][p] = (MP[who][p] || 0) + 1; if (who === 'me') EX.push({ i, t: ['mate'], m: p, f: i ? all[i - 1] : START, b: best, p: (g.san || [])[i] || '', e: [Math.round(evB), Math.round(evA)] }); } } catch (e) { /* skip */ } }
      if (timed && clk[i] != null) { const prev = i >= 2 ? clk[i - 2] : g.base, spent = prev != null ? prev + inc - clk[i] : null; if (spent != null && spent >= 0) { const crit = (cl && cl.forcing) || Math.abs(evB - s * (i >= 2 ? ev[i - 2] : 20)) >= 150; CT[who][crit ? 0 : 2] += spent; CT[who][crit ? 1 : 3]++; } }
      if (!cl || wb >= 97 || wb <= 3) continue;
      const same = place(cl.c) === place(b1), found = same || loss < 3;
      const gift = evB - s * (i >= 2 ? ev[i - 2] : 20);
      if (found || loss >= 15) { let tags = null;
        if (gift >= 100 && evB >= 100) { tags = tagsOf(b0, cl, moverW); if (tags.some(t => CORE.has(t))) { TN[who][1]++; if (found) TN[who][0]++; } else tags = null; }
        else if (Math.abs(evB) <= 150 && threatened(b0, moverW)) tags = ['defensive'].concat(cl.castle ? ['castling'] : [], endTags(b0));
        if (tags) for (const t of tags) { T[who][t][1]++; if (found) T[who][t][0]++; }
        if (tags && who === 'me' && !found && gift >= 100 && evB >= 100) EX.push({ i, t: tags.filter(x => CORE.has(x)), f: i ? all[i - 1] : START, b: best, p: (g.san || [])[i] || '', e: [Math.round(evB), Math.round(evA)] }); }
      if (found || loss < 15) continue;
      if (who === 'me' && best && evB > -150 && evB < 9000 && !EX.some(x => x.i === i)) EX.push({ i, t: ['better'], f: i ? all[i - 1] : START, b: best, p: (g.san || [])[i] || '', e: [Math.round(evB), Math.round(evA)] });      // any big mistake you made while not already lost: a 'find a better move' position
      if (!cl.type && !cl.forcing && i + 1 < n) { try { const a = parse(i ? all[i - 1] : START), z = parse(all[i + 1]), K0 = kingAt(b0, moverW), K1 = kingAt(b1, moverW), castled = K0 >= 0 && K1 >= 0 && Math.abs(file(K1) - file(K0)) === 2;
        themes(weak(a.b, moverW, a.cas), weak(z.b, moverW, z.cas), moverW, castled).forEach((v, j) => { if (v) PS[who][j]++; }); PN[who]++; } catch (e) { /* skip this move */ } }
      if (cl.type || cl.forcing) { const sg = signs(b0, moverW); SIGNS.forEach((k, j) => { if (sg[k]) S[who][j]++; }); SN[who]++; }
      // in-between: the opponent just captured on X, you could take back on X, the engine's move does something else
      let between = false;
      if (i >= 1) { const bb = B(i - 2); for (let x = 0; x < 128; x++) if (on(x) && bb[x] && b0[x] && bb[x] !== b0[x] && mine(b0[x], !moverW)) { if (attacked(b0, x, moverW) && cl.to !== x) between = true; break; } }
      [cl.quiet, cl.back, cl.long, cl.side, between].forEach((v, j) => { if (v) Hd[who][j]++; }); HN[who]++;
    }
    // trades from the first moment you are 2 pawns up (after move 5), over the next 20 half-moves
    let tr = null; const up = ev.findIndex((v, i) => i >= 10 && sMe * v >= 200);
    if (up >= 0) { let pc = 0, pw = 0; for (let i = up + 1; i < Math.min(n, up + 21); i++) { const a = B(i - 1), c = B(i); for (let x = 0; x < 128; x++) if (on(x) && a[x] && c[x] !== a[x] && (!c[x] || whiteP(c[x]) !== whiteP(a[x]))) { if (kindOf(a[x]) === 'p') pw++; else if (kindOf(a[x]) !== 'k') pc++; } } tr = [pc, pw]; }
    // opening rules in your first 10 moves
    const pr = [0, 0, 0, 0, 0]; const moved = new Set();
    for (let i = meW ? 0 : 1; i < Math.min(n, 20); i += 2) {
      const a = B(i - 1), c = B(i); let from = -1, to = -1;
      for (let x = 0; x < 128; x++) if (on(x)) { if (mine(a[x], meW) && !mine(c[x], meW)) from = x; if (mine(c[x], meW) && c[x] !== a[x]) to = x; }
      if (from < 0 || to < 0) continue; const k = kindOf(c[to]), capt = !!a[to] && !mine(a[to], meW), dev = developed(a, meW);
      if ('nbrq'.includes(k) && !capt && dev < 4 && moved.has(from)) pr[0] = 1;
      if (k === 'q' && dev < 2) pr[1] = 1;
      if (k === 'p' && capt && dev < developed(a, !meW)) pr[2] = 1;
      moved.delete(from); moved.add(to);
    }
    const ply10 = meW ? 18 : 19; if (n > ply10 && kingAt(B(ply10), meW) === (meW ? 4 : 116)) pr[3] = 1;
    if (n > 29 && sMe * ev[29] <= -150) pr[4] = 1;
    // the endgame: material when it starts, what was expected from the eval there, rook activity, textbook rook endings
    let eg = null, ra = null, kr = null; const eS = pcs.findIndex(v => v <= 6);
    let eI = eS; if (eS >= 0) for (let i = eS; i < n; i++) { const b = B(i); if (egCategory(kindsOf(b, meW), kindsOf(b, !meW)) !== 'Mixed pieces') { eI = i; break; } }
    if (eI >= 0) {
      const b = B(eI), m = kindsOf(b, meW), t = kindsOf(b, !meW), cat = egCategory(m, t);
      eg = { cat, pair: m + ' v ' + t, exp: Math.round(wp(sMe * Math.max(-1000, Math.min(1000, ev[eI])))) / 100 };
      if (cat === 'Rook') { const rooks = []; for (let x = 0; x < 128; x++) if (on(x) && b[x] === (meW ? 'R' : 'r')) rooks.push(x);
        const myP = pawnsOf(b, meW), theirP = pawnsOf(b, !meW), rel = x => meW ? rank(x) : 7 - rank(x);
        ra = rooks.some(x => rel(x) === 6 || attacksFrom(b, x).some(t => theirP.includes(t)) || myP.some(p => file(p) === file(x) && rel(p) > rel(x) && !theirP.some(q => file(q) === file(p) && rel(q) > rel(p)))) ? 1 : 0; }
      for (let i = eI; i < n && !kr; i++) { const k = rookEnding(B(i)); if (!k) continue; const att = k.st === meW, win = k.k === 'lucena' || k.k === 'cutoff'; if (att && win) kr = { k: k.k, ok: r === 'w' ? 1 : 0 }; else if (!att && !win) kr = { k: k.k, ok: r !== 'l' ? 1 : 0 }; else break; }
    }
    // pawn structure at move 20, and the plan that followed
    let sx = null;
    if (n >= 30) { const k = structureOf(B, n);
      if (k) { sx = { k: k.k, own: k.owner === meW ? 'y' : 't', exp: Math.round(wp(sMe * ev[k.at])) / 100 }; const late = B(Math.min(59, n - 1));
        if (k.k === 'Carlsbad') { const Y = !k.owner, P = pawnsOf(late, Y), rel = x => Y ? rank(x) : 7 - rank(x); sx.plan = P.some(x => file(x) === 1 && rel(x) >= 4) ? 'minority' : P.some(x => file(x) === 4 && rel(x) >= 3) ? 'e4' : 'other'; }
        if (k.k === "Isolated queen's pawn") { sx.qOff = !late.some(p => p === 'Q' || p === 'q') ? 1 : 0; const mid = B(Math.min(49, n - 1)), d = pawnsOf(mid, k.owner).find(x => file(x) === 3); if (d != null) { const f = d + (k.owner ? 16 : -16); sx.blk = on(f) && mid[f] && !mine(mid[f], k.owner) && kindOf(mid[f]) !== 'p' ? 1 : 0; } }
      } }
    // mate at the end of the game
    let mt = null; const lastV = ev[n - 1];
    if (Math.abs(lastV) === 10000 && n >= 2) { const materW = lastV > 0; mt = { p: matePattern(B(n - 1), B(n - 2), materW), by: materW === meW ? 'me' : 'th' }; }
    // what decided a loss, and where a won position slipped
    let tm = null; const res = meW ? g.wres : g.bres;
    if (r === 'l') {
      if (res === 'timeout') tm = 'clock'; else if (mt && mt.by === 'th') tm = n > 80 ? 'late mate' : 'early mate';
      else { for (let i = meW ? 0 : 1; i < n; i += 2) { if (sMe * (i ? ev[i - 1] : 20) > -100 && sMe * ev[i] <= -300) { tm = phaseOf(i, pcs); break; } } tm = tm || 'other'; }
    }
    let bp = null; if (up >= 0 && r !== 'w') bp = phaseOf(up, pcs);
    // style: captures and checks in your first 25 moves, and how long you stay accurate in the opening
    let cc = 0, mv = 0, fi = 15; const san = g.san || [];
    for (let i = meW ? 0 : 1; i < Math.min(n, 50); i += 2) { mv++; if (/[x+]/.test(san[i] || '')) cc++; }
    for (let i = meW ? 0 : 1; i < Math.min(n, 30); i += 2) { const evB = sMe * (i ? ev[i - 1] : 20); if (wp(evB) - wp(sMe * ev[i]) >= 5) { fi = Math.floor(i / 2); break; } }
    // style radar, for you and your opponent: [captures and checks, of moves (first 25 moves); pieces under attack after your moves, moves (10 to 30);
    // share of the clock spent per move (after move 10) x1000, moves; moves before the first opening slip; win chance lost per move in the 10 moves after the first big mistake, moves]
    const st = {}; for (const who of ['me', 'th']) { const W = who === 'me' ? meW : !meW, s1 = W ? 1 : -1, o = [0, 0, 0, 0, 0, 0, 15, 0, 0]; let big = -1;
      for (let i = W ? 0 : 1; i < n; i += 2) { const before = wp(s1 * (i ? ev[i - 1] : 20)), lost = before - wp(s1 * ev[i]);
        if (i < 50) { o[1]++; if (/[x+#]/.test(san[i] || '')) o[0]++; }
        if (i >= 20 && i < 60) { const b1 = B(i); let tn = 0; for (let x = 0; x < 128; x++) if (on(x) && b1[x] && !'pk'.includes(kindOf(b1[x])) && attacked(b1, x, !whiteP(b1[x]))) tn++; o[2] += tn; o[3]++; }
        if (timed && i >= 20 && clk[i] != null && clk[i - 2] != null) { const sp = clk[i - 2] + inc - clk[i]; if (sp >= 0) { o[4] += Math.round(1000 * sp / g.base); o[5]++; } }
        if (i < 30 && o[6] === 15 && lost >= 5) o[6] = Math.floor(i / 2);
        if (before > 3 && before < 97) { if (big < 0) { if (lost >= 15) big = i; } else if (o[8] < 10) { o[7] += Math.max(0, Math.round(lost * 10) / 10); o[8]++; } } }
      st[who] = o; }
    let sv = null; try { const res = typeof r === 'string' ? r : r && r.r, rTh = res === 'w' ? 'l' : res === 'l' ? 'w' : 'd'; sv = { me: styleOf(all, san, meW, res), th: styleOf(all, san, !meW, rTh) }; } catch (e) { sv = null; }
    EX.sort((p, q) => (q.e[0] - q.e[1]) - (p.e[0] - p.e[1])); EX.length = Math.min(EX.length, 6);
    const OH = { me: habits(all, g.san, meW), th: habits(all, g.san, !meW) };
    // your first 15 moves (for "Moves you keep repeating"), your big mistakes among them with the engine's move, and pawn moves among big mistakes for both sides
    const sanL = g.san || [], OB = [], OBM = [], PW = { me: [0, 0, 0, 0], th: [0, 0, 0, 0] };      // PW: [big mistakes that were pawn moves, big mistakes, pawn moves, moves]
    for (let i = 0; i < Math.min(n, sanL.length, ev.length); i++) { const mineP = (i % 2 === 0) === meW, w = mineP ? 'me' : 'th', sg = mineP ? sMe : -sMe, wb = wp(sg * (i ? ev[i - 1] : 20)), big = wb < 97 && wb > 3 && wb - wp(sg * ev[i]) >= 15, pawn = /^[a-h]/.test(sanL[i] || '');
      PW[w][2] += pawn ? 1 : 0; PW[w][3]++; if (mineP && i < 30) OBM.push((i && bm[i - 1]) || '-'); if (big) { PW[w][1]++; if (pawn) PW[w][0]++; if (mineP && i < 30) OB.push([i, (i && bm[i - 1]) || '']); } }
    return { om: sanL.slice(0, 30).join(' '), ob: OB, obm: OBM.join(' '), pw: PW, oh: OH, ex: EX, ps: PS, pn: PN, mp: MP, t: T, tn: TN, st, sv, s: S, sn: SN, h: Hd, hn: HN, mm: MM, ct: CT, tr, pr, eg, ra, kr, sx, mt, tm, bp, ag: mv ? Math.round(100 * cc / mv) : 0, fi };
  }

  // ── many games: add up what the Skills phases and Insights show ──
  function summarize(rows) {
    rows = rows.filter(r => r.y); const Y = { n: rows.length };
    const add = (a, b) => a.map((v, i) => v + (b[i] || 0)), pts = r => r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0;
    Y.tac = {}; for (const t of THEMES) { Y.tac[t] = { me: [0, 0], th: [0, 0] }; for (const r of rows) for (const w of ['me', 'th']) Y.tac[t][w] = add(Y.tac[t][w], r.y.t[w][t] || [0, 0]); }
    Y.tacN = { me: [0, 0], th: [0, 0] }; for (const r of rows) if (r.y.tn) for (const w of ['me', 'th']) Y.tacN[w] = add(Y.tacN[w], r.y.tn[w]);
    Y.sig = { me: SIGNS.map(() => 0), th: SIGNS.map(() => 0), mn: 0, tn: 0 }; Y.hid = { me: HIDE.map(() => 0), th: HIDE.map(() => 0), mn: 0, tn: 0 };
    Y.mm = { me: [0, 0], th: [0, 0] }; Y.ct = { me: [0, 0, 0, 0], th: [0, 0, 0, 0] };
    for (const r of rows) { const y = r.y; Y.sig.me = add(Y.sig.me, y.s.me); Y.sig.th = add(Y.sig.th, y.s.th); Y.sig.mn += y.sn.me; Y.sig.tn += y.sn.th; Y.hid.me = add(Y.hid.me, y.h.me); Y.hid.th = add(Y.hid.th, y.h.th); Y.hid.mn += y.hn.me; Y.hid.tn += y.hn.th; Y.mm.me = add(Y.mm.me, y.mm.me); Y.mm.th = add(Y.mm.th, y.mm.th); Y.ct.me = add(Y.ct.me, y.ct.me); Y.ct.th = add(Y.ct.th, y.ct.th); }
    Y.pos = { me: POS.map(() => 0), th: POS.map(() => 0), mn: 0, tn: 0 }; for (const r of rows) if (r.y.ps) { Y.pos.me = add(Y.pos.me, r.y.ps.me); Y.pos.th = add(Y.pos.th, r.y.ps.th); Y.pos.mn += r.y.pn.me; Y.pos.tn += r.y.pn.th; }
    const tr = { won: [0, 0], not: [0, 0] }; for (const r of rows) if (r.y.tr) tr[r.r === 'w' ? 'won' : 'not'] = add(tr[r.r === 'w' ? 'won' : 'not'], r.y.tr); Y.trade = tr;
    const wrong = rows.filter(r => r.y.pr[4]); Y.prin = { n: wrong.length, c: [0, 1, 2, 3].map(j => wrong.filter(r => r.y.pr[j]).length), all: [0, 1, 2, 3].map(j => rows.filter(r => r.y.pr[j]).length) };
    const grp = (key) => { const o = {}; for (const r of rows) { if (!r.y.eg) continue; const k = r.y.eg[key], g = o[k] || (o[k] = { k, n: 0, pts: 0, exp: 0 }); g.n++; g.pts += pts(r); g.exp += r.y.eg.exp; } return Object.values(o).sort((a, b) => b.n - a.n); };
    Y.egCat = grp('cat'); Y.egPair = grp('pair');
    Y.kr = {}; for (const r of rows) if (r.y.kr) { const o = Y.kr[r.y.kr.k] || (Y.kr[r.y.kr.k] = [0, 0]); o[r.y.kr.ok ? 0 : 1]++; }
    Y.ra = { lost: [0, 0], won: [0, 0] }; for (const r of rows) if (r.y.ra != null && r.r !== 'd') Y.ra[r.r === 'w' ? 'won' : 'lost'][r.y.ra ? 0 : 1]++;
    Y.sx = {}; for (const r of rows) { const x = r.y.sx; if (!x) continue; const o = Y.sx[x.k] || (Y.sx[x.k] = { y: { n: 0, pts: 0, exp: 0 }, t: { n: 0, pts: 0, exp: 0 }, plan: {}, q: [[0, 0], [0, 0]], blk: [0, 0] }); o[x.own].n++; o[x.own].pts += pts(r); o[x.own].exp += x.exp || 0;
      if (x.plan && x.own === 't') { const p = o.plan[x.plan] || (o.plan[x.plan] = { n: 0, pts: 0 }); p.n++; p.pts += pts(r); }
      if (x.qOff != null && x.own === 'y') { o.q[x.qOff][0]++; o.q[x.qOff][1] += pts(r); }
      if (x.blk != null && x.own === 't') { o.blk[0]++; if (x.blk) o.blk[1]++; } }
    Y.mt = {}; for (const m of MATES) Y.mt[m] = { me: 0, th: 0 }; for (const r of rows) if (r.y.mt) Y.mt[r.y.mt.p][r.y.mt.by]++;
    Y.tm = {}; for (const r of rows) if (r.y.tm) Y.tm[r.y.tm] = (Y.tm[r.y.tm] || 0) + 1; Y.losses = rows.filter(r => r.r === 'l').length;
    Y.bp = { opening: 0, middle: 0, endgame: 0 }; for (const r of rows) if (r.y.bp) Y.bp[r.y.bp]++;
    Y.score = rows.length ? rows.reduce((s, r) => s + pts(r), 0) / rows.length : .5;
    Y.st = { me: new Array(9).fill(0), th: new Array(9).fill(0), n: 0 }; for (const r of rows) if (r.y.st) { Y.st.n++; for (const w of ['me', 'th']) { const a = r.y.st[w]; Y.st[w] = Y.st[w].map((v, j) => j === 6 ? v + a[6] : j === 7 ? v + (a[8] >= 3 ? a[7] : 0) : j === 8 ? v + (a[8] >= 3 ? a[8] : 0) : v + a[j]); } }
    Y.long = { me: [0, 0], th: [0, 0] }; for (const r of rows) { const w = r.r === 'w' ? 'me' : r.r === 'l' ? 'th' : null; if (w && r.x) { Y.long[w][1]++; if (r.x[14] > 80) Y.long[w][0]++; } }
    Y.sv = { me: SV.map(() => [0, 0]), th: SV.map(() => [0, 0]), n: 0 }; for (const r of rows) if (r.y.sv) { Y.sv.n++; for (const w of ['me', 'th']) r.y.sv[w].forEach((x, j) => { if (x != null) { Y.sv[w][j][0] += x; Y.sv[w][j][1]++; } }); }
    Y.mp = { me: {}, th: {} }; for (const r of rows) if (r.y.mp) for (const w of ['me', 'th']) for (const [k, v] of Object.entries(r.y.mp[w])) Y.mp[w][k] = (Y.mp[w][k] || 0) + v;
    Y.ag = rows.length ? rows.reduce((s, r) => s + r.y.ag, 0) / rows.length : 0; Y.fi = rows.length ? rows.reduce((s, r) => s + r.y.fi, 0) / rows.length : 0;
    return Y;
  }
  return { SV, styleOf, POS, weak, themes, structureOf, extra, summarize, classify, signs, structure, matePattern, rookEnding, parse, apply, THEMES, SIGNS, HIDE, MATES };
})();
if (typeof module !== 'undefined') module.exports = CRS_SX;
