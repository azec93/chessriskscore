// ============================================================
// RISK CALCULATOR v9 — Platform-aware (Chess.com + Lichess)
// Selects accuracy tables based on platform parameter
// ============================================================

class RiskCalculator {
  constructor(config) { this.cfg = config; }
  _weight(n, K = 20) { return n / (n + K); }

  _winRateScore(w, n) {
    const weight = this._weight(n, this.cfg.WINRATE.WEIGHTING_K);
    if (n < this.cfg.MIN_GAMES_FOR_RATING) return 0;
    let base;
    if (w <= 0.50) base = 0;
    else if (w <= 0.60) base = ((w - 0.50) / 0.10) * 50;
    else if (w <= 0.70) base = 50 + ((w - 0.60) / 0.10) * 50;
    else base = 100 + ((w - 0.70) / 0.10) * 100;
    return base * weight;
  }

  // Select accuracy table based on platform
  _getAccuracyTable(platform) {
    return platform === 'lichess' ? this.cfg.LICHESS_FORMAT_ACCURACY : this.cfg.FORMAT_ACCURACY;
  }

  _getFormatAccuracyBand(fmt, rating, platform) {
    const tables = this._getAccuracyTable(platform);
    const table = tables[fmt] || tables['blitz'];
    if (!table) return { avgLo: 50, avgHi: 70, expected: 60, threshold: 71 };
    for (const [maxR, avgLo, avgHi, expected, threshold] of table) {
      if (rating < maxR) return { avgLo, avgHi, expected, threshold };
    }
    const l = table[table.length - 1];
    return { avgLo: l[1], avgHi: l[2], expected: l[3], threshold: l[4] };
  }

  _spikeScore(HPC, n) {
    if (n === 0 || HPC <= 10) return 0;
    const weight = this._weight(n, this.cfg.ACCURACY.WEIGHTING_K);
    let base;
    if (HPC > 30) base = 100 + Math.floor((HPC - 30) / 5) * 50;
    else if (HPC > 20) base = 50 + ((HPC - 20) / 10) * 50;
    else base = ((HPC - 10) / 10) * 50;
    return base * weight;
  }

  _anomalyScore(avgAcc, expected, n) {
    if (avgAcc === null || n < this.cfg.MIN_GAMES_FOR_ACCURACY || expected <= 0) return 0;
    const excess = avgAcc - expected;
    const RA = this.cfg.RATING_ANOMALY;
    if (excess <= 0) return 0;
    let base;
    if (excess >= RA.EXTREME_EXCESS) base = 100;
    else if (excess >= RA.HIGH_EXCESS) base = 60 + ((excess - RA.HIGH_EXCESS) / (RA.EXTREME_EXCESS - RA.HIGH_EXCESS)) * 40;
    else if (excess >= RA.MILD_EXCESS) base = 20 + ((excess - RA.MILD_EXCESS) / (RA.HIGH_EXCESS - RA.MILD_EXCESS)) * 40;
    else base = (excess / RA.MILD_EXCESS) * 20;
    return base * this._weight(n, 15);
  }

  _accRiskScore(HPC, accGames, avgAcc, expected) {
    const A = this.cfg.ACCURACY;
    return A.ANOMALY_WEIGHT * this._anomalyScore(avgAcc, expected, accGames) + A.SPIKE_WEIGHT * this._spikeScore(HPC, accGames);
  }

  _accountAgeFactor(ts) {
    if (!ts) return 1;
    const days = (Date.now() / 1000 - ts) / 86400;
    for (const [max, mult] of this.cfg.ACCOUNT_AGE.MULTIPLIERS) { if (days <= max) return mult; }
    return 1;
  }

  _accountAgeDays(ts) { return ts ? Math.round((Date.now() / 1000 - ts) / 86400) : null; }

  _getFormatRecord(stats, fmt) {
    const key = `chess_${fmt}`;
    const rec = stats[key]?.record;
    if (!rec) return null;
    return { wins: rec.win || 0, losses: rec.loss || 0, draws: rec.draw || 0,
      total: (rec.win || 0) + (rec.loss || 0) + (rec.draw || 0),
      rating: stats[key]?.last?.rating || stats[key]?.best?.rating || 0 };
  }

  _getBestRating(stats, formats) {
    let best = 0;
    for (const fmt of formats) { const r = stats[`chess_${fmt}`]?.last?.rating || 0; if (r > best) best = r; }
    return best;
  }

