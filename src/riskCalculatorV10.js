// ============================================================
// RISK CALCULATOR v10 — drop-in for v9 (Chess.com). Load AFTER config.js and riskCalculator.js.
//
// v10 = v9's own evidence (uncapped) + four signals v9 ignores, all taken from
// data the extension already downloads. No extra API calls.
//   1. lifetime games in the format      (few games = riskier)
//   2. share of games at 90%+ accuracy   (more = riskier)
//   3. clock left at the end of a game   (more = riskier)
//   4. share of games of 15 moves or less (more = riskier)
// Weights and score bands were fitted on 252 Chess.com accounts closed for fair
// play vs 1,993 normal accounts (build_v10.mjs). Lichess has no validation data
// yet, so Lichess keeps the v9 score unchanged.
// ============================================================

/* V10_MODEL_START */
const V10_MODEL = {
  "fittedOn": "252 closed-for-fair-play vs 1993 normal Chess.com accounts",
  "intercept": -0.789,
  "features": [
    {
      "name": "v9Evidence",
      "weight": 0.446,
      "mean": 0.509,
      "sd": 0.6137,
      "median": 0.3118
    },
    {
      "name": "lifetimeGames",
      "weight": -0.711,
      "mean": 3.3842,
      "sd": 0.8739,
      "median": 3.5027
    },
    {
      "name": "acc90Share",
      "weight": 0.464,
      "mean": 0.0549,
      "sd": 0.1,
      "median": 0.025
    },
    {
      "name": "clockLeft",
      "weight": 0.303,
      "mean": 0.3795,
      "sd": 0.1473,
      "median": 0.3683
    },
    {
      "name": "shortGameShare",
      "weight": 0.25,
      "mean": 0.1021,
      "sd": 0.0833,
      "median": 0.08
    }
  ],
  "anchors": [
    [
      -3.51,
      0
    ],
    [
      -1.25,
      3
    ],
    [
      0.482,
      12
    ],
    [
      1.199,
      25
    ],
    [
      1.849,
      50
    ],
    [
      2.245,
      75
    ],
    [
      5.462,
      100
    ]
  ]
};
/* V10_MODEL_END */

const V10_LIMITS = { MAX_GAMES_PARSED: 300, MAX_CLOCK_GAMES: 150, MIN_ACC_GAMES: 3, MIN_CLOCK_MOVES: 100, SHORT_GAME_MOVES: 15 };

class RiskCalculatorV10 extends RiskCalculator {
  // v9's evidence before the 0-100 clamp, so two accounts that both "hit 100" can still be ranked.
  _scoreForFormat(fmt, stats, recentGames, username, ageFactor, bestRating, platform, title) {
    const r = super._scoreForFormat(fmt, stats, recentGames, username, ageFactor, bestRating, platform, title);
    const W = this.cfg.WEIGHTS;
    r.v9Raw = ageFactor * (W.OVERALL_WINRATE * r.overallWR + W.RECENT_WINRATE * r.recentWR + W.ACC_RISK * r.accRisk);
    (this._rawByFormat ||= {})[fmt] = r.v9Raw;
    return r;
  }

