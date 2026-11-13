// ============================================================
// MY STATS v2: drawing the Skills phases, the grouped Insights and the Style block (popup only).
// Numbers come from CRS_SK.report (existing Skills) and CRS_SX.summarize (stats-core.js). Every coloured number has a benchmark:
// typical at your rating (Skills benchmarks), your opponents in the same games, or your own other games. No benchmark, no colour.
// Each "Try" tip is written once per screen: a tip already shown on the screen is not shown again (user, 2026-11-07).
// ============================================================
const CRS_SXUI = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Number(n).toLocaleString('en-US'), P0 = v => Math.round(v) + '%', share = (a, b) => b ? 100 * a / b : 0;
  const DIR = { down: '<path d="M7 7l10 10M17 9v8H9"/>', up: '<path d="M7 17 17 7M9 7h8v8"/>', lv: '<path d="M5 12h14"/>' };
  const dir = t => `<svg class="si-ic ${t === 'down' ? 'down' : t === 'up' ? 'up' : 'lv'}" viewBox="0 0 24 24" aria-hidden="true">${DIR[t === 'down' || t === 'up' ? t : 'lv']}</svg>`;
  const CHV = '<svg class="si-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const toneOf = (you, ref, gap = 5, higher = true) => { const d = higher ? you - ref : ref - you; return d >= gap ? 'up' : d <= -gap ? 'down' : ''; };
  const b = (v, t) => `<b class="${t || ''}">${v}</b>`;
  const tbl = (heads, rows) => `<div class="sk-t" style="grid-template-columns:1fr${' 34px'.repeat(heads.length)}"><span class="h"></span>${heads.map(h => `<span class="h n">${h}</span>`).join('')}${rows.map(r => r.map((c, i) => { const [v, k] = Array.isArray(c) ? c : [c, '']; return `<span class="${i ? 'n' : ''} ${k === 'down' ? 'behind' : k === 'up' ? 'ahead' : ''}">${v}</span>`; }).join('')).join('')}</div>`;
  const bar = (name, sub, right, pct, tick, tone) => `<div class="sty"><span class="r"><span>${name}${sub ? `<small>${sub}</small>` : ''}</span><b class="${tone || ''}">${right ? `<small>${right}</small>` : ''}${Math.round(pct)}%</b></span><span class="tb"><u class="${tone || ''}" style="width:${Math.max(0, Math.min(100, pct))}%"></u>${tick != null ? `<i style="left:${Math.max(0, Math.min(100, tick))}%"></i>` : ''}</span></div>`;
  const two = (heads, rows) => `<div class="ps h"><span></span><span>${heads[0]}</span><span>${heads[1]}</span></div>` + rows.map(r => `<div class="ps"><span>${r[0]}</span><b class="${r[1][2] || ''}">${r[1][0]}<small>${r[1][1]}</small></b><b class="${r[2][2] || ''}">${r[2][0]}<small>${r[2][1]}</small></b></div>`).join('');

  // one "Try" per stat, each written once; the screen keeps a set of tips already used
  const TIPS = {
    develop: "Count pieces in play, not moves played. Before move 10, get your knights and bishops out and castle; don't move the same piece twice or bring the queen out early unless it wins something. Start an attack only once every minor piece is in play.",
    clock: "Plan your clock like a budget: aim to have about 70% left at move 20, and spend no more than a tenth of your time on any single move before move 15. If you are behind that pace, play the obvious recaptures and developing moves at once.",
    crit: "Spend time where the game can turn: when either side has checks, captures or threats, or when you must choose a plan. When the position is quiet and the move is obvious, play it fast and bank the seconds.",
    ahead: "Ahead and short of time, simplify on purpose: offer queen and rook trades, keep your pawns protected, and choose safe moves you can play in a few seconds. A won position you can play quickly beats a better one you cannot.",
    losses: "Take the phase that decides most of your losses and give it a week of practice: replay those games and mark the exact move where a level game turned lost.",
    think: "When a think runs long, stop adding new lines and play the safest move you have already checked. When you are about to move in under three seconds, first ask one question: what does their last move attack?",
    convert: "Once you are clearly winning, switch from attacking to safety: list every check, capture and threat they have and take those away first. Then trade pieces, not pawns; one extra pawn is usually enough in the ending, and fewer pieces leave fewer tricks.",
    fork: "Knights fork in circles, not lines: before each move, find their king, queen and rooks and check the squares a knight could jump to that hit two of them. Pawns fork too, when two pieces stand side by side just in front of a pawn.",
    pin: "Pins live on lines: whenever their king or queen shares a file, rank or diagonal with another of their pieces, ask whether your bishop, rook or queen can land on it. A pinned piece is also a poor defender, so attack whatever it guards.",
    skewer: "A skewer is a pin in reverse, with the valuable piece in front. Look for one when their king or queen shares a line with a rook or a loose piece behind it, especially with checks along the edge of the board.",
    discovered: "Any piece of yours standing in front of your own bishop, rook or queen is a loaded gun: before moving it, ask what the line hits once it opens, and move it with a threat of its own so both land at once.",
    promotion: "With a pawn two squares from queening, count it out: the defence usually rests on one piece in front of or behind the pawn. Look for a sacrifice or check that drags that piece away, and make sure no check is waiting for your new queen.",
    signals: "Tactics are announced by warning signs: an exposed king, a loose piece that can actually be attacked, pieces on one line, big pieces a knight-jump apart, a piece with no squares, one defender doing two jobs, or defenders far from their king. When you see one, slow down and look for the shot.",
    hidden: "The moves you miss are the ones that look strange: backward moves, quiet moves that set up a threat, and long moves across the board. Before choosing, add one of each to your list on purpose, and after a capture look for an in-between move before the automatic recapture.",
    mates: "When their king has two free squares or fewer, look at every check first, even sacrifices, and note which squares around the king nothing guards. Learn the common patterns by name, such as back rank, smothered and Boden, so you recognise them instead of calculating them.",
    lines: "For a line that keeps going wrong, replay those games and find the first move the engine disliked; it is usually one idea you have not met yet. Learn that idea and the plan that follows it rather than adding more moves.",
    prin: "In the opening, move each piece once and toward the centre, castle by about move 10, and only grab pawns when you are not behind in development. Any move that does none of these needs a concrete reason.",
    carlsbad: "Facing the minority attack, do not wait for b4 and b5 to arrive: aim a knight at e4 and build play on the kingside, or change the structure with ...b6 and ...c5. Keep the pieces that guard c6, the pawn the attack is aimed at.",
    iqp: "Against an isolated pawn, first put a piece, ideally a knight, on the square in front of it, then trade pieces, above all its owner's light-squared bishop. The pawn is weakest in the endgame, so every trade helps you; with it yourself, attack before the endgame arrives.",
    struct: "In a structure you score poorly in, learn its two standard plans and decide which one fits where your pieces stand. Mixing plans is what loses: pick one by move 20 and commit to it.",
    rook: "Learn the two positions most rook endings run into. Lucena, to win: with the pawn on the 7th, lift your rook to the 4th rank so it can shield your king from checks. Philidor, to draw: keep your rook on your 3rd rank until their pawn steps forward, then check from behind.",
    pair: "Before trading into an ending, picture the position after the trade and ask whether it suits you. Count the pawn ending before the last pieces come off: pawn endings are exact, and usually go to the side with the more active king.",
    better: "From a better endgame, activate before you push: bring your king toward the centre and put your rook where it attacks pawns or sits behind a passed pawn. An active rook is worth about a pawn, so give a pawn to activate it if you must.",
    known: "Defending a rook ending, keep your king in front of the pawn if you can, put your rook on the long side where its checks have room, and check from a distance: a rook needs about three files between it and the pawn to check usefully.",
    active: "A passive rook loses rook endings: rather than guard a pawn from in front, give it up and put your rook behind a passed pawn or on the 7th rank, where it attacks pawns and ties their king down.",
    backrank: "Make a flight square for your king, with a pawn move such as h3, before your back rank runs out of pieces, and before every trade on the back rank check which checks it leaves behind.",
    egtype: "Take the ending type you score worst in and play it out from a winning position against the engine until the win is routine. Endings repeat, so a handful of patterns covers most of your games.",
    opening: "Use your first ten moves for development, the centre and king safety. A move that does none of the three needs a concrete reason, such as winning material or meeting a direct threat.",
    tactics: "Do ten tactic puzzles a day, one theme at a time, until you see the pattern before you calculate. In your games, check every capture and check for both sides before each move.",
    endgame: "In the ending the king becomes a fighting piece: bring it toward the centre early, and count moves before every trade, above all before going into a pawn ending.",
    pos: "Before every pawn move, ask which squares it stops guarding for good. Pawns cannot move back, so a hole or a weak pawn it leaves stays for the rest of the game: push a pawn only when it gains something concrete, and put a piece on the holes your opponent leaves.",
    quiet: "When your opponent slips but no check or capture works, look for a quiet move that makes two threats, or one threat they cannot meet. Ask what you would play if it were your move again, then play the move that sets that up.",
    defensive: "When something of yours is attacked, list every way to answer before moving: move it, guard it, block the line, counter-attack something bigger, or give check. Pick the one that leaves no second threat behind, and check what their last move attacks first.",
    exposed: "When their king has lost its pawn cover, bring more pieces before you check: a check that drives the king back to safety wastes the chance. Open lines toward it with pawn breaks or sacrifices, and look for the mating net, not just the checks.",
    sacrifice: "Before rejecting a move because it loses material, follow it two moves further: does it open their king, win back more, or leave a piece trapped? Count what you get after the forced replies, not what you give on the first move.",
    advanced: "A pawn on your 6th or 7th rank ties down their pieces. Look for a sacrifice that removes the one piece stopping it, a check that gains the tempo it needs, or a rook behind it. Against their advanced pawn, blockade it with a piece first.",
    rookEnd: "In rook endings the tactics are skewers along ranks, a rook sacrifice to promote, and stalemate tricks. Before each move, check every rank and file your rook can reach for a check or skewer, and count both pawn races to the end.",
    kingside: "Against a king castled short, count attackers against defenders around it before you commit. Push the h- or g-pawn to open a file only when your pieces are already near, and look for the sacrifice on h7, g7 or f7 that rips the cover open.",
    bishopEnd: "In bishop endings, put your pawns on the opposite colour to your bishop so it protects the squares they cannot. Look for a bishop sacrifice that lets a passed pawn through, and remember that opposite-coloured bishops are often a draw even a pawn or two down.",
    clearance: "When a piece of yours blocks a line or a square another piece wants, ask what happens if it moves away with tempo: with check, a capture or a threat. The piece that gets out of the way is often the one that makes the attack work.",
    deflection: "Find their defender that guards two things, or guards the one square that matters. Attack it, check it or offer it something to take, and the square it guarded falls. Before each move, ask which of their pieces is doing two jobs.",
    hanging: "Before every move, scan their pieces for one that nothing guards, and yours for the same. Loose pieces drop off: take theirs when you can, and never leave one of yours where a check or fork can pick it up.",
    castling: "Castling can be a tactic: it brings the rook into play with tempo, gets the king off an open file, or connects the rooks for a back-rank threat. In sharp positions, check whether castling now answers a threat or adds one of your own.",
    save: "When losing, make the win hard: keep pieces on, create threats and passed pawns, and look for a fortress or a stalemate trick. Many lost positions are drawn because the winning side had to find something difficult.",
  };
  // the same Tip as Insights everywhere: a lightbulb button, the tip shown when tapped (user, 2026-11-09: no more "Try:")
  const TIP_BTN = (key, o) => `<button type="button" class="ig-tb" data-tg="tip:${key}" aria-expanded="${o}"><svg class="ig-bulb" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>Tip <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>` + (o ? `<p class="ig-t">${TIPS[key]}</p>` : '');
  const tipFn = (used, open) => key => { if (!TIPS[key] || used.has(key)) return ''; used.add(key); return `<div class="tipw">${TIP_BTN(key, !!(open && open.has('tip:' + key)))}</div>`; };
  const item = (open, it) => { const o = open.has(it.k); return `<div class="si-it"><button type="button" class="si-h" data-tg="${it.k}" aria-expanded="${o}">${dir(it.tone)}<span class="si-t">${it.head}</span>${CHV}</button>${o ? `<div class="si-m xm"><div class="xt">${it.title}</div>${it.body || ''}${it.tip || ''}</div>` : ''}</div>`; };
  const SIGN_NAMES = ['Exposed king', 'Loose piece', 'Pieces on one line', 'Knight-fork distance', 'Trapped piece', 'Overloaded defender', 'Defenders too far'];
  const SIGN_HEAD = ['their king was exposed', 'a loose piece was on the board', 'their pieces stood on one line', 'two of their big pieces were a knight-jump apart', 'one of their pieces was trapped', 'one of their defenders was guarding two things', 'their defenders were far from the king'];
  const HIDE_NAMES = ['Quiet move', 'Backward move', 'Long-range move', 'Sideways rook or queen', 'In-between move'];
  const HIDE_TIP = { 'Quiet move': 'The best move was not a check, a capture or a promotion, so it did not jump out.', 'Backward move': 'The best move went back towards your own side of the board. Retreats are easy to overlook.',
    'Long-range move': 'The best move sent a piece 4 squares or more in one go, which is easy to miss from far away.', 'Sideways rook or queen': 'The best move was a rook or queen sliding along the same rank, left or right.',
    'In-between move': 'Your opponent had just captured. Instead of taking straight back, the best move was something else first, often a check or a threat.' };
  // each positional theme as something you did, to finish "Your most common positional mistake is ..."
  const POS_DID = { 'Isolated pawn': 'creating an isolated pawn', 'Gave up the long diagonal': 'giving up the long diagonal', 'Permanent hole': 'leaving a permanent hole in your position', 'Backward pawn': 'creating a backward pawn',
    'Trapped piece': 'getting a piece trapped', 'Weak colour complex': 'weakening all the squares of one colour', 'King stuck in the centre': 'leaving your king stuck in the centre', "Hole in the king's pawn shield": 'weakening the pawns in front of your king',
    'Gave the opponent an open file': 'giving your opponent an open file', 'Gave up castling': 'giving up the right to castle', 'Allowed connected passers': 'allowing connected passed pawns', 'Allowed a protected passer': 'allowing a protected passed pawn' };
  const LENW = ['games decided in the opening (under 20 moves', 'games decided in the middlegame (20 to 40 moves', 'games that reach the endgame (over 40 moves'];
  const POS_DID2 = { 'Isolated pawn': 'leaving one of your pawns with no pawn beside it to protect it', 'Gave up the long diagonal': 'letting an enemy bishop or queen take over one of the long diagonals',
    'Permanent hole': 'leaving a square in your half that none of your pawns can ever guard again', 'Backward pawn': 'leaving a pawn behind its neighbours where it cannot safely move forward',
    'Trapped piece': 'leaving one of your pieces with almost no safe squares', 'Weak colour complex': 'losing the bishop that guarded the squares your pawns leave weak',
    'King stuck in the centre': 'your king losing the right to castle with an open central file in front of it', "Hole in the king's pawn shield": 'losing a pawn from in front of your castled king',
    'Gave the opponent an open file': 'handing an enemy rook an open file', 'Gave up castling': 'giving up the right to castle with a king or rook move',
    'Allowed connected passers': 'letting your opponent get two passed pawns side by side', 'Allowed a protected passer': 'letting your opponent get a passed pawn defended by another pawn' };
  const posMine = (nm, me) => `Your most common positional mistake is ${b(POS_DID2[nm] || nm.toLowerCase())} (${nm.toLowerCase()}): ${P0(me)} of your positional mistakes.`;
  const egLine = (k, sc, rest, n, t) => t === 'down' ? `You score poorly in ${esc(k.toLowerCase())} endings: ${b(P0(sc), 'down')} compared with ${P0(rest)} in your other endings (${n} games).` : t === 'up' ? `You score well in ${esc(k.toLowerCase())} endings: ${b(P0(sc), 'up')} compared with ${P0(rest)} in your other endings (${n} games).` : `You score about the same in ${esc(k.toLowerCase())} endings (${P0(sc)}, ${n} games) as in your other endings (${P0(rest)}).`;
  const posLine = (nm, me, th, t) => `Your most common positional mistake is ${b(POS_DID2[nm] || nm.toLowerCase(), t)} (${nm.toLowerCase()}): ${P0(me)} of your positional mistakes. Your opponents do it in ${P0(th)} of theirs.`;
  // the 17 tactical themes: name, what it is (shown on hover), and how sentences say it
  const TAC = {
    quiet: ['Quiet move', 'A calm, non-forcing move that sets up an unstoppable threat.', 'quiet moves', 'beat you with a quiet move'],
    defensive: ['Defensive move', 'The only move that holds the position together.', 'defensive moves', 'hold with the only defensive move'],
    exposed: ['Exposed king', 'A king with no pawn cover gets hunted down.', 'attacks on an exposed king', 'attack your exposed king'],
    sacrifice: ['Sacrifice', 'Material is given up for a bigger payoff a few moves later.', 'sacrifices', 'win with a sacrifice'],
    advanced: ['Advanced pawn', 'A pawn deep in enemy territory that threatens to promote.', 'advanced pawn pushes', 'push an advanced pawn'],
    pin: ['Pin', 'A piece can\u2019t move without exposing something more valuable behind it.', 'pins', 'pin you'],
    promotion: ['Promotion', 'A pawn promotes (or the threat of it decides the game).', 'promotions', 'promote a pawn'],
    rookEnd: ['Rook endgame', 'Only kings, rooks and pawns left.', 'rook endgame tactics', 'win a tactic in a rook endgame'],
    kingside: ['Kingside attack', 'An attack on a king castled short.', 'kingside attacks', 'attack your castled king'],
    bishopEnd: ['Bishop endgame', 'Only kings, bishops and pawns left.', 'bishop endgame tactics', 'win a tactic in a bishop endgame'],
    clearance: ['Clearance', 'A piece gets out of the way to open a line or square for another.', 'clearances', 'clear a line against you'],
    deflection: ['Deflection', 'A defender is lured away from the square it was guarding.', 'deflections', 'deflect your defenders'],
    hanging: ['Hanging piece', 'A piece was left undefended and could simply be taken.', 'hanging pieces', 'take your hanging pieces'],
    castling: ['Castling', 'Castling is the key move.', 'castling at the key moment', 'castle at the key moment'],
    discovered: ['Discovered attack', 'Moving one piece uncovers an attack by another.', 'discovered attacks', 'hit you with a discovered attack'],
    fork: ['Fork', 'One piece attacks two or more targets at once.', 'forks', 'fork you'],
    skewer: ['Skewer', 'A valuable piece is attacked, moves away, and the piece behind it falls.', 'skewers', 'skewer you'],
  };
  const CTX = new Set(['defensive', 'exposed', 'kingside', 'rookEnd', 'bishopEnd']);      // board situations, not tactics: never picked as your best or worst tactic
  const TAC_TIP = Object.fromEntries(Object.entries(TAC).map(([k, v]) => [k, v[1]]));
  const TLET = Object.fromEntries(Object.entries(TAC).map(([k, v]) => [k, v[3]]));
  const TNAME = Object.fromEntries(Object.entries(TAC).map(([k, v]) => [k, v[2]]));
  // which side "yours" and "theirs" mean for each pawn structure, in plain words
  const SIDE = {
    "Isolated queen's pawn": ['you had the isolated pawn', 'you played against it'],
    'Carlsbad': ['you faced the minority attack', 'you had the minority attack'],
    'Open Sicilian': ['you were the Sicilian side', 'you played against the Sicilian'],
    'French Advance chain': ['you had the e5 pawn chain', 'you attacked the chain'],
    'Caro-Kann and Scandinavian centre': ['you had the c- and e-pawns', 'you played against them'],
    'Scotch and Philidor centre': ['you had the e-pawn', 'you had the d-pawn'],
    "Queen's pawn centre": ['you were White', 'you were Black'],
    'e4 v e5 centre': ['you were White', 'you were Black'],
    'Open e-file': ['you were White', 'you were Black'],
    'Open centre': ['you were White', 'you were Black'],
    'Slav formation': ['you had the Slav pawns', 'you played against them'],
    "King's Indian centre": ["you had the King's Indian pawns", 'you played against them'],
    'Benoni': ['you had the Benoni pawns', 'you played against them'],
    'Stonewall': ['you had the Stonewall', 'you played against it'],
    'Hedgehog': ['you had the Hedgehog', 'you played against it'],
    'Maroczy bind': ['you had the bind', 'you played against it'],
    'Hanging pawns': ['you had the hanging pawns', 'you played against them'],
  };
  // what each structure is, on hover
  const STRUCT_TIP = { "Isolated queen's pawn": 'A d-pawn with no pawns of its own colour on the c- or e-file.', 'Carlsbad': "The Queen's Gambit Exchange pawns: one side can push b4 and b5 against the c6 pawn.",
    'Open Sicilian': 'White has the e-pawn and no d-pawn; Black has the d- and e-pawns and no c-pawn.', 'French Advance chain': "White pawns on d4 and e5 against Black's d5 and e6.",
    "King's Indian centre": "White pawns on d5 and e4 against Black's d6 and e5.", 'Benoni': 'White has a pawn on d5; Black has c5 and d6 and no e-pawn.', 'Stonewall': 'Pawns on c3, d4, e3 and f4 (or the same for Black).',
    'Hedgehog': 'Black pawns on a6, b6, d6 and e6 against White pawns on c4 and e4.', 'Maroczy bind': 'White pawns on c4 and e4 against a Black side with no c-pawn.', 'Slav formation': 'Black pawns on c6, d5 and e6 against White pawns on d4 and c4 or e3.',
    'Hanging pawns': 'Two pawns side by side on c4 and d4 (or c5 and d5) with no pawns beside them.', 'Caro-Kann and Scandinavian centre': 'White keeps the d-pawn but not the e-pawn; Black keeps the c- and e-pawns but not the d-pawn.',
    'Scotch and Philidor centre': 'White keeps the e-pawn but not the d-pawn; Black keeps the d- and c-pawns but not the e-pawn.', "Queen's pawn centre": 'White pawns on d4 and e3 against Black pawns on d5 and e6.',
    'e4 v e5 centre': 'Pawns on e4 and e5 with both d-pawns still on the board, as in the Italian and the Ruy Lopez.', 'Open e-file': 'Both e-pawns are gone and both d-pawns remain, so the e-file is open.',
    'Open centre': 'No d- or e-pawns left on either side: open lines and piece play.' };
  const sideWords = (k, side) => (SIDE[k] || ['the structure was yours', 'you played against it'])[side === 'y' ? 0 : 1];
  const sorted = a => a.slice().sort((x, y) => (x.rank || 0) - (y.rank || 0));

  // ── the stat items, by phase ──
  function phaseItems(Q, Y, W, tip, rows, open) {
    const M = Q.M, out = { Opening: [], Middle: [], Endgame: [], Clock: [], Profile: [], Insights: [] }, push = (ph, it) => out[ph].push(it);
    const gl = (games, what) => games.slice(0, 5).map(g => `<div class="sk-g"><a href="${W.game(g.g)}" target="_blank" rel="noopener">${esc(g.u)}</a><span>${what(g)}</span></div>`).join('');
    // Opening
    if (Q.lines.length) { const L = Q.lines[0], t = L.ev <= -.3 ? 'down' : '';
      push('Opening', { k: 'o-lines', tone: t, rank: t ? 1 : 9, head: `Your weakest line is ${b(esc(L.name))} as ${L.c === 'w' ? 'White' : 'Black'}: after move 15 you are usually ${b(Math.abs(L.ev) < .3 ? 'about level' : Math.abs(L.ev).toFixed(1) + ' pawns ' + (L.ev > 0 ? 'up' : 'down'), t)}.`, title: 'Lines that went wrong early',
        body: tbl(['Games', 'Move 15'], Q.lines.slice(0, 6).map(l => [`${esc(l.name)}, ${l.c === 'w' ? 'W' : 'B'}`, fmt(l.n), [(l.ev > 0 ? '+' : '') + l.ev.toFixed(1), l.ev <= -.3 ? 'down' : l.ev >= .3 ? 'up' : '']])), tip: t ? tip('lines') : '' }); }
    if (Y && Y.prin.n >= 5) { const names = ['moved a piece twice', 'brought the queen out early', 'grabbed a pawn behind in development', 'had not castled by move 10'], i = Y.prin.c.indexOf(Math.max(...Y.prin.c)), sw = share(Y.prin.c[i], Y.prin.n), sa = share(Y.prin.all[i], Y.n), t = toneOf(sw, sa, 10, false);
      push('Opening', { k: 'o-prin', tone: t, rank: t ? 2 : 9, head: `When the opening went wrong you ${names[i]} in ${b(P0(sw), t)} of those games, against ${P0(sa)} overall.`, title: 'Opening rules you broke',
        body: tbl(['Wrong', 'All'], names.map((nm, j) => [nm[0].toUpperCase() + nm.slice(1), P0(share(Y.prin.c[j], Y.prin.n)), P0(share(Y.prin.all[j], Y.n))])), tip: t === 'down' ? tip('prin') : '' }); }
    // Middle
    if (M.convert) { const t = SKv(M.convert.rel);
      const bp = Y ? Y.bp : null, tw = Y ? Y.trade : null, pcs = a => a[0] + a[1] ? P0(share(a[0], a[0] + a[1])) : '–';
      push('Profile', { k: 'm-conv', tone: t, rank: t === 'down' ? 1 : 9, head: `You won ${b(P0(M.convert.you), t)} of your winning positions. Typical is ${P0(M.convert.typ)}.`, title: 'Converting wins',
        body: (bp && bp.opening + bp.middle + bp.endgame ? `<p>Where the wins that got away were first won:</p>` + tbl(['Games'], [['Opening', fmt(bp.opening)], ['Middlegame', fmt(bp.middle)], ['Endgame', fmt(bp.endgame)]]) : '')
          + (tw && tw.won[0] + tw.won[1] + tw.not[0] + tw.not[1] ? `<p>Trades once you were 2 pawns up, share that were pieces:</p>` + tbl(['Pieces'], [['Games you won', pcs(tw.won)], ['Games you did not', pcs(tw.not)]]) : '') + gl(Q.blown, g => g.r === 'd' ? 'drew' : g.time ? 'lost on time' : 'lost'), tip: t === 'down' ? tip('convert') : '' }); }
    if (Y) {
      const T = Y.tac, gaps = Object.keys(T).filter(k => T[k].me[1] >= 10 && T[k].th[1] >= 10).map(k => ({ k, me: share(...T[k].me), th: share(...T[k].th) })).map(o => ({ ...o, d: o.me - o.th })).sort((a, b) => a.d - b.d);
      const tabT = two(['You found', 'They found'], Object.keys(T).filter(k => T[k].me[1] + T[k].th[1]).map(k => { const me = share(...T[k].me), th = share(...T[k].th), t = T[k].me[1] >= 10 && T[k].th[1] >= 10 ? toneOf(me, th) : ''; return [TNAME[k][0].toUpperCase() + TNAME[k].slice(1), [P0(me), T[k].me[1], t], [P0(th), T[k].th[1], '']]; }));
      const w = gaps[0], s = gaps[gaps.length - 1];
      if (w && w.d <= -5) push('Insights', { k: 'm-tacw', tone: 'down', rank: 2, head: `You find ${TNAME[w.k]} less often than your opponents: ${b(P0(w.me), 'down')} against ${P0(w.th)}.`, title: 'Tactics on the board', body: tabT + '<p>Share of the chances each side had that were taken, then how many chances.</p>', tip: tip(w.k) });
      if (s && s.d >= 5) push('Insights', { k: 'm-tacs', tone: 'up', rank: 5, head: `You find ${TNAME[s.k]} more often than your opponents: ${b(P0(s.me), 'up')} against ${P0(s.th)}.`, title: 'Tactics on the board', body: w && w.d <= -5 ? '' : tabT });
      if (Y.hid.mn >= 10 && Y.hid.tn >= 10) { const me = Y.hid.me.map(v => share(v, Y.hid.mn)), th = Y.hid.th.map(v => share(v, Y.hid.tn)), d = me.map((v, j) => v - th[j]), i = d.indexOf(Math.max(...d)), t = toneOf(me[i], th[i], 5, false) === 'down' ? 'down' : '';
        push('Middle', { k: 'm-hid', tone: t, rank: t ? 4 : 9, head: `${HIDE_NAMES[i]}s are ${b(P0(me[i]), t)} of the moves you miss. Your opponents: ${P0(th[i])}.`, title: 'How missed moves were hidden',
          body: tbl(['You', 'Opp.'], HIDE_NAMES.map((nm, j) => [`<span class="tip" title="${esc(HIDE_TIP[nm])}">${nm}</span>`, [P0(me[j]), toneOf(me[j], th[j], 5, false)], P0(th[j])])), tip: t === 'down' ? tip('hidden') : '' }); }
      const mm = Y.mm; if (mm.me[0] + mm.th[0] + mm.me[1] + mm.th[1] >= 3) { const t = mm.me[0] > mm.th[0] * 1.4 + 1 ? 'down' : mm.th[0] > mm.me[0] * 1.4 + 1 ? 'up' : '';
        push('Profile', { k: 'm-mate', tone: t, rank: t === 'down' ? 3 : 9, head: `You missed forced mates ${t === 'down' ? 'more often than' : t === 'up' ? 'less often than' : 'about as often as'} your opponents: in ${b(fmt(mm.me[0]) + ' game' + (mm.me[0] === 1 ? '' : 's'), t)}, against ${fmt(mm.th[0])} for them.`, title: 'Mates', body: tbl(['You', 'Opp.'], [['Missed a forced mate', fmt(mm.me[0]), fmt(mm.th[0])], ['Walked into mate', fmt(mm.me[1]), fmt(mm.th[1])]]), tip: t === 'down' ? tip('mates') : '' }); }
      const PO = Y.pos; if (PO && PO.mn >= 10) { const names = typeof CRS_SX !== 'undefined' ? CRS_SX.POS : [], me = PO.me.map(v => share(v, PO.mn)), th = PO.me.map((v, j) => share(PO.th[j], PO.tn || 1)), i = me.indexOf(Math.max(...me)), t = toneOf(me[i], th[i], 5, false) === 'down' ? 'down' : '';
        push('Middle', { k: 'm-pos', tone: '', rank: 9, title: 'Positional themes', head: posMine(names[i], me[i]),
          body: tbl(['You', 'Opp.'], names.map((nm, j) => [`<span class="tip" title="${esc(POS_TIP[nm] || '')}">${nm}</span>`, [P0(me[j]), toneOf(me[j], th[j], 5, false) === 'down' ? 'down' : ''], P0(th[j])])).replace('grid-template-columns:1fr 34px 34px', 'grid-template-columns:1fr 30px 30px')
            + `<p>Mistakes with no tactic behind them (${fmt(PO.mn)} of yours, ${fmt(PO.tn)} of your opponents'), and what each one gave away: a weakness in your camp or something your opponent gained. Hover over a theme for what it means. Orange: 5 points more often than your opponents.</p>` }); }
      const SX = Object.entries(Y.sx).map(([k, o]) => ({ k, ...o })).filter(o => o.y.n + o.t.n >= 5);
      if (SX.length) { const total = Y.n || 1, sc = o => share(o.pts, o.n), ex = o => share(o.exp, o.n), L = SX.map(o => ({ k: o.k, n: o.y.n + o.t.n, pts: o.y.pts + o.t.pts, exp: o.y.exp + o.t.exp, y: o.y, t: o.t })).sort((p, q) => q.n - p.n);
        const tn = o => o.n >= 8 ? toneOf(sc(o), ex(o), 10) : '', ok = L.filter(o => o.n >= 8).sort((p, q) => (sc(p) - ex(p)) - (sc(q) - ex(q))), worst = ok[0], best = ok[ok.length - 1], t = worst ? tn(worst) : '';
        let extra = ''; const cb = Y.sx.Carlsbad; if (cb && Object.keys(cb.plan).length) extra += `<p>Carlsbad, when you had the minority attack, by the plan you chose:</p>` + tbl(['Games', 'Score'], Object.entries(cb.plan).map(([p, v]) => [p === 'minority' ? 'Minority attack (b-pawn push)' : p === 'e4' ? 'Central break with e4' : 'Neither plan', fmt(v.n), P0(share(v.pts, v.n))]));
        const iq = Y.sx["Isolated queen's pawn"]; if (iq && iq.q[0][0] + iq.q[1][0]) extra += `<p>With the isolated pawn, queens on ${P0(share(iq.q[0][1], iq.q[0][0] || 1))} (${iq.q[0][0]}), queens off ${P0(share(iq.q[1][1], iq.q[1][0] || 1))} (${iq.q[1][0]}).</p>`;
        if (iq && iq.blk[0]) extra += `<p>Against it, you blockaded the pawn in ${iq.blk[1]} of ${iq.blk[0]} games.</p>`;
        const side = (o, w) => o[w].n ? `${sideWords(o.k, w).replace(/^you /, '')} ${P0(sc(o[w]))} (exp. ${P0(ex(o[w]))}, ${o[w].n})` : '';
        push('Middle', { k: 'm-sx', tone: t, rank: t === 'down' ? 5 : 9, title: 'Pawn structures',
          head: worst && t === 'down' ? `In the ${b(esc(worst.k), 'down')} you score ${P0(sc(worst))} against an expected ${P0(ex(worst))} (${worst.n} games): the position was fine when you got there, the play after went wrong.` + (best && best !== worst && tn(best) === 'up' ? ` You do best in the ${b(esc(best.k), 'up')}: ${P0(sc(best))} against ${P0(ex(best))}.` : '')
            : best && tn(best) === 'up' ? `You do best in the ${b(esc(best.k), 'up')} structure: ${P0(sc(best))} against an expected ${P0(ex(best))} (${best.n} games).` : `In your pawn structures you score about what the positions deserved.`,
          body: `<div class="sxr h"><span>Structure</span><small>Games</small><b>Score</b><small>Expected</small></div>` + L.map(o => `<div class="sxr"><span class="tip" title="${esc(STRUCT_TIP[o.k] || '')}">${esc(o.k)}</span><small>${o.n} · ${P0(share(o.n, total))}</small><b class="${tn(o)}">${P0(sc(o))}</b><small>${P0(ex(o))}</small></div><div class="sxs">${[side(o, 'y'), side(o, 't')].filter(Boolean).map(x => x[0].toUpperCase() + x.slice(1)).join(' · ')}</div>`).join('')
            + `<p>The pawn structure each game spent longest in, from move 12 to 40. Games: how many and what share of your ${fmt(total)} analysed games. Score: your result, a draw counting as half. Expected: the engine's winning chances for you when the structure first appeared, so a score well below it means the trouble came after. Green or orange: 8 games or more and 10 points from expected. Hover a name for what it is.</p>` + extra,
          tip: t === 'down' ? tip(worst.k === 'Carlsbad' ? 'carlsbad' : worst.k === "Isolated queen's pawn" ? 'iqp' : 'struct') : '' }); }
    }
    // Endgame
    if (Y && Y.egCat.length) { const tot = Y.egCat.reduce((s, c) => ({ n: s.n + c.n, pts: s.pts + c.pts }), { n: 0, pts: 0 });
      const cands = Y.egCat.filter(c => c.n >= 15 && tot.n - c.n >= 15).map(c => ({ ...c, sc: share(c.pts, c.n), rest: share(tot.pts - c.pts, tot.n - c.n) })).sort((a, b) => (a.sc - a.rest) - (b.sc - b.rest));
      const w = cands[0], t = w ? toneOf(w.sc, w.rest, 8) : '';
      push('Endgame', { k: 'e-cat', tone: t, rank: t === 'down' ? 2 : 9, head: w ? egLine(w.k, w.sc, w.rest, w.n, t) : `You reached ${fmt(tot.n)} endgames.`, title: 'By material',
        body: tbl(['Games', 'Score'], Y.egCat.map(c => [esc(c.k), fmt(c.n), P0(share(c.pts, c.n))])), tip: t === 'down' ? tip(w.k === 'Rook' ? 'rook' : 'egtype') : '' }); }
    if (Y && Y.egPair.length) { const L = Y.egPair.slice(0, 9), rows = L.map(c => ({ ...c, sc: share(c.pts, c.n), ex: share(c.exp, c.n) })), w = rows.filter(c => c.n >= 15).sort((a, b) => (a.sc - a.ex) - (b.sc - b.ex))[0], t = w ? toneOf(w.sc, w.ex, 6) : '';
      push('Endgame', { k: 'e-pair', tone: t, rank: t === 'down' ? 1 : 9, head: w ? `${esc(w.k)}: you score ${b(P0(w.sc), t)} against an expected ${P0(w.ex)} in ${w.n} games.` : 'Your pieces against theirs', title: 'Your pieces against theirs',
        body: rows.map(c => bar(esc(c.k), String(c.n), `exp. ${P0(c.ex)}`, c.sc, c.ex, c.n >= 15 ? toneOf(c.sc, c.ex, 6) : '')).join('') + '<p>Each row is the material when the endgame began: your pieces, then theirs (Q queen, R rook, B bishop, N knight, P pawns only). The small number is games. The bar is your score. The white tick is the score the engine expected from those positions, so a bar that stops short of the tick means you scored less than the positions deserved. Under 15 games stays grey.</p>', tip: t === 'down' ? tip('pair') : '' }); }
    { const E = Q.endB; if (E && E.up.n >= 8) { const me = share(E.up.w, E.up.n), them = E.down.n >= 8 ? share(E.down.l, E.down.n) : null, t = them == null ? '' : toneOf(me, them, 5);

      push('Endgame', { k: 'e-win', tone: t, rank: t === 'down' ? 3 : t === 'up' ? 6 : 9, head: `From a better endgame you win ${b(P0(me), t)}.${them == null ? '' : ` Your opponents win ${P0(them)} from the same edge.`}`, title: 'Endgame win %',
        body: tbl(['Won', 'Drew', 'Lost', 'Win'], [['From better', E.up], ['From equal', E.even], ['From worse', E.down]].map(([nm, o]) => [nm, fmt(o.w), fmt(o.d), fmt(o.l), o.n ? P0(share(o.w, o.n)) : '–'])) + '<p>Better or worse means a pawn or more up or down when the endgame began.</p>', tip: t === 'down' ? tip('better') : '' }); } }
    if (Y) { const K = Y.kr, names = { philidor: 'Philidor draw', vancura: 'Vancura draw', lucena: 'Lucena win', cutoff: 'King cut off, win' }, miss = Object.values(K).reduce((s, v) => s + v[1], 0), got = Object.values(K).reduce((s, v) => s + v[0], 0);
      if (miss + got) { const t = miss > got ? 'down' : miss === 0 ? 'up' : '';
        push('Endgame', { k: 'e-known', tone: t, rank: t === 'down' ? 2 : 8, head: miss ? `You let ${b(fmt(miss) + ' textbook rook ending' + (miss === 1 ? '' : 's'), t)} go, and held or won ${fmt(got)}.` : `You held or won all ${fmt(got)} textbook rook endings you reached.`, title: 'Known rook endings',
          body: tbl(['Got it', 'Missed'], Object.entries(K).map(([k, v]) => [names[k], fmt(v[0]), [fmt(v[1]), v[1] ? 'down' : '']])), tip: t === 'down' ? tip('known') : '' }); }
      const R = Y.ra; if (R.lost[0] + R.lost[1] >= 15) { const p = share(R.lost[1], R.lost[0] + R.lost[1]), pw = R.won[0] + R.won[1] ? share(R.won[1], R.won[0] + R.won[1]) : null, t = pw == null ? '' : toneOf(p, pw, 10, false);
        push('Endgame', { k: 'e-rook', tone: t, rank: t === 'down' ? 4 : 9, head: `In rook endings you lost, your rook started passive ${b(P0(p), t)} of the time${pw == null ? '' : `, against ${P0(pw)} in the ones you won`}.`, title: 'Active or passive rook',
          body: tbl(['Lost', 'Won'], [['Rook active', fmt(R.lost[0]), fmt(R.won[0])], ['Rook passive', fmt(R.lost[1]), fmt(R.won[1])]]), tip: t === 'down' ? tip('active') : '' }); }
    }
    // Clock
    if (M.timeloss) { const t = SKv(M.timeloss.rel), row = (l, m, d = 0) => M[m] ? [l, [M[m].you.toFixed(d) + '%', SKv(M[m].rel) === 'down' ? 'down' : ''], M[m].typ.toFixed(d) + '%'] : null;
      push('Clock', { k: 'c-time', tone: t, rank: t === 'down' ? 1 : 9, head: `You lost on time in ${b(P0(M.timeloss.you), t)} of games. Typical is ${P0(M.timeloss.typ)}.`, title: 'Clock', body: tbl(['You', 'Typical'], [row('Lost on time', 'timeloss'), row('Games under 15 s', 'low'), row('Clock at move 20', 'clock20')].filter(Boolean)), tip: t === 'down' ? tip('clock') : '' }); }
    if (Y && Y.ct.me[1] >= 20 && Y.ct.me[3] >= 20) { const c = Y.ct.me[0] / Y.ct.me[1], q = Y.ct.me[2] / Y.ct.me[3], oc = Y.ct.th[1] ? Y.ct.th[0] / Y.ct.th[1] : null, oq = Y.ct.th[3] ? Y.ct.th[2] / Y.ct.th[3] : null, ratio = c / (q || 1), oratio = oc != null && oq ? oc / oq : null, t = oratio == null ? '' : ratio < oratio * .85 ? 'down' : ratio > oratio * 1.15 ? 'up' : '';
      const slow = (x, y) => { const p = Math.round(100 * (x / (y || 1) - 1)); return p > 2 ? `slow down by ${p}%` : p < -2 ? `speed up by ${-p}%` : `do not slow down`; };
      push('Clock', { k: 'c-crit', tone: t, rank: t === 'down' ? 2 : 9, head: `On critical moves, where a check, capture or promotion is best or the position just swung, you take ${b(c.toFixed(1) + ' s', t)}, against ${q.toFixed(1)} s on quiet moves, so you ${slow(c, q)} when it matters.${oratio == null ? '' : ` Your opponents ${slow(oc, oq)} (${oc.toFixed(1)} s against ${oq.toFixed(1)} s).`}`, title: 'Time where it matters',
        body: tbl(['You', 'Opp.'], [['Critical moves', c.toFixed(1) + ' s', oc == null ? '–' : oc.toFixed(1) + ' s'], ['Quiet moves', q.toFixed(1) + ' s', oq == null ? '–' : oq.toFixed(1) + ' s']]) + '<p>A critical move is one where the best move is a check, capture or promotion, or the evaluation just swung.</p>', tip: t === 'down' ? tip('crit') : '' }); }
    if (M.clock20) { const t = SKv(M.clock20.rel);
      push('Clock', { k: 'c-20', tone: t, rank: t === 'down' ? 2.5 : 9, head: `You reach move 20 with ${b(P0(M.clock20.you), t)} of your clock left. Typical is ${P0(M.clock20.typ)}.${t === 'down' ? ' The time goes in the opening, so play your first moves faster.' : ''}`, title: 'Clock at move 20',
        body: '<p>The share of your starting time still on your clock when you reach move 20, against players your rating.</p>', tip: t === 'down' ? tip('opening') : '' }); }
    { const T = Q.think, N = T.n, rate = (x, n) => n ? 100 * x / n : 0, r = [rate(T.fast, N[0]), rate(T.mid, N[1]), rate(T.slow, N[2])];
      if (T.g >= (typeof CRS_SK !== 'undefined' ? CRS_SK.MIN_GAMES : 30) && r[1] > 0) { const fx = N[0] >= 100 ? r[0] / r[1] : 0, sx = N[2] >= 40 ? r[2] / r[1] : 0, x = v => v.toFixed(1) + '×', p = v => v.toFixed(1);
        const rush = fx >= 1.4 && fx >= sx, long = !rush && sx >= 1.4, t = rush || long ? 'down' : '';
        const head = rush ? `You make more big mistakes when you rush: moves played in under 3 seconds go badly wrong ${b(x(fx), 'down')} as often as moves you spend 3 to 20 seconds on (${p(r[0])} against ${p(r[1])} per 100 moves).`
          : long ? `Long thinks do not help you: after 20 seconds or more you make a big mistake ${b(x(sx), 'down')} as often as on 3 to 20 second moves (${p(r[2])} against ${p(r[1])} per 100 moves).`
          : fx && fx < .8 ? `Moving fast does not cost you: moves under 3 seconds go badly wrong less often than your 3 to 20 second moves (${p(r[0])} against ${p(r[1])} per 100 moves).` : fx ? `Rushing does not cost you: moves under 3 seconds go badly wrong about as often as your 3 to 20 second moves (${p(r[0])} against ${p(r[1])} per 100 moves).` : '';
        if (head) push('Clock', { k: 'c-think', tone: t, rank: t ? 2.2 : 9, head, title: 'Think time and big mistakes',
          body: tbl(['Moves', 'Big', 'Per 100'], [['Under 3 s', N[0], T.fast, r[0]], ['3 to 20 s', N[1], T.mid, r[1]], ['20 s or more', N[2], T.slow, r[2]]].map(([l, n, bb, v]) => [l, fmt(n), fmt(bb), n ? v.toFixed(1) : '–'])) + '<p>Big is a big mistake: a move that throws away a large share of your winning chances. Per 100 is how many of every 100 moves at that speed were big mistakes.</p>', tip: t ? tip('think') : '' }); } }
    if (Q.aheadT.length) push('Clock', { k: 'c-ahead', tone: 'down', rank: 3, head: `${b(P0(share(Q.aheadT.length, Q.me.lostT)), 'down')} (${fmt(Q.aheadT.length)} of ${fmt(Q.me.lostT)}) of your losses on time came when you were a pawn or more ahead.`, title: 'Lost on time while ahead', body: gl(Q.aheadT, () => 'lost on time'), tip: tip('ahead') });
    if (Y && Y.losses >= 10) { const order = [['clock', 'Clock'], ['late mate', 'Mated after move 40'], ['early mate', 'Mated before move 40'], ['opening', 'Opening collapse'], ['middle', 'Middlegame collapse'], ['endgame', 'Endgame collapse'], ['other', 'Other']], top = order.slice().sort((a, b) => (Y.tm[b[0]] || 0) - (Y.tm[a[0]] || 0))[0];
      push('Clock', { k: 'c-loss', tone: '', rank: .5, head: `${b(top[1])} decides the most of your losses: ${fmt(Y.tm[top[0]] || 0)} of ${fmt(Y.losses)}.`, title: 'How your losses happened',
        body: tbl(['Games', 'Share'], order.filter(([k]) => Y.tm[k]).map(([k, nm]) => [nm, fmt(Y.tm[k]), P0(share(Y.tm[k], Y.losses))])) + '<p>Each loss counted once, by what decided it. A collapse is the move where a level game turned lost.</p>', tip: '' }); }
    for (const ph in out) out[ph] = sorted(out[ph]);
    return out;
  }
  const SKv = rel => { const v = typeof CRS_SK !== 'undefined' ? CRS_SK.verdict(rel) : 'level'; return v === 'behind' ? 'down' : v === 'ahead' ? 'up' : ''; };
  const SUM = { Opening: 'opening', Middle: 'middlegame', Endgame: 'endgame', Clock: 'clock' };
  // the Skills tab body for one phase: a summary line, the skill bars that belong there, then the insight rows
  // the openings table at the top of Skills › Opening: one row per opening, games, win %, score; tap a row for its games
  function openings(rows, W, open, side) {
    if (!rows || !rows.length) return '';
    const pts = r => r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0, pick = rows.filter(r => r.op && (side === 'all' || r.c === side));
    const ref = pick.length ? 100 * pick.reduce((t, r) => t + pts(r), 0) / pick.length : 50, ops = {};
    for (const r of pick) { const o = ops[r.op] || (ops[r.op] = { name: r.op, n: 0, w: 0, d: 0, l: 0, g: [] }); o.n++; o[r.r]++; o.g.push(r); }
    const sortedOps = Object.values(ops).sort((a, b) => b.n - a.n), L = sortedOps.filter(o => o.n >= 5), cut = sortedOps.filter(o => o.n < 5), word = side === 'w' ? ' as White' : side === 'b' ? ' as Black' : '';
    const pctS = a => a.length ? 100 * a.reduce((t, r) => t + pts(r), 0) / a.length : null;
    const detail = o => { const g = o.g, Wg = g.filter(r => r.c === 'w'), Bg = g.filter(r => r.c === 'b'), ev = g.filter(r => r.x && r.x[13] != null), e15 = ev.length ? ev.reduce((t, r) => t + r.x[13], 0) / ev.length / 100 : null, early = g.filter(r => r.x && r.x[4] > 0 && r.x[4] <= 15).length;
      const kv = (k, v) => `<div class="okv"><span>${k}</span><b>${v}</b></div>`;
      return `<div class="ps-m od">${side === 'all' ? kv('As White', Wg.length ? `${P0(pctS(Wg))} (${Wg.length})` : 'not played') + kv('As Black', Bg.length ? `${P0(pctS(Bg))} (${Bg.length})` : 'not played') : ''}${kv('After move 15 you are', e15 == null ? 'not known' : Math.abs(e15) < .25 ? 'about level' : `${Math.abs(e15).toFixed(1)} pawns ${e15 > 0 ? 'up' : 'down'}`)}${kv('First big mistake by move 15', `${early} of ${g.length} games`)}${(() => { const h = habitRates(g); if (h.n < 3) return ''; const u = h.list[0], m = h.list[1]; return kv('Still uncastled after move 12', `${u.me} of ${h.n} (opp. ${u.th})`) + kv('2+ minor pieces at home, move 12', `${m.me} of ${h.n} (opp. ${m.th})`); })()}<div class="sk-gl">Latest games</div>${g.slice().sort((x, y) => y.t - x.t).slice(0, 5).map(r => `<div class="sk-g"><a href="${W.game(r.id)}" target="_blank" rel="noopener">${esc(r.u)}</a><span>${side === 'all' ? (r.c === 'w' ? 'White, ' : 'Black, ') : ''}${r.r === 'w' ? 'won' : r.r === 'd' ? 'drew' : 'lost'}</span></div>`).join('')}</div>`; };
    const row = o => { const sc = 100 * (o.w + o.d / 2) / o.n, wr = 100 * o.w / o.n, t = o.n >= 5 ? toneOf(sc, ref, 5) : '', k = 'op|' + side + '|' + o.name, op = open.has(k);
      return `<button type="button" class="opr" data-tg="${esc(k)}" aria-expanded="${op}"><span title="${esc(o.name)}">${esc(o.name)}</span><small>${o.n}</small><small>${P0(wr)}</small><b class="${t}">${P0(sc)}</b></button>`
        + (op ? detail(o) : ''); };
    const tbl0 = `<div class="st-opts" role="radiogroup" aria-label="Colour">${[['all', 'All'], ['w', 'As White'], ['b', 'As Black']].map(([k, t]) => `<button type="button" role="radio" data-side="${k}" aria-checked="${side === k}">${t}</button>`).join('')}</div>`
      + `<div class="opr h"><span></span><small>Games</small><small>Win</small><b>Score</b></div>` + (L.length ? L.map(row).join('') : `<p class="st-sub">No games${word} in this range.</p>`)
      + `<p>Every opening you played 5 times or more${word}${cut.length ? ` (${cut.length} others with fewer games, ${cut.reduce((t, o) => t + o.n, 0)} games, are left out)` : ''}. Tap one to see where it goes wrong. Score counts a draw as half. Green and orange: 5 points better or worse than the ${P0(ref)} you score${word} overall.</p>`;
    const top = sortedOps[0], ok = L.filter(o => o.n >= 5).map(o => ({ ...o, sc: 100 * (o.w + o.d / 2) / o.n })), hi = ok.slice().sort((a, b) => b.sc - a.sc)[0], lo = ok.slice().sort((a, b) => a.sc - b.sc)[0];
    const head = !top ? `No games${word} in this range.` : hi && lo && hi !== lo ? `You do best in the ${b(esc(hi.name), toneOf(hi.sc, ref, 5))} (${P0(hi.sc)}) and worst in the ${b(esc(lo.name), toneOf(lo.sc, ref, 5))} (${P0(lo.sc)}).` : `Your openings${word}.`;
    return { k: 'o-ops', tone: '', rank: 0, title: 'Openings', head, body: tbl0 };
  }
  function habitItem(rows, tip) { const h = habitRates(rows); if (h.n < 10) return null;
    const w = h.list.filter(x => x.pm - x.pt >= 10 && x.me - x.th >= 3).sort((a, b) => (b.pm - b.pt) - (a.pm - a.pt))[0], g = h.list.filter(x => x.pt - x.pm >= 10 && x.th - x.me >= 3).sort((a, b) => (b.pt - b.pm) - (a.pt - a.pm))[0];
    const head = w ? `In your openings you ${w.line} in ${b(P0(w.pm), 'down')} of games (${w.me} of ${h.n}). Your opponents: ${P0(w.pt)}.` : g ? `Your development is cleaner than your opponents': they ${g.line.replace('your queen', 'their queen')} in ${P0(g.pt)} of games, you in ${b(P0(g.pm), 'up')}.` : `Your opening habits match your opponents' in the same games.`;
    return { k: 'o-habits', tone: w ? 'down' : g ? 'up' : '', rank: w ? 1.2 : 8, title: 'Opening habits', head,
      body: `<div class="opr h"><span></span><small>You</small><small>Opp.</small></div>` + h.list.map(x => `<div class="opr wr"><span>${x.label}</span><small class="${x.pm - x.pt >= 10 && x.me - x.th >= 3 ? 'down' : x.pt - x.pm >= 10 && x.th - x.me >= 3 ? 'up' : ''}">${P0(x.pm)}</small><small>${P0(x.pt)}</small></div>`).join('')
        + `<p>Measured in every game that reached move 12 (${fmt(h.n)}), for you and your opponent in the same game. Orange or green: 10 points or more, and 3 games or more, worse or better than your opponents.</p>`, tip: w ? tip('develop') : '' }; }
  function skills(Q, Y, W, phase, open, skItems, rows, side) {
    const used = new Set(), tip = tipFn(used, open), base = phaseItems(Q, Y, W, tip, rows, open)[phase] || [];
    const extra = (skItems || []).filter(x => x.phase === phase).map(x => ({ ...x, rank: x.tone === 'down' ? 1.5 : 8, tip: x.tone === 'down' ? tip(x.tipKey) : '' }));
    const items = sorted(base), lead = sorted(extra);
    // the summary line only when no weakness row is there to say it (user, 2026-11-07: never the same insight twice)
    const sum = '';      // C1 removed (user, 2026-11-09)
    const ops = phase === 'Opening' && rows && rows.length ? [openings(rows, W, open, side || 'all'), habitItem(rows, tip)].filter(Boolean) : [];
    return `${sum}<div class="si-body">${lead.concat(ops, items).map(it => item(open, it)).join('') || '<p class="st-sub">Not enough games for this phase yet.</p>'}</div>`;
  }
  // ---- next (2026-11-10): numbers on any set of rows, kept per set so repaints stay fast
  const MEMO = new Map();
  function metrics(R, bench) {
    if (!R || R.length < 30 || typeof CRS_SK === 'undefined' || typeof CRS_SX === 'undefined') return null;
    const key = R.length + '|' + R[0].id + '|' + R[R.length - 1].id; if (MEMO.has(key)) return MEMO.get(key);
    let q = null, y = null; try { q = CRS_SK.report(R, bench); y = CRS_SX.summarize(R); } catch (e) { q = null; }
    const pts = r => r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0, sc = a => a.length ? 100 * a.reduce((t, r) => t + pts(r), 0) / a.length : null, lg = R.filter(r => r.x && r.x[14] > 80);
    const m = !q ? null : { n: R.length, from: R[R.length - 1].t, to: R[0].t, rt: q.rating,
      score: [sc(R), R.length], endgame: [sc(lg), lg.length], tactics: [y && y.tacN ? share(...y.tacN.me) : null, y && y.tacN ? y.tacN.me[1] : 0],
      convert: [share(q.me.conv, q.me.reach), q.me.reach], saved: [share(q.me.saved, q.me.worse), q.me.worse], timeloss: [share(q.me.lostT, q.me.g), q.me.g],
      clock20: [share(q.me.s20, q.me.s20n), q.me.s20n], big: [q.me.moves ? 100 * q.me.big / q.me.moves : null, q.me.moves] };
    if (MEMO.size > 40) MEMO.clear(); MEMO.set(key, m); return m;
  }
  const DAY = t => new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  // 2B What changed: your newer half of games against your older half (nothing from past searches is saved)
  const CHG = [['score', 'Score', true, 5], ['endgame', 'Score in long games (over 40 moves)', true, 5], ['tactics', 'Tactics found', true, 5], ['convert', 'Winning positions won', true, 5], ['saved', 'Lost positions saved', true, 5], ['timeloss', 'Games lost on time', false, 4], ['clock20', 'Clock left at move 20', true, 5], ['big', 'Big mistakes per 100 moves', false, .5]];
  function changed(rows, bench) {
    if (!rows || rows.length < 60) return '';
    const R = rows.slice().sort((a, b) => b.t - a.t), h = Math.floor(R.length / 2), a = metrics(R.slice(0, h), bench), o = metrics(R.slice(h), bench); if (!a || !o) return '';
    const f = (k, v) => v == null ? '–' : k === 'big' ? v.toFixed(1) : P0(v), ch = [], st = [];
    for (const [k, nm, hi, gap] of CHG) { const [v1, d1] = a[k], [v0, d0] = o[k]; if (v1 == null || v0 == null || d1 < 30 || d0 < 30) continue;
      const d = hi ? v1 - v0 : v0 - v1, t = d >= gap ? 'up' : d <= -gap ? 'down' : '';
      if (t) ch.push(`<div class="ig-s">${dir(t)}<div><p>${nm}: ${b(f(k, v1), t)} in your newer games, ${v1 > v0 ? 'up' : 'down'} from ${f(k, v0)} in your older ones.</p></div></div>`); else st.push(nm.toLowerCase()); }
    if (!ch.length && !st.length) return '';
    return `<div class="ig"><div class="ig-h"><span>What changed</span><small class="mt">newer ${a.n} v older ${o.n} games</small></div><p class="ig-steady" style="padding-left:0">Your newer games run ${DAY(a.from)} to ${DAY(a.to)}.</p>${ch.join('') || `<div class="ig-s">${dir('')}<div><p>Nothing moved by more than its usual gap between your older and newer games.</p></div></div>`}${st.length ? `<p class="ig-steady">Steady: ${st.join(', ')}.</p>` : ''}</div>`;
  }
  // 5A By time control: a column per time control; 30 games before it is compared
  function byTc(rows, bench) {
    if (!rows || !rows.length) return ''; const g = {}; for (const r of rows) (g[r.tc] = g[r.tc] || []).push(r);
    const ks = ['bullet', 'blitz', 'rapid', 'daily'].filter(k => g[k]); if (ks.length < 2) return '';
    const M = Object.fromEntries(ks.map(k => [k, g[k].length >= 30 ? metrics(g[k].slice().sort((a, b) => b.t - a.t), bench) : null]));
    const rowsT = [['Score', 'score', v => P0(v)], ['Tactics found', 'tactics', v => P0(v)], ['Lost on time', 'timeloss', v => P0(v)], ['Big mistakes / 100 moves', 'big', v => v.toFixed(1)]];
    const cell = (k, key, f) => M[k] && M[k][key][0] != null ? `<span class="c">${f(M[k][key][0])}</span>` : `<span class="na">${g[k].length} of 30</span>`;
    const short = ks.filter(k => g[k].length < 30).map(k => `${k} has ${g[k].length}`);
    return `<div class="ig"><div class="ig-h"><span>By time control</span></div><div class="tcx" style="grid-template-columns:minmax(0,1.3fr) repeat(${ks.length},minmax(0,1fr))"><span></span>${ks.map(k => `<span class="h">${k[0].toUpperCase() + k.slice(1)}</span>`).join('')}`
      + `<span class="k">Games</span>${ks.map(k => `<span class="c">${fmt(g[k].length)}</span>`).join('')}<span class="k">Rating</span>${ks.map(k => { const nw = g[k].slice().sort((a, b) => b.t - a.t)[0]; return `<span class="c">${nw && nw.rt ? fmt(nw.rt) : '–'}</span>`; }).join('')}`
      + rowsT.map(([nm, key, f]) => `<span class="k">${nm}</span>${ks.map(k => cell(k, key, f)).join('')}`).join('') + `</div><p class="ig-steady">Each time control needs 30 games before it is compared${short.length ? `: ${short.join(', ')}` : ''}.</p></div>`;
  }
  // opening habits (from y.oh): rates for you and your opponents in the same games
  const HAB = [['uncastled', 'were still uncastled after move 12', 'Still uncastled after move 12', h => h[1] === 0], ['home', 'still had two or more knights or bishops at home after move 12', 'Two or more minor pieces at home after move 12', h => h[0] >= 2],
    ['queen', 'moved your queen twice or more before move 10', 'Queen moved twice or more before move 10', h => h[2] >= 2], ['twice', 'moved the same piece twice or more before move 10', 'Same piece moved twice or more before move 10', h => h[3] >= 2]];
  function habitRates(R) { const G = (R || []).filter(r => r.y && r.y.oh && r.y.oh.me && r.y.oh.th), n = G.length;
    return { n, list: HAB.map(([k, line, label, f]) => { const me = G.filter(r => f(r.y.oh.me)).length, th = G.filter(r => f(r.y.oh.th)).length; return { k, line, label, me, th, pm: n ? 100 * me / n : 0, pt: n ? 100 * th / n : 0 }; }) }; }
  // the habit that sets you apart most from your opponents in these games: 5+ games, 20+ points and 3+ games more than them
  const worstHabit = R => { const h = habitRates(R); if (h.n < 5) return null; const w = h.list.filter(x => x.pm - x.pt >= 20 && x.me - x.th >= 3).sort((a, b) => (b.pm - b.pt) - (a.pm - a.pt))[0]; return w ? { ...w, n: h.n } : null; };
  // the Insights tab: weaknesses, strengths, on par, your style. legacy = the 1.8 findings ({tone, head, more, calm, to, open}); Q/Y add the new ones
  // Insights: one block per area of the game, each with its key stats and, under a weak one, one Try (layout A, user 2026-11-08)
  function insights(legacy, Q, Y, W, open, ex) {
    ex = ex || {}; const rows = ex.rows || [], used = new Set(), tipT = k => { if (!k || !TIPS[k] || used.has(k)) return ''; used.add(k); return TIP_BTN(k, open.has('tip:' + k)); };
    const pts = r => r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0, scOf = a => a.length ? 100 * a.reduce((t, r) => t + pts(r), 0) / a.length : null, all = scOf(rows);
    const L = Object.fromEntries((legacy || []).map(it => [it.k, it])), S = [];
    const sec = (name, go, open2, stats) => { stats = stats.filter(Boolean); if (stats.length) S.push({ name, go, open: open2, stats }); };
    // General: colour, game length, who you play like
    const gen = [];
    if (ex.overall) gen.push(ex.overall);
    if (L.colW || L.colB) { const c = [L.colW, L.colB].filter(Boolean), t = c.some(x => x.tone === 'down') ? 'down' : c.some(x => x.tone === 'up') ? 'up' : ''; gen.push({ tone: t, head: c.map(x => x.head).join(' ') }); }
    if (rows.length >= 30) { const res = [[LENW[0], r => r.x[14] < 40], [LENW[1], r => r.x[14] >= 40 && r.x[14] <= 80], [LENW[2], r => r.x[14] > 80]].map(([nm, f]) => { const a = rows.filter(f); return { nm, n: a.length, sc: scOf(a) }; }).filter(o => o.n >= 10);
      const hi = res.slice().sort((p, q) => q.sc - p.sc)[0], lo = res.slice().sort((p, q) => p.sc - q.sc)[0];
      if (hi && lo && hi !== lo) { const th = toneOf(hi.sc, all, 8), tl = toneOf(lo.sc, all, 8);
        gen.push({ tone: tl === 'down' ? 'down' : th, head: `You score best in ${hi.nm}: ${b(P0(hi.sc), th)}) and worst in ${lo.nm}: ${b(P0(lo.sc), tl)}).`, tip: tl === 'down' ? (lo.nm === LENW[2] ? 'endgame' : lo.nm === LENW[0] ? 'opening' : 'struct') : '' }); } }
    if (ex.gm) gen.push({ tone: '', head: `You play most like ${b(esc(ex.gm.nm))}: ${esc(ex.gm.d)}. The You tab says what you share.` });
    sec('General', 'form', '', gen);
    // Openings: best and worst, 5 games or more
    { const ops = {}; for (const r of rows) if (r.op) (ops[r.op] = ops[r.op] || []).push(r);
      const ok = Object.entries(ops).sort((p, q) => q[1].length - p[1].length).slice(0, 10).filter(([, a]) => a.length >= 5).map(([k, a]) => ({ k, n: a.length, sc: scOf(a) })), hi = ok.slice().sort((p, q) => q.sc - p.sc || q.n - p.n)[0], lo = ok.slice().sort((p, q) => p.sc - q.sc || q.n - p.n)[0];
      const st = [];
      if (hi && lo && hi !== lo) { const th = toneOf(hi.sc, all, 5), tl = toneOf(lo.sc, all, 5);
        st.push({ tone: tl === 'down' ? 'down' : th, head: `You do best in the ${b(esc(hi.k), th)} (${P0(hi.sc)}, ${hi.n} games) and worst in the ${b(esc(lo.k), tl)} (${P0(lo.sc)}, ${lo.n} games).`, tip: tl === 'down' ? 'lines' : '',
          fk: tl === 'down' ? { key: 'lines', title: 'The ' + lo.k, what: `the ${esc(lo.k)}`, you: lo.sc, ref: all, n: lo.n, refS: `You score ${P0(all)} over all your games (${lo.n} games here).`, rest: { tone: th, head: `You do best in the ${b(esc(hi.k), th)} (${P0(hi.sc)}, ${hi.n} games).` } } : null }); }
      if (lo) { const wh = worstHabit(ops[lo.k]); if (wh) st.push({ tone: 'down', head: `In the ${b(esc(lo.k))} you ${wh.line} in ${b(`${wh.me} of ${wh.n}`, 'down')} games. Your opponents in those games: ${wh.th} of ${wh.n}.`, tip: 'develop' }); }
      sec('Openings', 'skills', 'phase:Opening', st); }
    // Middlegame: pawn structures against what the engine expected when you reached them, 8 games or more
    if (Y) { const ok = Object.entries(Y.sx).map(([k, o]) => ({ k, n: o.y.n + o.t.n, sc: share(o.y.pts + o.t.pts, o.y.n + o.t.n), ex: share((o.y.exp || 0) + (o.t.exp || 0), o.y.n + o.t.n) })).filter(o => o.n >= 8).sort((p, q) => (p.sc - p.ex) - (q.sc - q.ex));
      const lo = ok[0], hi = ok[ok.length - 1], st = [], tl = lo ? toneOf(lo.sc, lo.ex, 10) : '', th = hi && hi !== lo ? toneOf(hi.sc, hi.ex, 10) : '';
      if (tl === 'down') st.push({ fk: { key: lo.k === 'Carlsbad' ? 'carlsbad' : 'struct', title: 'The ' + lo.k, what: `the ${esc(lo.k)}`, you: lo.sc, ref: lo.ex, n: lo.n, refS: `The positions deserved ${P0(lo.ex)} (${lo.n} games).`, rest: th === 'up' ? { tone: 'up', head: `In pawn structures, you do best in the ${b(esc(hi.k), 'up')}: ${P0(hi.sc)} against an expected ${P0(hi.ex)}.` } : null },
        tone: 'down', head: `In pawn structures, you do worst in the ${b(esc(lo.k), 'down')}: ${P0(lo.sc)} against an expected ${P0(lo.ex)} (${lo.n} games).` + (th === 'up' ? ` You do best in the ${b(esc(hi.k), 'up')}: ${P0(hi.sc)} against ${P0(hi.ex)}.` : ''), tip: lo.k === 'Carlsbad' ? 'carlsbad' : lo.k === "Isolated queen's pawn" ? 'iqp' : 'struct' });
      else if (th === 'up') st.push({ tone: 'up', head: `In pawn structures, you do best in the ${b(esc(hi.k), 'up')}: ${P0(hi.sc)} against an expected ${P0(hi.ex)} (${hi.n} games).` });
      else if (lo) st.push({ tone: '', head: `In your pawn structures you score about what the positions deserved.` });
      sec('Middlegame', 'skills', 'phase:Middle', st); }
    // Endgame: the material pairing furthest below what the positions deserved, then rook endings
    if (Y) { const st = [], pr = Y.egPair.filter(c => c.n >= 15).map(c => ({ ...c, sc: share(c.pts, c.n), ex: share(c.exp, c.n) })).sort((p, q) => (p.sc - p.ex) - (q.sc - q.ex)), w = pr[0];
      if (w) { const t = toneOf(w.sc, w.ex, 6), bt = pr[pr.length - 1], tb = bt && bt !== w ? toneOf(bt.sc, bt.ex, 6) : '';
        st.push(t === 'down' ? { tone: 'down', head: `You struggle in ${b(esc(w.k))} endings, scoring ${b(P0(w.sc), 'down')} against an expected ${P0(w.ex)} (${w.n} games).`, tip: 'pair', fk: { key: 'pair', title: w.k + ' endings', what: `${esc(w.k)} endings`, you: w.sc, ref: w.ex, n: w.n, refS: `The positions deserved ${P0(w.ex)} (${w.n} games).` } }
          : tb === 'up' ? { tone: 'up', head: `You do well in ${b(esc(bt.k))} endings, scoring ${b(P0(bt.sc), 'up')} against an expected ${P0(bt.ex)} (${bt.n} games).` }
          : { tone: '', head: `In your endings you score about what the positions deserved: ${b(esc(w.k))} ${P0(w.sc)}, expected ${P0(w.ex)}.` }); }
      const tot = Y.egCat.reduce((q, c) => ({ n: q.n + c.n, pts: q.pts + c.pts }), { n: 0, pts: 0 }), rk = Y.egCat.find(c => c.k === 'Rook');
      if (rk && rk.n >= 15 && tot.n - rk.n >= 15) { const sc = share(rk.pts, rk.n), rest = share(tot.pts - rk.pts, tot.n - rk.n), t = toneOf(sc, rest, 8);
        if (t) st.push({ tone: t, head: egLine('Rook', sc, rest, rk.n, t), tip: t === 'down' ? 'rook' : '', fk: t === 'down' ? { key: 'rook', title: 'Rook endings', what: 'rook endings', you: sc, ref: rest, n: rk.n, refS: `You score ${P0(rest)} in your other endings (${rk.n} games).` } : null }); }
      sec('Endgame', 'skills', 'phase:Endgame', st); }
    // Positional: what your quiet mistakes gave away most
    { const PO = Y && Y.pos; if (PO && PO.mn >= 10) { const names = typeof CRS_SX !== 'undefined' ? CRS_SX.POS : [], me = PO.me.map(v => share(v, PO.mn)), th = PO.th.map(v => share(v, PO.tn || 1)), i = me.indexOf(Math.max(...me)), t = toneOf(me[i], th[i], 5, false);
      sec('Positional', 'skills', 'phase:Middle', [{ tone: t, head: posLine(names[i], me[i], th[i], t), tip: t === 'down' ? 'pos' : '' }]); } }
    // Tactics: the one you miss most, the one you hand over most, and one you do well
    if (Y) { const T = Y.tac, ks = Object.keys(T), st = [];
      const miss = ks.filter(k => !CTX.has(k) && T[k].me[1] >= 5).map(k => ({ k, m: T[k].me[1] - T[k].me[0], n: T[k].me[1], ms: share(T[k].me[1] - T[k].me[0], T[k].me[1]), ts: T[k].th[1] >= 5 ? share(T[k].th[1] - T[k].th[0], T[k].th[1]) : null, tn: T[k].th[1] })).sort((p, q) => q.ms - p.ms)[0];
      const gave = ks.filter(k => !CTX.has(k) && T[k].th[1] >= 5).map(k => ({ k, n: T[k].th[1], f: T[k].th[0] })).sort((p, q) => q.n - p.n)[0];
      // the colour needs 10+ chances on both sides, and the sentence always says what it is compared with (user, 2026-11-09: a green 'you miss' read as wrong)
      if (miss) { const t = miss.ts == null || miss.n < 10 || miss.tn < 10 ? '' : toneOf(miss.ms, miss.ts, 5, false), same = gave && gave.k === miss.k;
        const vs = miss.ts == null ? '' : t === 'up' ? ` Your opponents miss them even more often (${P0(miss.ts)}), so this is better than usual.` : t === 'down' ? ` Your opponents miss them less often (${P0(miss.ts)}).` : ` Your opponents miss them ${Math.abs(miss.ms - miss.ts) < 5 ? 'about as often' : miss.ms > miss.ts ? 'less often' : 'more often'} (${P0(miss.ts)})${miss.n < 10 || miss.tn < 10 ? ', too few chances to judge' : ''}.`;
        st.push({ tone: t, head: `The tactic you miss most often is ${b(TNAME[miss.k], t)}: ${miss.m} of ${miss.n} chances (${b(P0(miss.ms), t)}).` + vs + (gave ? ` You ${same ? 'also ' : ''}let your opponents ${TLET[gave.k]} most: you gave them ${gave.n} chances and they took ${gave.f} (${P0(share(gave.f, gave.n))}).` : ''), tip: t === 'down' ? miss.k : '' }); }
      const good = ks.filter(k => !CTX.has(k) && T[k].me[1] >= 10 && T[k].th[1] >= 10).map(k => ({ k, me: share(...T[k].me), th: share(...T[k].th) })).filter(o => o.me - o.th >= 5).sort((p, q) => (q.me - q.th) - (p.me - p.th))[0];
      if (good && (!miss || good.k !== miss.k)) st.push({ tone: 'up', head: `You find ${b(TNAME[good.k], 'up')} well: ${P0(good.me)}, against ${P0(good.th)} for your opponents.` });
      sec('Tactics', 'form', 'row:pf-tac', st); }
    // Clock
    if (Q && Q.M.timeloss) { const tl = Q.M.timeloss, t = SKv(tl.rel),      // same verdict as Skills › Clock, so both tabs colour it alike
      st = [{ tone: t, head: `You lost on time in ${b(P0(tl.you), t)} of games. Typical is ${P0(tl.typ)}.`, tip: t === 'down' ? 'clock' : '', fk: t === 'down' ? { key: 'clock', title: 'The clock', line: `You lose on time in ${b(P0(tl.you), 'down')} of your games. Typical at your rating is ${P0(tl.typ)}.`, you: 100 - tl.you, ref: 100 - tl.typ, n: Q.me.g / 2 } : null }];
      if (Q.aheadT.length >= 3) st.push({ tone: 'down', head: `${b(P0(share(Q.aheadT.length, Q.me.lostT)), 'down')} (${fmt(Q.aheadT.length)} of ${fmt(Q.me.lostT)}) of your losses on time came when you were a pawn or more ahead.`, tip: 'ahead' });
      sec('Clock', 'skills', 'phase:Clock', st); }
    // 1A Focus this week: the Weakness furthest below its benchmark, in points ((benchmark - you) x games / 100); its line leaves its section
    let focus = ''; { const C = []; for (const x of S) for (const it of x.stats) if (it.fk && it.fk.ref > it.fk.you) C.push({ x, it, lost: (it.fk.ref - it.fk.you) * it.fk.n / 100 });
      const top = C.sort((p, q) => q.lost - p.lost)[0];
      if (top) { const f = top.it.fk, x = top.x; x.focus = true;
        focus = `<div class="fc"><div class="fc-k">Focus this week</div><div class="fc-h">${esc(f.title)}</div><p>${f.line || `You score ${b(P0(f.you), 'down')} in ${f.what}. ${f.refS}`}</p><p>That is about ${(Math.round(top.lost * 10) / 10).toFixed(1)} points below the benchmark, more than any other weakness in these games.</p>${tipT(f.key)}</div>`;
        const i = x.stats.indexOf(top.it); if (f.rest) x.stats[i] = { tone: f.rest.tone || '', head: f.rest.head + ' Your weakest one is in Focus, at the top.' }; else x.stats.splice(i, 1);
        if (!x.stats.length) x.stats.push({ tone: '', head: 'Your weakest point here is in Focus, at the top.' }); } }
    const pre = focus, post = byTc(rows, ex.bench);
    if (!S.length) return pre || '<p class="st-sub">No findings yet.</p>';
    // heading verdict: Weakness if any stat is worse than its benchmark, Strength if any is better, otherwise On par (user: heading style from layout C)
    const vd = x => x.name === 'General' ? ['', ''] : x.focus || x.stats.some(it => it.tone === 'down') ? ['down', 'Weakness'] : x.stats.some(it => it.tone === 'up') ? ['up', 'Strength'] : ['', 'On par'];
    const ord = x => x.name === 'General' ? 0 : vd(x)[1] === 'Weakness' ? 1 : vd(x)[1] === 'On par' ? 2 : 3; S.sort((p, q) => ord(p) - ord(q));
    return pre + S.map(x => `<div class="ig"><div class="ig-h"><span>${x.name}</span>${vd(x)[1] ? `<small class="${vd(x)[0]}">${vd(x)[1]}</small>` : ''}<button type="button" class="st-link st-xl sx-go" data-goto="${x.go}"${x.open ? ` data-open="${x.open}"` : ''}>See detail ›</button></div>`
      + x.stats.map(it => `<div class="ig-s">${dir(it.tone)}<div><p>${it.head}</p>${tipT(it.tip)}</div></div>`).join('') + '</div>').join('') + post;
  }
  // Form › Style: how you play, not how well. Raw 0 to 100, grey, no benchmark yet (the GM comparison is parked until it is reliable).
  const SHARP = /gambit|sicilian|king's indian|dutch|benoni|benko|budapest|albin|latvian|alekhine|grob|dragon|najdorf|sveshnikov|marshall|evans|fried liver|two knights|vienna/i;
  // the style radar: six axes for you, your opponents in the same games dashed behind (style is not good or bad, so no colour)
  const RADAR = [['Aggression', 'How often you capture or give check in your first 25 moves. Higher means you attack more.'],
    ['Tension', 'How many pieces stay under attack, on both sides, after your moves from move 10 to 30. Higher means you keep the position sharp instead of settling it.'],
    ['Speed', 'How fast you move for your time control after move 10. Higher means you play faster.'],
    ['Endurance', 'How many of your wins went past move 40. Higher means you also win the long games, not only the quick ones.'],
    ['Opening prep', 'How far into the first 15 moves you get before your first opening slip. Higher means you know your openings deeper.'],
    ['Resilience', 'How well you play on after your first big mistake. Higher means you rarely follow one mistake with another.']];
  function radarVals(Y, w) { const a = Y.st[w], cl = v => v == null || isNaN(v) ? null : Math.max(0, Math.min(100, Math.round(v))), L = Y.long[w];
    return [cl(a[1] ? 200 * a[0] / a[1] : null), cl(a[3] ? 25 * a[2] / a[3] : null), cl(a[5] ? 100 - 2 * a[4] / a[5] : null), cl(L[1] ? 100 * L[0] / L[1] : null), cl(Y.st.n ? 100 * a[6] / Y.st.n / 15 : null), cl(a[8] ? 100 - 10 * a[7] / a[8] : null)]; }
  // measured from their games (pgnmentor.com player files, 28851 classical games, moved to blitz by the shift seen in Carlsen, Nakamura, Kramnik, Anand and Ding blitz games); built by chess-risk-v10-test/gm-build
  const GM_K = ["e4","e5reply","c5reply","d4","aggression","castleMove","castleLong","storm","longWin","tension","sacrifice"];
  const GM_SD = [0.296,0.255,0.277,0.192,0.023,0.701,0.025,0.031,0.111,0.11,0.042];
  const GM_POOL = [0.469,0.456,0.227,0.235,0.219,10.935,0.082,0.13,0.424,1.384,0.045];
  const GM_P = {"Mikhail Tal":[0.628,0.216,0.585,0.023,0.221,9.621,0.091,0.108,0.361,1.493,0.053],"Paul Morphy":[1,1,0,0,0.29,10.922,0.061,0.188,0.115,1.711,0.193],"Garry Kasparov":[0.41,0.105,0.744,0.344,0.215,11.301,0.082,0.162,0.377,1.415,0.047],"Bobby Fischer":[0.942,0.11,0.733,0,0.226,9.903,0.1,0.194,0.371,1.38,0.038],"Alexander Alekhine":[0.476,0.661,0,0.37,0.231,12.092,0.135,0.139,0.335,1.443,0.044],"Viswanathan Anand":[0.845,0.463,0.292,0.013,0.212,10.801,0.112,0.116,0.473,1.365,0.032],"Hikaru Nakamura":[0.409,0.446,0.261,0.199,0.208,11.452,0.084,0.117,0.56,1.346,0.024],"Boris Spassky":[0.635,0.657,0.12,0.242,0.203,9.911,0.107,0.129,0.377,1.274,0.035],"Magnus Carlsen":[0.475,0.459,0.287,0.232,0.222,11.216,0.089,0.118,0.515,1.36,0.039],"Ding Liren":[0.119,0.59,0.027,0.452,0.214,10.656,0.044,0.13,0.523,1.355,0.038],"Mikhail Botvinnik":[0.124,0.236,0.092,0.344,0.2,11.604,0.084,0.141,0.492,1.303,0.019],"Vladimir Kramnik":[0.217,0.493,0.309,0.273,0.22,11.058,0.067,0.105,0.465,1.385,0.035],"José Raúl Capablanca":[0.347,0.721,0,0.435,0.234,11.658,0.052,0.117,0.394,1.351,0.027],"Anatoly Karpov":[0.304,0.508,0,0.412,0.202,11.174,0.063,0.088,0.528,1.328,0.018],"Tigran Petrosian":[0.085,0.171,0.201,0.393,0.187,10.651,0.06,0.091,0.471,1.248,0.025]};
  const GM_N = {"Mikhail Tal":2345,"Paul Morphy":210,"Garry Kasparov":1846,"Bobby Fischer":783,"Alexander Alekhine":1655,"Viswanathan Anand":2863,"Hikaru Nakamura":3298,"Boris Spassky":2195,"Magnus Carlsen":3376,"Ding Liren":1640,"Mikhail Botvinnik":889,"Vladimir Kramnik":2474,"José Raúl Capablanca":595,"Anatoly Karpov":2811,"Tigran Petrosian":1871};
  // how each measure reads in words, for "Like X, you ..." (high, low)
  const GM_WORDS = { e4: ['open with 1.e4', 'rarely open with 1.e4'], e5reply: ['answer 1.e4 with 1...e5', 'rarely answer 1.e4 with 1...e5'], c5reply: ['play the Sicilian', 'avoid the Sicilian'], d4: ['open with 1.d4', 'rarely open with 1.d4'],
    aggression: ['capture and check a lot early', 'keep the pieces on early'], castleMove: ['castle late', 'castle early'], castleLong: ['castle queenside more often', 'nearly always castle kingside'],
    storm: ['push pawns at a castled king', 'rarely push pawns at the king'], longWin: ['win long games', 'win before move 40'], tension: ['keep pieces under attack', 'keep the tension low'], sacrifice: ['give material for the attack', 'rarely give material'] };
  function gmMatch(rows) {
    const R = (rows || []).filter(r => r.y && r.y.sv); if (R.length < 30 || typeof CRS_SX === 'undefined') return null; const idx = GM_K.map(k => CRS_SX.SV.indexOf(k));
    const place = list => { const sum = { me: idx.map(() => [0, 0]), th: idx.map(() => [0, 0]) }; for (const r of list) for (const w of ['me', 'th']) idx.forEach((f, j) => { const x = r.y.sv[w][f]; if (x != null) { sum[w][j][0] += x; sum[w][j][1]++; } });
      return idx.map((f, j) => sum.me[j][1] >= 5 && sum.th[j][1] >= 5 ? GM_POOL[j] + sum.me[j][0] / sum.me[j][1] - sum.th[j][0] / sum.th[j][1] : null); };
    const dist = (u, p) => { let s0 = 0, n = 0; u.forEach((x, j) => { if (x != null) { s0 += ((x - p[j]) / GM_SD[j]) ** 2; n++; } }); return n ? s0 / n : 1e9; };
    const rank = u => Object.entries(GM_P).map(([nm, p]) => ({ nm, dd: dist(u, p) })).sort((a, b) => a.dd - b.dd);
    const u = place(R), L = rank(u), top = L[0].nm;
    // how sure: the top player on halves of your games (odd and even games, then 20 fixed shuffles)
    let seed = R.length * 7919 + 1, same = 0, other = {}; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const halves = [R.filter((r, i) => i % 2 === 0), R.filter((r, i) => i % 2 === 1)]; for (let t = 0; t < 20; t++) halves.push(R.slice().sort(() => rnd() - .5).slice(0, Math.floor(R.length / 2)));
    for (const h of halves) { const t0 = rank(place(h))[0].nm; if (t0 === top) same++; else other[t0] = (other[t0] || 0) + 1; }
    const alt = Object.entries(other).sort((a, b) => b[1] - a[1])[0];
    // what you share with the closest player: measures where you both sit on the same side of the grandmaster average
    const p = GM_P[top], z = (x, j) => (x - GM_POOL[j]) / GM_SD[j], traits = u.map((x, j) => x == null ? null : { j, a: z(x, j), b: z(p[j], j) }).filter(o => o && Math.sign(o.a) === Math.sign(o.b) && Math.abs(o.a) >= .5 && Math.abs(o.b) >= .5)
      .sort((o1, o2) => Math.min(Math.abs(o2.a), Math.abs(o2.b)) - Math.min(Math.abs(o1.a), Math.abs(o1.b))).slice(0, 2).map(o => GM_WORDS[GM_K[o.j]][o.a > 0 ? 0 : 1]);
    const D = Object.fromEntries(GMS.map(([nm, d]) => [nm, d]));
    return { u, p, list: L.map(o => ({ ...o, d: D[o.nm] || '' })), top, far: L[L.length - 1].nm, sure: same / halves.length, alt: alt ? alt[0] : null, traits, n: R.length };
  }
  const GMS = [['Mikhail Tal', 'attacking, sacrificial'], ['Paul Morphy', 'open-game attacker'], ['Garry Kasparov', 'dynamic, initiative first'], ['Bobby Fischer', 'precise, a narrow sharp repertoire'], ['Alexander Alekhine', 'deep combinations, wild middlegames'], ['Viswanathan Anand', 'fast and balanced'], ['Hikaru Nakamura', 'practical, wide repertoire'], ['Boris Spassky', 'universal, classical'], ['Magnus Carlsen', 'universal, squeezes small edges'], ['Ding Liren', 'solid, deep preparation'], ['Mikhail Botvinnik', 'scientific, a fixed repertoire'], ['Vladimir Kramnik', 'solid, endgame-minded'], ['José Raúl Capablanca', 'clean technique, simple positions'], ['Anatoly Karpov', 'positional squeeze, low risk'], ['Tigran Petrosian', 'solid, defensive, prophylactic']];
  // ── two sections that never mix ──
  // How you play: six habits against your opponents in the same games (dot = you, ring = them)
  const more = (open, k, show, hide) => `<button type="button" class="st-link sx-fold" data-tg="${k}" aria-expanded="${open.has(k)}">${open.has(k) ? hide : show} ${open.has(k) ? '‹' : '›'}</button>`;
  function howPlay(Y, open) {
    if (!Y || !Y.st || !Y.st.n) return ''; const v0 = radarVals(Y, 'me'), th = radarVals(Y, 'th'), a = Y.st.me, L = Y.long.me, n1 = x => (Math.round(x * 10) / 10).toFixed(1);
    // each label is set against the players you meet in the same games: 6 points or more above, below, or in between (0, 2, 1); -1 = not measured
    const v = v0.map((x, i) => x == null ? null : th[i] == null ? (x >= 60 ? 0 : x <= 40 ? 2 : 1) : x - th[i] >= 6 ? 0 : th[i] - x >= 6 ? 2 : 1), band = x => x == null ? -1 : x;
    // [name of each band (high, middle, low), the plain fact behind it]
    const F = [[['Attacking', 'Balanced', 'Patient'], a[1] ? `You capture or give check on ${P0(100 * a[0] / a[1])} of your first 25 moves.` : ''],
      [['Keeps it sharp', 'In between', 'Tidies up'], a[3] ? `After your moves, ${n1(a[2] / a[3])} pieces are left under attack on average.` : ''],
      [['Quick', 'Steady pace', 'Careful'], a[5] ? `A typical move costs you ${n1(a[4] / a[5] / 10)}% of your starting clock.` : ''],
      [['Wins the long games', 'Wins long and short', 'Wins early'], L[1] ? `${P0(100 * L[0] / L[1])} of your wins go past move 40.` : ''],
      [['Knows the openings', 'Average opening depth', 'Slips early'], `Your first opening slip comes around move ${Math.max(1, Math.round(a[6] / Y.st.n))}.`],
      [['Recovers well', 'Recovers unevenly', 'Unravels'], a[8] ? `After your first big mistake, each of your next moves gives up ${n1(a[7] / a[8])} points of winning chances on average.` : '']];
    const rows = F.map(([nm, fact], i) => band(v[i]) < 0 || !fact ? '' : `<div class="hp-r"><b class="tip" title="${esc(RADAR[i][0] + ': ' + RADAR[i][1] + ' The label is set against the players you meet.')}">${nm[band(v[i])]}</b><span>${fact}</span></div>`).join('');
    const adj = [['an attacking', 'a balanced', 'a patient'], ['quick', 'steady', 'careful']], w1 = band(v[0]) < 0 ? 'a' : adj[0][band(v[0])], w2 = band(v[2]) < 0 ? '' : ', ' + adj[1][band(v[2])];
    const bits = [band(v[1]) === 0 ? 'keeps positions sharp' : band(v[1]) === 2 ? 'tidies positions up' : '', band(v[3]) === 0 ? 'wins the long games' : band(v[3]) === 2 ? 'wins early' : ''].filter(Boolean);
    return `<div class="hp"><div class="hp-h"><span class="sk-gl">How you play</span><span class="hp-k">${fmt(Y.st.n)} games</span></div><p class="sw hp-sum">You are ${w1}${w2} player${bits.length ? ' who ' + bits.join(' and ') : ''}.</p>${open.has('hp:more') ? rows : ''}${more(open, 'hp:more', 'Show the six habits', 'Hide the six habits')}</div>`; }
  // each player's style in plain words (own words)
  const GM_STYLE = { 'Mikhail Tal': 'Tal attacked at any cost. He gave up pieces to drag the enemy king into the open and trusted his opponent to get lost in the mess.',
    'Paul Morphy': 'Morphy got every piece out fast, opened the centre and attacked before his opponent had finished developing.',
    'Garry Kasparov': 'Kasparov played for the initiative from move one: deep opening preparation, active pieces and constant pressure.',
    'Bobby Fischer': 'Fischer played a small set of sharp openings he knew better than anyone, and then made clear, precise moves until the win was simple.',
    'Alexander Alekhine': 'Alekhine built up complicated positions and then broke them open with long, hard-to-see combinations.',
    'Viswanathan Anand': 'Anand played fast and sound in every kind of position, and punished mistakes quickly.',
    'Hikaru Nakamura': 'Nakamura is practical: a wide range of openings, tough defence, and long games he keeps playing until the opponent cracks.',
    'Boris Spassky': 'Spassky could play any kind of position. He chose classical, healthy development and switched to attack when it was there.',
    'Magnus Carlsen': 'Carlsen takes small, safe advantages and keeps the game going for a very long time, until the other player slips.',
    'Ding Liren': 'Ding is solid and deeply prepared. He opens with the queen pawn, takes few risks and waits for a real chance.',
    'Mikhail Botvinnik': 'Botvinnik treated chess like science: a fixed set of openings studied in depth, and a plan for every pawn structure.',
    'Vladimir Kramnik': 'Kramnik was solid and patient. He swapped pieces willingly and won in the endgame.',
    'José Raúl Capablanca': 'Capablanca kept chess simple. Classical openings, the king tucked away safely, and clean positions he could win without taking risks.',
    'Anatoly Karpov': 'Karpov squeezed. He took away his opponent’s good moves one by one, took no risks, and won slowly.',
    'Tigran Petrosian': 'Petrosian was the great defender. He stopped his opponent’s ideas before they started and almost never lost.' };
  const LN = nm => nm === 'Ding Liren' ? 'Ding' : nm.split(' ').pop();      // family name
  function whoLike(M, gm, open) {
    if (!M) return `<div class="wl"><div class="sk-gl">Who you play like</div><p class="st-sub">Needs 30 analysed games.</p></div>`;
    const top = gm[0], ln = LN(top.nm), far = gm[gm.length - 1], Z = M.u.map((x, j) => x == null ? null : { j, a: (x - GM_POOL[j]) / GM_SD[j], b: (M.p[j] - GM_POOL[j]) / GM_SD[j] }).filter(Boolean);
    const strong = o => Math.abs(o.a) >= .5 && Math.abs(o.b) >= .5, word = o => GM_WORDS[GM_K[o.j]][o.a > 0 ? 0 : 1], list = x => x.length < 2 ? x[0] : x.slice(0, -1).join(', ') + ' and ' + x[x.length - 1];
    const same = Z.filter(o => strong(o) && Math.sign(o.a) === Math.sign(o.b)).sort((p, q) => Math.min(Math.abs(q.a), Math.abs(q.b)) - Math.min(Math.abs(p.a), Math.abs(p.b))).slice(0, 3),
      diff = Z.filter(o => strong(o) && Math.sign(o.a) !== Math.sign(o.b)).sort((p, q) => Math.abs(q.a - q.b) - Math.abs(p.a - p.b)).slice(0, 2);
    const k = Math.round(M.sure * 22), nx = gm.slice(1, 3).map(o => `${esc(LN(o.nm))} (${esc(o.d)})`);
    return `<div class="wl"><div class="hp-h"><span class="sk-gl">Who you play like</span><span class="hp-k">of 15 great players</span></div>`
      + `<p class="wl-n">${esc(top.nm)}</p><p class="sw">${esc(GM_STYLE[top.nm] || top.d)}</p>`
      + (!open.has('wl:more') ? more(open, 'wl:more', `Why ${esc(ln)}`, '') + '</div>' : '')
      + (!open.has('wl:more') ? '' : (same.length ? `<p class="sw"><b>What you share.</b> Like ${esc(ln)}, you ${list(same.map(word))}.</p>` : '')
      + (diff.length ? `<p class="sw"><b>Where you differ.</b> You ${list(diff.map(word))}. ${esc(ln)} did the opposite.</p>` : '')
      + `<p class="sw"><b>Next closest.</b> ${list(nx)}.</p><p class="sw"><b>Least like you.</b> ${esc(LN(far.nm))} (${esc(far.d)}).</p>`
      + `<p class="hp-b">${M.sure >= .7 ? 'A clear match' : 'A close call'}: on 22 different halves of your games, ${esc(ln)} came out closest ${k} times${M.sure < .7 && M.alt ? `, ${esc(LN(M.alt))} most of the rest` : ''}.</p>`
      + `<details class="sx-more"><summary>How this is measured</summary><p class="st-note">Each player is measured from their own games (${fmt(Object.values(GM_N).reduce((x, c) => x + c, 0))} classical games), on 11 choices: first moves with each colour, early captures and checks, when and where you castle, pawn storms, sacrifices, tension and long wins. The closest player is the one whose 11 choices sit nearest yours.</p></details>` + more(open, 'wl:more', '', 'Show less') + '</div>'); }
  // ── Moves you keep repeating: the same position in your first 15 moves, the same move, and how it went ──
  const RPF = new Map(), START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const rpFens = r => { if (RPF.has(r.id)) return RPF.get(r.id); let f = null; try { f = CRS_SK.replay(r.y.om.split(' ')).all; } catch (e) { f = null; } RPF.set(r.id, f); return f; };
  const wdl = m => [[m.w, 'win', 'wins'], [m.d, 'draw', 'draws'], [m.l, 'loss', 'losses']].filter(x => x[0]).map(x => `${x[0]} ${x[0] === 1 ? x[1] : x[2]}`).join(', ');
  const RPM = { sig: '', html: '' };
  function repeats(rows, open) {
    open = open || new Set(); const sig = (rows || []).length + '|' + (rows || []).reduce((t, r) => (t + (r.t || 0)) % 1e12, 0) + '|' + [...open].filter(k => /^qz:[as]r/.test(k)).sort().join();
    if (RPM.sig === sig) return RPM.html; const done = h => { RPM.sig = sig; RPM.html = h; return h; };
    const G = (rows || []).filter(r => r.y && r.y.om), head = `<div class="tgt"><div class="hp-h"><span class="sk-gl">Moves you keep repeating</span><span class="hp-k">${fmt(G.length)} games</span></div>`;
    if (!G.length) return head + `<p class="st-sub">Kept for games analysed from version 1.11 on: press Search to check your games again.</p></div>`;
    const P = {}, T = {}, byId = new Map(G.map(r => [r.id, r])), blank = () => ({ n: 0, w: 0, d: 0, l: 0, big: 0, ids: [] });
    for (const r of G) { const san = r.y.om.split(' '), F = rpFens(r); if (!F) continue; const big = new Set((r.y.ob || []).map(o => o[0])), bests = (r.y.obm || '').split(' '), me0 = r.c === 'w' ? 0 : 1;
      for (let i = 3; i < Math.min(san.length, F.length); i++) { const fen = F[i - 1], key = fen.split(' ').slice(0, 2).join(' ');
        if (i % 2 === me0) { if (i < 4) continue; const p = P[key] = P[key] || { fen, i, n: 0, c: r.c, op: {}, mv: {}, best: {} }; p.n++; if (r.op) p.op[r.op] = (p.op[r.op] || 0) + 1;
          const bb = bests[(i - me0) / 2]; if (bb && bb !== '-') p.best[bb] = (p.best[bb] || 0) + 1; const m = p.mv[san[i]] = p.mv[san[i]] || blank(); m.n++; m[r.r]++; m.ids.push(r.id); if (big.has(i)) m.big++; }
        else { const k2 = key + ' ' + san[i], t = T[k2] = T[k2] || { ...blank(), fen: F[i], i, c: r.c, op: {}, san: san[i], best: {} }; t.n++; t[r.r]++; t.ids.push(r.id); if (r.op) t.op[r.op] = (t.op[r.op] || 0) + 1;
          const bb = bests[(i + 1 - me0) / 2]; if (bb && bb !== '-') t.best[bb] = (t.best[bb] || 0) + 1; } } }
    const L = Object.values(P), opOf = p => (Object.entries(p.op).sort((x, y) => y[1] - x[1])[0] || ['This position'])[0], mvNo = i => Math.floor(i / 2) + 1, no = (p, san) => `${mvNo(p.i)}${p.c === 'w' ? '.' : '...'}${esc(san)}`, sc = m => m.n ? (m.w + m.d / 2) / m.n : 0;
    const overlap = (x, y) => x.filter(id => y.includes(id)).length >= .8 * Math.min(x.length, y.length);
    // where the line goes wrong: your first big mistake after this point, in the games you lost
    const where = (ids, ply) => { const Ls = ids.map(id => byId.get(id)).filter(r => r && r.r === 'l'); if (Ls.length < 2) return '';
      const mv = Ls.map(r => (r.y.ob || []).map(o => o[0]).filter(x => x > ply).sort((x, y) => x - y)[0]).filter(x => x != null).map(mvNo);
      if (mv.length >= Math.max(2, Ls.length / 2)) { const lo = Math.min(...mv), hi = Math.max(...mv); return ` In ${mv.length} of those ${Ls.length} losses your next big mistake came ${lo === hi ? 'on move ' + lo : `between moves ${lo} and ${hi}`}.`; }
      return ` Most of those losses have no big mistake in your first 15 moves, so they are decided later in the game.`; };
    const A = []; for (const o of L.flatMap(p => Object.entries(p.mv).filter(([, m]) => m.big >= 2 || (m.big >= 1 && m.n >= 4 && sc(m) <= .3) || (m.n >= 6 && sc(m) <= .25)).map(([san, m]) => ({ p, san, m }))).sort((x, y) => y.m.big - x.m.big || y.m.n - x.m.n || x.p.i - y.p.i)) {
      if (A.length < 3 && !A.some(q => overlap(o.m.ids, q.m.ids))) A.push(o); }
    const used = new Set(A.map(o => o.p)), B = L.filter(p => !used.has(p) && p.n >= 6).map(p => { const E2 = Object.entries(p.mv).sort((x, y) => y[1].n - x[1].n), t = E2[0], rest = E2.slice(1).reduce((s, [, m]) => ({ n: s.n + m.n, w: s.w + m.w, d: s.d + m.d, l: s.l + m.l }), { n: 0, w: 0, d: 0, l: 0 });
      return t[1].n >= 3 && rest.n >= 3 && sc(rest) - sc(t[1]) >= .25 ? { p, E2 } : null; }).filter(Boolean).sort((x, y) => y.p.n - x.p.n || y.p.i - x.p.i).slice(0, 1);
    // opponent replies you score worst against
    const R = []; for (const t of Object.values(T).filter(t => t.n >= 6 && sc(t) <= .3).sort((x, y) => sc(x) - sc(y) || y.n - x.n)) { if (R.length < 2 && !R.some(q => overlap(t.ids, q.ids)) && !A.some(q => overlap(t.ids, q.m.ids)) && !B.some(q => overlap(t.ids, Object.values(q.p.mv).flatMap(m => m.ids)))) R.push(t); }
    if (!A.length && !B.length && !R.length) return head + `<p class="st-sub">No position in your first 15 moves where you keep playing a move that goes badly.</p></div>`;
    // the board: you can try the engine's move when it is known for this position
    const bdP = (p, k) => { const best = (Object.entries(p.best).sort((x, y) => y[1] - x[1])[0] || [''])[0]; if (!best) return [board({ f: p.fen, b: 'a1a1', c: p.c, k }, false).replace('qb play', 'qb'), '', ''];
      const solved = open.has('qz:s' + k), show = solved || open.has('qz:a' + k), Bd = fenB(p.fen), [fr, fc] = sqI(best.slice(0, 2)), [tr, tc] = sqI(best.slice(2, 4)), pc = Bd[fr][fc];
      return [won(board({ f: p.fen, b: best, c: p.c, k }, show, solved), open, k) + `<p class="qz-msg" aria-live="polite"></p>`, show ? ` ${solved ? '<b class="up">Correct.</b> ' : ''}The engine plays your ${PNAME[(pc || 'p').toLowerCase()]} from ${best.slice(0, 2)} ${Bd[tr][tc] ? 'taking on' : 'to'} ${best.slice(2, 4)}.` : '',
        show ? '' : `<p class="rp-try">What would the engine play here? Drag a piece, or tap it and then the square.</p><button type="button" class="qz-b" data-tg="qz:a${k}">Show the engine's move</button>`]; };
    const tbl = p => `<div class="opr h"><span>Your move</span><small></small><small>Games</small><small>W-D-L</small></div>${Object.entries(p.mv).sort((x, y) => y[1].n - x[1].n).map(([s2, m2]) => `<div class="opr"><span>${no(p, s2)}</span><small></small><small>${m2.n}</small><b>${m2.w}-${m2.d}-${m2.l}</b></div>`).join('')}`;
    const a = A.map(({ p, san, m }, j) => { const [bd, ans, tr] = bdP(p, 'rp' + j);
      return `<div class="rp">${bd}<p><b>${esc(opOf(p))}, move ${mvNo(p.i)}.</b> You reached this position ${p.n} times and played ${b(no(p, san))} ${m.n === p.n ? 'every time' : `${m.n} times`}: ${wdl(m)}.${m.big ? ` The engine marks it a big mistake in ${m.big} of ${m.n}.` : ''}${where(m.ids, p.i)}${ans}</p>${tr}${m.n < p.n ? tbl(p) : ''}</div>`; }).join('');
    const c = B.map(({ p }, j) => { const [bd, ans, tr] = bdP(p, 'rq' + j); return `<div class="rp">${bd}<p><b>${esc(opOf(p))}, move ${mvNo(p.i)}.</b> ${p.n} games from this position. Your usual move scores lower than your other moves.${ans}</p>${tr}${tbl(p)}</div>`; }).join('');
    const d = R.map((t, j) => { const [bd, ans, tr] = bdP(t, 'rr' + j); return `<div class="rp">${bd}<p><b>${esc(opOf(t))}, move ${mvNo(t.i)}.</b> Your opponents played ${b(`${mvNo(t.i)}${t.c === 'w' ? '...' : '.'}${esc(t.san)}`)} against you ${t.n} times: ${wdl(t)}.${where(t.ids, t.i)}${ans}</p>${tr}</div>`; }).join('');
    return done(head + `<p class="hp-b">The same position in your first 15 moves, the same move, and how it went.</p>${a}${c}${d ? `<div class="wl-m">Replies you score worst against</div>${d}` : ''}</div>`); }
  // Your pawn moves: how many of your big mistakes were pawn moves, against your opponents in the same games
  function pawnMoves(rows) {
    const S = { me: [0, 0, 0, 0], th: [0, 0, 0, 0] }; let n = 0; for (const r of rows || []) if (r.y && r.y.pw) { n++; for (const w of ['me', 'th']) r.y.pw[w].forEach((x, j) => { S[w][j] += x; }); }
    if (S.me[1] < 20 || S.th[1] < 20) return ''; const pm = 100 * S.me[0] / S.me[1], po = 100 * S.th[0] / S.th[1], mv = 100 * S.me[2] / Math.max(1, S.me[3]), t = pm - po >= 8 ? 'down' : po - pm >= 8 ? 'up' : '';
    return `<div class="tgt"><div class="hp-h"><span class="sk-gl">Your pawn moves</span><span class="hp-k">${fmt(n)} games</span></div><p class="sw">Pawn moves are ${b(P0(pm), t)} of your big mistakes and ${P0(mv)} of your moves. Your opponents: ${P0(po)} of their big mistakes. ${t === 'down' ? 'A pawn move cannot be taken back: before each one, check which squares it stops guarding.' : t === 'up' ? 'Your pawn play is safer than theirs.' : 'Pawn play is not where your games go wrong.'}</p></div>`; }
  const targeted = rows => pawnMoves(rows);
  function train(rows, open, W, seen) { open = open || new Set(); if (!rows || !rows.length) return `<p class="st-sub">Press Search first. Train uses positions from your own analysed games.</p>`;
    return `<div class="pf-g"">From your games</div>${quiz(rows, null, open, W, seen)}<div class="pf-g">From your openings</div>${repeats(rows, open)}`; }
  function style(P, rows, Y, open) {
    if (!P || !P.n) return null;
    const draws = P.d / P.n, ops = P.ops || {}, tot = Object.values(ops).reduce((s, a) => s + a[0] + a[1] + a[2], 0);
    const sharp = tot ? Object.entries(ops).filter(([k]) => SHARP.test(k)).reduce((s, [, a]) => s + a[0] + a[1] + a[2], 0) / tot : 0;
    const variety = tot ? 1 - Object.values(ops).reduce((s, a) => s + Math.pow((a[0] + a[1] + a[2]) / tot, 2), 0) : 0;
    const v = { draw: 100 * (1 - draws), sharp: 100 * sharp, agg: Y ? Y.ag : null, variety: 100 * variety, depth: Y ? Math.min(100, 100 * Y.fi / 15) : null };
    if (rows && rows.length >= 20) { const R = rows.slice().sort((a, b) => a.t - b.t), sc = r => r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0, win = [];
      for (let i = 10; i <= R.length; i += 5) win.push(R.slice(i - 10, i).reduce((s, r) => s + sc(r), 0) / 10);
      const m = win.reduce((s, x) => s + x, 0) / win.length, sd = Math.sqrt(win.reduce((s, x) => s + (x - m) * (x - m), 0) / win.length); v.consist = Math.max(0, Math.min(100, 100 - sd * 400));
      let sw = 0, n = 0; for (const c of ['w', 'b']) { const L = R.filter(r => r.c === c && r.op); for (let i = 1; i < L.length; i++) { n++; if (L[i].op !== L[i - 1].op) sw++; } } v.unpred = n ? 100 * sw / n : null; }
    const label = v.sharp >= 45 || (v.agg != null && v.agg >= 45) ? 'Aggressive' : v.draw < 85 && v.sharp < 25 ? 'Solid' : 'Balanced';
    const g = (nm, x, tip) => x == null ? '' : `<div class="sty" title="${esc(tip || '')}"><span class="r"><span>${nm}</span><b>${Math.round(x)}</b></span><span class="tb"><u style="width:${Math.max(0, Math.min(100, x))}%"></u></span></div>`;
    // Plays most like: FIRST VERSION (2026-11-07). Player profiles below are rough estimates, not yet measured from their games; to be calibrated
    // (plan in chess-risk-facelift/stats-knowledge/TODO-parked.md). Only numbers that mean the same in blitz and classical are compared.

    const M = gmMatch(rows), gm = M ? M.list : [];
    const span = gm.length ? Math.max(.01, gm[gm.length - 1].dd - gm[0].dd) : 1, cl = o => Math.round(100 - 85 * (o.dd - gm[0].dd) / span);
    const last = o => o.nm.split(' ').pop();
    const html = howPlay(Y, open || new Set()) + whoLike(M, gm, open || new Set());
    const line = gm.length ? `Your style: you play most like ${gm[0].nm} (${gm[0].d}).` : 'Your style.';      // B11 Play style label removed (user, 2026-11-09)
    return { html, line, gm: gm.length ? { nm: gm[0].nm, d: gm[0].d, far: gm[gm.length - 1].nm, farD: gm[gm.length - 1].d, sure: M.sure, traits: M.traits } : null };
  }
  // one line per positional theme, shown on hover (own words)
  const POS_TIP = {
    'Isolated pawn': 'Your move left a pawn with no pawn of yours on either neighbouring file to protect it.',
    'Gave up the long diagonal': 'An opponent bishop or queen got a long, open run on one of the two long diagonals.',
    'Permanent hole': 'A square in your half that none of your pawns can ever guard again.',
    'Backward pawn': 'A pawn left behind its neighbours that cannot safely move forward.',
    'Trapped piece': 'One of your pieces was left with almost no safe squares.',
    'Weak colour complex': 'You lost the bishop for the colour your pawns leave undefended.',
    'King stuck in the centre': 'Your king lost the right to castle with an open central file in front of it.',
    "Hole in the king's pawn shield": 'A pawn in front of your castled king went missing.',
    'Gave the opponent an open file': 'An opponent rook got a file with none of its own pawns on it.',
    'Gave up castling': 'A king or rook move cost you the right to castle.',
    'Allowed connected passers': 'Your opponent got two passed pawns side by side.',
    'Allowed a protected passer': 'Your opponent got a passed pawn defended by another of their pawns.',
  };
  // Profile sections as rows: the key stat as the line, the full table when opened. extra = more rows built by the page (style, habits)
  // 3C: a position from your own games where you missed the tactic you miss most; the answer stays hidden until asked for
  const PCS = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, PNAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  const fenB = fen => fen.split(' ')[0].split('/').map(r => { const a = []; for (const ch of r) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) a.push(''); else a.push(ch); } return a; });
  const sqI = q => [8 - +q[1], q.charCodeAt(0) - 97], evW = v => v >= 300 ? 'winning' : v >= 120 ? 'better' : v > -120 ? 'level' : v > -300 ? 'worse' : 'losing';
  function board(e, show, after) { const B = fenB(e.f), flip = e.c === 'b', [fr, fc] = sqI(e.b.slice(0, 2)), [tr, tc] = sqI(e.b.slice(2, 4)); let h = '';
    // after: the position once the best move is played (solved boards), with en passant, promotion and castling handled
    if (after && B[fr] && B[fr][fc]) { const pc = B[fr][fc]; if (pc.toLowerCase() === 'p' && fc !== tc && !B[tr][tc]) B[fr][tc] = ''; B[tr][tc] = e.b[4] ? (pc === 'P' ? e.b[4].toUpperCase() : e.b[4].toLowerCase()) : pc; B[fr][fc] = '';
      if (pc.toLowerCase() === 'k' && Math.abs(tc - fc) === 2) { const rf = tc > fc ? 7 : 0, rt = tc > fc ? 5 : 3; B[fr][rt] = B[fr][rf]; B[fr][rf] = ''; } }
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const R = flip ? 7 - r : r, C = flip ? 7 - c : c, p = B[R][C], hl = show && ((R === fr && C === fc) || (R === tr && C === tc));
      h += `<i data-sq="${'abcdefgh'[C]}${8 - R}"${c === 0 ? ` data-r="${8 - R}"` : ''}${r === 7 ? ` data-f="${'abcdefgh'[C]}"` : ''} class="${(R + C) % 2 ? 'd' : 'l'}${p ? (p === p.toUpperCase() ? ' pw' : ' pb') : ''}${hl ? ' hl' : ''}">${p ? `<img src="pieces/${p === p.toUpperCase() ? 'w' : 'b'}${p.toUpperCase()}.svg" alt="${PNAME[p.toLowerCase()]}" draggable="false">` : ''}</i>`; }
    const cx = c => ((flip ? 7 - c : c) + .5) * 12.5, cy = r => ((flip ? 7 - r : r) + .5) * 12.5, ax = cx(fc), ay = cy(fr), bx = cx(tc), by = cy(tr), dl = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / dl, uy = (by - ay) / dl, hx = bx - ux * 5, hy = by - uy * 5, n2 = v => v.toFixed(1);
    return `<div class="qb${show ? '' : ' play'}" data-best="${e.b.slice(0, 4)}" data-side="${e.f.split(' ')[1]}" data-k="${e.k}">${h}${show && !after ? `<svg viewBox="0 0 100 100" aria-hidden="true"><line x1="${n2(ax + ux * 3.5)}" y1="${n2(ay + uy * 3.5)}" x2="${n2(hx)}" y2="${n2(hy)}"/><polygon points="${n2(bx)},${n2(by)} ${n2(hx - uy * 3.2)},${n2(hy + ux * 3.2)} ${n2(hx + uy * 3.2)},${n2(hy - ux * 3.2)}"/></svg>` : ''}</div>`; }
  const WON = new Set(), won = (h, open, k) => { k = String(k); if (!open.has('qz:s' + k)) { WON.delete(k); return h; } const first = !WON.has(k); WON.add(k);
    const m = /data-best="([a-h][1-8])([a-h])([1-8])" data-side="([wb])"/.exec(h); if (!m) return h; const flip = m[4] === 'b', f = m[2].charCodeAt(0) - 97, col = flip ? 7 - f : f, row = flip ? +m[3] - 1 : 8 - +m[3];
    return h.replace('class="qb"', `class="qb won${first ? ' go' : ''}"`).replace(/<\/div>$/, `<b class="tick" style="left:calc(${(col + 1) * 12.5}% - 15px);top:calc(${row * 12.5}% + 1px)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M6.5 12.5l3.6 3.6 7.4-7.8"/></svg></b></div>`); };
  function quizList(rows, theme) { const L = []; for (const r of rows || []) for (const e of (r.y && r.y.ex) || []) if (e.t && e.f && e.b) L.push({ ...e, id: r.id, u: r.u, c: r.c, d: r.t, op: r.op });
    const pri = e => e.t.includes('mate') ? 1 : theme && e.t.includes(theme) ? 0 : e.t.includes('better') ? 3 : 2; L.sort((p, q) => pri(p) - pri(q) || (q.e[0] - q.e[1]) - (p.e[0] - p.e[1])); const F = new Set(), U = L.filter(e => { const f = e.f.split(' ').slice(0, 2).join(' '); if (F.has(f)) return false; F.add(f); return true; }); U.forEach((e, k) => { e.k = k; }); return U; }
  function quiz(rows, theme, open, W, seen) {
    if (!rows) return ''; const L0 = quizList(rows, theme), pid = e => e.id + ':' + e.i, L = seen ? L0.filter(e => !seen.has(pid(e))) : L0;
    if (seen && L0.length && !L.length) return `<div class="qz"><div class="sk-gl">Find the move <span>${L0.length} of ${L0.length}</span></div><p>You have been through all ${fmt(L0.length)} positions from these games. New ones appear after your next Search.</p><button type="button" class="qz-n" data-tg="qz:reset">Start again ›</button></div>`;
    if (!L.length) return `<div class="qz"><div class="sk-gl">Find the move</div><p class="st-sub">No position saved yet. Positions are kept for games analysed from version 1.10 on: press Search to check your games again.</p></div>`;
    const e = L[seen ? 0 : [...open].filter(x => x.startsWith('qz:n')).length % L.length], k = e.k, solved = open.has('qz:s' + k), show = solved || open.has('qz:a' + k), nm = e.t.includes('mate') ? 'mate in one' : e.t.includes('better') ? 'much better move' : ((TAC[e.t[0]] && TAC[e.t[0]][0]) || e.t[0]).toLowerCase(), B = fenB(e.f), [fr, fc] = sqI(e.b.slice(0, 2)), [tr, tc] = sqI(e.b.slice(2, 4)), p = B[fr][fc], tg = B[tr][tc];
    const best = `your ${PNAME[(p || 'p').toLowerCase()]} from ${e.b.slice(0, 2)} ${tg ? 'taking on' : 'to'} ${e.b.slice(2, 4)}`;
    return `<div class="qz"><div class="sk-gl">Find the move <span>${seen ? L0.length - L.length + 1 : k + 1} of ${L0.length}</span></div><p>From your game against ${esc(e.u)}, ${DAY(e.d)}. You are ${e.c === 'w' ? 'White' : 'Black'}${e.t.includes('mate') ? '' : ` and ${evW(e.e[0])}`}. There is a ${esc(nm)} here.${show ? '' : ' Drag your piece to its square, or tap the piece and then the square.'}</p>${won(board(e, show, solved), open, k)}<p class="qz-msg" aria-live="polite"></p>`
      + (show ? `<p>${solved ? '<b class="up">Correct.</b> ' : ''}You played ${esc(e.p)} in the game.${e.t.includes('mate') ? ` Best was ${best}, mate in one.` : ''} ${e.t.includes('mate') ? '' : `Best was ${best}: you would have stayed ${evW(e.e[0])}. After your move the game was ${evW(e.e[1])}.`}${W ? ` <a href="${W.game(e.id)}" target="_blank" rel="noopener">Open game ›</a>` : ''}</p>` : `<button type="button" class="qz-b" data-tg="qz:a${k}">Show the answer</button>`)
      + (L.length > 1 ? `<button type="button" class="qz-n"${seen ? ` data-next="${esc(pid(e))}"` : ''} data-tg="qz:n${[...open].filter(x => x.startsWith('qz:n')).length}">${seen ? 'Next position' : 'Another position'} ›</button>` : '') + `</div>`; }
  // 7A share card: flat colour, logo, six pastel chips, radar (drawn on a canvas in the popup, nothing uploaded)
  const CHIP = ['#b9adf5', '#9fd0f2', '#93dbb4', '#f4cfa0', '#f4b3c0', '#ece08f'], AXES = ['Aggression', 'Tension', 'Speed', 'Endurance', 'Opening prep', 'Resilience'];
  function shareCard(W, H, d, logo) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), s = Math.min(W, H) / 630, wide = W > H * 1.3, BG = '#15181b', INK = '#f4f0e8', INK2 = '#a7a39b';
    const F = (w, z) => `${w} ${z * s}px system-ui,'Segoe UI',sans-serif`, rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = BG; g.fillRect(0, 0, W, H); const L = 58 * s, ls = 50 * s; g.textBaseline = 'middle';
    if (logo && logo.complete && logo.naturalWidth) { g.save(); rr(L, 48 * s, ls, ls, 12 * s); g.fillStyle = '#22272c'; g.fill(); g.clip(); g.drawImage(logo, L + 4 * s, 52 * s, ls - 8 * s, ls - 8 * s); g.restore(); }
    g.textAlign = 'left'; g.fillStyle = INK; g.font = F(800, 18); g.fillText('CHESS RISK SCORE', L + ls + 14 * s, 65 * s); g.fillStyle = CHIP[0]; g.font = F(700, 12); g.fillText('MY STATS', L + ls + 14 * s, 85 * s);
    const z = wide ? 1 : .92; let y = (wide ? 190 : 150) * s;
    g.fillStyle = INK2; g.font = F(600, 18); g.fillText(`${d.user} on ${d.site}`, L, y); y += 46 * s * z;
    g.fillStyle = INK; g.font = F(800, 36 * z); g.fillText('Who I play like', L, y); y += 44 * s * z; g.fillStyle = CHIP[0]; g.fillText(d.gm.nm, L, y); y += 38 * s * z;
    g.fillStyle = INK2; g.font = F(500, 19 * z); g.fillText(d.gm.d.charAt(0).toUpperCase() + d.gm.d.slice(1), L, y);
    const ch = 46 * s, gap = 10 * s, cw = wide ? 100 * s : (W - 2 * L - 2 * gap) / 3, cy0 = wide ? y + 54 * s : 476 * s;
    AXES.forEach((nm, i) => { const x = L + (i % 3) * (cw + gap), yy = cy0 + Math.floor(i / 3) * (ch + gap); rr(x, yy, cw, ch, 9 * s); g.fillStyle = CHIP[i]; g.fill(); g.fillStyle = BG; g.font = F(800, 19); g.fillText(d.me[i] == null ? '–' : String(d.me[i]), x + 11 * s, yy + 17 * s); g.font = F(600, 11.5); g.fillText(nm, x + 11 * s, yy + 35 * s); });
    const rx = wide ? W * .76 : W / 2, ry = wide ? H / 2 + 14 * s : 372 * s, R = (wide ? 150 : 82) * s, pt = (i, v) => { const a = -Math.PI / 2 + i * Math.PI / 3, r = R * (v || 0) / 100; return [rx + r * Math.cos(a), ry + r * Math.sin(a)]; };
    g.lineWidth = 1.2 * s; g.strokeStyle = 'rgba(255,255,255,.09)'; for (const v of [25, 50, 75, 100]) { g.beginPath(); for (let i = 0; i < 6; i++) { const [x, yy] = pt(i, v); i ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.closePath(); g.stroke(); }
    for (let i = 0; i < 6; i++) { const [x, yy] = pt(i, 100); g.beginPath(); g.moveTo(rx, ry); g.lineTo(x, yy); g.stroke(); }
    const path = vals => { g.beginPath(); vals.forEach((v, i) => { const [x, yy] = pt(i, v); i ? g.lineTo(x, yy) : g.moveTo(x, yy); }); g.closePath(); };
    path(d.me); g.fillStyle = 'rgba(185,173,245,.28)'; g.fill(); g.strokeStyle = CHIP[0]; g.lineWidth = 3.4 * s; g.lineJoin = 'round'; g.stroke();
    d.me.forEach((v, i) => { const [x, yy] = pt(i, v); g.beginPath(); g.arc(x, yy, 5 * s, 0, 7); g.fillStyle = CHIP[0]; g.fill(); });
    if (wide) AXES.forEach((nm, i) => { const a = -Math.PI / 2 + i * Math.PI / 3, rl = R + 42 * s, x = rx + rl * Math.cos(a), yy = ry + rl * Math.sin(a); g.textAlign = Math.abs(x - rx) < 4 ? 'center' : x > rx ? 'left' : 'right'; g.fillStyle = INK2; g.font = F(600, 15); g.fillText(nm, x, yy - 10 * s); g.fillStyle = INK; g.font = F(800, 22); g.fillText(d.me[i] == null ? '–' : String(d.me[i]), x, yy + 13 * s); });
    g.textAlign = 'left'; g.fillStyle = INK2; g.font = F(500, 14); g.fillText(`${d.n} games, ${DAY(d.from)} to ${DAY(d.to)}`, L, H - 34 * s);
    return cv; }
  function radarData(Y) { return Y && Y.st && Y.st.n ? { me: radarVals(Y, 'me'), th: radarVals(Y, 'th') } : null; }
  function profile(rows, Y, open, extra, moved, opt) {
    const tipOnce = tipFn(new Set(), open);
    const out = [], pts = r => r.r === 'w' ? 1 : r.r === 'd' ? .5 : 0, sc = a => a.length ? 100 * a.reduce((t, r) => t + pts(r), 0) / a.length : null;
    if (rows && rows.length >= 10) {
      const all = sc(rows), res = [['Under 20 moves', r => r.x[14] < 40], ['20 to 40 moves', r => r.x[14] >= 40 && r.x[14] <= 80], ['Over 40 moves', r => r.x[14] > 80]].map(([nm, f]) => { const a = rows.filter(f); return [nm, a.length, sc(a)]; });
      const ok = res.filter(r => r[1] >= 10), hi = ok.slice().sort((a, b) => b[2] - a[2])[0], lo = ok.slice().sort((a, b) => a[2] - b[2])[0];
      out.push({ k: 'pf-len', tone: '', title: 'Game length', head: hi && lo && hi !== lo ? `You score best in ${LENW[res.indexOf(hi)]}: ${b(P0(hi[2]))}) and worst in ${LENW[res.indexOf(lo)]}: ${b(P0(lo[2]))}).` : `Your score by game length (${P0(all)} overall).`,
        body: tbl(['Games', 'Score'], res.map(r => [r[0], fmt(r[1]), r[2] == null ? '–' : [P0(r[2]), r[1] >= 10 ? toneOf(r[2], all, 8) : '']])) + `<p>Score counts a draw as half. Green and orange: 8 points or more above or below your ${P0(all)} overall.</p>` });
      // H2: losses over before move 25, against your opponents' losses to you
      const L = rows.filter(r => r.r === 'l' && r.x[14] != null), Wn = rows.filter(r => r.r === 'w' && r.x[14] != null);
      if (L.length >= 10 && Wn.length >= 10) { const me = share(L.filter(r => r.x[14] <= 48).length, L.length), th = share(Wn.filter(r => r.x[14] <= 48).length, Wn.length), t = toneOf(me, th, 5, false), k = L.filter(r => r.x[14] <= 48).length;
        out.push({ k: 'pf-short', tone: t, title: 'Early losses', head: `${b(P0(me), t)} of your losses (${k} of ${L.length}) were over before move 25. Your opponents' losses to you ended that early ${P0(th)} of the time.`,
          body: tbl(['Games', 'Early'], [['Your losses', fmt(L.length), P0(me)], ['Their losses (your wins)', fmt(Wn.length), P0(th)]]) + '<p>Early means the game ended by move 25. Orange or green: 5 points or more more or less often than your opponents.</p>', tip: t === 'down' ? tipOnce('opening') : '' }); }
    }
    if (Y) {
      const MT = Object.entries(Y.mt).filter(([, v]) => v.me + v.th), dN = MT.reduce((t, [, v]) => t + v.me, 0), sN = MT.reduce((t, [, v]) => t + v.th, 0);
      if (dN + sN >= 3) { const sig = MT.slice().sort((a, b) => b[1].me - a[1].me)[0], bad = MT.slice().sort((a, b) => b[1].th - a[1].th)[0];
        const MP = (Y.mp && Y.mp.me) || {}, mpN = Object.values(MP).reduce((x, y) => x + y, 0), mpTop = Object.entries(MP).sort((p, q) => q[1] - p[1])[0];
        out.push({ k: 'pf-mate', tone: '', title: 'Mate patterns', head: (sig[1].me ? `You do well finishing with ${b(sig[0].toLowerCase())} mates: ${sig[1].me} of your ${dN} mates.` : `You delivered ${b(fmt(dN))} mates.`)
            + (mpTop && mpN >= 2 ? ` The mate in one you miss most is the ${b(mpTop[0].toLowerCase() + ' mate', 'down')}: ${mpTop[1]} of the ${mpN} mates in one you missed.` : bad[1].th ? ` You get mated most by ${b(bad[0].toLowerCase())}: ${bad[1].th} of the ${sN} times.` : ''),
          body: tbl(['Gave', 'Took', 'Missed'], MT.concat(Object.keys(MP).filter(k => !Y.mt[k] || !(Y.mt[k].me + Y.mt[k].th)).map(k => [k, { me: 0, th: 0 }])).sort((p2, q2) => (q2[1].me + q2[1].th + (MP[q2[0]] || 0)) - (p2[1].me + p2[1].th + (MP[p2[0]] || 0))).map(([k2, v]) => [k2, fmt(v.me), fmt(v.th), fmt(MP[k2] || 0)]))
            + `<p>Gave: mates you delivered. Took: mates you were given. Missed: mates in one you had and did not play, named by the mate the engine's move would have given (only mates in one can be named, because the engine gives the first move of a longer mate, not the whole line).</p>` }); }
      const T = Y.tac, ks = Object.keys(T).filter(k => T[k].me[1] + T[k].th[1]).sort((p, q) => (T[q].me[1] + T[q].th[1]) - (T[p].me[1] + T[p].th[1]));
      if (ks.length) {
        // totals count each chance once (a chance can fit several themes); defensive moments are not tactics you had
        const sum = w => Y.tacN && Y.tacN[w][1] ? Y.tacN[w] : ks.filter(k => k !== 'defensive').reduce((t, k) => [t[0] + T[k][w][0], t[1] + T[k][w][1]], [0, 0]), me = sum('me'), th = sum('th'), cell = (a, i) => i === 0 ? fmt(a[0]) : fmt(a[1] - a[0]);
        const t = toneOf(share(...me), share(...th)) === 'down' ? 'down' : '';
        const enough = ks.filter(k => !CTX.has(k) && T[k].me[1] >= 5).map(k => ({ k, miss: share(T[k].me[1] - T[k].me[0], T[k].me[1]), m: T[k].me[1] - T[k].me[0], n: T[k].me[1], f: T[k].me[0] }));
        const worst = enough.slice().sort((a, b) => b.miss - a.miss)[0], best = enough.slice().sort((a, b) => a.miss - b.miss)[0];
        const extraLine = worst && best && worst !== best ? ` You struggle most with ${b(TNAME[worst.k])}: you missed ${worst.m} of ${worst.n} (${P0(worst.miss)}). You do best with ${b(TNAME[best.k])}: you found ${best.f} of ${best.n} (${P0(100 - best.miss)}).` : '';
        const cellT = (a, tn) => !a[1] ? '<span><small>none</small></span>' : `<span class="${tn}"><small>${fmt(a[0])}/${fmt(a[1])}</small> <b>${P0(share(a[0], a[1]))}</b></span>`;
        out.push({ k: 'pf-tac', tone: t, title: 'Tactic profile', head: `You found ${b(P0(share(me[0], me[1])), t)} of the tactics you had (${fmt(me[0])} of ${fmt(me[1])}), compared with ${P0(share(th[0], th[1]))} for your opponents.${extraLine}`,
          body: `<div class="tpr h"><span>Tactic</span><span>You found</span><span>You allowed</span></div>`
            + ks.map(k => { const nm = TAC[k] ? TAC[k][0] : k, tn = T[k].me[1] >= 10 && T[k].th[1] >= 10 ? toneOf(share(...T[k].me), share(...T[k].th)) : '';
              return `<div class="tpr"><span class="tip" title="${esc(TAC_TIP[k] || '')}">${nm}</span>${cellT(T[k].me, tn)}${cellT(T[k].th, '')}</div>`; }).join('')
            + `<p>You found: the tactics you had and how many you played. You allowed: the tactics your mistakes handed your opponents and how many they played. Green or orange: you find a bigger or smaller share than your opponents do (10 chances or more each). One chance can fit several themes, so the rows add up to more than the totals. Defensive move counts the moments in a level game when you were in check, a rook or queen of yours was under attack, or two of your pieces were at once. Hover over a theme for what it is.</p>` });
      }
    }
    if (Y && Y.sig && Y.sig.mn >= 10 && Y.sig.tn >= 10) { const G = Y.sig, me = G.me.map(v => share(v, G.mn)), th = G.th.map(v => share(v, G.tn)), i = me.indexOf(Math.max(...me)), t = toneOf(me[i], th[i], 5, false);
      const SIGN_TIP = ['Their king had little pawn cover or had left its corner.', 'One of their pieces had no defender.', 'Two of their pieces stood on one line that your long-range piece could reach.', 'Two of their big pieces were a knight jump apart, so one knight could hit both.', 'One of their pieces had no safe square to go to.', 'One of their pieces was the only guard of two things at once.', 'None of their pieces stood near their king.'];
      out.push({ k: 'pf-sig', tone: t, title: 'Warning signs', head: `When you missed a tactic, the most common warning sign was that ${SIGN_HEAD[i]}: ${b(P0(me[i]), t)} of your misses. Your opponents: ${P0(th[i])}.`,
        body: tbl(['You', 'Opp.'], SIGN_NAMES.map((nm, j) => [`<span class="tip" title="${esc(SIGN_TIP[j])}">${nm}</span>`, [P0(me[j]), toneOf(me[j], th[j], 5, false)], P0(th[j])])) + `<p>Seven signs that a tactic is nearby, and how often each was on the board when a tactical best move got missed: ${fmt(G.mn)} of your misses, ${fmt(G.tn)} of your opponents'. A miss can show several signs. Orange: 5 points or more more often than your opponents.</p>`, tip: t === 'down' ? tipOnce('signals') : '' }); }
    { const th = Y && Y.tac ? Object.keys(Y.tac).filter(k => !CTX.has(k) && Y.tac[k].me[1] >= 5).sort((p, q) => (Y.tac[q].me[1] - Y.tac[q].me[0]) / Y.tac[q].me[1] - (Y.tac[p].me[1] - Y.tac[p].me[0]) / Y.tac[p].me[1])[0] : null, ql = quizList(rows, th);
      out.push({ k: 'pf-quiz', tone: '', title: 'Find the move', head: ql.length ? `Find the move: ${b(fmt(ql.length))} positions from your own games where you missed a tactic, a mate in one or a much better move.` : 'Find the move: positions from your own games appear here after your next Search.', body: quiz(rows, th, open, opt && opt.W) }); }
    const at = out.findIndex(x => x.k === 'pf-tac'), mv = moved || [];
    const qi = out.findIndex(x => x.k === 'pf-quiz'); if (qi >= 0) out.unshift(...out.splice(qi, 1));
    if (at >= 0) out.splice(out.findIndex(x => x.k === 'pf-tac') + 1, 0, ...mv); else out.push(...mv);
    const all = out.concat(extra || []);
    const G1 = new Set(['pf-len', 'pf-short', 'pf-mate', 'pf-hab']), g1 = all.filter(x => G1.has(x.k)), g3 = all.filter(x => x.k === 'pf-quiz'), g2 = all.filter(x => !G1.has(x.k) && x.k !== 'pf-quiz');
    const sec = (t, a, post) => a.length || post ? `<div class="pf-g">${t}</div>${a.length ? `<div class="si-body pf-rows">${a.map(it => item(open, it)).join('')}</div>` : ''}${post || ''}` : '';
    return sec('How your games go', g1) + sec('Where your games go wrong', g2, '<div id="sf-tgt"></div>') + (g3.length ? `<button type="button" class="st-link sx-fold pf-tr" data-goto="train">Practise positions from your games in Train ›</button>` : '');
  }
  function moved(Q, Y, W, open, skItems, rows) {
    const used = new Set(), tip = tipFn(used, open), base = Q ? (phaseItems(Q, Y, W, tip, rows, open).Profile || []) : [];
    const sk = (skItems || []).filter(x => x.phase === 'Profile').map(x => ({ ...x, tip: x.tone === 'down' ? tip(x.tipKey) : '' }));
    return sk.concat(base);
  }
  return { skills, insights, style, profile, moved, TIPS, shareCard, radarData, targeted, train };
})();