  _getFormatRating(stats, fmt) {
    return stats[`chess_${fmt}`]?.last?.rating || stats[`chess_${fmt}`]?.best?.rating || 0;
  }

  // Title-based dampener: only GMs and IMs receive reduced risk
  // Their high win rates and accuracy are expected at their level
  _titleDampener(title) {
    if (!title) return 1.0;
    const t = title.toUpperCase();
    if (t === 'GM' || t === 'WGM') return 0.5;   // 50% risk reduction
    if (t === 'IM' || t === 'WIM') return 0.65;   // 35% risk reduction
    return 1.0; // FM, NM, CM etc — no dampening
  }

  _scoreForFormat(fmt, stats, recentGames, username, ageFactor, bestRating, platform, title) {
    const userL = username.toLowerCase(), W = this.cfg.WEIGHTS;
    const fmtRating = this._getFormatRating(stats, fmt) || bestRating;
    const accBand = this._getFormatAccuracyBand(fmt, fmtRating, platform);
    const rec = this._getFormatRecord(stats, fmt);

    const overallWinPct = rec && rec.total > 0 ? Math.round((rec.wins / rec.total) * 100) : 0;
    const overallWR = rec && rec.total >= this.cfg.MIN_GAMES_FOR_RATING
      ? this._winRateScore(rec.wins / rec.total, rec.total) : 0;

    let rWins = 0, rTotal = 0, accHigh = 0, accCount = 0, accSum = 0;
    for (const game of recentGames) {
      if (game.time_class !== fmt) continue;
      if (this.cfg.RATED_ONLY && game.rated === false) continue;
      const isW = (game.white?.username || '').toLowerCase() === userL;
      const isB = (game.black?.username || '').toLowerCase() === userL;
      if (!isW && !isB) continue;
      const p = isW ? game.white : game.black;
      if (!p) continue;
      rTotal++;
      if (p.result === 'win') rWins++;
      const acc = game.accuracies ? (isW ? game.accuracies.white : game.accuracies.black) : null;
      if (acc !== null && acc !== undefined) { accCount++; accSum += acc; if (acc >= accBand.threshold) accHigh++; }
    }

    const recentWinPct = rTotal > 0 ? Math.round((rWins / rTotal) * 100) : 0;
    const recentWR = rTotal >= this.cfg.MIN_GAMES_FOR_RATING
      ? this._winRateScore(rTotal > 0 ? rWins / rTotal : 0, rTotal) : 0;

    const HPC = accCount > 0 ? (accHigh / accCount) * 100 : 0;
    const avgAcc = accCount > 0 ? accSum / accCount : null;
    const accRisk = this._accRiskScore(HPC, accCount, avgAcc, accBand.expected);
    const raw = W.OVERALL_WINRATE * overallWR + W.RECENT_WINRATE * recentWR + W.ACC_RISK * accRisk;

    // Title-based dampener: only GM/IM receive reduced risk scores
    const dampener = this._titleDampener(title);
    const score = Math.min(100, Math.max(0, Math.round(ageFactor * raw * dampener)));

    return {
      score, overallWR: Math.round(overallWR), recentWR: Math.round(recentWR),
      overallWinPct, recentWinPct, dampener,
      accRisk: Math.round(accRisk), accBand, fmtRating,
      avgAccuracy: avgAcc !== null ? Math.round(avgAcc * 10) / 10 : null, accGames: accCount,
    };
  }

  _computeWinStreak(recentGames, username) {
    const userL = username.toLowerCase();
    const sorted = [...recentGames].filter(g => {
      if (this.cfg.RATED_ONLY && g.rated === false) return false;
      return (g.white?.username||'').toLowerCase() === userL || (g.black?.username||'').toLowerCase() === userL;
    }).sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
    let streak = 0;
    for (const g of sorted) {
      const p = (g.white?.username||'').toLowerCase() === userL ? g.white : g.black;
      if (!p || p.result !== 'win') break; streak++;
    }
    return streak;
  }

