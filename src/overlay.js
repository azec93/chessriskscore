// ============================================================
// OVERLAY UI v9 — Tonal Pastel facelift
// Same layout as before (ring + 4 bars, risk chips, 3 facts, format table,
// "how risk is calculated", refresh + credits) in the new design.
// The overlay lives in a shadow root so the host page and the overlay cannot
// restyle each other. It is rebuilt from the previous values so the ring,
// bars and score count animate between players.
// ============================================================

const CRS_ICONS = {
  cog: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/></svg>',
  bullet: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9.5h10.5c2.6 0 5.3 1.1 7.5 2.5-2.2 1.4-4.9 2.5-7.5 2.5H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/></svg>',
  blitz: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13.5 2L5 13.5h5.5L9.5 22 19 9.5h-5.5z"/></svg>',
  rapid: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  daily: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/></svg>',
  // risk-chip icons
  age: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2 1-3.5 2.5-4.5.2 1.6 1 2.4 1.8 2.4C11.8 8.5 11.5 5.5 12 3z"/></svg>',
  acc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/></svg>',
  win: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  games: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  title: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h16M5 15l-1.5-8 5 4L12 5l3.5 6 5-4L19 15z"/></svg>',
  report: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v5M12 17.5v.5"/></svg>',
};

class OverlayUI {
  constructor() {
    this.el = null; this.shadow = null; this.root = null;
    this.isDragging = false; this.dragOffset = { x: 0, y: 0 };
    this.VERSION = '1.8.0';
    this.showBadges = true;
    this.showReport = true;
    this._lastResult = null; this._lastArgs = null;
    this._shown = null;          // values currently on screen, used as the animation start
    this._state = null;          // 'loading' | 'error' | 'result' | 'semi'
    this._user = null;
    this._countRaf = 0; this._countTimer = 0;
    this._bttwLive = false;      // BTTW mark animates once per browser session
    this.CIRC = 201.06;
    try { this._iconUrl = chrome.runtime.getURL('icons/icon48.png'); } catch (e) { this._iconUrl = ''; }
    this._reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  create() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'chess-risk-overlay';
    this.el.classList.add('hidden');
    this.shadow = this.el.attachShadow({ mode: 'open' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CRS_OVERLAY_CSS);
      this.shadow.adoptedStyleSheets = [sheet];
    } catch (e) {
      const st = document.createElement('style'); st.textContent = CRS_OVERLAY_CSS; this.shadow.appendChild(st);
    }
    // @property is ignored inside a shadow root, so register the animatable risk colour here.
    try { CSS.registerProperty({ name: '--crs-risk', syntax: '<color>', inherits: true, initialValue: 'oklch(84% 0.155 163)' }); } catch (e) {}
    this.root = document.createElement('div');
    this.root.className = 'ov';
    this.root.dataset.band = 'low';
    this.shadow.appendChild(this.root);
    document.body.appendChild(this.el);
    this.root.addEventListener('click', (e) => this._onClick(e));
    this._makeDraggable();
    this._initBttw();
  }

  show() { if (!this.el) this.create(); requestAnimationFrame(() => { this.el.classList.remove('hidden'); this.el.classList.add('visible'); }); }
  hide() { if (!this.el) return; this.el.classList.add('hidden'); this.el.classList.remove('visible'); }

  // The BTTW animation plays on the first overlay of a browser session, then rests.
  _initBttw() {
    try {
      chrome.storage.session.get('bttwPlayed').then((v) => {
        if (!v || !v.bttwPlayed) { this._bttwLive = true; chrome.storage.session.set({ bttwPlayed: 1 }); }
      }).catch(() => {});
    } catch (e) {}
  }

  // ── small helpers ─────────────────────────────────────────
  _esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  _bandKey(level) {
    const l = (level?.label || '').toUpperCase();
    return l.startsWith('LOW') ? 'low' : l.startsWith('MOD') ? 'mod' : l.startsWith('HIGH') ? 'high' : 'ext';
  }
  _winCls(pct) { return pct >= 70 ? 'flag' : pct >= 60 ? 'warn' : ''; }
  _accCls(acc, band) { return acc === null || acc === undefined || !band ? '' : acc >= band.threshold ? 'flag' : acc > band.avgHi ? 'warn' : ''; }
  _ageCls(f) { return f > 2 ? 'flag' : f > 1.2 ? 'warn' : ''; }
  _ageStr(days) { return days === null || days === undefined ? 'N/A' : days < 365 ? `${days}d` : `${(days / 365).toFixed(1)}y`; }

  _barHtml() {
    const logo = this._iconUrl ? `<img src="${this._iconUrl}" alt="">` : '';
    return `<div class="o-bar"><div class="brand">${logo}<b>Chess Risk Score</b><span class="ver">v${this.VERSION}</span></div>
      <div class="acts"><button class="ib" id="crs-settings-btn" aria-label="Settings" title="Open settings">${CRS_ICONS.cog}</button><button class="ib" id="crs-close-btn" aria-label="Close" title="Close">${CRS_ICONS.close}</button></div></div>`;
  }

