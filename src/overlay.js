// ============================================================
// OVERLAY UI v8 — Username-based toggle, risk-level markers
// ============================================================

class OverlayUI {
  constructor() { this.el = null; this.isDragging = false; this.dragOffset = { x: 0, y: 0 }; this.VERSION = '1.2.0'; this._lastResult = null; this._lastArgs = null; }
  create() { if (this.el) return; this.el = document.createElement('div'); this.el.id = 'chess-risk-overlay'; this.el.classList.add('hidden'); document.body.appendChild(this.el); this._makeDraggable(); }
  show() { if (!this.el) this.create(); requestAnimationFrame(() => { this.el.classList.remove('hidden'); this.el.classList.add('visible'); }); }
  hide() { if (!this.el) return; this.el.classList.add('hidden'); this.el.classList.remove('visible'); }

  showLoading(username) {
    if (!this.el) this.create();
    this.el.style.removeProperty('--risk-color'); this.el.style.removeProperty('--risk-glow');
    this.el.classList.remove('crs-pulse-border');
    const t = this._detectTheme(); this.el.classList.remove('crs-theme-light','crs-theme-dark'); this.el.classList.add(`crs-theme-${t}`);
    this.el.innerHTML = `<div class="crs-header"><div class="crs-logo"><span class="crs-logo-icon">♟</span> CHESS RISK SCORE <span class="crs-version">v${this.VERSION}</span></div><button class="crs-close" id="crs-close-btn">✕</button></div><div class="crs-opponent"><div class="crs-opponent-label">Analyzing</div>${this._esc(username)}</div><div class="crs-loading"><div class="crs-loading-dots"><div class="crs-loading-dot"></div><div class="crs-loading-dot"></div><div class="crs-loading-dot"></div></div><div class="crs-loading-text">Fetching stats…</div></div>`;
    this._bindClose(); this.show();
  }

  showError(username, message) {
    if (!this.el) this.create();
    this.el.innerHTML = `<div class="crs-header"><div class="crs-logo"><span class="crs-logo-icon">♟</span> CHESS RISK SCORE <span class="crs-version">v${this.VERSION}</span></div><button class="crs-close" id="crs-close-btn">✕</button></div><div class="crs-opponent"><div class="crs-opponent-label">Error</div>${this._esc(username)}</div><div class="crs-error"><div class="crs-error-icon">⚠</div><div>${this._esc(message)}</div></div>`;
    this._bindClose(); this.show();
  }

  _detectTheme() {
    const h=document.documentElement,b=document.body;
    const c=[h.getAttribute('data-theme'),h.getAttribute('data-color-scheme'),b.getAttribute('data-theme'),b.getAttribute('data-color-scheme')].filter(Boolean).join(' ').toLowerCase()+' '+(h.className+' '+b.className).toLowerCase();
    if (/dark/.test(c)) return 'dark'; if (/light/.test(c)) return 'light';
    try { const m=getComputedStyle(b).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if(m) return (0.299*+m[1]+0.587*+m[2]+0.114*+m[3])<128?'dark':'light'; } catch(e){}
    return window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
  }

  _accColor(avgAcc, accBand) {
    if (avgAcc===null||!accBand) return {color:'rgba(255,255,255,0.4)'};
    if (avgAcc>=accBand.threshold) return {color:'#ef4444'};
    if (avgAcc>accBand.avgHi) return {color:'#f59e0b'};
    return {color:'#22c55e'};
  }

  _ageColor(f) { return f<=1.2?'#22c55e':f<=2.0?'#f59e0b':f<=3.5?'#f97316':'#ef4444'; }

  // Color for win rate percentage
  _wrColor(pct) { return pct>=70?'#ef4444':pct>=60?'#f97316':pct>=50?'#f59e0b':'#22c55e'; }

