// My cheater stats page inside the popup (Chess.com and Lichess). It only draws what the background scan writes (keys crsHistRun
// and crsHistRunLi) and sends it commands; closing the popup does not stop a scan. Nothing is requested until you search.
// Two lenses on the same games: "Recent form" (your own results, no opponent look-ups needed, so it appears as soon as the games
// are read) and "Cheater lens" (how many opponents were later banned, which needs every opponent checked).
(() => {
  const KEYS = { cc: 'crsHistRun', li: 'crsHistRunLi' }, PREF = 'crsHistPrefs', $ = id => document.getElementById(id);
  const H = typeof CRS_HIST !== 'undefined' ? CRS_HIST : null;
  const WORDS = {
    cc: { site: 'Chess.com', banned: 'banned accounts', opp: 'Banned opponents', what: 'banned for cheating', member: u => `https://www.chess.com/member/${encodeURIComponent(u)}`, game: g => `https://www.chess.com/game/${g}`,
      note: 'Chess.com marks an account "fair play violations" only after banning it; that is the count above. Other closures are counted apart. Rated standard chess only. Some cheaters are never caught, so these numbers are a floor.' },
    li: { site: 'Lichess', banned: 'marked accounts', opp: 'Marked opponents', what: 'marked by Lichess for breaking its rules (mostly engine use)', member: u => `https://lichess.org/@/${encodeURIComponent(u)}`, game: g => `https://lichess.org/${g}`,
      note: 'Lichess marks an account when it breaks the rules, mostly engine use but sometimes other violations; that is the count above. Closed accounts are counted apart. Rated standard chess only. Some cheaters are never caught, so these numbers are a floor.' },
  };
  const RANGES = { g50: { label: 'your last 50 games' }, recent: { label: 'your last 100 games' }, g250: { label: 'your last 250 games' }, g500: { label: 'your last 500 games' }, medium: { label: 'your last 1,000 games', hint: 'A bigger sample: takes a few minutes.' },
    d1: { label: 'today' }, wk: { label: 'this week' }, mo: { label: 'this month' }, d90: { label: 'the last 3 months' }, d180: { label: 'the last 6 months' }, d365: { label: 'the last year', hint: 'Can take a few minutes if you play a lot.' }, full: { label: 'your whole career', hint: 'Can take hours on a long history. You can pause and carry on later.' } };
  const PILL = { 'READING GAMES': ['run', 'Reading games'], 'CHECKING OPPONENTS': ['run', 'Checking opponents'], FINISHED: ['ok', 'Complete'], PAUSED: ['stop', 'Paused'], STOPPED: ['stop', 'Stopped'], READY: ['idle', 'Ready'] };
  const TERMINAL = ['FINISHED', 'PAUSED', 'STOPPED'];
  const fmt = n => Number(n).toLocaleString('en-US');
  const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '0%';
  const rangeLabel = (mode, tc) => { const l = RANGES[mode].label; if (!tc || tc === 'all' || mode === 'full') return l; return /games$/.test(l) ? l.replace(/games$/, tc + ' games') : `your ${tc} games in ${l}`; };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Every command must be answered by the scan in the background script. The popup page always loads fresh from disk, but an unpacked
  // extension keeps its old background script until it is reloaded, and that script may not answer or may not know this page's commands: say so instead of quietly doing the wrong thing.
  const send = m => new Promise(res => {
    const done = ok => { $('st-stale').hidden = ok; res(ok); };
    const timer = setTimeout(() => done(false), 5000);
    try { chrome.runtime.sendMessage(m, r => { void chrome.runtime.lastError; clearTimeout(timer); done(!!(r && r.ok && r.v === CRS_HIST.PROTO)); }); } catch (e) { clearTimeout(timer); done(false); }
  });
  const VALID = { cc: /^[A-Za-z0-9_-]{3,25}$/, li: /^[A-Za-z0-9_-]{2,30}$/ };
  const R = { cc: null, li: null };
  let sk = null, skRows = { cc: null, li: null }, skOpen = '', skPhase = 'Opening';
  const sxOpen = new Set();
  let pfShut = new Set();      // Profile headings the user closed (by their text); saved in prefs
  function pfApply() {
    for (const l of document.querySelectorAll('#st-form .lbl.t-head')) {
      const key = l.textContent.trim(), shut = pfShut.has(key); l.classList.add('pf-h'); l.classList.toggle('pf-shut', shut); l.setAttribute('role', 'button'); l.setAttribute('aria-expanded', String(!shut)); l.tabIndex = 0;
      for (let n = l.nextElementSibling; n && !(n.classList.contains('lbl') && n.classList.contains('t-head')); n = n.nextElementSibling) n.classList.toggle('pf-hid', shut);
    }
  }      // v2 insight rows that are open (Skills phases and Insights)
  let shareData = null;      // 7A: what the share card is drawn from, set when the You tab paints
  let sel = 'cc', range = 'recent', lens = 'ins', tcPick = 'all', opSide = 'all', clearArmed = 0, msgBad = false, starting = null;   // starting: the scan is requested but not yet reported

  const ago = t => { const d = Math.floor((Date.now() / 1000 - t) / 86400); return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 60 ? d + 'd ago' : new Date(t * 1000).toISOString().slice(0, 10); };
  const saved = p => (R[p] && R[p].user) || '';
  const say = (t, bad) => { $('st-msg').textContent = t; $('st-msg').classList.toggle('bad', !!bad); msgBad = !!bad; };
  const busyNow = r => !!(r && r.busy && !TERMINAL.includes(r.state));          // a scan that has already ended is not busy, even if the last flag is still on its way
  const anyBusy = () => busyNow(R.cc) || busyNow(R.li);
  const prefs = () => { try { chrome.storage.local.set({ [PREF]: { range, lens, tc: tcPick, side: opSide, site: sel, phase: skPhase, shut: [...pfShut] } }); } catch (e) {} };

  // ── Recent form ──
  const tot3 = a => a[0] + a[1] + a[2];
  const score3 = a => (a[0] + a[1] / 2) / (tot3(a) || 1);
  const scoreRow = (label, a) => { const m = tot3(a), shown = Math.round(score3(a) * 100); return m ? `<div class="sf-row"><span title="${esc(label)}">${esc(label)}</span><small>${fmt(m)}</small><b class="${shown > 50 ? 'up' : shown < 50 ? 'down' : ''}">${shown}%</b></div>` : `<div class="sf-row empty"><span>${esc(label)}</span><small>0</small><b>–</b></div>`; };
  // Insights, most useful first: how the games ended (against typical at your rating), what the engine says to work on, then openings. All of it only where the numbers are big enough to mean something.
  const xl = (to, k, text) => `<button type="button" class="st-link st-xl" data-goto="${to}"${k ? ` data-open="${k}"` : ''}>${text}</button>`;
  function typicalTimeLoss(P) {       // % of games lost on time at your rating, each time control weighted by its games
    const bench = typeof CRS_SKBENCH !== 'undefined' ? CRS_SKBENCH[sel] : null; if (!bench) return null;
    let sum = 0, n = 0;
    for (const g in P.by || {}) { const B = bench[g], Q = P.by[g], m = B && B.m.timeloss; if (!m) continue; let best = null; for (const k in Q.tc) if (Q.tc[k].b && (!best || Q.tc[k].n > best.n)) best = Q.tc[k]; if (!best) continue; sum += Q.n * (m[0] + m[1] * Math.max(B.lo, Math.min(B.hi, best.b[1]))); n += Q.n; }
    return n ? sum / n : null;
  }
  // stacked bar of counts, with a key under it: parts = [[label, count, tone]]
  // one bar: your score filled, a tick where typical is
  const tickBar = (label, you, ref, cls, right) => `<div class="ib-row"><span>${label}</span><span class="ib-tr"><u class="${cls}" style="width:${Math.round(you * 100)}%"></u><s style="left:${Math.round(ref * 100)}%"></s></span><b class="${cls}">${right}</b></div>`;
  const WHITE_SCORE = 0.533;      // White's average score, measured over 2,820 stored rated games
  // gaps: the skills already listed at the top, so their numbers are not said again here
  function insights(P, Q, gaps) {
    const out = [], L = P.l, W = P.w, hl = (P.how && P.how.l) || {}, hw = (P.how && P.how.w) || {};
    // how your games ended: one plain table, a row per way of ending, wins and losses side by side
    const ENDS = [['Checkmate', o => o.mate], ['Resigned', o => (o.resign || 0) + (o.other || 0)], ['On time', o => o.time], ['Abandoned', o => o.abandon]];
    const bars = `<p>How your games ended:</p>` + gTab(['Wins', 'Losses'], ENDS.filter(([, f]) => f(hw) || f(hl)).map(([lbl, f]) => [lbl, fmt(f(hw) || 0), fmt(f(hl) || 0)]));
    if (hl.time >= 3 && hl.time / L >= 0.15 && !gaps.time) {
      const y = 100 * hl.time / P.n, t = typicalTimeLoss(P), v = t == null || !SK ? 'level' : SK.verdict(y ? 100 * t / y : 200), c = v === 'behind' ? 'down' : v === 'ahead' ? 'up' : '';
      // at or under typical is not a problem: it goes in the calm line
      if (t != null && v !== 'behind') out.push({ calm: 'time losses', line: `Time losses: <b>${fmt(hl.time)} of your ${fmt(L)}</b> losses were on time, ${y.toFixed(0)}% of your games. Typical at your rating is ${t.toFixed(0)}%.` });
      else out.push({ k: 'ends', ic: 'flag', tone: c, head: `<b>${fmt(hl.time)} of your ${fmt(L)}</b> losses were on time.`, more: (t == null ? '' : `<p>That is <b class="${c}">${y.toFixed(0)}%</b> of your games. Typical at your rating is ${t.toFixed(0)}%.</p>`) + bars, to: 'form' });
    } else if (W + L && !gaps.time) {
      const big = Object.entries(hl).sort((a, b) => b[1] - a[1])[0], word = { mate: 'by checkmate', resign: 'by resigning', time: 'on time', abandon: 'by abandoning', other: 'in other ways' };
      if (big) out.push({ k: 'ends', ic: 'flag', head: `Most of your losses came ${word[big[0]] || 'in other ways'}: <b>${fmt(big[1])} of ${fmt(L)}</b>.`, more: bars, to: 'form' });
    } else if (gaps.time) gaps.time.more += bars;
    if (Q && Q.short.n >= 10) {
      const s = Q.short;
      if (s.s / s.n >= .3) out.push({ k: 'short', ic: 'skip', tone: 'down', head: `<b>${fmt(s.s)} of your ${fmt(s.n)}</b> losses ${s.s === 1 ? 'was' : 'were'} over before move 25.`, more: `<p>Many of your losses come early, so the opening is costing you.</p>` });
      else out.push({ calm: 'early losses', line: `Early losses: <b>${fmt(s.s)} of your ${fmt(s.n)}</b> losses ended before move 25.` });
    }
    // each colour in turn: your score against typical, then your best and worst opening with that colour.
    // Openings are judged against your own score with that colour, and by the engine when it has seen them: is it the opening, or what comes after?
    const pc = a => Math.round(score3(a) * 100), tone3 = (v, ref) => v - ref >= .03 ? 'up' : v - ref <= -.03 ? 'down' : '';
    const floor = Math.max(5, Math.round(P.n * 0.03)), calmOps = [];
    for (const [side, all, set, typ] of [['White', P.cw, P.opw || {}, WHITE_SCORE], ['Black', P.cb, P.opb || {}, 1 - WHITE_SCORE]]) {
      const n = tot3(all); if (n < 10) continue;
      const me = score3(all), c = tone3(me, typ);
      out.push({ k: 'col' + side[0], ic: 'half', tone: c, head: `As ${side} you score <b class="${c}">${pc(all)}%</b>. Typical is ${Math.round(typ * 100)}%.`,
        more: `<p>Over ${fmt(n)} games as ${side}.</p>`, to: 'form' });
      // an opening is named only when it has 15+ games and differs from the rest of your games with that colour by more than chance (95%, two-sided)
      const z = k => { const a = set[k], r = all.map((x, i) => x - a[i]), na = tot3(a), nr = tot3(r); if (nr < 5) return 0;
        const pr = score3(r), v = (r[0] + r[1] / 4) / nr - pr * pr; return v > 0 ? (score3(a) - pr) / Math.sqrt(v / na + v / nr) : 0; };
      const sig = Object.keys(set).filter(k => tot3(set[k]) >= Math.max(15, floor) && Math.abs(z(k)) >= 1.96).sort((x, y) => Math.abs(z(y)) - Math.abs(z(x))).slice(0, 2);
      if (!sig.length) { calmOps.push(side); continue; }
      // what the engine saw at move 15, read the right way round for a strong or a weak opening
      const why = (k, worse) => { const e = Q && Q.lines.find(l => l.name === k && l.c === side[0].toLowerCase()); if (!e) return '';
        const at = e.ev >= .3 ? 'ahead' : e.ev <= -.3 ? 'behind' : 'level', by = at === 'level' ? '' : ` (${Math.abs(e.ev).toFixed(1)} pawns at move 15)`;
        return worse ? (at === 'behind' ? ` You come out of the opening behind${by}, so the opening is the problem.` : ` You come out of the opening ${at}${by}, so the trouble comes later.`)
          : (at === 'ahead' ? ` You come out of the opening ahead${by}.` : ` You come out of the opening ${at}${by} and still score well, so your middlegame is doing the work.`); };
      const one = k => `<b>${esc(k)}</b> <b class="${z(k) > 0 ? 'up' : 'down'}">${pc(set[k])}%</b>`;
      out.push({ k: 'op' + side[0], ic: 'book', tone: sig.every(k => z(k) > 0) ? 'up' : sig.every(k => z(k) < 0) ? 'down' : '', head: `As ${side}, ${sig.map(one).join(' and ')}, against your ${pc(all)}% overall.`,
        more: sig.map(k => { const r = all.map((x, i) => x - set[k][i]); return `<p>${esc(k)}: <b>${pc(set[k])}%</b> over ${fmt(tot3(set[k]))} games. Your other ${side} games: ${pc(r)}% over ${fmt(tot3(r))}. A gap this big is unlikely to be luck.${why(k, z(k) < 0)}</p>`; }).join(''), to: 'form' });
    }
    if (calmOps.length) out.push({ calm: 'openings', line: `Openings: none of your ${calmOps.join(' or ')} openings scores differently from the rest by more than chance.` });
    return out;
  }
  const HABW = { 'After a loss': 'after a loss', 'After two losses': 'after two losses in a row', 'After a win': 'after a win', 'Games 1 to 5': 'in the first five games of a sitting', 'Game 6 onwards': 'from the sixth game of a sitting', Mornings: 'in the mornings', Afternoons: 'in the afternoons', Evenings: 'in the evenings', Nights: 'at night' };
  function habitsInto(P) {
    const G = H && H.habits(P); $('sf-habbox').hidden = !G || !G.rows.length; if ($('sf-habbox').hidden) return;
    $('sf-habits').innerHTML = G.rows.filter(r => r.n >= 5).map(r => { const d = r.n >= 15 ? r.you - r.rest : 0, c = d >= .05 ? 'up' : d <= -.05 ? 'down' : ''; return `<div class="sf-row"><span title="${esc(r.label)}">${esc(r.label)}</span><small>${fmt(r.n)}</small><b class="${c}">${Math.round(r.you * 100)}%</b></div>`; }).join('');
    const f = G.flag, how = 'Your score in different situations, green or orange when 5 points or more above or below your other games (15 games or more). After a loss and after a win: the very next game. Games 1 to 5 and game 6 onwards: where the game falls in a sitting, which is games played less than an hour apart. Afternoons, evenings and nights follow this computer\'s clock.';
    $('sf-habnote').innerHTML = how + ' ' + (f ? `${esc(f.label)} stands out: ${Math.round(f.you * 100)}% against ${Math.round(f.rest * 100)}% in your other games, a gap too big to be luck.` : 'None of the gaps is bigger than luck would produce, so none of these is a habit yet.');
  }
  function renderForm(All) {
    const tc = tcPick !== 'all' && range === 'full' ? tcPick : null, P = tc ? All.by[tc] : All;      // a career scan reads everything, so it filters here; any other range was fetched for this time control
    const n = P.n, sc = n ? (P.w + P.d / 2) / n : 0, pc = x => n ? Math.round(x / n * 100) + '%' : '–';
    { const typ = typicalOf(P), c = sc - typ >= .03 ? 'up' : sc - typ <= -.03 ? 'down' : ''; $('sf-big').textContent = (sc * 100).toFixed(1) + '%'; $('sf-big').className = c; $('sf-big').dataset.typ = Math.round(typ * 100); }
    $('sf-what').textContent = (tc ? `score over ${fmt(n)} ${tc} game${n === 1 ? '' : 's'}` : `score over ${rangeLabel(range, tcPick)}`) + `. Typical is ${$('sf-big').dataset.typ}%.`;
    [['w', P.w], ['d', P.d], ['l', P.l]].forEach(([k, x]) => { const e = document.querySelector('#sf-wdl .' + k); e.style.width = (x / (n || 1) * 100) + '%'; e.style.display = x ? '' : 'none'; $('sf-' + k).textContent = fmt(x); $('sf-' + k + 'p').textContent = pc(x); });
    // rating: the time control you played most, first and last rating in the sample
    let best = null; for (const k in P.tc) if (!best || P.tc[k].n > P.tc[best].n) best = k;
    const T = best && P.tc[best], haveRate = !!(T && T.a && T.b && T.b[1] && T.n >= 2);
    $('sf-ratecard').hidden = !haveRate;
    if (haveRate) {
      const diff = T.b[1] - T.a[1];
      $('sf-ratelabel').textContent = `${cap(best)} rating`; $('sf-ratenow').textContent = fmt(T.b[1]);
      $('sf-ratediff').textContent = diff === 0 ? 'no change' : (diff > 0 ? '+' : '−') + Math.abs(diff); $('sf-ratediff').className = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
      $('sf-ratefrom').textContent = `From ${fmt(T.a[1])} over ${fmt(T.n)} games`;
    }
    // last 10 games, oldest on the left
    const fm = (P.fm || []).slice(0, 10).reverse(), cells = [];
    for (let i = 0; i < 10 - fm.length; i++) cells.push('<i class="none"></i>');
    for (const [, r] of fm) cells.push(`<i class="${r}">${r.toUpperCase()}</i>`);
    $('sf-formstrip').innerHTML = cells.join('');
    const fmAll = P.fm || []; let run = 0; while (run < fmAll.length && fmAll[run][1] === fmAll[0][1]) run++;
    $('sf-formnote').textContent = 'Oldest on the left.' + (run >= 3 && fmAll[0][1] !== 'd' ? ` You have ${fmAll[0][1] === 'w' ? 'won' : 'lost'} your last ${run}${run === fmAll.length ? ' or more' : ''}.` : '');
    const hasSides = !!P.opw, opSet = (hasSides && opSide === 'w' ? P.opw : hasSides && opSide === 'b' ? P.opb : P.ops) || {}, opRows = Object.keys(opSet).sort((a, b) => tot3(opSet[b]) - tot3(opSet[a])).slice(0, 6);
    $('sf-oplabel').hidden = $('sf-ops').hidden = !Object.keys(P.ops || {}).length; $('sf-opside').hidden = !hasSides || $('sf-oplabel').hidden;
    document.querySelectorAll('#sf-opside [data-side]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.side === opSide)));
    // each opening against your own score with that colour (or overall), so green and orange mean better or worse than usual for you
    const opRef = opSide === 'w' && hasSides ? score3(P.cw) : opSide === 'b' && hasSides ? score3(P.cb) : sc, opWord = opSide === 'w' && hasSides ? ' as White' : opSide === 'b' && hasSides ? ' as Black' : '';
    $('sf-ops').innerHTML = opRows.length ? opRows.map(k => { const a = opSet[k], d = score3(a) - opRef; return `<div class="sf-row"><span title="${esc(k)}">${esc(k)}</span><small>${fmt(tot3(a))}</small><b class="${tot3(a) >= 5 && d >= .05 ? 'up' : tot3(a) >= 5 && d <= -.05 ? 'down' : ''}">${Math.round(score3(a) * 100)}%</b></div>`; }).join('') + `<p class="st-sub">Your most played. Green and orange are better or worse than the ${Math.round(opRef * 100)}% you score${opWord} overall, over 5 games or more.</p>` : '<p class="st-sub">No games with this colour.</p>';
    const rows = [['Vs higher-rated', P.hi], ['Vs similar rating', P.eq], ['Vs lower-rated', P.lo]];
    $('sf-rows').innerHTML = rows.map(([label, a]) => {
      const m = a[0] + a[1] + a[2], sc2 = H ? H.score(a) : 0, shown = Math.round(sc2 * 100);
      return m ? `<div class="sf-row"><span>${label}</span><small>${fmt(m)}</small><b class="${shown > 50 ? 'up' : shown < 50 ? 'down' : ''}">${shown}%</b></div>` : `<div class="sf-row empty"><span>${label}</span><small>0</small><b>–</b></div>`;
    }).join('');
    habitsInto(P);
    // v2 Profile rows: game length, mates, tactics, positional themes, style, habits; each row is its key stat, tap for the table
    { const use = SK ? skUse() : [], Y = typeof CRS_SX !== 'undefined' && use.length ? CRS_SX.summarize(use) : null, st = typeof CRS_SXUI !== 'undefined' ? CRS_SXUI.style(P, use, Y && Y.n ? Y : null, sxOpen) : null, extra = [];
      const sty = $('sf-styletop'); if (sty) { sty.hidden = !st; sty.innerHTML = st ? `<div class="pf-g">Your style</div>${st.html}${st.gm && Y && Y.n ? `<div class="sx-save"><span>Save my style as an image</span><button type="button" data-save="wide">Wide</button><button type="button" data-save="square">Square</button></div>` : ''}` : ''; sty._fill = !(st && CRS_SXUI.targeted) ? null : () => { const fill = () => { const tg = $('sf-tgt'); if (tg) { tg.innerHTML = CRS_SXUI.targeted(skUse(), sxOpen); sty.dataset.warm = '1'; } }; sty.dataset.warm ? fill() : setTimeout(fill, 40); }; shareData = st && st.gm && Y && Y.n ? { gm: st.gm, Y, use } : null; }
      const hb = $('sf-habbox');
      if (!hb.hidden && $('sf-habits').innerHTML) { const G = H && H.habits(P), f = G && G.flag, d = f ? (f.you < f.rest ? 'down' : 'up') : '';
        extra.push({ k: 'pf-hab', tone: d, title: 'Habits', head: f ? `You score ${d === 'down' ? 'worse' : 'better'} ${HABW[f.label] || esc(f.label).toLowerCase()}: <b class="${d}">${Math.round(f.you * 100)}%</b>, against ${Math.round(f.rest * 100)}% in your other games.` : 'Your results hold steady: after a win or a loss, early or late in a sitting and at any time of day, nothing differs by more than luck would explain.',
          body: `<div class="sf-rows">${$('sf-habits').innerHTML}</div><p>${$('sf-habnote').innerHTML}</p>` }); }
      $('sf-stylebox').hidden = true; hb.classList.add('pf-gone');      // its rows live in the Habits row now; pf-gone is never undone by the heading toggles
      const bench = typeof CRS_SKBENCH !== 'undefined' ? CRS_SKBENCH[sel] : null, okB = bench && !(tcPick !== 'all' && !bench[tcPick]);
      const Q = SK && okB && use.length >= SK.MIN_GAMES ? SK.report(use, bench) : null, mv = Q && typeof CRS_SXUI !== 'undefined' ? CRS_SXUI.moved(Q, Y && Y.n ? Y : null, WORDS[sel], sxOpen, skItemsOf(skillList(Q), WORDS[sel]), use) : [];
      $('sf-prof').innerHTML = typeof CRS_SXUI !== 'undefined' ? CRS_SXUI.profile(use, Y && Y.n ? Y : null, sxOpen, extra, mv, { W: WORDS[sel] }) : ''; if ($('sf-styletop')._fill) $('sf-styletop')._fill(); }
    $('sf-oplabel').hidden = $('sf-ops').hidden = $('sf-opside').hidden = true;      // crc: openings live in Skills › Opening now
    pfApply();
  }

  // ── Cheater lens ──
  // what the cheater numbers mean for you, for the Insights tab
  function cheatIns(v, t, W, P) {
    // what they cost you: your score against them, against your score against everyone else, in games
    const c = t.cheat, G = t.gamesChecked, whole = t.checked === t.opponents && P && P.n >= G && P.n > c.games, more = [];
    const rest = whole ? (P.w + P.d / 2 - c.w - c.d / 2) / (P.n - c.games) : null, lost = rest == null || !c.games ? 0 : (rest - c.score) * c.games, wins = Math.round(lost);
    let head, tone = '';
    if (!c.games) return [{ calm: 'cheaters', line: `Cheaters: none of your ${fmt(G)} games so far was against ${W.banned}.` }];
    if (wins < 2 && rest != null) return [{ calm: 'cheaters', line: `Cheaters: only <b>${fmt(c.games)} of your ${fmt(G)}</b> games ${c.games === 1 ? 'was' : 'were'} against ${W.banned}, and you score <b>${pc0(rest)}</b> against everyone else.` }];
    if (wins >= 2) { tone = 'down'; head = `Games against ${W.banned} cost you about <b class="down">${fmt(wins)} wins</b>.`; }
    else head = `<b>${fmt(c.games)} of your ${fmt(G)}</b> games so far ${c.games === 1 ? 'was' : 'were'} against ${W.banned}.`;
    if (c.games && rest != null) more.push(`<p>You scored <b>${pc0(c.score)}</b> in ${c.games === 1 ? 'that game' : `those ${fmt(c.games)} games`} and <b>${pc0(rest)}</b> against everyone else.${wins >= 1 ? ` Scoring your usual against them would have given you about ${fmt(wins)} more point${wins === 1 ? '' : 's'} (a draw is half).` : ''}</p>`);
    const fresh = (v.rec || []).filter(x => x.n).length; if (fresh) more.push(`<p><b>${fmt(fresh)}</b> ${fresh === 1 ? 'was' : 'were'} banned in the last two weeks.</p>`);
    return [{ k: 'cheat', ic: 'shield', tone, head, more: more.join(''), to: 'cheat' }];
  }
  function renderCheat(v, t, W, P) {
    const c = t.cheat, o = t.other, G = t.gamesChecked, share = G ? c.games / G : 0;
    $('st-big').textContent = G ? (share * 100 >= 10 ? (share * 100).toFixed(0) : (share * 100).toFixed(1)) + '%' : '0%';
    $('st-what').textContent = `of your games were against ${W.banned}`;
    $('st-about').textContent = c.games ? `About 1 in ${fmt(Math.max(1, Math.round(G / c.games)))} games` : `None of ${fmt(G)} games so far`;
    $('st-banned').textContent = fmt(c.opp); $('st-gp').textContent = fmt(c.games);
    $('st-score').textContent = c.score == null ? '–' : `${(c.score * 100).toFixed(1)}%`;
    const tot = c.w + c.d + c.l || 1;
    [['w', c.w], ['d', c.d], ['l', c.l]].forEach(([k, x]) => { const e = document.querySelector('#st-wdl .' + k); e.style.width = (x / tot * 100) + '%'; e.style.display = x ? '' : 'none'; $('st-' + k).textContent = fmt(x); $('st-' + k + 'p').textContent = c.games ? Math.round(x / tot * 100) + '%' : '–'; });
    $('st-closedline').textContent = `${fmt(o.opp)} more closed for other reasons (${fmt(o.games)} game${o.games === 1 ? '' : 's'}).`;
    const cov = v.covered;
    $('st-rtitle').hidden = $('st-rline').hidden = !cov;
    $('st-rline').textContent = !cov ? '' : v.recN
      ? `${fmt(v.recN)} of your last ${fmt(cov)} games ${v.recN === 1 ? 'was' : 'were'} against a player since ${W.what}${v.oldest <= Date.now() / 1000 - 30 * 86400 ? `, ${fmt(v.inWin)} in the last 30 days` : ''}.`
      : `None of your last ${fmt(cov)} games was against a player ${W.what}, so far. This happens days or weeks later: check again from time to time.`;
    $('st-rlist').innerHTML = (v.rec || []).map(x => `<li><span class="nm"><a href="${W.member(x.u)}" target="_blank" rel="noopener">${esc(x.u)}</a></span>${x.n ? '<span class="nw">NEW</span>' : ''}<span class="wh">${ago(x.t)}</span><span class="rs ${x.r}" title="${{ w: 'You won', d: 'Draw', l: 'You lost' }[x.r]}">${x.r.toUpperCase()}</span>${x.g ? `<a class="gl" href="${W.game(x.g)}" target="_blank" rel="noopener">game</a>` : ''}</li>`).join('');
  }

  // ── Skills: each bar runs from Behind to Ahead around what is typical at your rating ──
  const SK = typeof CRS_SK !== 'undefined' ? CRS_SK : null, SK_FULL = 60, SK_GAMES = { g50: 50, recent: 100, g250: 250, g500: 500, medium: 1000 }, SK_DAYS = { d7: 7, d30: 30, d90: 90, d365: 365 };
  const skN = () => SK_GAMES[range] || 1000;      // a period or a career covers up to the newest 1,000 games, the most that is kept
  const skRowsNow = () => { const p = sel, user = saved(p), rec = skRows[p], cut = H.daysOf(range) ? Date.now() / 1000 - H.daysOf(range) * 86400 : 0; return rec && user && rec.depth === SK.DEPTH && rec.user.toLowerCase() === user.toLowerCase() ? Object.values(rec.rows).filter(x => (tcPick === 'all' || x.tc === tcPick) && x.t >= cut) : []; };
  const skUse = () => { const bench = typeof CRS_SKBENCH !== 'undefined' ? CRS_SKBENCH[sel] : null; return !SK || !bench ? [] : skRowsNow().filter(x => bench[x.tc]).sort((a, b) => b.t - a.t).slice(0, skN()); };
  const num = (v, d = 0, unit = '%') => v.toFixed(d) + unit;
  const tag = (t, cls) => `<b${cls ? ` class="${cls}"` : ''}>${t}</b>`;
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
  const cut = rel => SK.verdict(rel) === 'level' ? '' : SK.verdict(rel);
  // where you stand after move 15, in plain words
  const evWords = v => Math.abs(v) < .3 ? 'about level' : `${Math.abs(v).toFixed(1)} pawns ${v > 0 ? 'up' : 'down'}`;
  function opLine(o) {
    const t = o.ev >= .3 ? 'ahead' : o.ev <= -.3 ? 'behind' : '';
    return `<b>${esc(o.name)} as ${o.c === 'w' ? 'White' : 'Black'}:</b> after move 15 you are usually ${tag(evWords(o.ev), t)}. You won ${o.w}, ${o.d ? `drew ${o.d}, ` : ''}lost ${o.l}.`;
  }
  function skillList(Q) {
    const M = Q.M, R = Q.me, per100 = x => x.n ? (100 * x.b / x.n).toFixed(1) : '0', timeLost = Q.blown.filter(b => b.time).length, tb = (l, m, d, unit) => !M[m] ? null : ({ l, y: num(M[m].you, d, unit), t: num(M[m].typ, d, unit), o: num(M[m].opp, d, unit), c: cut(M[m].rel) });
    const out = [
      { k: 'time', name: 'Clock', rel: M.timeloss.rel, rows: [tb('Lost on time', 'timeloss'), tb('Under 15s', 'low'), tb('Clock at move 20', 'clock20')], say: [
        Q.low.n >= 100 ? `Under 30 seconds you make ${tag(per100(Q.low))} big mistakes per 100 moves, and ${tag(per100(Q.high))} with more time.` : '',
      ], games: [] },
      { k: 'convert', name: 'Converting wins', rel: M.convert.rel, rows: [tb('Converted', 'convert')], say: [
        `You reached a winning position in ${tag(fmt(R.reach))} games and won ${tag(fmt(R.conv))} of them.`,
        Q.blown.length ? `That left ${tag(Q.blown.length, 'behind')} you did not win${timeLost ? `, and ${tag(Math.round(100 * timeLost / Q.blown.length))}% of those were lost on time` : ''}.` : '',
      ], games: Q.blown, gl: 'Wins that got away' },
      { k: 'endgame', name: 'Endgame', rel: M.endgame.rel, rows: [tb('Winning chances lost per move', 'endgame', 1)], say: [
        Q.bigs ? `${tag(Math.round(100 * Q.bigE / Q.bigs))}% of your big mistakes happen here.` : '',
      ], games: [] },
      { k: 'tactics', name: 'Tactics', rel: M.tactics.rel, rows: [tb('Big mistakes per 100', 'tactics', 1, ''), tb('Mistakes punished', 'punish')], say: [
        Q.bigs ? `${tag(Math.round(100 * Q.bigUp / Q.bigs))}% of your big mistakes came when you were already a pawn or more ahead.` : '',
      ], games: [] },
      { k: 'save', name: 'Saving lost positions', rel: M.save.rel, rows: [tb('Saved', 'save')], say: [
        `You were clearly losing in ${tag(fmt(R.worse))} games and saved ${tag(fmt(R.saved))}.`,
      ], games: Q.saved, gl: 'Games you saved' },
      { k: 'opening', name: 'Opening', rel: M.opening.rel, rows: [tb('Winning chances lost per move', 'opening', 1)], say: [
        Q.evW != null && Q.evB != null ? `After move 15 you are usually ${tag(evWords(Q.evW))} as White and ${tag(evWords(Q.evB))} as Black.` : '',
        ...Q.lines.slice(0, 2).map(opLine), ...Q.lines.slice(2).slice(-2).map(opLine),
      ], games: [] },
    ];
    return out.sort((a, b) => a.rel - b.rel);
  }
  // The skills behind typical, biggest gap first, each with its one number and one thing to do
  function skFocus(Q) {
    const M = Q.M, pc = (k, d = 0) => M[k].you.toFixed(d) + '%', tp = (k, d = 0) => M[k].typ.toFixed(d) + '%', timeLost = Q.blown.length ? Math.round(100 * Q.blown.filter(b => b.time).length / Q.blown.length) : 0, c20 = M.clock20;
    const F = {
      time: { name: 'Clock', line: `You lost on time in <b class="behind">${pc('timeloss')}</b> of games. Typical is ${tp('timeloss')}.`, act: c20 && c20.you <= c20.typ - 3 ?`You reach move 20 with ${pc('clock20')} of your clock, typical is ${tp('clock20')}. Spend less in the opening.` : c20 ? `Your clock at move 20 is normal, so the time goes later. Simplify sooner when you are ahead.` : '' },
      convert: { name: 'Converting wins', line: `You won <b class="behind">${pc('convert')}</b> of your winning positions. Typical is ${tp('convert')}.`, act: timeLost >= 30 ? `${timeLost}% of the ones that got away were lost on time, so fix the clock first.` : 'Open the games in Skills and find the move where the win went.' },
      endgame: { name: 'Endgame', line: `You give away <b class="behind">${pc('endgame', 1)}</b> of your chances per endgame move. Typical is ${tp('endgame', 1)}.`, act: Q.bigs ? `${Math.round(100 * Q.bigE / Q.bigs)}% of your big mistakes happen here. Practise basic endgames.` : 'Practise basic endgames.' },
      tactics: { name: 'Tactics', line: `You make <b class="behind">${M.tactics.you.toFixed(1)}</b> big mistakes per 100 moves. Typical is ${M.tactics.typ.toFixed(1)}.`, act: Q.bigs && Q.bigUp / Q.bigs >= .3 ? `${Math.round(100 * Q.bigUp / Q.bigs)}% of them come when you are already ahead. Check their threats before every move when winning.` : Q.firstBig ? `The first one usually comes by move ${Math.round(Q.firstBig)}. Do tactics puzzles on a timer.` : 'Do tactics puzzles on a timer.' },
      save: { name: 'Saving lost positions', line: `You saved <b class="behind">${pc('save')}</b> of your lost positions. Typical is ${tp('save')}.`, act: 'When losing, keep the position messy and set traps instead of trading down.' },
      opening: { name: 'Opening', line: `You give away <b class="behind">${pc('opening', 1)}</b> of your chances per opening move. Typical is ${tp('opening', 1)}.`, act: Q.lines.length ? `Your weakest line is ${esc(Q.lines[0].name)} as ${Q.lines[0].c === 'w' ? 'White' : 'Black'}, ${sgn(Q.lines[0].ev)} pawns after move 15. Start there.` : 'Learn the first ten moves of your two main lines.' },
    };
    return [['time', M.timeloss], ['convert', M.convert], ['endgame', M.endgame], ['tactics', M.tactics], ['save', M.save], ['opening', M.opening]].filter(([, m]) => m && SK.verdict(m.rel) === 'behind').sort((a, b) => a[1].rel - b[1].rel).map(([k]) => ({ k, ...F[k] }));
  }
  // Your games in numbers: the clock, when the mistakes come, how fast you played them, endgames
  // Each one compares you with something (your opponents in the same games, or your own other moves) and only shows when the gap is real
  const gTab = (heads, rows) => `<div class="sk-t"${heads.length === 3 ? '' : ` style="grid-template-columns:1fr${' 44px'.repeat(heads.length)}"`}><span class="h"></span>${heads.map(h => `<span class="h n">${h}</span>`).join('')}${rows.map(r => r.map((v, i) => `<span${i ? ' class="n"' : ''}>${v}</span>`).join('')).join('')}</div>`;
  const gList = (games, W, what) => games.slice(0, 5).map(g => `<div class="sk-g"><a href="${W.game(g.g)}" target="_blank" rel="noopener">${esc(g.u)}</a><span>${what(g)}</span></div>`).join('');
  const pc0 = v => v == null ? '–' : Math.round(100 * v) + '%';
  function skInsights(Q, W, gaps) {
    const M = Q.M, out = [], tone = d => d >= 5 ? 'up' : d <= -5 ? 'down' : '';
    if (Q.aheadT.length) out.push({ k: 'aheadT', ic: 'flag', tone: 'down', head: `<b class="down">${fmt(Q.aheadT.length)} of your ${fmt(Q.me.lostT)}</b> losses on time came when you were a pawn or more ahead.`, more: '<p>Games to review:</p>' + gList(Q.aheadT, W, () => 'lost on time'), to: 'skills', open: 'time' });
    // who cracks first: your opponents are about your rating, so even is about 50%
    const C = Q.crack, cn = C.me.n + C.them.n;
    if (cn >= 20) {
      const p = Math.round(100 * C.me.n / cn), t = tone(50 - p);
      if (!t) out.push({ calm: 'first mistakes', line: `First big mistake: you make it in <b>${p}%</b> of games, about even with your opponents.` });
      else out.push({ k: 'first', ic: 'alert', tone: t, head: `You made the first big mistake in <b class="${t}">${p}%</b> of your games. Even is 50%.`,
        more: gTab(['Games', 'Score', 'Move'], [['You first', fmt(C.me.n), pc0(C.me.s), C.myMove ? Math.round(C.myMove) : '–'], ['They first', fmt(C.them.n), pc0(C.them.s), C.theirMove ? Math.round(C.theirMove) : '–'], ['Neither', fmt(C.none.n), pc0(C.none.s), '–']])
          + `<p>Move is when the first big mistake usually comes.${C.myMove && C.theirMove && C.myMove < C.theirMove - 1 ? ` Yours comes <b class="down">${Math.round(C.theirMove - C.myMove)} moves</b> before theirs.` : ''}</p>`, to: 'skills', open: 'tactics' });
    }
    // think time: how often a move goes badly wrong at each speed, against your 3–20 second moves
    const T = Q.think, N = T.n, rate = (b, n) => n ? 100 * b / n : 0, r = [rate(T.fast, N[0]), rate(T.mid, N[1]), rate(T.slow, N[2])];
    if (T.g >= SK.MIN_GAMES && r[1] > 0) {
      const fx = N[0] >= 100 ? r[0] / r[1] : 0, sx = N[2] >= 40 ? r[2] / r[1] : 0, x = n => n.toFixed(1) + '×';
      const head = fx >= 1.4 && fx >= sx ? `Your moves under 3 seconds are <b class="down">${x(fx)}</b> as likely to be a big mistake.` : sx >= 1.4 ? `Your thinks of 20 seconds or more are <b class="down">${x(sx)}</b> as likely to end in a big mistake.` : '';
      if (!head && fx) out.push({ calm: 'think time', line: fx < .9 ? `Think time: your moves under 3 seconds go wrong <b>${x(fx)}</b> as often as your 3 to 20 second moves, so rushing is not the problem.` : `Think time: your moves under 3 seconds go wrong about as often as your 3 to 20 second moves (<b>${x(fx)}</b>).` });
      if (head) out.push({ k: 'think', ic: 'bolt', tone: 'down', head,
        more: gTab(['Moves', 'Big', 'Per 100'], [['Under 3 s', N[0], T.fast, r[0]], ['3–20 s', N[1], T.mid, r[1]], ['20 s+', N[2], T.slow, r[2]]].map(([l, n, b, v]) => [l, fmt(n), fmt(b), n ? v.toFixed(1) : '–']))
          + `<p>Compared with your moves of 3 to 20 seconds. Big is big mistakes.</p>` });
    }
    // endgames you started a pawn or more up, against your opponents with the same edge in the same games
    const E = Q.endB;
    if (E.up.n >= 8) {
      const me = E.up.w / E.up.n, them = E.down.n >= 8 ? E.down.l / E.down.n : null, t = them == null ? '' : tone(100 * (me - them));
      if (them != null && !t) out.push({ calm: 'pawn-up endgames', line: `Pawn-up endgames: you win <b>${pc0(me)}</b>, your opponents ${pc0(them)}.` });
      else out.push({ k: 'end', ic: 'king', tone: t, head: `You won <b class="${t}">${pc0(me)}</b> of endgames you started a pawn or more up.${them == null ? '' : ` Your opponents won ${pc0(them)}.`}`,
        more: gTab(['Games', 'Won', 'Lost'], [['Pawn up', E.up, 1], ['Level', E.even], ['Pawn down', E.down]].map(([l, o]) => [l, fmt(o.n), fmt(o.w), fmt(o.l)]))
          + (them == null ? '' : `<p>Your opponents' row is your Pawn down row the other way round.</p>`)
          + (M.endgame && !gaps.endgame && cut(M.endgame.rel) ? `<p>Each endgame move gives away <b class="${cut(M.endgame.rel)}">${num(M.endgame.you, 1)}</b> of your chances. Typical is ${num(M.endgame.typ, 1)}.</p>` : '')
          + (E.slipped.length ? '<p>Pawn-up endgames you did not win:</p>' + gList(E.slipped, W, g => g.r === 'd' ? 'drew' : g.time ? 'lost on time' : 'lost') : ''), to: 'skills', open: 'endgame' });
    }
    return out;
  }
  const skGames = (s, W) => !s.games.length ? '' : `<div class="sk-gl">${s.gl}</div>` + s.games.slice(0, 5).map(g => `<div class="sk-g"><a href="${W.game(g.g)}" target="_blank" rel="noopener">${esc(g.u)}</a><span>${s.k === 'time' ? '' : g.r === 'w' ? 'won' : g.r === 'd' ? 'drew' : g.time ? 'lost on time' : 'lost'}</span></div>`).join('');
  // the four skills as insight rows (tactics goes to Profile)
  function skItemsOf(list, W) {
    const PHK = { opening: 'Opening', tactics: 'Profile', endgame: 'Endgame', save: 'Endgame' }, word = v => v === 'behind' ? 'behind' : v === 'ahead' ? 'ahead of' : 'about level with';
    return list.filter(s => PHK[s.k]).map(s => { const v = SK.verdict(s.rel), tone = v === 'behind' ? 'down' : v === 'ahead' ? 'up' : '', r = s.rows.filter(Boolean)[0];
      return { k: 'sk-' + s.k, phase: PHK[s.k], tone, tipKey: s.k, title: s.name,
        head: r ? ({ opening: `Your opening play is ${word(v)} players your rating: each of your first 15 moves gives away <b class="${tone}">${r.y}</b> of your winning chances on average (typical ${r.t}).`,
          tactics: `Your tactics are ${word(v)} players your rating: <b class="${tone}">${r.y}</b> big mistakes per 100 moves (typical ${r.t}).`,
          endgame: `Your endgame play is ${word(v)} players your rating: each endgame move gives away <b class="${tone}">${r.y}</b> of your winning chances on average (typical ${r.t}).`,
          save: `You are ${word(v)} players your rating at saving lost positions: you held <b class="${tone}">${r.y}</b> of them (typical ${r.t}).` }[s.k]) : `${s.name}: you are ${word(v)} players your rating.`,
        body: `<div class="sk-t"><span class="h"></span><span class="h n">You</span><span class="h n">Typical</span><span class="h n">Opp.</span>${s.rows.filter(Boolean).map(x => `<span>${x.l}</span><span class="n s ${x.c}">${x.y}</span><span class="n">${x.t}</span><span class="n">${x.o}</span>`).join('')}</div>${s.say.filter(Boolean).map(x => `<p>${x}</p>`).join('')}${skGames(s, W)}` }; });
  }
  function renderSkills() {
    const p = sel, W = WORDS[p], user = saved(p), bench = typeof CRS_SKBENCH !== 'undefined' ? CRS_SKBENCH[p] : null, here = sk && sk.p === p && sk.user && sk.user.toLowerCase() === user.toLowerCase(), running = !!(sk && sk.running), mine = running && here;
    const use = skUse(), N = skN(), period = !SK_GAMES[range], noBench = tcPick !== 'all' && !(bench && bench[tcPick]), scanning = anyBusy(), done = here && sk.state === 'FINISHED' && (sk.tc || 'all') === tcPick && sk.n >= N && Math.abs((sk.days || 0) - (H.daysOf(range) || 0)) < 0.05, show = use.length >= SK.MIN_GAMES && !noBench;
    const skMin = N * SK.secondsPerGame(SK.engines(navigator.hardwareConcurrency)) / 60;
    let line = '';
    if (noBench) line = `Typical numbers for ${tcPick} on ${W.site} are not ready yet, so there is nothing to compare ${tcPick} games with.`;
    else if (mine) line = use.length < SK.MIN_GAMES ? 'Your results appear here once 30 games are analysed.' : '';
    else if (scanning) line = 'The engine starts when the opponents are checked. It runs on this computer and nothing is sent anywhere.';
    else if (here && !running && sk.state === 'STOPPED' && sk.line) line = sk.line;
    else if (done && use.length < SK.MIN_GAMES) line = sk.line || `You only have ${fmt(use.length)} rated ${tcPick === 'all' ? '' : tcPick + ' '}game${use.length === 1 ? '' : 's'} here. Skills needs at least ${SK.MIN_GAMES} to compare.`;
    else if (!show) line = `Not analysed yet. Press Search and a chess engine runs over these games on this computer, in about ${skMin < 1.5 ? 'a minute' : Math.ceil(skMin) + ' min'} at most. Nothing is sent anywhere.`;
    else if (!done && !period && use.length < N) line = `Showing the ${fmt(use.length)} games analysed so far. Press Search for the rest.`;
    $('sk-line').textContent = line; $('sk-line').classList.remove('bad');
    $('sk-out').hidden = !show;
    if (!show) return;
    const Q = SK.report(use, bench), list = skillList(Q);
    $('sk-who').innerHTML =`${esc(W.site)} · <b>${esc(user)}</b> · ${fmt(Q.n)} game${Q.n === 1 ? '' : 's'}${mine ? ' so far' : ''}${range === 'full' && Q.n >= 1000 ? ' (newest in your career)' : ''}<br>${Q.groups.map(g => `${cap(g.tc)} ${fmt(g.rt)}`).join(' · ')}`;
    // v2: Opening / Middle / Endgame / Clock. Each phase: a summary line, its skill bars, then one insight per stat that opens to the full numbers
    const PH = { Opening: ['opening'], Middle: ['tactics', 'convert'], Endgame: ['endgame', 'save'], Clock: ['time'] }, phase = PH[skPhase] ? skPhase : 'Opening';
    // crc: the skill bars are insight lines now ("you are about level with players your rating in tactics")
    const skItems = skItemsOf(list, W);
    const ks = Object.keys(PH), Y = typeof CRS_SX !== 'undefined' ? CRS_SX.summarize(use) : null;
    $('sk-rows').innerHTML = `<div class="st-tabs sx-ph" role="radiogroup" aria-label="Game phase"><i class="thumb" aria-hidden="true" style="transform:translateX(${ks.indexOf(phase) * 100}%)"></i>${ks.map(k => `<button type="button" role="radio" data-ph="${k}" aria-checked="${k === phase}">${k}</button>`).join('')}</div>`
      + (typeof CRS_SXUI !== 'undefined' ? CRS_SXUI.skills(Q, Y && Y.n ? Y : null, W, phase, sxOpen, skItems, use, opSide) : '');
    $('sk-note').hidden = true; void `Typical is from ${fmt(Q.groups.reduce((s, g) => s + bench[g.tc].n, 0))} ${W.site} player-games in ${Q.groups.length > 1 ? 'these time controls' : Q.groups[0].tc}, analysed the same way${Q.atEdge ? '; your rating is outside the range they cover, so it is compared with the nearest they have' : ''}${Q.groups.some(g => g.tc === 'daily') ? '. Daily games have no clock numbers, and typical for daily rests on few games, so treat it as rough' : ''}. Opp. is your opponents in these games. A big mistake gives away 15% or more of your winning chances. These are estimates: small gaps can be chance.`;
  }
  async function skLoad(p) { try { const k = p === 'li' ? 'crsSk_li' : 'crsSk_cc'; skRows[p] = (await chrome.storage.local.get(k))[k] || null; } catch (e) {} if (lens === 'skills' || lens === 'ins') paint(); }

  // ── Insights: one short line each, from the Form, Skills and Cheaters numbers. Press one to see the detail and a link to its tab ──
  const ICON = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M5 21V4h12l-2.5 4 2.5 4H5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
    king: '<path d="M5 18 4 8l4.5 3.5L12 5l3.5 6.5L20 8l-1 10z"/><path d="M5 21h14"/>',
    target: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    buoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m6 6 3 3M18 6l-3 3M6 18l3-3M18 18l-3-3"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    alert: '<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17v.5"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    half: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor"/>',
    skip: '<path d="M4 6l7 6-7 6zM12 6l7 6-7 6z"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  };
  const SKILL_IC = { time: 'clock', convert: 'trophy', endgame: 'king', tactics: 'target', save: 'buoy', opening: 'book' };
  const svg = (k, cls) => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const siOpen = new Set();
  const siItem = it => {
    const can = !!(it.more || it.to), open = can && siOpen.has(it.k);
    const head = `${svg(it.ic, 'si-ic ' + (it.tone || ''))}<span class="si-t">${it.head}</span>`;
    return `<div class="si-it">` + (can ? `<button type="button" class="si-h" data-si="${it.k}" aria-expanded="${open}">${head}<svg class="si-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>` : `<div class="si-h">${head}</div>`)
      + (open ? `<div class="si-m">${it.more || ''}${it.to ? `<p>${xl(it.to, it.open || '', it.to === 'form' ? 'See it in Profile' : it.to === 'skills' ? 'See it in Skills' : 'See it in Cheaters')}</p>` : ''}</div>` : '') + '</div>';
  };
  // "You scored 50.6% in your blitz games this month (212 games)." Over every game in the range, not only the analysed ones
  // A1 and B1: your score with typical from your colour mix (White scores 53.3%), coloured at 3 points like the colour lines
  function typicalOf(P) { const nw = tot3(P.cw || [0, 0, 0]), nb = tot3(P.cb || [0, 0, 0]); return nw + nb ? (nw * WHITE_SCORE + nb * (1 - WHITE_SCORE)) / (nw + nb) : .5; }
  function overallLine(P) {
    if (!P || !P.cw || !P.cb) return null; const w = [0, 1, 2].map(i => P.cw[i] + P.cb[i]), n = tot3(w); if (!n) return null;
    const tc = tcPick !== 'all' ? tcPick + ' ' : '', lab = (RANGES[range] || {}).label || '', me = score3(w), typ = typicalOf(P), c = me - typ >= .03 ? 'up' : me - typ <= -.03 ? 'down' : '', sc = (100 * me).toFixed(1) + '%';
    const where = /^your last /.test(lab) ? `in ${lab.replace(/ games$/, ` ${tc}games`)}` : lab === 'your whole career' ? `in your ${tc}games across your whole career` : `in your ${tc}games ${lab}`;
    return { tone: c, head: `You scored <b class="${c}">${sc}</b> ${where} (${/^your last /.test(lab) ? '' : fmt(n) + ' games: '}${fmt(w[0])} won, ${fmt(w[1])} drawn, ${fmt(w[2])} lost). Typical is ${Math.round(typ * 100)}%.` };
  }
  function renderInsights(P, cheat) {
    const bench = typeof CRS_SKBENCH !== 'undefined' ? CRS_SKBENCH[sel] : null, use = skUse(), noBench = tcPick !== 'all' && !(bench && bench[tcPick]);
    const Q = SK && bench && !noBench && use.length >= SK.MIN_GAMES ? SK.report(use, bench) : null;
    // the skills furthest behind players your rating come first
    const gaps = {}, top = (Q ? skFocus(Q) : []).slice(0, 3).map(f => (gaps[f.k] = { k: 'gap-' + f.k, ic: SKILL_IC[f.k], tone: 'down', head: f.line, more: f.act ? `<p>${f.act}</p>` : '', to: 'skills', open: f.k }));
    $('si-line').textContent = Q || noBench ? '' : sk && sk.running ? 'Skills findings appear here when the engine finishes.' : 'Skills findings appear here once 30 games are analysed. Press Search.';
    $('si-line').hidden = !$('si-line').textContent;
    const all = [...top, ...insights(P, Q, gaps), ...(Q ? skInsights(Q, WORDS[sel], gaps) : []), ...(cheat || [])], items = all.filter(it => !it.calm), calm = all.filter(it => it.calm);
    // the ones that came out normal for you share one line at the end
    if (typeof CRS_SXUI !== 'undefined') {      // v2: weaknesses, strengths, on par, your style
      const Y = typeof CRS_SX !== 'undefined' ? CRS_SX.summarize(use) : null, st = CRS_SXUI.style(P, use, Y && Y.n ? Y : null, sxOpen);
      $('si-body').innerHTML = CRS_SXUI.insights(all, Q, Y && Y.n ? Y : null, WORDS[sel], sxOpen, { rows: use, gm: st && st.gm, overall: overallLine(P), bench: noBench ? null : bench }); return;
    }
    if (calm.length) items.push({ k: 'calm', ic: 'check', head: `Not holding you back: ${calm.map(c => c.calm).join(', ')}.`, more: calm.map(c => `<p>${c.line}</p>`).join('') });
    $('si-body').innerHTML = items.map(siItem).join('');
  }

  function paint() {
    // keep the two boxes in step with what is saved (never while you are typing in one)
    for (const p of ['cc', 'li']) { const box = $('st-user-' + p); if (document.activeElement !== box && !box.dataset.dirty) box.value = saved(p); }
    // platform, then username, then games or period, then Search
    $('st-site-sel').value = sel; $('st-range-sel').value = range; $('st-tc-sel').value = tcPick;
    $('st-find-cc').hidden = sel !== 'cc'; $('st-find-li').hidden = sel !== 'li';
    document.querySelectorAll('#st-lens [data-l]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.l === lens)));
    { const ls = [...document.querySelectorAll('#st-lens [data-l]')].map(b => b.dataset.l); document.querySelector('#st-lens .thumb').style.transform = `translateX(${Math.max(0, ls.indexOf(lens)) * 100}%)`; }   // the segmented control's thumb slides to the open view
    $('st-rhint').textContent = RANGES[range].hint || '';
    const sameRun = x => x.mode === range && (range === 'full' || (x.tc || 'all') === tcPick), sKey = tcPick === 'all' || range === 'full' ? range : range + '|' + tcPick;
    const busy = anyBusy();
    const skBusy = !!(sk && sk.running);
    document.querySelectorAll('.st-go').forEach(b => { b.disabled = busy || skBusy; });
    if (!msgBad) say('', false);
    const r = R[sel], W = WORDS[sel], has = !!saved(sel), mine = !!(r && r.running && !TERMINAL.includes(r.state));
    if (starting && r && r.at >= starting.t && (r.running || TERMINAL.includes(r.state)) && r.mode === starting.mode && (r.tc || 'all') === starting.tc) starting = null;
    if (starting && Date.now() - starting.t > 8000) starting = null;
    const loading = has && ((mine && sameRun(r)) || (starting && starting.p === sel && sameRun(starting)));
    const active = ['cc', 'li'].map(p => R[p]).find(x => x && x.running && !TERMINAL.includes(x.state));   // a scan running anywhere: its progress and controls stay on screen whichever site or range is showing
    const v = r && r.view, t = v && v.ts && v.ts[sKey] && v.ts[sKey].checked ? v.ts[sKey] : null, P = v && v.perf && v.perf[sKey] && v.perf[sKey].n ? v.perf[sKey] : null;

    // loading card: two steps, a moving bar, a live line. It always shows something is happening.
    const pausedRun = has && !active && !skBusy && !loading && !!r && r.state === 'PAUSED' && sameRun(r);   // paused here: the card stays, with Play
    const card = loading || !!active || skBusy || pausedRun;
    $('st-load').hidden = !card;
    if (card) {
      const state = skBusy ? 'SKILLS' : active ? active.state : 'READING GAMES', pctNow = skBusy ? (sk.all ? sk.done / sk.all * 100 : 0) : active ? active.pct : 0;
      $('stp1').className = state === 'READING GAMES' ? 'on' : 'done'; $('stp2').className = state === 'CHECKING OPPONENTS' ? 'on' : state === 'SKILLS' ? 'done' : ''; $('stp3').className = state === 'SKILLS' ? 'on' : '';
      $('st-pct').textContent = pctNow && !pausedRun ? Math.round(pctNow) + '%' : '';
      if (!pausedRun) $('st-bar').style.width = Math.max(pctNow || 0, 4) + '%';
      $('st-load').classList.toggle('paused', pausedRun);
      const elsewhere = active && (active !== r || !sameRun(active)) ? `${WORDS[active.p].site}, ${rangeLabel(active.mode, active.tc)}: ` : '';
      $('st-line').textContent = pausedRun ? r.line : skBusy ? (sk.p === sel ? '' : WORDS[sk.p].site + ': ') + sk.line : active ? elsewhere + active.line : 'Starting…';
    }
    $('st-pause').hidden = skBusy || pausedRun || !active; $('st-play').hidden = !pausedRun; $('st-ctl').hidden = !active && !skBusy && !pausedRun;
    // status pill and message when nothing is running
    $('st-pill').hidden = card; $('st-line2').hidden = loading || pausedRun;
    let key = 'READY', line;
    if (!has) line = `Type your ${W.site} username, then press Search.`;
    else if (active) line = '';
    else if (r && sameRun(r) && !loading) { key = r.state; line = r.state === 'FINISHED' && (P || t) ? '' : r.line; }
    else if (P || t) { key = 'FINISHED'; line = ''; }       // this range was checked on an earlier search
    else line = `Not checked yet for ${rangeLabel(range, tcPick)}. Press Search.`;
    const [cls, label] = PILL[key] || PILL.READY;
    $('st-pill').className = 'st-pill ' + cls; $('st-state').textContent = label;
    $('st-line2').textContent = line || '';
    $('st-clear').textContent = clearArmed ? 'Press again to delete' : 'Clear saved results';
    $('st-banned-l').textContent = W.opp; $('st-note').textContent = W.note;

    // the hint is only useful before a range has been checked
    $('st-rhint').hidden = !RANGES[range].hint || !!(P || t) || loading;

    // results
    const show = has && (lens === 'form' || lens === 'ins' || lens === 'train' ? !!P : lens === 'skills' ? true : !!t);
    $('st-out').hidden = !has;
    $('st-skel').hidden = !(loading && !show);
    const tcAny = tcPick !== 'all', tcOn = tcAny && range === 'full', tT = !t ? null : !tcOn ? t : (v.tsTc && v.tsTc[range] && v.tsTc[range][tcPick]) || null, fEmpty = tcOn && P && !(P.by || {})[tcPick], cEmpty = tcOn && t && !tT;
    if (!loading && (((lens === 'form' || lens === 'ins') && fEmpty) || (lens === 'cheat' && cEmpty))) $('st-line2').textContent = lens === 'cheat' && !(v.tsTc && v.tsTc[range]) ? 'Clear saved results and search again to filter this by time control.' : `No ${tcPick} games in ${RANGES[range].label}.`;
    const insOk = !!(P && !fEmpty);
    $('st-form').hidden = lens !== 'form' || !P || fEmpty; $('st-cheat').hidden = lens !== 'cheat' || !t || cEmpty; $('st-skills').hidden = lens !== 'skills'; $('st-instab').hidden = lens !== 'ins' || !insOk; $('st-train').hidden = lens !== 'train' || !P || fEmpty;
    if (!has) return;
    const cv = tT && (tcAny ? { ...v, ...(v.recBy && v.recBy[tcPick] || { recN: 0, covered: 0, oldest: 0, inWin: 0, rec: [] }) } : v), cP = tcOn ? P && (P.by || {})[tcPick] : P;
    if (P && !fEmpty && lens === 'form') { renderForm(P); if (range === 'full' && v.fullComplete === false) $('sf-what').textContent += ' so far'; }
    if (tT && lens === 'cheat') renderCheat(cv, tT, W, cP);
    if (lens === 'skills') renderSkills();
    if (P && !fEmpty && lens === 'train') $('st-train').innerHTML = typeof CRS_SXUI !== 'undefined' && CRS_SXUI.train ? CRS_SXUI.train(SK ? skUse() : [], sxOpen, WORDS[sel]) : '';
    if (insOk && lens === 'ins') renderInsights(cP, tT ? cheatIns(cv, tT, W, cP) : '');
  }

  // Search (or Enter in the box): save the name and search the chosen range
  function search(p) {
    const box = $('st-user-' + p), v = box.value.trim(), was = saved(p);
    delete box.dataset.dirty;
    if (!v) { if (was) { send({ type: 'hist-remove', p }); send({ type: 'sk-clear', p }); R[p] = null; } say('', false); paint(); return; }
    if (!VALID[p].test(v)) { say(`That does not look like a ${WORDS[p].site} username.`, true); box.dataset.dirty = '1'; return; }
    if (anyBusy() || (sk && sk.running)) { say('A search is running. Stop it first, then search again.', true); box.value = was; return; }
    say('', false); sel = p;
    starting = { p, t: Date.now(), mode: range, tc: tcPick }; paint();
    send({ type: 'hist-search', p, user: v, mode: range, tc: tcPick }).then(ok => { if (!ok) { starting = null; paint(); } });
  }
  for (const p of ['cc', 'li']) {
    const box = $('st-user-' + p);
    box.addEventListener('input', () => { box.dataset.dirty = '1'; if (msgBad) say('', false); });
    $('st-find-' + p).addEventListener('submit', e => { e.preventDefault(); search(p); });
  }
  $('st-site-sel').addEventListener('change', e => { sel = e.target.value; prefs(); paint(); if (!saved(sel)) $('st-user-' + sel).focus(); });
  $('st-search').onclick = () => search(sel);
  // 7A: save the style card as a PNG (drawn here, nothing uploaded)
  { const logo = new Image(); logo.src = 'icons/icon128.png';
    $('st-form').addEventListener('click', e => { const bt = e.target.closest('[data-save]'); if (!bt || !shareData || typeof CRS_SXUI === 'undefined') return;
      const rd = CRS_SXUI.radarData(shareData.Y), u = shareData.use; if (!rd || !u.length) return;
      const who = (skRows[sel] && skRows[sel].user) || '', wide = bt.dataset.save === 'wide';
      const cv = CRS_SXUI.shareCard(wide ? 1200 : 1080, wide ? 630 : 1080, { user: who, site: WORDS[sel].site, gm: shareData.gm, me: rd.me, th: rd.th, n: u.length, from: u[u.length - 1].t, to: u[0].t }, logo);
      const a = document.createElement('a'); a.download = `chess-risk-style-${(who || 'me').replace(/[^\w-]/g, '')}-${wide ? 'wide' : 'square'}.png`; a.href = cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); }); }
  // playable quiz board: tap your piece then a square, or drag it; the right move solves it, a wrong one bounces back
  { let from = null, drag = null, ghost = null, moved = false;
    const mineOf = bd => bd.dataset.side === 'w' ? 'pw' : 'pb', msgOf = bd => bd.parentElement.querySelector('.qz-msg');
    const tryMove = (bd, f, t) => { const mine = mineOf(bd), msg = msgOf(bd), ok = f.dataset.sq + t.dataset.sq === bd.dataset.best; f.classList.remove('sel', 'drag');
      const pc = f.innerHTML, taken = t.innerHTML, tcls = t.className; t.innerHTML = pc; t.classList.remove('pw', 'pb'); t.classList.add(mine); f.innerHTML = ''; f.classList.remove(mine);
      if (ok) { msg.textContent = ''; sxOpen.add('qz:s' + bd.dataset.k); setTimeout(paint, 450); return; }
      msg.textContent = 'Not the best move. Try again, or tap Show the answer.';
      setTimeout(() => { f.innerHTML = pc; f.classList.add(mine); t.innerHTML = taken; t.className = tcls; }, 700); };
    const sqAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('.qb.play [data-sq]'); };
    sfBoth('pointerdown', e => { const sq = e.target.closest('.qb.play [data-sq]'); if (!sq) return; const bd = sq.closest('.qb');
      if (!sq.classList.contains(mineOf(bd))) return; drag = { bd, sq, x: e.clientX, y: e.clientY }; moved = false; }, true);
    window.addEventListener('pointermove', e => { if (!drag) return; if (!moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      if (!moved) { moved = true; if (from) { from.classList.remove('sel'); from = null; } ghost = document.createElement('div'); ghost.className = 'qdrag ' + mineOf(drag.bd); ghost.innerHTML = drag.sq.innerHTML; document.body.appendChild(ghost); drag.sq.classList.add('drag'); }
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; });
    window.addEventListener('pointerup', e => { if (!drag) return; const d = drag; drag = null; if (!moved) return; if (ghost) { ghost.remove(); ghost = null; } d.sq.classList.remove('drag');
      const t = sqAt(e.clientX, e.clientY); if (t && t !== d.sq && t.closest('.qb') === d.bd && !t.classList.contains(mineOf(d.bd))) tryMove(d.bd, d.sq, t); });
    sfBoth('click', e => { const sq = e.target.closest('.qb.play [data-sq]'); if (!sq) return; e.stopPropagation(); if (moved) { moved = false; return; }
      const bd = sq.closest('.qb'), mine = mineOf(bd), msg = msgOf(bd);
      if (!from) { if (!sq.classList.contains(mine)) { msg.textContent = 'Tap one of your own pieces first.'; return; } from = sq; sq.classList.add('sel'); msg.textContent = ''; return; }
      if (sq === from) { from.classList.remove('sel'); from = null; return; }
      if (sq.classList.contains(mine)) { from.classList.remove('sel'); from = sq; sq.classList.add('sel'); return; }
      const f = from; from = null; tryMove(bd, f, sq); }, true); }
  function sfBoth(t, f, o) { for (const id of ['sf-prof', 'sf-styletop', 'st-train']) $(id).addEventListener(t, f, o); }      // the playable boards live in both
  sfBoth('click', e => { const t = e.target.closest('[data-tg]'); if (t) { const k = t.dataset.tg; sxOpen.has(k) ? sxOpen.delete(k) : sxOpen.add(k); paint(); } });
  { const tog = e => { const l = e.target.closest('#st-form .lbl.t-head'); if (!l || (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); const k = l.textContent.trim(); pfShut.has(k) ? pfShut.delete(k) : pfShut.add(k); prefs(); pfApply(); };
    $('st-form').addEventListener('click', tog); $('st-form').addEventListener('keydown', tog); }
  $('sf-opside').addEventListener('click', e => { const k = e.target.dataset && e.target.dataset.side; if (k) { opSide = k; prefs(); paint(); } });
  $('st-tc-sel').addEventListener('change', e => { tcPick = e.target.value; prefs(); paint(); });
  $('st-range-sel').addEventListener('change', e => { range = e.target.value; prefs(); paint(); });
  // switching views: the thumb slides (CSS) and the new view fades up into place
  const PANEL = { ins: 'st-instab', form: 'st-form', skills: 'st-skills', cheat: 'st-cheat' };
  const enter = () => { const el = $(PANEL[lens]); if (!el) return; el.classList.remove('st-enter'); void el.offsetWidth; el.classList.add('st-enter'); };
  document.querySelectorAll('#st-lens [data-l]').forEach(b => b.addEventListener('click', () => { if (lens === b.dataset.l) return; lens = b.dataset.l; prefs(); paint(); enter(); }));
  $('st-pause').onclick = () => { send({ type: 'hist-pause' }); $('st-pause').disabled = true; setTimeout(() => { $('st-pause').disabled = false; }, 700); };
  $('st-play').onclick = () => { $('st-play').disabled = true; setTimeout(() => { $('st-play').disabled = false; }, 700); search(sel); };
  $('st-stop').onclick = () => { send({ type: sk && sk.running ? 'sk-stop' : 'hist-stop', p: sel }); $('st-stop').disabled = true; setTimeout(() => { $('st-stop').disabled = false; }, 700); };
  $('st-clear').onclick = () => { if (!clearArmed) { clearArmed = 1; paint(); setTimeout(() => { clearArmed = 0; paint(); }, 4000); } else { clearArmed = 0; send({ type: 'hist-clear', p: sel }); send({ type: 'sk-clear', p: sel }); } };
  $('st-reload').onclick = () => chrome.runtime.reload();
  // links between the tabs: Form asks what happened, Skills asks why, Cheaters asks whether it was fair
  $('st-out').addEventListener('click', e => { const b = e.target.closest('[data-goto]'); if (!b) return; lens = b.dataset.goto; if (b.dataset.open) { if (b.dataset.open.startsWith('phase:')) skPhase = b.dataset.open.slice(6); else if (b.dataset.open.startsWith('row:')) sxOpen.add(b.dataset.open.slice(4)); else skOpen = b.dataset.open; } prefs(); paint(); enter(); $('st-lens').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  $('si-body').addEventListener('click', e => { const t = e.target.closest('[data-tg]'); if (t) { const k = t.dataset.tg; sxOpen.has(k) ? sxOpen.delete(k) : sxOpen.add(k); paint(); return; } const b = e.target.closest('[data-si]'); if (b) { const k = b.dataset.si; siOpen.has(k) ? siOpen.delete(k) : siOpen.add(k); paint(); } });
  $('sk-rows').addEventListener('click', e => { const sd = e.target.closest('[data-side]'); if (sd) { opSide = sd.dataset.side; prefs(); paint(); return; } const ph = e.target.closest('[data-ph]'); if (ph) { skPhase = ph.dataset.ph; prefs(); paint(); return; } const t = e.target.closest('[data-tg]'); if (t) { const k = t.dataset.tg; sxOpen.has(k) ? sxOpen.delete(k) : sxOpen.add(k); paint(); return; } const b = e.target.closest('[data-sk]'); if (b) { skOpen = skOpen === b.dataset.sk ? '' : b.dataset.sk; paint(); } });
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      for (const p of ['cc', 'li']) if (ch[KEYS[p]]) { R[p] = ch[KEYS[p]].newValue || null; if (msgBad && saved(p)) say('', false); }
      if (ch.crsSkRun) sk = ch.crsSkRun.newValue || null; if (ch.crsSk_cc) skRows.cc = ch.crsSk_cc.newValue || null; if (ch.crsSk_li) skRows.li = ch.crsSk_li.newValue || null;
      paint();
    });
  } catch (e) {}
  setInterval(() => { if (starting) paint(); }, 1000);
  (async () => {
    try { const o = await chrome.storage.local.get([KEYS.cc, KEYS.li, PREF, 'crsSkRun', 'crsSk_cc', 'crsSk_li']); R.cc = o[KEYS.cc] || null; R.li = o[KEYS.li] || null; sk = o.crsSkRun || null; skRows.cc = o.crsSk_cc || null; skRows.li = o.crsSk_li || null; const pr = o[PREF] || {}; if (RANGES[pr.range]) range = pr.range; if (['ins', 'form', 'skills', 'train', 'cheat'].includes(pr.lens)) lens = pr.lens; if (['all', 'rapid', 'blitz', 'bullet', 'daily'].includes(pr.tc)) tcPick = pr.tc; if (['all', 'w', 'b'].includes(pr.side)) opSide = pr.side; if (['Opening', 'Middle', 'Endgame', 'Clock'].includes(pr.phase)) skPhase = pr.phase; if (Array.isArray(pr.shut)) pfShut = new Set(pr.shut.map(String)); if (pr.site === 'cc' || pr.site === 'li') sel = pr.site; else if (!saved('cc') && saved('li')) sel = 'li'; } catch (e) {}
    paint();
    send({ type: 'hist-ping' });
  })();
})();