  _ringHtml(fromScore) {
    const C = this.CIRC;
    return `<div class="ring"><svg viewBox="0 0 76 76" aria-hidden="true"><circle class="rt" cx="38" cy="38" r="32"/>
      <circle class="rf" cx="38" cy="38" r="32" style="stroke-dasharray:${C};stroke-dashoffset:${C - fromScore / 100 * C}"/>
      <g class="head" style="transform:rotate(${fromScore / 100 * 360}deg)"><circle cx="70" cy="38" r="4.2"/></g></svg>
      <b id="crs-num">${fromScore}</b></div>`;
  }

  _bttwHtml() {
    return `<span class="bttw${this._bttwLive ? '' : ' static'}" title="Brick Through The Window Media"><span class="bttw-l">BTTW<br>Media</span>
      <span class="bttw-a" aria-hidden="true">
        <svg class="bttw-thrower" viewBox="0 0 24 34" fill="none">
          <ellipse cx="14" cy="4.5" rx="3.8" ry="4.2" fill="oklch(24% 0.01 285)"/>
          <rect x="11.2" y="3.6" width="5.6" height="1.4" rx="0.7" fill="oklch(80% 0.01 285 / .35)"/>
          <circle cx="13" cy="4.3" r="0.5" fill="oklch(95% 0 0 / .8)"/><circle cx="15" cy="4.3" r="0.5" fill="oklch(95% 0 0 / .8)"/>
          <path d="M14 8 L12 18 L16.5 17 Z" fill="oklch(90% 0.01 285 / .32)"/>
          <path d="M14 10 L19 4.5 L22 3" stroke="oklch(90% 0.01 285 / .35)" stroke-width="2" stroke-linecap="round"/>
          <path d="M13 11 L8 13.5 L5.5 12.5" stroke="oklch(90% 0.01 285 / .35)" stroke-width="2" stroke-linecap="round"/>
          <path d="M13 17.5 L9 25 L6.5 31" stroke="oklch(90% 0.01 285 / .35)" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M15.5 17 L18 25 L20.5 31" stroke="oklch(90% 0.01 285 / .35)" stroke-width="2.2" stroke-linecap="round"/>
          <ellipse cx="5.8" cy="32" rx="2.8" ry="1.6" fill="oklch(90% 0.01 285 / .28)"/><ellipse cx="21.2" cy="32" rx="2.8" ry="1.6" fill="oklch(90% 0.01 285 / .28)"/>
        </svg>
        <i class="bttw-brick"></i><i class="bttw-window"></i><i class="bttw-flash"></i>
        <span class="bttw-confetti"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      </span></span>`;
  }

  // ── states ────────────────────────────────────────────────
  showLoading(username) {
    if (!this.el) this.create();
    this._state = 'loading'; this._user = username;
    this.root.classList.remove('quiet');
    this.root.innerHTML = `${this._barHtml()}<div class="state"><div class="state-l">Analyzing</div><div class="state-n">${this._esc(username)}</div>
      <div class="dots"><i></i><i></i><i></i></div><div class="state-t">Fetching stats…</div></div>`;
    this.show();
  }

  showError(username, message) {
    if (!this.el) this.create();
    this._state = 'error'; this._user = username;
    this.root.classList.remove('quiet');
    this.root.innerHTML = `${this._barHtml()}<div class="state err"><div class="state-l">Error</div><div class="state-n">${this._esc(username)}</div>
      <div class="state-t">${this._esc(message)}</div></div>`;
    this.show();
  }

  // Semi-zen: header, score ring, verdict and an expand button only.
  showSemiZen(username, result, oppName = '', myName = '') {
    if (!this.el) this.create();
    this._lastResult = result; this._lastArgs = { username, oppName, myName };
    this._state = 'semi'; this._user = username;
    const from = this._shown ? this._shown.score : 0;
    this.root.classList.remove('quiet');
    this.root.innerHTML = `${this._barHtml()}<div class="semi">${this._ringHtml(from)}
      <div class="verdict"><b class="vd">${this._esc(result.level.label)}</b></div>
      <button class="expand" id="crs-expand-btn" title="Show full risk profile">Full profile ${CRS_ICONS.chev}</button></div>`;
    this._animateTo({ score: result.score }, from, this._bandKey(result.level));
    this._shown = { ...(this._shown || { owr: 0, rwr: 0, acc: 0, age: 0, idx: 0 }), score: result.score, band: this._bandKey(result.level) };
    this.show();
  }