  showResult(username, result, isSelf = false, oppName = '', myName = '') {
    if (!this.el) this.create();
    const { score, level, breakdown, insights, perFormatRatings, winStreak, scoredFormat } = result;
    const { color, glow, label } = level;

    this.el.style.setProperty('--risk-color', color);
    this.el.style.setProperty('--risk-glow', glow);
    const theme = this._detectTheme();
    this.el.classList.remove('crs-theme-light','crs-theme-dark');
    this.el.classList.add(`crs-theme-${theme}`);
    if (score >= 65) this.el.classList.add('crs-pulse-border'); else this.el.classList.remove('crs-pulse-border');

    const ageDaysStr = breakdown.ageDays!==null?(breakdown.ageDays<365?`${breakdown.ageDays}d`:`${(breakdown.ageDays/365).toFixed(1)}y`):'N/A';
    const resolvedFmt = scoredFormat || breakdown.bestFormat || null;
    const fmtCap = resolvedFmt ? resolvedFmt.charAt(0).toUpperCase()+resolvedFmt.slice(1) : '';

    // Peak
    let peakVal=0, peakFmtLabel='Peak Rating';
    if (resolvedFmt && perFormatRatings?.[resolvedFmt]) {
      const fp=perFormatRatings[resolvedFmt].peak||0, fc=perFormatRatings[resolvedFmt].current||0;
      peakVal=Math.max(fp,fc); peakFmtLabel=fmtCap+' Peak';
    } else {
      let bp=0,bf='';
      for (const [f,r] of Object.entries(perFormatRatings||{})){const p=Math.max(r.peak||0,r.current||0);if(p>bp){bp=p;bf=f;}}
      if(bp>0){peakVal=bp;peakFmtLabel=bf.charAt(0).toUpperCase()+bf.slice(1)+' Peak';}
    }
    const peakStr = peakVal > 0 ? String(peakVal) : '?';

    // Format W%
    let fmtWinPct='—', fmtWinPctColor='rgba(255,255,255,0.85)';
    if (resolvedFmt && insights?.[resolvedFmt]) {
      const d=insights[resolvedFmt], t=d.recent.total||0;
      if(t>0){const wp=Math.round((d.recent.wins/t)*100);fmtWinPct=wp+'%';fmtWinPctColor=this._wrColor(wp);}
    }

    const CIRC=175.93, dashOffset=CIRC-(score/100)*CIRC;
    const ageFactorVal=breakdown.ageFactor??1, ageCol=this._ageColor(ageFactorVal);

    const accBand=breakdown.accBand||{}, fmtRating=breakdown.fmtRating||0;
    const bestFmtCap=fmtCap||'Blitz';
    const accThreshStr=accBand.threshold?`≥${accBand.threshold}%`:'?';
    const accNormalStr=(accBand.avgLo&&accBand.avgHi)?`${accBand.avgLo}–${accBand.avgHi}%`:'?';
    const accExpectedStr=accBand.expected?`${accBand.expected}%`:'?';
    const playerAvgAcc=breakdown.avgAccuracy??null;
    const playerAvgAccStr=playerAvgAcc!==null?`${playerAvgAcc}%`:'N/A';
    const accExcess=(playerAvgAcc!==null&&accBand.expected)?Math.round((playerAvgAcc-accBand.expected)*10)/10:null;
    const accExcessStr=accExcess!==null?(accExcess>0?`+${accExcess}pp`:`${accExcess}pp`):'';
    const accCol=this._accColor(playerAvgAcc,accBand);

    const owPct=breakdown.overallWinPct||0, rwPct=breakdown.recentWinPct||0;
    const owColor=this._wrColor(owPct), rwColor=this._wrColor(rwPct);

    // Username tabs
    const oppLabel = oppName || username;
    const selfLabel = myName || 'Me';

    this.el.innerHTML = `
      <div class="crs-header">
        <div class="crs-logo"><span class="crs-logo-icon">♟</span> CHESS RISK SCORE <span class="crs-version">v${this.VERSION}</span></div>
        <button class="crs-close" id="crs-close-btn">✕</button>
      </div>

      <div class="crs-name-tabs">
        <button class="crs-name-tab ${!isSelf?'active':''}" id="crs-tab-opp" title="View opponent">${this._esc(this._truncName(oppLabel))}</button>
        <button class="crs-name-tab ${isSelf?'active':''}" id="crs-tab-me" title="View self">${this._esc(this._truncName(selfLabel))}</button>
      </div>

      <div class="crs-score-section">
        <div class="crs-score-ring">
          <svg class="crs-ring-svg" viewBox="0 0 70 70">
            <circle class="crs-ring-bg" cx="35" cy="35" r="28"/>
            <circle class="crs-ring-fill" cx="35" cy="35" r="28" stroke="${color}" style="stroke-dashoffset:${dashOffset}"/>
          </svg>
          <div class="crs-score-num">${score}</div>
        </div>
        <div class="crs-score-info">
          <div class="crs-risk-label">${label}</div>
          ${this._statRowRisk('Overall W%', owPct, owPct+'%', owColor, `All-time ${bestFmtCap} win rate (${owPct}%). Above 60% begins contributing to risk.`)}
          ${this._statRowRisk('Recent W%', rwPct, rwPct+'%', rwColor, `Last 2 months ${bestFmtCap} win rate (${rwPct}%).`)}
          ${this._statRowCustom('Accuracy', playerAvgAcc!==null?playerAvgAcc:0, playerAvgAccStr, accCol.color,
            `${bestFmtCap} accuracy. Player: ${playerAvgAccStr} ${accExcessStr?'('+accExcessStr+' vs '+accExpectedStr+')':''}. Normal: ${accNormalStr}. Flag: ${accThreshStr}.`,
            accBand.threshold||0, accBand.threshold?accBand.threshold+'%':'')}
          ${this._statRowAge('Age Factor', ageFactorVal, ageDaysStr)}
        </div>
      </div>

      <div class="crs-divider"></div>

      <div class="crs-meta">
        <div class="crs-meta-item" title="Peak rating (all time) for ${fmtCap||'best'} format">
          <div class="crs-meta-val">${peakStr}</div>
          <div class="crs-meta-label">${peakFmtLabel}</div>
        </div>
        <div class="crs-meta-item" title="Account age">
          <div class="crs-meta-val" style="color:${ageCol}">${ageDaysStr}</div>
          <div class="crs-meta-label">Acct Age</div>
        </div>
        <div class="crs-meta-item" title="${fmtCap||'Overall'} win rate (last 2 months)">
          <div class="crs-meta-val" style="color:${fmtWinPctColor}">${fmtWinPct}</div>
          <div class="crs-meta-label">${fmtCap?fmtCap+' W%':'W%'}</div>
        </div>
      </div>

      <div class="crs-divider"></div>

      ${this._renderInsightsTable(insights)}

      <div class="crs-divider"></div>

      <div class="crs-context-toggle" id="crs-context-toggle">
        <span class="crs-context-arrow" id="crs-context-arrow">▸</span>
        HOW RISK IS CALCULATED
      </div>
      <div class="crs-context-panel" id="crs-context-panel" style="display:none">
        <div class="crs-ctx-section">
          <div class="crs-ctx-title">Formula</div>
          <div class="crs-ctx-formula">Risk = AgeFactor × (<span class="crs-ctx-w">0.35</span>·OWR + <span class="crs-ctx-w">0.30</span>·RWR + <span class="crs-ctx-w">0.35</span>·ACC) × TitleFactor</div>
          <div class="crs-ctx-legend">OWR = Overall Win Rate · RWR = Recent Win Rate · ACC = Accuracy Risk</div>
          <div class="crs-ctx-legend" style="margin-top:2px;font-size:8px;color:rgba(255,255,255,0.2)">Title Factor: verified GMs receive 50% risk reduction, IMs receive 35% reduction</div>
        </div>
        <div class="crs-ctx-section">
          <div class="crs-ctx-title">${bestFmtCap} Accuracy Norms <span class="crs-ctx-sub">(${fmtRating} rated)</span></div>
          <div class="crs-ctx-acc-grid">
            <div class="crs-ctx-acc-item"><div class="crs-ctx-acc-val">${accNormalStr}</div><div class="crs-ctx-acc-label">Normal Range</div></div>
            <div class="crs-ctx-acc-item"><div class="crs-ctx-acc-val">${accExpectedStr}</div><div class="crs-ctx-acc-label">Expected Avg</div></div>
            <div class="crs-ctx-acc-item"><div class="crs-ctx-acc-val" style="color:var(--risk-color)">${accThreshStr}</div><div class="crs-ctx-acc-label">Flag Threshold</div></div>
            <div class="crs-ctx-acc-item"><div class="crs-ctx-acc-val" style="color:${accCol.color}">${playerAvgAccStr}</div><div class="crs-ctx-acc-label">This Player</div></div>
          </div>
        </div>
        <div class="crs-ctx-section"><div class="crs-ctx-title">All Format Baselines (by rating)</div>${this._renderAccuracyRefTable(fmtRating)}</div>
        <div class="crs-ctx-section crs-ctx-weights">
          <div class="crs-ctx-title">Score Breakdown <span class="crs-ctx-sub">(${score} / 100)</span></div>
          ${(()=>{
            const owC=Math.round(breakdown.overallWinrate*0.35);
            const rwC=Math.round(breakdown.recentWinrate*0.30);
            const acC=Math.round(breakdown.accRisk*0.35);
            const rawTotal=owC+rwC+acC;
            const damp = breakdown.dampener ?? 1;
            const dampPct = Math.round(damp * 100);
            const afterAge = ageFactorVal > 1 ? Math.round(rawTotal * ageFactorVal) : rawTotal;
            const hasDamp = damp < 0.99;
            const titleStr = breakdown.title || '';
            return `<div class="crs-ctx-bar-stack">
              <div class="crs-ctx-bar-seg" style="flex:${Math.max(1,owC)};background:#3b82f6" title="OWR: ${owC} pts"></div>
              <div class="crs-ctx-bar-seg" style="flex:${Math.max(1,rwC)};background:#8b5cf6" title="RWR: ${rwC} pts"></div>
              <div class="crs-ctx-bar-seg" style="flex:${Math.max(1,acC)};background:#f59e0b" title="ACC: ${acC} pts"></div>
              <div class="crs-ctx-bar-seg" style="flex:${Math.max(1,100-score)};background:rgba(255,255,255,0.05)" title="Remaining: ${100-score}"></div>
            </div>
            <div class="crs-ctx-bar-legend">
              <span style="color:#3b82f6">● OWR ${owC}</span>
              <span style="color:#8b5cf6">● RWR ${rwC}</span>
              <span style="color:#f59e0b">● ACC ${acC}</span>
              <span style="color:rgba(255,255,255,0.3)">= ${rawTotal}</span>
            </div>
            <div class="crs-ctx-bar-legend" style="margin-top:3px">
              ${ageFactorVal>1?`<span style="color:#e879a0">× Age ${ageFactorVal.toFixed(1)} = ${afterAge}</span>`:''}
              ${hasDamp?`<span style="color:#60a5fa" title="${titleStr} title — verified titled players receive reduced risk scores">× ${titleStr} Title ${dampPct}% = ${score}</span>`:''}
              ${!hasDamp && ageFactorVal<=1?`<span style="color:rgba(255,255,255,0.3)">Final = ${score}</span>`:''}
            </div>`;
          })()}
        </div>
      </div>

      <div class="crs-footer">
        <button class="crs-refresh-btn" id="crs-refresh-btn"><span id="crs-spin">↻</span> Refresh</button>
        <div class="crs-footer-bttw" title="Brick Through The Window Media">
          <div class="crs-footer-bttw-label">BTTW<br>MEDIA</div>
          <div class="crs-bttw-anim">
            <svg class="crs-bttw-thrower" viewBox="0 0 16 22" fill="none">
              <ellipse cx="9" cy="3" rx="2.5" ry="2.8" fill="rgba(40,40,40,0.9)"/>
              <rect x="7.2" y="2.3" width="3.6" height="1" rx="0.5" fill="rgba(200,200,200,0.2)"/>
              <circle cx="8.4" cy="2.8" r="0.3" fill="rgba(255,255,255,0.6)"/><circle cx="9.6" cy="2.8" r="0.3" fill="rgba(255,255,255,0.6)"/>
              <path d="M9 5.5 L7.8 12 L10.8 11.5 Z" fill="rgba(255,255,255,0.25)"/>
              <path d="M9 7 L12 3.5 L14 2.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.3" stroke-linecap="round"/>
              <path d="M8.5 7.5 L5.5 9 L4 8.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.3" stroke-linecap="round"/>
              <path d="M8 11.5 L6 16 L4.5 20" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M10 11 L11.5 16 L13 20" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <div class="crs-bttw-brick"></div>
            <div class="crs-bttw-window"></div>
            <div class="crs-bttw-flash"></div>
            <div class="crs-bttw-confetti"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
        <div class="crs-footer-right">
          <span class="crs-footer-credit">CREATED BY AZ_93</span>
          <a class="crs-footer-contact" href="mailto:azec.1993@gmail.com" title="Contact az_93">
            <svg viewBox="0 0 16 12" width="10" height="8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="14" height="10" rx="1.5"/><polyline points="1,1 8,7 15,1"/></svg>
          </a>
        </div>
      </div>`;

    this._bindClose(); this._bindRefresh(username); this._bindContextToggle(); this._bindNameTabs();
    this.show(); setTimeout(()=>this._animateBars(),80);
  }