  _moveCount(pgn) {
    const m = pgn.match(/(\d+)\.(?:\.\.)?\s+\S+(?:\s+\{[^}]*\})?\s+(?:1-0|0-1|1\/2-1\/2)\s*$/);
    return m ? +m[1] : null;
  }

  // The four new signals for one format. Returns null for a signal that has no data.
  _signals(fmt, stats, recentGames, username, statsLoaded = true) {
    const userL = username.toLowerCase();
    const mine = [];
    for (const g of recentGames) {
      if (g.time_class !== fmt || g.rated === false) continue;
      if (g.rules && g.rules !== 'chess') continue;
      const isW = (g.white?.username || '').toLowerCase() === userL;
      if (!isW && (g.black?.username || '').toLowerCase() !== userL) continue;
      mine.push({ g, isW });
    }
    mine.sort((a, b) => (b.g.end_time || 0) - (a.g.end_time || 0));       // newest first

    let accN = 0, acc90 = 0, moveGames = 0, shortGames = 0, clockGames = 0, clockMoves = 0, leftSum = 0;
    const clkRe = /\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
    for (let i = 0; i < mine.length; i++) {
      const { g, isW } = mine[i];
      const acc = g.accuracies ? (isW ? g.accuracies.white : g.accuracies.black) : null;
      if (acc !== null && acc !== undefined) { accN++; if (acc >= 90) acc90++; }
      if (i >= V10_LIMITS.MAX_GAMES_PARSED || !g.pgn) continue;
      const n = this._moveCount(g.pgn);
      if (n) { moveGames++; if (n <= V10_LIMITS.SHORT_GAME_MOVES) shortGames++; }
      if (clockGames >= V10_LIMITS.MAX_CLOCK_GAMES || fmt === 'daily') continue;
      const base = parseFloat(String(g.time_control));
      if (!(base > 0)) continue;
      let idx = 0, mineLast = null, count = 0, m;
      clkRe.lastIndex = 0;
      while ((m = clkRe.exec(g.pgn))) {
        if ((idx % 2 === 0) === isW) { mineLast = +m[1] * 3600 + +m[2] * 60 + +m[3]; count++; }
        idx++;
      }
      if (idx >= 20 && mineLast !== null) { clockGames++; clockMoves += count; leftSum += mineLast / base; }
    }
    const rec = this._getFormatRecord(stats, fmt);
    return {
      // Unknown (not zero) when the stats request failed: zero games is the strongest risk signal.
      lifetimeGames: rec ? rec.total : (statsLoaded ? 0 : null),
      acc90Share: accN >= V10_LIMITS.MIN_ACC_GAMES ? acc90 / accN : null,
      clockLeft: clockMoves >= V10_LIMITS.MIN_CLOCK_MOVES ? leftSum / clockGames : null,
      shortGameShare: moveGames >= 5 ? shortGames / moveGames : null,
      accGames: accN, clockGames, gamesSeen: mine.length,
    };
  }

  // The inputs of the model, in the order V10_MODEL lists them.
  _inputs(v9Raw, s) {
    return {
      v9Evidence: Math.log10(1 + Math.max(0, v9Raw)),
      lifetimeGames: s.lifetimeGames === null ? null : Math.log10(s.lifetimeGames + 1),
      acc90Share: s.acc90Share,
      clockLeft: s.clockLeft,
      shortGameShare: s.shortGameShare,
    };
  }

  // logit = intercept + sum( weight * (value - mean) / sd ); a missing value counts as typical (0).
  _logit(inputs) {
    let z = V10_MODEL.intercept;
    const parts = {};
    for (const f of V10_MODEL.features) {
      const v = inputs[f.name] ?? f.median;
      parts[f.name] = f.weight * (v - f.mean) / f.sd;
      z += parts[f.name];
    }
    return { z, parts };
  }

  // Piecewise-linear map from logit to 0-100 through fixed anchor points.
  _toScore(z) {
    const A = V10_MODEL.anchors;                       // [[logit, score], ...] ascending
    if (z <= A[0][0]) return A[0][1];
    for (let i = 1; i < A.length; i++) {
      if (z <= A[i][0]) return A[i - 1][1] + (A[i][1] - A[i - 1][1]) * (z - A[i - 1][0]) / (A[i][0] - A[i - 1][0]);
    }
    return 100;
  }

  // Rating in a format: the stats when they loaded, otherwise the player's rating in their
  // newest game of that format (already downloaded with the games).
  _getFormatRating(stats, fmt) {
    return super._getFormatRating(stats, fmt) || (this._ratingFromGames && this._ratingFromGames[fmt]) || 0;
  }

  calculate(data, preferredFormat, platform = 'chesscom') {
    this._rawByFormat = {};
    this._ratingFromGames = {};
    const seen = {}, userL = String(data.username || '').toLowerCase();
    for (const g of (data.recentGames || [])) {
      if (!g.time_class || g.rated === false || (g.rules && g.rules !== 'chess')) continue;
      const me = (g.white?.username || '').toLowerCase() === userL ? g.white : (g.black?.username || '').toLowerCase() === userL ? g.black : null;
      if (!me || !me.rating || (seen[g.time_class] || 0) > (g.end_time || 0)) continue;
      seen[g.time_class] = g.end_time || 0; this._ratingFromGames[g.time_class] = me.rating;
    }
    const result = super.calculate(data, preferredFormat, platform);
    if (platform !== 'chesscom' || !V10_MODEL) return result;       // Lichess: v9 unchanged

    const fmt = result.scoredFormat;
    const signals = this._signals(fmt, data.stats, data.recentGames, data.username, data.statsLoaded !== false);
    const inputs = this._inputs(this._rawByFormat[fmt] ?? 0, signals);
    const { z, parts } = this._logit(inputs);
    const dampener = this._titleDampener(data.profile?.title || null);
    const score = Math.min(100, Math.max(0, Math.round(this._toScore(z) * dampener)));

    const levels = this.cfg.RISK_LEVELS;
    let level = levels.DANGER;
    for (const lvl of Object.values(levels)) { if (score < lvl.max) { level = lvl; break; } }

    const available = ['acc90Share', 'clockLeft', 'shortGameShare'].filter(k => signals[k] !== null).length;
    const incomplete = Array.isArray(data.missing) && data.missing.length > 0;
    const confidence = incomplete ? 'low' : signals.gamesSeen >= 30 && available === 3 ? 'high' : signals.gamesSeen >= 10 && available >= 1 ? 'medium' : 'low';

    return {
      ...result, score, level,
      breakdown: { ...result.breakdown, v9Score: result.score, v10: { signals, contributions: parts, confidence } },
    };
  }
}