  // ── risk chips: the biggest drivers behind the score ──────
  _chips(result, ageDaysStr) {
    if (this.showBadges === false) return [];
    const b = result.breakdown, out = [];
    // Long-time accounts (the v12 model leads): what pushed this score up, in neutral words. Nothing is shown at Low.
    if (b.v12 && b.v12.blend >= 0.5) {
      if (result.score < 25) return [];
      return b.v12.reasons.map(r => ({ sev: r.push >= 0.8 ? 'high' : r.push >= 0.4 ? 'med' : 'low', icon: r.icon, text: r.label,
        tip: `${r.label} is unusual compared with normal long-time accounts and raised this score.` }));
    }
    const ageDays = b.ageDays, ageFactor = b.ageFactor ?? 1;
    if (ageDays !== null && ageDays < 90 && ageFactor > 1) {
      out.push({ w: Math.min(100, ageFactor * 18), sev: ageFactor >= 3.5 ? 'high' : 'med', pin: ageDays < 30, icon: 'age', text: 'New account',
        tip: `Account is only ${ageDaysStr} old. Applies a ×${ageFactor.toFixed(1)} multiplier.` });
    }
    const streak = result.winStreak || 0;
    if (streak >= 5) {
      out.push({ w: Math.min(90, streak * 6), sev: streak >= 10 ? 'high' : streak >= 7 ? 'med' : 'low', icon: 'streak', text: `${streak}-win streak`,
        tip: `On a ${streak}-game winning streak in recent rated games.` });
    }
    const avgAcc = b.avgAccuracy, thr = b.accBand?.threshold;
    if (avgAcc !== null && avgAcc !== undefined && thr && avgAcc >= thr) {
      out.push({ w: Math.min(100, b.accRisk || (avgAcc - thr + 55)), sev: avgAcc >= thr + 5 ? 'high' : 'med', icon: 'acc', text: 'Hyper-accurate',
        tip: `Average accuracy ${avgAcc}% meets the ${thr}% flag line for this rating.` });
    }
    const hi = Math.max(b.overallWinPct || 0, b.recentWinPct || 0);
    if (hi >= 60) {
      const which = (b.recentWinPct || 0) >= (b.overallWinPct || 0) ? 'recent' : 'overall';
      out.push({ w: hi, sev: hi >= 70 ? 'high' : hi >= 65 ? 'med' : 'low', icon: 'win', text: 'High win rate',
        tip: `${hi}% ${which} win rate. Above 50% begins contributing to risk.` });
    }
    // v10 behaviour signals: shown when they push the score up noticeably
    const v10 = b.v10;
    if (v10) {
      const c = v10.contributions || {}, s = v10.signals || {};
      const sig = (key, icon, text, tip) => { if ((c[key] || 0) >= 0.6) out.push({ w: Math.min(95, c[key] * 60), sev: c[key] >= 1.2 ? 'high' : 'med', icon, text, tip }); };
      sig('lifetimeGames', 'games', 'Few games', `Only ${s.lifetimeGames} lifetime games in this format.`);
      sig('acc90Share', 'acc', '90%+ games', `${Math.round((s.acc90Share || 0) * 100)}% of reviewed games were 90%+ accuracy.`);
      sig('clockLeft', 'clock', 'Clock to spare', `Finishes games with ${Math.round((s.clockLeft || 0) * 100)}% of the clock left on average.`);
      sig('shortGameShare', 'win', 'Short games', `${Math.round((s.shortGameShare || 0) * 100)}% of games end within 15 moves.`);
      if (b.v11) sig('z', 'streak', 'Beating ratings', "Wins far more often than the opponents' ratings predict.");
    }
    out.sort((x, y) => (y.pin ? 1 : 0) - (x.pin ? 1 : 0) || y.w - x.w);
    const top = out.slice(0, 3);
    const damp = b.dampener ?? 1;
    if (damp < 1 && b.title) {
      top.push({ sev: 'good', icon: 'title', text: `Titled ${b.title.toUpperCase()}`,
        tip: `Verified ${b.title.toUpperCase()}. Strong results are expected, so the score is reduced ${Math.round((1 - damp) * 100)}%.` });
    }
    return top;
  }

  _meter(label, from, to, text, status, marker, tip, i) {
    return `<div class="m" style="--i:${i}" title="${this._esc(tip)}"><span class="m-l">${label}</span>
      <span class="m-t"><i class="m-f ${status}" data-w="${Math.max(0, Math.min(100, to))}" style="width:${Math.max(0, Math.min(100, from))}%"></i>${marker !== null && marker !== undefined ? `<u style="left:${Math.max(2, Math.min(98, marker))}%"></u>` : ''}</span>
      <span class="m-v ${status}">${text}</span></div>`;
  }