  _truncName(n) { return n && n.length > 14 ? n.slice(0,12)+'…' : n; }

  // Semi-zen: only show header, score ring, and expand toggle
  showSemiZen(username, result, oppName = '', myName = '') {
    if (!this.el) this.create();
    this._lastResult = result;
    this._lastArgs = { username, oppName, myName };

    const { score, level } = result;
    const { color, glow, label } = level;

    this.el.style.setProperty('--risk-color', color);
    this.el.style.setProperty('--risk-glow', glow);
    const theme = this._detectTheme();
    this.el.classList.remove('crs-theme-light','crs-theme-dark');
    this.el.classList.add(`crs-theme-${theme}`);
    if (score >= 65) this.el.classList.add('crs-pulse-border'); else this.el.classList.remove('crs-pulse-border');

    const CIRC=175.93, dashOffset=CIRC-(score/100)*CIRC;

    this.el.innerHTML = `
      <div class="crs-header">
        <div class="crs-logo"><span class="crs-logo-icon">♟</span> CHESS RISK SCORE <span class="crs-version">v${this.VERSION}</span></div>
        <button class="crs-close" id="crs-close-btn">✕</button>
      </div>
      <div class="crs-semi-zen">
        <div class="crs-score-ring" style="margin:12px auto">
          <svg class="crs-ring-svg" viewBox="0 0 70 70">
            <circle class="crs-ring-bg" cx="35" cy="35" r="28"/>
            <circle class="crs-ring-fill" cx="35" cy="35" r="28" stroke="${color}" style="stroke-dashoffset:${dashOffset}"/>
          </svg>
          <div class="crs-score-num">${score}</div>
        </div>
        <div class="crs-risk-label" style="text-align:center;padding-bottom:4px">${label}</div>
        <button class="crs-expand-btn" id="crs-expand-btn" title="Show full risk profile">▸ FULL PROFILE</button>
      </div>`;

    this._bindClose();
    const expandBtn = document.getElementById('crs-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        if (this._lastResult && this._lastArgs) {
          this.showResult(this._lastArgs.username, this._lastResult, false, this._lastArgs.oppName, this._lastArgs.myName);
        }
      });
    }
    this.show();
  }

  // Win rate stat row with risk-level markers (25/50/75) and colored %
  // Single white threshold line at the highest risk boundary crossed
  _statRowRisk(label, pct, displayVal, valColor, tooltip) {
    const p = Math.min(100, Math.max(0, pct||0));
    const t = tooltip?` title="${this._esc(tooltip)}"`:'';
    let markerPos = null, markerTitle = '';
    if (pct >= 70) { markerPos = 70; markerTitle = '70% — extreme risk'; }
    else if (pct >= 60) { markerPos = 60; markerTitle = '60% — high risk'; }
    else if (pct >= 50) { markerPos = 50; markerTitle = '50% — moderate risk'; }
    const marker = markerPos !== null ? `<div class="crs-stat-bar-marker crs-marker-white" style="left:${markerPos}%" title="${markerTitle}"></div>` : '';
    return `<div class="crs-stat-row"${t}><div class="crs-stat-label">${label}</div><div class="crs-stat-bar-wrap">
      <div class="crs-stat-bar crs-stat-bar-custom" data-target="${p}" style="width:0%;background:${valColor}"></div>${marker}
    </div><div class="crs-stat-val" style="color:${valColor}">${displayVal}</div></div>`;
  }

  _statRowCustom(label,barPct,displayVal,barColor,tooltip,thresholdPct,thresholdLabel){
    const pct=Math.min(100,Math.max(0,barPct||0));
    const t=tooltip?` title="${this._esc(tooltip)}"`:'';
    const marker=thresholdPct!=null?`<div class="crs-stat-bar-marker crs-marker-white" style="left:${Math.min(98,Math.max(2,thresholdPct))}%" title="Flag threshold: ${thresholdLabel||''}"></div>`:'';
    return`<div class="crs-stat-row"${t}><div class="crs-stat-label">${label}</div><div class="crs-stat-bar-wrap"><div class="crs-stat-bar crs-stat-bar-custom" data-target="${pct}" style="width:0%;background:${barColor}"></div>${marker}</div><div class="crs-stat-val" style="color:${barColor}">${displayVal}</div></div>`;
  }

  _statRowAge(label,factor,ageDaysStr){
    const pct=Math.min(100,Math.max(0,Math.round((factor/5)*100)));
    const display=factor>1?`×${factor.toFixed(1)}`:'×1';
    const barColor=this._ageColor(factor);
    const tip=`Account ${ageDaysStr} old → ${display} risk multiplier. <7d=×5, <30d=×3.5, <90d=×2, >1yr=×1.`;
    return`<div class="crs-stat-row" title="${this._esc(tip)}"><div class="crs-stat-label">${label}</div><div class="crs-stat-bar-wrap"><div class="crs-stat-bar crs-stat-bar-custom" data-target="${pct}" style="width:0%;background:${barColor}"></div></div><div class="crs-stat-val" style="color:${barColor}">${display}</div></div>`;
  }

  _renderAccuracyRefTable(playerRating) {
    const fmts=['bullet','blitz','rapid'];
    const svgIcons = {
      rapid:'<svg viewBox="0 0 16 16" class="crs-fmt-svg" style="width:12px;height:12px;display:inline-block;vertical-align:middle" title="Rapid"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="4" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="8.5" x2="10.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      blitz:'<svg viewBox="0 0 16 16" class="crs-fmt-svg" style="width:12px;height:12px;display:inline-block;vertical-align:middle" title="Blitz"><polygon points="9,1 4,9 8,9 7,15 12,7 8,7" fill="currentColor"/></svg>',
      bullet:'<svg viewBox="0 0 20 14" class="crs-fmt-svg crs-fmt-bullet" style="width:16px;height:10px;display:inline-block;vertical-align:middle" title="Bullet"><line x1="1" y1="5" x2="6" y2="5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/><line x1="0" y1="7" x2="5.5" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/><line x1="1" y1="9" x2="6" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/><rect x="5.5" y="4" width="8" height="6" rx="1" fill="currentColor"/><path d="M13.5 4 Q18 7 13.5 10 Z" fill="currentColor"/></svg>',
    };
    if(!CONFIG?.FORMAT_ACCURACY) return '';
    let rows='';
    const fmtLabels = {bullet:'Bullet',blitz:'Blitz',rapid:'Rapid'};
    for(const f of fmts){const t=CONFIG.FORMAT_ACCURACY[f];if(!t)continue;let band=null;for(const[maxR,lo,hi,exp,thr]of t){if(playerRating<maxR){band={lo,hi,exp,thr};break;}}if(!band){const l=t[t.length-1];band={lo:l[1],hi:l[2],exp:l[3],thr:l[4]};}rows+=`<div class="crs-ctx-ref-row"><div class="crs-ctx-ref-fmt" title="${fmtLabels[f]||f}">${svgIcons[f]||''}</div><div class="crs-ctx-ref-range">${band.lo}–${band.hi}%</div><div class="crs-ctx-ref-exp">${band.exp}%</div><div class="crs-ctx-ref-thr">${band.thr}%</div></div>`;}
    return `<div class="crs-ctx-ref-table"><div class="crs-ctx-ref-header"><div></div><div>Normal</div><div>Expected</div><div>Flag At</div></div>${rows}</div>`;
  }

  _ctxBarSegment(label,rawScore,weight,color){const c=Math.round(rawScore*weight);return `<div class="crs-ctx-bar-seg" style="flex:${Math.max(1,c)};background:${color}" title="${label}: ${rawScore}×${weight}=${c}"></div>`;}

  _renderInsightsTable(insights) {
    if(!insights) return '';
    const rows=[];
    // Fix 10: ordered bullet, blitz, rapid
    const fmtOrder = ['bullet','blitz','rapid','daily'];
    const fmtTitles = {bullet:'Bullet',blitz:'Blitz',rapid:'Rapid',classical:'Classical',daily:'Daily'};
    const sortedEntries = Object.entries(insights).sort((a,b) => {
      const ai=fmtOrder.indexOf(a[0]), bi=fmtOrder.indexOf(b[0]);
      return (ai===-1?99:ai)-(bi===-1?99:bi);
    });

    for(const[fmt,data]of sortedEntries){
      const{wins,losses,draws,total}=data.recent;
      if(total===0&&!data.overall)continue;
      const w=total>0?wins:(data.overall?.wins||0),l=total>0?losses:(data.overall?.losses||0),d=total>0?draws:(data.overall?.draws||0);
      const t=w+l+d,winPct=t>0?Math.round((w/t)*100):0;
      const acc=data.avgAccuracy,cur=data.currentRating,rawPeak=data.peakRating;
      const peak=(cur&&rawPeak)?Math.max(cur,rawPeak):(rawPeak||cur||null);
      const curStr=cur?String(cur):'—',peakStr=peak?String(peak):'—';
      // Color columns white
      let accColor = 'rgba(255,255,255,0.85)';
      const fmtTitle = fmtTitles[fmt]||fmt;
      const icons={
        rapid:`<svg viewBox="0 0 16 16" class="crs-fmt-svg" title="${fmtTitle}"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="4" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="8.5" x2="10.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        blitz:`<svg viewBox="0 0 16 16" class="crs-fmt-svg" title="${fmtTitle}"><polygon points="9,1 4,9 8,9 7,15 12,7 8,7" fill="currentColor"/></svg>`,
        bullet:`<svg viewBox="0 0 20 14" class="crs-fmt-svg crs-fmt-bullet" title="${fmtTitle}"><line x1="1" y1="5" x2="6" y2="5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/><line x1="0" y1="7" x2="5.5" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/><line x1="1" y1="9" x2="6" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/><rect x="5.5" y="4" width="8" height="6" rx="1" fill="currentColor"/><path d="M13.5 4 Q18 7 13.5 10 Z" fill="currentColor"/></svg>`,
        classical:`<svg viewBox="0 0 16 16" class="crs-fmt-svg" title="${fmtTitle}"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="3" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="8.5" x2="11" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        daily:'📅',
      };
      const wpC = 'rgba(255,255,255,0.85)';
      rows.push(`
        <div class="crs-it-row" title="${total>0?total+' games in the last 2 months':'overall'}">
          <div class="crs-it-fmt" title="${fmtTitle}">${icons[fmt]||fmt}</div>
          <div class="crs-it-wld"><span class="w">${w}</span><span class="sep">/</span><span class="l">${l}</span><span class="sep">/</span><span class="d">${d}</span></div>
          <div class="crs-it-wpct" style="color:${wpC}">${t>0?winPct+'%':'—'}</div>
          <div class="crs-it-acc" style="color:${accColor}">${acc!==null?acc+'%':'—'}</div>
          <div class="crs-it-rating cur">${curStr}${(()=>{const ch=data.ratingChange7d;if(!ch)return'';return`<span class="crs-it-trend ${ch>0?'pos':'neg'}">${ch>0?'+':''}${ch}</span>`;})()}</div>
          <div class="crs-it-rating peak">${peak?peakStr:'—'}</div>
        </div>`);
    }
    if(!rows.length)return`<div class="crs-insights-table"><div class="crs-it-no-data">No game data</div></div>`;
    return`<div class="crs-insights-table">
      <div class="crs-it-header">
        <div title="Time control format"></div>
        <div title="Wins / Losses / Draws (last 2 months)">W / L / D</div>
        <div title="Win percentage (last 2 months)">W%</div>
        <div title="Average accuracy (last 2 months, reviewed games)">Acc</div>
        <div title="Current rating with 7-day trend">Cur</div>
        <div title="All-time peak rating">Peak</div>
      </div>${rows.join('')}</div>`;
  }

  _animateBars(){document.querySelectorAll('.crs-stat-bar[data-target]').forEach(bar=>{setTimeout(()=>{bar.style.width=bar.dataset.target+'%';},50);});}
  _bindClose(){const b=document.getElementById('crs-close-btn');if(b)b.addEventListener('click',()=>this.hide());}
  _bindRefresh(username){const b=document.getElementById('crs-refresh-btn');if(b)b.addEventListener('click',()=>{b.disabled=true;const s=document.getElementById('crs-spin');if(s)s.style.animation='crs-spin 0.8s linear infinite';window.dispatchEvent(new CustomEvent('crs:refresh',{detail:{username}}));});}
  _bindContextToggle(){const t=document.getElementById('crs-context-toggle'),p=document.getElementById('crs-context-panel'),a=document.getElementById('crs-context-arrow');if(t&&p)t.addEventListener('click',()=>{const o=p.style.display!=='none';p.style.display=o?'none':'block';if(a)a.textContent=o?'▸':'▾';t.classList.toggle('crs-ctx-open',!o);});}
  _bindNameTabs(){
    const opp=document.getElementById('crs-tab-opp'), me=document.getElementById('crs-tab-me');
    if(opp) opp.addEventListener('click',()=>{if(!opp.classList.contains('active'))window.dispatchEvent(new CustomEvent('crs:toggle-view'));});
    if(me) me.addEventListener('click',()=>{if(!me.classList.contains('active'))window.dispatchEvent(new CustomEvent('crs:toggle-view'));});
  }

  _makeDraggable(){
    if(!this.el)return;
    this.el.addEventListener('mousedown',(e)=>{const h=this.el.querySelector('.crs-header');if(!h||!h.contains(e.target)||e.target.closest('.crs-close'))return;this.isDragging=true;const r=this.el.getBoundingClientRect();this.dragOffset={x:e.clientX-r.left,y:e.clientY-r.top};this.el.classList.add('dragging');e.preventDefault();});
    document.addEventListener('mousemove',(e)=>{if(!this.isDragging||!this.el)return;this.el.style.right='auto';this.el.style.bottom='auto';this.el.style.left=Math.max(0,Math.min(window.innerWidth-240,e.clientX-this.dragOffset.x))+'px';this.el.style.top=Math.max(0,Math.min(window.innerHeight-400,e.clientY-this.dragOffset.y))+'px';});
    document.addEventListener('mouseup',()=>{if(this.isDragging&&this.el)this.el.classList.remove('dragging');this.isDragging=false;});
  }

  _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
}