  computeInsights(recentGames, username, stats, formats) {
    const userL = username.toLowerCase(), result = {};
    const sevenDaysAgo = (Date.now() / 1000) - (7 * 86400);
    for (const fmt of formats) {
      let wins=0,losses=0,draws=0,accTotal=0,accSum=0;
      let o7dTs=Infinity,n7dTs=-Infinity,o7dR=null,n7dR=null;
      for (const game of recentGames) {
        if (!game.time_class||game.time_class!==fmt) continue;
        if (this.cfg.RATED_ONLY&&game.rated===false) continue;
        const isW=(game.white?.username||'').toLowerCase()===userL;
        const isB=(game.black?.username||'').toLowerCase()===userL;
        if (!isW&&!isB) continue;
        const p=isW?game.white:game.black; if(!p) continue;
        if (p.result==='win') wins++;
        else if (['resigned','timeout','checkmated','abandoned'].includes(p.result)) losses++;
        else draws++;
        const acc=game.accuracies?(isW?game.accuracies.white:game.accuracies.black):null;
        if (acc!==null&&acc!==undefined){accSum+=acc;accTotal++;}
        const ts=game.end_time||0;
        if (ts>=sevenDaysAgo){const r=p['@rating']||p.rating||null;if(r){if(ts<o7dTs){o7dTs=ts;o7dR=r;}if(ts>n7dTs){n7dTs=ts;n7dR=r;}}}
      }
      const rc7d=(n7dR!==null&&o7dR!==null&&n7dTs!==o7dTs)?n7dR-o7dR:null;
      const key=`chess_${fmt}`,fs=stats[key];
      result[fmt]={
        recent:{wins,losses,draws,total:wins+losses+draws},
        overall:this._getFormatRecord(stats,fmt),
        avgAccuracy:accTotal>0?Math.round(accSum/accTotal*10)/10:null,
        accuracyGames:accTotal,
        currentRating:fs?.last?.rating||null,
        peakRating:fs?.best?.rating||null,
        ratingChange7d:rc7d,
      };
    }
    return result;
  }

  // Main entry: platform = 'chesscom' | 'lichess'
  calculate(data, preferredFormat, platform = 'chesscom') {
    const {username, profile, stats, recentGames} = data;
    const formats = platform === 'lichess' ? this.cfg.LICHESS_FORMATS : this.cfg.FORMATS;
    const bestRating = this._getBestRating(stats, formats);
    const ageDays = this._accountAgeDays(profile?.joined);
    const ageFactor = this._accountAgeFactor(profile?.joined);
    const title = profile?.title || null;
    const formatsToScore = (preferredFormat && formats.includes(preferredFormat)) ? [preferredFormat] : formats;

    let bestScore=0, bestFormat=null;
    let bestBreakdown={overallWinrate:0,recentWinrate:0,accRisk:0,overallWinPct:0,recentWinPct:0,dampener:1,title:null};
    let bestAccBand={avgLo:0,avgHi:0,expected:0,threshold:0};
    let bestFmtRating=0, bestAvgAcc=null, bestAccGames=0;

    for (const fmt of formatsToScore) {
      const r = this._scoreForFormat(fmt, stats, recentGames, username, ageFactor, bestRating, platform, title);
      if (r.score > bestScore || formatsToScore.length === 1) {
        bestScore=r.score;
        bestBreakdown={overallWinrate:r.overallWR,recentWinrate:r.recentWR,accRisk:r.accRisk,overallWinPct:r.overallWinPct,recentWinPct:r.recentWinPct,dampener:r.dampener,title};
        bestFormat=fmt; bestAccBand=r.accBand; bestFmtRating=r.fmtRating; bestAvgAcc=r.avgAccuracy; bestAccGames=r.accGames;
      }
    }

    const ageDisplayScore = ageDays!==null ? Math.max(0,Math.min(100,Math.round((1-ageDays/365)*100))) : 0;
    const score = bestScore;
    const levels = this.cfg.RISK_LEVELS;
    let level = levels.DANGER;
    for (const lvl of Object.values(levels)) { if(score<lvl.max){level=lvl;break;} }

    const winStreak = this._computeWinStreak(recentGames, username);
    const insights = this.computeInsights(recentGames, username, stats, formats);
    const perFormatRatings = {};
    for (const fmt of formats) {
      const key=`chess_${fmt}`;
      perFormatRatings[fmt]={current:stats[key]?.last?.rating||null, peak:stats[key]?.best?.rating||null};
    }

    return {
      score, level, platform,
      breakdown:{
        ...bestBreakdown,
        accountAge:ageDisplayScore, ageDays, bestRating, ageFactor, bestFormat,
        accBand:bestAccBand, fmtRating:bestFmtRating,
        avgAccuracy:bestAvgAcc, accGames:bestAccGames,
      },
      insights, perFormatRatings, winStreak,
      recentGameCount:recentGames.length,
      scoredFormat:bestFormat,
    };
  }
}