  _tableHtml(insights) {
    const order = ['bullet', 'blitz', 'rapid', 'daily'];
    const rows = order.map((fmt, i) => {
      const d = insights?.[fmt];
      const rec = d ? (d.recent.total > 0 ? d.recent : d.overall ? { wins: d.overall.wins, losses: d.overall.losses, draws: d.overall.draws, total: d.overall.total } : null) : null;
      if (!rec || !rec.total) {
        return `<div class="tr none rise" style="--i:${9 + i}"><span class="fi" title="${this._cap(fmt)}">${CRS_ICONS[fmt]}</span><span class="nodata">No recent games</span></div>`;
      }
      const winPct = Math.round(rec.wins / rec.total * 100);
      const cur = d.currentRating, peak = (cur && d.peakRating) ? Math.max(cur, d.peakRating) : (d.peakRating || cur || null);
      const ch = d.ratingChange7d;
      const delta = ch ? `<em class="cd ${ch < 0 ? 'dn' : 'up'}">${ch > 0 ? '+' : '−'}${Math.abs(ch)}</em>` : '';
      // All-time records can run to four or five digits: shorten them so the column never overflows.
      const k = n => n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
      const tip = d.recent.total > 0 ? `${d.recent.total} games in the last 2 months` : `All-time record: ${rec.wins} / ${rec.losses} / ${rec.draws} (no games in the last 2 months)`;
      return `<div class="tr rise" style="--i:${9 + i}" title="${tip}"><span class="fi" title="${this._cap(fmt)}">${CRS_ICONS[fmt]}</span>
        <span class="wld"><i class="w">${k(rec.wins)}</i>/<i class="l">${k(rec.losses)}</i>/<i class="d">${k(rec.draws)}</i></span>
        <span class="${this._winCls(winPct)}">${winPct}%</span><span>${d.avgAccuracy === null || d.avgAccuracy === undefined ? '—' : d.avgAccuracy + '%'}</span>
        <span class="cur"><span class="cn">${cur || '—'}${delta}</span></span><span>${peak || '—'}</span></div>`;
    }).join('');
    return `<div class="tbl" role="table">
      <div class="th rise" style="--i:8"><span></span><span title="Wins / Losses / Draws (last 2 months)">W / L / D</span><span title="Win percentage">W%</span><span title="Average accuracy (reviewed games)">Acc</span><span title="Current rating with 7-day change">Cur</span><span title="All-time peak rating">Peak</span></div>
      ${rows}</div>`;
  }

  _bandFor(platform, fmt, rating) {
    const tables = typeof CONFIG !== 'undefined' ? (platform === 'lichess' ? CONFIG.LICHESS_FORMAT_ACCURACY : CONFIG.FORMAT_ACCURACY) : null;
    const t = tables?.[fmt];
    if (!t) return null;
    const r = t.find(x => rating < x[0]) || t[t.length - 1];
    return { lo: r[1], hi: r[2], exp: r[3], thr: r[4] };
  }

  // "How risk is calculated": score build-up ledger, accuracy scale, baselines.
  _calcHtml(result, fmt) {
    const b = result.breakdown, score = result.score;
    const o = Math.round((b.overallWinrate || 0) * 0.35), r = Math.round((b.recentWinrate || 0) * 0.30), a = Math.round((b.accRisk || 0) * 0.35);
    const raw = o + r + a;
    const ageFactor = b.ageFactor ?? 1, damp = b.dampener ?? 1;
    const v10 = b.v10;
    const rating = b.fmtRating || 0, fmtCap = this._cap(fmt) || 'Blitz';
    const band = b.accBand && b.accBand.threshold ? { lo: b.accBand.avgLo, hi: b.accBand.avgHi, exp: b.accBand.expected, thr: b.accBand.threshold } : null;
    const acc = b.avgAccuracy;
    const me = this._accCls(acc, b.accBand) || 'ok';
    const sc = v => Math.max(0, Math.min(100, (v - 60) / 40 * 100));
    const titleSmall = damp < 1 && b.title ? `${this._esc(b.title.toUpperCase())} −${Math.round((1 - damp) * 100)}%` : 'GM −50% · IM −35%';

    let tail;
    const v12 = b.v12;
    if (v12 && v12.blend >= 0.5) {
      const eff = x => Math.abs(x) < 0.15 ? ['nil', 'neutral'] : x > 0 ? ['up', x >= 0.8 ? '++ risk' : '+ risk'] : ['dn', x <= -0.8 ? '−− risk' : '− risk'];
      const rows = v12.families.map(f => { const [cls, txt] = eff(f.push); return `<div class="lr sig"><i></i><span class="nm">${this._esc(f.label)}</span><span class="pt ${cls}">${txt}</span></div>`; }).join('');
      tail = `
        <div class="lr cmp"><i></i><span class="nm">Compared with normal long-time accounts</span></div>
        ${rows}
        ${v12.blend < 1 ? `<div class="lr sub"><i></i><span class="nm">Blend<small>${Math.round(v12.blend * 100)}% long-time model, account ${this._ageStr(b.ageDays)} old</small></span><span class="wt"></span><span class="pt"></span></div>` : ''}
        <div class="lr fin"><i></i><span class="nm">Final score</span><span class="wt"></span><span class="pt">${score}</span></div>`;
    } else if (v10) {
      const c = v10.contributions || {}, s = v10.signals || {};
      const eff = v => { const x = v || 0; return Math.abs(x) < 0.15 ? ['nil', 'neutral'] : x > 0 ? ['up', x >= 0.8 ? '++ risk' : '+ risk'] : ['dn', x <= -0.8 ? '−− risk' : '− risk']; };
      const pct = v => v === null || v === undefined ? null : Math.round(v * 100) + '%';
      const row = (name, small, key) => { const [cls, txt] = eff(c[key]); return `<div class="lr sig"><i></i><span class="nm">${name}<small>${small}</small></span><span class="pt ${cls}">${txt}</span></div>`; };
      tail = `
        <div class="lr sub"><i></i><span class="nm">Record score<small>win rates, accuracy, age</small></span><span class="wt"></span><span class="pt">${b.v9Score}</span></div>
        <div class="lr cmp"><i></i><span class="nm">Compared with a typical account</span></div>
        ${row('Record score', 'the ' + b.v9Score + ' above', 'v9Evidence')}
        ${row('Lifetime games', `${s.lifetimeGames ?? 0} in ${fmtCap.toLowerCase()}`, 'lifetimeGames')}
        ${row('Games at 90%+ accuracy', pct(s.acc90Share) ? `${pct(s.acc90Share)} of ${s.accGames} reviewed${b.v11 ? ` (typical: ${pct(v10.expected?.acc90Share)})` : ''}` : 'no reviewed games', 'acc90Share')}
        ${row('Clock left at game end', pct(s.clockLeft) ? `${pct(s.clockLeft)} on average` : 'no clock data', 'clockLeft')}
        ${row('Short games', pct(s.shortGameShare) ? `${pct(s.shortGameShare)} end by move 15` : 'no data', 'shortGameShare')}
        ${b.v11 ? row('Account age', s.ageDays === null || s.ageDays === undefined ? 'unknown' : this._ageStr(s.ageDays) + ' old', 'logAge') : ''}
        ${b.v11 ? row('Best game accuracy', s.accMax === null || s.accMax === undefined ? 'fewer than 3 reviewed' : `${Math.round(s.accMax * 10) / 10}% (typical at ${s.rating}: ${Math.round((v10.expected?.accMax || 0) * 10) / 10}%)`, 'accMax') : ''}
        ${b.v11 ? row('Results vs ratings', s.z === null || s.z === undefined ? 'no data' : s.z >= 2 ? 'far above what ratings predict' : s.z >= 1 ? 'above what ratings predict' : s.z <= -1 ? 'below what ratings predict' : 'about what ratings predict', 'z') : ''}
        <div class="lr fin"><i></i><span class="nm">Final score</span><span class="wt"></span><span class="pt">${score}</span></div>`;
    } else {
      tail = `<div class="lr fin"><i></i><span class="nm">Final score</span><span class="wt"></span><span class="pt">${score}</span></div>`;
    }
    const longTime = v12 && v12.blend >= 0.5;
    const formula = longTime
      ? 'Long-time account model<br>220 small decision trees over 61 signals<br>(rating itself is not an input)'
      : b.v11
      ?'Record = AgeFactor ×<br>(0.35·OWR + 0.30·RWR + 0.35·ACC)<br>Final = record weighed with 7 behaviour signals'
      : v10
      ? 'Record = AgeFactor × TitleFactor ×<br>(0.35·OWR + 0.30·RWR + 0.35·ACC)<br>Final = record weighed with 4 behaviour signals'
      : 'Risk = AgeFactor × TitleFactor ×<br>(0.35·OWR + 0.30·RWR + 0.35·ACC)';
    const note = longTime
      ? `<p class="note">Accounts older than 90 days are scored by a separate model trained on long-time accounts closed for fair play compared with normal ones, and tested on accounts that were closed only after it had scored them. 25 = top 2 in 100 normal long-time accounts, 50 = top 1 in 200, 75 = top 1 in 1,000. A high score means unusual, not proven.</p>`
      : b.v11
      ?`<p class="note">The final score is not the record score plus points. It weighs the record together with seven behaviour signals, each judged against a typical account of the same rating, on its own scale: fewer than 1 in 100 normal accounts reach 75. Titles give no discount: established strong players score low on the signals themselves. The weights come from 11,298 Chess.com accounts closed for fair play compared with 37,807 normal accounts, including 9,814 titled players. Evidence: ${this._esc(v10.confidence)}.</p>`
      : v10
      ? `<p class="note">The final score is not the record score plus points. It weighs the record together with the four behaviour signals, each judged against a typical account, on its own scale: fewer than 1 in 100 normal accounts reach 75. The weights come from 252 Chess.com accounts closed for fair play compared with 1,993 normal accounts. Evidence: ${this._esc(v10.confidence)}.</p>`
      : '';

    const names = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', daily: 'Daily' };
    const baselines = ['bullet', 'blitz', 'rapid', 'daily'].map(k => {
      const x = this._bandFor(result.platform, k, rating);
      return x ? `<div class="btr ${k === fmt ? 'on' : ''}"><span class="bf">${CRS_ICONS[k]}${names[k]}</span><span>${x.lo}–${x.hi}%</span><span>${x.exp}%</span><span class="warn">${x.thr}%</span></div>` : '';
    }).join('');

    return `
      <section class="cs">
        <h4>Score build-up <span>${score} / 100</span></h4>
        <div class="formula2">${formula}</div>
        ${longTime ? '' : `<div class="stack" aria-hidden="true"><i class="s-owr" style="flex:${Math.max(o, .4)}"></i><i class="s-rwr" style="flex:${Math.max(r, .4)}"></i><i class="s-acc" style="flex:${Math.max(a, .4)}"></i><i class="s-rest" style="flex:${Math.max(100 - raw, 1)}"></i></div>`}
        <div class="ldg">
          ${longTime ? '' : `<div class="lr"><i class="s-owr"></i><span class="nm">Overall win rate<small>OWR</small></span><span class="wt">35%</span><span class="pt">+${o}</span></div>
          <div class="lr"><i class="s-rwr"></i><span class="nm">Recent win rate<small>RWR</small></span><span class="wt">30%</span><span class="pt">+${r}</span></div>
          <div class="lr"><i class="s-acc"></i><span class="nm">Accuracy risk<small>ACC</small></span><span class="wt">35%</span><span class="pt">+${a}</span></div>
          <div class="lr sub"><i></i><span class="nm">Subtotal</span><span class="wt"></span><span class="pt">${raw}</span></div>
          <div class="lr mult"><i></i><span class="nm">Account age<small>${this._ageStr(b.ageDays)} old</small></span><span class="wt"></span><span class="pt">×${ageFactor.toFixed(1)}</span></div>
          ${b.v11 ? '' : `<div class="lr mult"><i></i><span class="nm">Title factor<small>${titleSmall}</small></span><span class="wt"></span><span class="pt">×${damp.toFixed(damp === 1 ? 1 : 2)}</span></div>`}`}
          ${tail}
        </div>
        ${note}
      </section>
      ${band ? `<section class="cs">
        <h4>${fmtCap} accuracy <span>${rating} rated</span></h4>
        <div class="scale" aria-hidden="true">
          <i class="band" style="left:${sc(band.lo)}%;width:${sc(band.hi) - sc(band.lo)}%"></i>
          <i class="tk exp" style="left:${sc(band.exp)}%"></i>
          <i class="tk lim" style="left:${sc(band.thr)}%"></i>
          ${acc !== null && acc !== undefined ? `<i class="you ${me}" style="left:${sc(acc)}%"></i>` : ''}
        </div>
        <div class="sax" aria-hidden="true"><span>60%</span><span>70%</span><span>80%</span><span>90%</span><span>100%</span></div>
        <dl class="kv">
          <div><dt><i class="k-band"></i>Normal range</dt><dd>${band.lo}–${band.hi}%</dd></div>
          <div><dt><i class="k-exp"></i>Expected avg</dt><dd>${band.exp}%</dd></div>
          <div><dt><i class="k-lim"></i>Flag threshold</dt><dd class="warn">≥${band.thr}%</dd></div>
          <div><dt><i class="k-you ${me}"></i>This player</dt><dd class="${me === 'ok' ? '' : me}">${acc !== null && acc !== undefined ? acc + '%' : 'N/A'}</dd></div>
        </dl>
      </section>` : ''}
      ${baselines ? `<section class="cs">
        <h4>Baselines <span>at ${rating} rating</span></h4>
        <div class="bt"><div class="bth"><span>Format</span><span>Normal</span><span>Expected</span><span>Flag at</span></div>${baselines}</div>
      </section>` : ''}`;
  }

  // ── full result ───────────────────────────────────────────
  showResult(username, result, isSelf = false, oppName = '', myName = '') {
    if (!this.el) this.create();
    const { score, level, breakdown: b, insights, perFormatRatings, scoredFormat } = result;
    const band = this._bandKey(level);
    const fmt = scoredFormat || b.bestFormat || null;
    const fmtCap = this._cap(fmt);
    const ageDaysStr = this._ageStr(b.ageDays);
    const ageFactor = b.ageFactor ?? 1;
    const owr = b.overallWinPct || 0, rwr = b.recentWinPct || 0;
    const acc = b.avgAccuracy ?? null, accBand = b.accBand || null;

    // Peak rating for the scored format (falls back to the best format on record)
    let peakVal = 0, peakLabel = 'Peak';
    if (fmt && perFormatRatings?.[fmt]) {
      peakVal = Math.max(perFormatRatings[fmt].peak || 0, perFormatRatings[fmt].current || 0); peakLabel = `${fmtCap} peak`;
    } else {
      for (const [f, r] of Object.entries(perFormatRatings || {})) { const p = Math.max(r.peak || 0, r.current || 0); if (p > peakVal) { peakVal = p; peakLabel = `${this._cap(f)} peak`; } }
    }
    let fmtWin = null;
    if (fmt && insights?.[fmt] && insights[fmt].recent.total > 0) fmtWin = Math.round(insights[fmt].recent.wins / insights[fmt].recent.total * 100);

    const to = { score, owr, rwr, acc: acc ?? 0, age: ageFactor / 5 * 100, idx: isSelf ? 1 : 0 };
    const from = this._shown || { score: 0, owr: 0, rwr: 0, acc: 0, age: 0, idx: to.idx };
    // Same player redrawn (cached result replaced by fresh data): no entrance animations.
    const quiet = this._state === 'result' && this._user === username;
    const wasOpen = this.shadow.getElementById('crs-how')?.classList.contains('open');

    const chips = this._chips(result, ageDaysStr);
    const tags = chips.length ? `<div class="tags-wrap"><div class="chips"><div class="chips-in">
      ${chips.map((g, i) => `<span class="ft ${g.sev} rise" style="--i:${5 + i}" title="${this._esc(g.tip)}">${CRS_ICONS[g.icon]}<span>${this._esc(g.text)}</span></span>`).join('')}
    </div></div></div>` : '';

    const accTip = accBand?.threshold
      ? `${fmtCap || 'Format'} accuracy${acc !== null ? ` ${acc}%` : ': no reviewed games'}. Normal ${accBand.avgLo}–${accBand.avgHi}%. Flag line ${accBand.threshold}%.`
      : 'Average accuracy in reviewed games.';

    this.root.dataset.band = this._shown ? this._shown.band : band;
    this.root.dataset.badges = this.showBadges === false ? 'off' : 'on';
    this.root.classList.toggle('quiet', quiet);
    this.root.innerHTML = `
      ${this._barHtml()}
      <div class="tabs" role="tablist" style="--i:${from.idx}">
        <button role="tab" id="crs-tab-opp" aria-selected="${!isSelf}" title="View opponent"><b>${this._esc(oppName || username)}</b></button>
        <button role="tab" id="crs-tab-me" aria-selected="${!!isSelf}" title="View self"><b>${this._esc(myName || 'Me')}</b></button></div>
      <div class="score">
        ${isSelf || this.showReport === false ? this._ringHtml(from.score) : `<div class="ring-col">${this._ringHtml(from.score)}<button class="rep-flag" id="crs-report-btn" aria-label="Report ${this._esc(username)}" title="Report ${this._esc(username)}">${CRS_ICONS.report}</button></div>`}
        <div class="info">
          <div class="verdict rise" style="--i:1"><b class="vd">${this._esc(level.label)}</b></div>
          ${this._meter('Overall W%', from.owr, owr, owr + '%', this._winCls(owr), 60, `All-time ${fmtCap} win rate (${owr}%). Above 50% begins contributing to risk.`, 2)}
          ${this._meter('Recent W%', from.rwr, rwr, rwr + '%', this._winCls(rwr), 60, `Last 2 months ${fmtCap} win rate (${rwr}%).`, 3)}
          ${this._meter('Accuracy', from.acc, acc ?? 0, acc !== null ? acc + '%' : '—', acc !== null ? this._accCls(acc, accBand) : 'none', accBand?.threshold ?? null, accTip, 4)}
          ${this._meter('Age factor', from.age, to.age, '×' + ageFactor.toFixed(1), this._ageCls(ageFactor), null, `Account ${ageDaysStr} old. Under 7d ×5, under 30d ×3.5, under 90d ×2, over a year ×1.`, 5)}
        </div>
      </div>
      ${result._missing && result._missing.length ? `<div class="notice" role="status">${CRS_ICONS.warn}<span>Chess.com did not return this player's ${this._esc(result._missing.join(' and '))}. The score may be off. Press Refresh to try again.</span></div>` : ''}
      ${tags}
      <div class="facts">
        <div class="rise" style="--i:6" title="Peak rating (all time)"><b>${peakVal > 0 ? peakVal : '?'}</b><span>${peakLabel}</span></div>
        <div class="rise" style="--i:7" title="Account age"><b class="${ageFactor > 2 ? 'flag' : ''}">${ageDaysStr}</b><span>Acct age</span></div>
        <div class="rise" style="--i:8" title="${fmtCap || 'Format'} win rate (last 2 months)"><b class="${fmtWin !== null ? this._winCls(fmtWin) : ''}">${fmtWin !== null ? fmtWin + '%' : '—'}</b><span>${fmtCap ? fmtCap + ' W%' : 'W%'}</span></div>
      </div>
      ${this._tableHtml(insights)}
      <div class="fold acc how${wasOpen ? ' open' : ''}" id="crs-how">
        <button class="fold-h" id="crs-context-toggle" aria-expanded="${!!wasOpen}"><span>How risk is calculated</span>${CRS_ICONS.chev}</button>
        <div class="fold-b" id="crs-context-panel"><div class="fold-in calc">${this._calcHtml(result, fmt)}</div></div>
      </div>
      <div class="o-foot"><button class="refresh" id="crs-refresh-btn"${result._partial ? ' disabled title="First look from the newest games. Still loading the rest."' : ''}>${CRS_ICONS.refresh}<span>${result._partial ? 'Loading' : 'Refresh'}</span></button>
        <span class="o-credit">${this._bttwHtml()}<span class="credit">by <em>az_93</em></span><a class="mail-l" href="mailto:azec.1993@gmail.com" title="azec.1993@gmail.com">${CRS_ICONS.mail}<span>Contact</span></a></span></div>`;

    this._animateTo(to, from.score, band);
    this._shown = { ...to, band };
    this._state = 'result'; this._user = username;
    this._bttwLive = false;      // later renders show the resting frame
    this.show();
  }

  // Paint the from-state, then move ring, bars, tab thumb and score count to their targets.
  _animateTo(to, fromScore, band) {
    void this.root.offsetWidth;
    this.root.dataset.band = band;
    this.root.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
    const rf = this.root.querySelector('.rf'), hd = this.root.querySelector('.head');
    if (rf) rf.style.strokeDashoffset = this.CIRC - to.score / 100 * this.CIRC;
    if (hd) hd.style.transform = `rotate(${to.score / 100 * 360}deg)`;
    const tabs = this.root.querySelector('.tabs');
    if (tabs && to.idx !== undefined) tabs.style.setProperty('--i', to.idx);
    const num = this.shadow.getElementById('crs-num');
    if (num) this._countTo(num, fromScore, to.score, 900);
  }

  _countTo(el, a, b, ms) {
    cancelAnimationFrame(this._countRaf); clearTimeout(this._countTimer);
    if (this._reduced || a === b) { el.textContent = b; return; }
    // Timer fallback: rAF stalls in background tabs, so always land on the final value.
    this._countTimer = setTimeout(() => { el.textContent = b; }, ms + 60);
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(a + (b - a) * e);
      if (p < 1) this._countRaf = requestAnimationFrame(tick);
    };
    this._countRaf = requestAnimationFrame(tick);
  }

  // ── events (one delegated listener; markup is replaced on every render) ──
  _onClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    switch (t.id) {
      case 'crs-close-btn': this.hide(); break;
      case 'crs-settings-btn': this._toggleSettings(); break;
      case 'crs-tab-opp':
      case 'crs-tab-me':
        if (t.getAttribute('aria-selected') !== 'true') window.dispatchEvent(new CustomEvent('crs:toggle-view'));
        break;
      case 'crs-report-btn':
        window.dispatchEvent(new CustomEvent('crs:report', { detail: { username: this._user } }));
        break;
      case 'crs-refresh-btn':
        t.disabled = true;
        window.dispatchEvent(new CustomEvent('crs:refresh', { detail: { username: this._user } }));
        break;
      case 'crs-context-toggle': {
        const fold = t.closest('.fold'), open = !fold.classList.contains('open');
        fold.classList.toggle('open', open); t.setAttribute('aria-expanded', open);
        break;
      }
      case 'crs-expand-btn':
        if (this._lastResult && this._lastArgs) this.showResult(this._lastArgs.username, this._lastResult, false, this._lastArgs.oppName, this._lastArgs.myName);
        break;
    }
  }

  // Open settings as a seamless in-page dropdown (iframe of popup.html).
  _toggleSettings() {
    const id = 'crs-settings-modal';
    const existing = document.getElementById(id);
    if (existing) { if (existing._cleanup) existing._cleanup(); existing.remove(); return; }
    let url;
    try { url = chrome.runtime.getURL('popup.html'); } catch (e) { return; }
    const modal = document.createElement('div'); modal.id = id;
    const panel = document.createElement('div'); panel.className = 'crs-settings-panel';
    const frame = document.createElement('iframe'); frame.src = url; frame.className = 'crs-settings-frame';
    const closeBtn = document.createElement('button'); closeBtn.className = 'crs-settings-close'; closeBtn.type = 'button'; closeBtn.title = 'Close settings'; closeBtn.textContent = '✕';
    panel.appendChild(frame); panel.appendChild(closeBtn); modal.appendChild(panel);
    const r = this.el ? this.el.getBoundingClientRect() : null;
    if (r) {
      panel.style.top = Math.max(8, Math.round(r.top)) + 'px';
      panel.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    }
    const onMsg = (e) => { if (e && e.data && e.data.type === 'crs-popup-height' && typeof e.data.height === 'number') { frame.style.height = Math.max(120, Math.min(e.data.height, window.innerHeight - 24)) + 'px'; } };
    window.addEventListener('message', onMsg);
    const close = () => { window.removeEventListener('message', onMsg); modal.remove(); };
    modal._cleanup = () => window.removeEventListener('message', onMsg);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    document.body.appendChild(modal);
  }

  _makeDraggable() {
    if (!this.el) return;
    // Listeners live on document only while dragging, so there is no permanent mousemove handler.
    const onMove = (e) => {
      if (!this.isDragging || !this.el) return;
      const r = this.el.getBoundingClientRect();
      this.el.style.right = 'auto'; this.el.style.bottom = 'auto';
      this.el.style.left = Math.max(0, Math.min(window.innerWidth - r.width, e.clientX - this.dragOffset.x)) + 'px';
      this.el.style.top = Math.max(0, Math.min(window.innerHeight - Math.min(r.height, 120), e.clientY - this.dragOffset.y)) + 'px';
    };
    const onUp = () => {
      if (this.isDragging && this.el) this.el.classList.remove('dragging');
      this.isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    this.el.addEventListener('mousedown', (e) => {
      const path = e.composedPath();
      const onBar = path.some(n => n.classList && n.classList.contains('o-bar'));
      const onButton = path.some(n => n.tagName === 'BUTTON');
      if (!onBar || onButton) return;
      this.isDragging = true;
      const r = this.el.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.el.classList.add('dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  }
}
