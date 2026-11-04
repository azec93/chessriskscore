// ============================================================
// RISK CALCULATOR v11 — Chess.com. Load AFTER riskCalculatorV10.js.
//
// v11 = v10's inputs + three more, all from data the extension already downloads (no extra API calls):
//   1. account age                        (younger = riskier)
//   2. best single-game accuracy          (judged against what an honest player of that rating shows)
//   3. results vs opponent ratings        (winning far more than the ratings predict = riskier)
// and the 90%+ accuracy share is now judged against rating too, so strong honest players are not
// flagged just for playing accurately.
// No title discount: established titled players score low on the signals themselves.
// Weights, rating tables and score bands are written in by chess-risk-v10-test/build_v11.mjs from
// 11,298 accounts closed for fair play vs 37,807 normal accounts. Lichess keeps the v9 score.
// ============================================================

/* V11_MODEL_START */
const V11_MODEL = {
  "fittedOn": "11298 Chess.com accounts closed for fair play vs 37807 normal accounts (all ratings, incl. 9,814 titled players)",
  "intercept": -0.7235,
  "features": [
    {
      "name": "v9Evidence",
      "weight": 0.4905,
      "mean": 0.7915,
      "sd": 0.8001,
      "median": 0.6484
    },
    {
      "name": "lifetimeGames",
      "weight": -0.5234,
      "mean": 3.0946,
      "sd": 0.9908,
      "median": 3.2658
    },
    {
      "name": "acc90Share",
      "weight": 0.3183,
      "mean": 0.0281,
      "sd": 0.1496,
      "median": -0.0101
    },
    {
      "name": "accMax",
      "weight": 0.2045,
      "mean": 0.5972,
      "sd": 5.5773,
      "median": 1.5069
    },
    {
      "name": "clockLeft",
      "weight": 0.1254,
      "mean": 0.3477,
      "sd": 0.1477,
      "median": 0.3195
    },
    {
      "name": "shortGameShare",
      "weight": 0.3023,
      "mean": 0.0911,
      "sd": 0.1245,
      "median": 0.0619
    },
    {
      "name": "logAge",
      "weight": -1.1612,
      "mean": 2.7633,
      "sd": 0.9186,
      "median": 3.1062
    },
    {
      "name": "z",
      "weight": 0.3141,
      "mean": 0.5021,
      "sd": 1.6144,
      "median": 0.1894
    }
  ],
  "expected": {
    "acc90Share": [
      [
        0,
        0.0351
      ],
      [
        1,
        0.0287
      ],
      [
        2,
        0.028
      ],
      [
        3,
        0.0318
      ],
      [
        4,
        0.0337
      ],
      [
        5,
        0.0373
      ],
      [
        6,
        0.0415
      ],
      [
        7,
        0.0481
      ],
      [
        8,
        0.0564
      ],
      [
        9,
        0.0757
      ],
      [
        10,
        0.1305
      ],
      [
        11,
        0.148
      ],
      [
        12,
        0.1538
      ],
      [
        13,
        0.1666
      ],
      [
        14,
        0.1964
      ],
      [
        15,
        0.2736
      ]
    ],
    "accMax": [
      [
        0,
        85.1143
      ],
      [
        1,
        85.8686
      ],
      [
        2,
        86.7097
      ],
      [
        3,
        87.7311
      ],
      [
        4,
        88.494
      ],
      [
        5,
        88.7979
      ],
      [
        6,
        89.5011
      ],
      [
        7,
        89.986
      ],
      [
        8,
        90.7205
      ],
      [
        9,
        91.8425
      ],
      [
        10,
        93.462
      ],
      [
        11,
        94.0141
      ],
      [
        12,
        94.1611
      ],
      [
        13,
        94.8291
      ],
      [
        14,
        95.8089
      ],
      [
        15,
        97.4473
      ]
    ]
  },
  "anchors": [
    [
      -4.6792,
      0
    ],
    [
      -1.8676,
      3
    ],
    [
      0.0775,
      12
    ],
    [
      1.0837,
      25
    ],
    [
      2.0539,
      50
    ],
    [
      2.7044,
      75
    ],
    [
      4.5785,
      100
    ]
  ]
};
/* V11_MODEL_END */

const V11_DRAWS = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'];

class RiskCalculatorV11 extends RiskCalculatorV10 {
  // Linear interpolation over [[ratingStep, value], ...]; step b covers rating b*200 .. b*200+199.
  _expected(table, rating) {
    const x = Math.min(15, rating / 200 - 0.5);
    if (x <= table[0][0]) return table[0][1];
    if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
    for (let i = 1; i < table.length; i++) {
      if (x <= table[i][0]) { const t = (x - table[i - 1][0]) / (table[i][0] - table[i - 1][0]); return table[i - 1][1] + (table[i][1] - table[i - 1][1]) * t; }
    }
    return table[table.length - 1][1];
  }

  // Account age, best-game accuracy, results vs opponents and current rating for one format.
  _extraSignals(fmt, recentGames, username, joined) {
    const userL = username.toLowerCase();
    let newest = 0;
    for (const g of recentGames) if ((g.end_time || 0) > newest) newest = g.end_time;
    const ageDays = joined ? Math.round(((newest || Date.now() / 1000) - joined) / 86400) : null;

    const mine = recentGames.filter(g => g.time_class === fmt && g.rated !== false && (!g.rules || g.rules === 'chess'))
      .sort((a, b) => (a.end_time || 0) - (b.end_time || 0));                // oldest first
    let sumS = 0, sumE = 0, sumVar = 0, prev = null, last = null, accN = 0, accMax = null;
    for (const g of mine) {
      const isW = (g.white?.username || '').toLowerCase() === userL;
      if (!isW && (g.black?.username || '').toLowerCase() !== userL) continue;
      const me = isW ? g.white : g.black, opp = isW ? g.black : g.white;
      if (!me || !opp) continue;
      const S = me.result === 'win' ? 1 : V11_DRAWS.includes(me.result) ? 0.5 : 0;
      const pre = prev ?? me.rating;
      const E = 1 / (1 + 10 ** ((opp.rating - pre) / 400));
      sumS += S; sumE += E; sumVar += E * (1 - E);
      prev = me.rating; last = me.rating;
      const acc = g.accuracies ? (isW ? g.accuracies.white : g.accuracies.black) : null;
      if (acc !== null && acc !== undefined) { accN++; if (accMax === null || acc > accMax) accMax = acc; }
    }
    return {
      ageDays,
      accMax: accN >= 3 ? accMax : null,
      z: sumVar > 0 ? (sumS - sumE) / Math.sqrt(sumVar) : null,
      rating: last,
    };
  }

  _logit11(inputs) {
    let z = V11_MODEL.intercept;
    const parts = {};
    for (const f of V11_MODEL.features) {
      const v = inputs[f.name] ?? f.median;                       // missing = typical
      parts[f.name] = f.weight * (v - f.mean) / f.sd;
      z += parts[f.name];
    }
    return { z, parts };
  }

  _toScore11(z) {
    const A = V11_MODEL.anchors;
    if (z <= A[0][0]) return A[0][1];
    for (let i = 1; i < A.length; i++) {
      if (z <= A[i][0]) return A[i - 1][1] + (A[i][1] - A[i - 1][1]) * (z - A[i - 1][0]) / (A[i][0] - A[i - 1][0]);
    }
    return 100;
  }

  calculate(data, preferredFormat, platform = 'chesscom') {
    if (platform !== 'chesscom' || !V11_MODEL) return super.calculate(data, preferredFormat, platform);   // Lichess: v9 unchanged

    // No title discount on Chess.com: score the account as if it had no title.
    const title = data.profile?.title || null;
    const plain = data.profile ? { ...data, profile: { ...data.profile, title: null } } : data;
    const result = super.calculate(plain, preferredFormat, platform);
    const fmt = result.scoredFormat;
    const s = { ...(result.breakdown.v10?.signals || this._signals(fmt, data.stats, data.recentGames, data.username, data.statsLoaded !== false)) };
    const x = this._extraSignals(fmt, data.recentGames || [], String(data.username || ''), data.profile?.joined || null);
    const rating = x.rating || this._getFormatRating(data.stats, fmt) || 0;
    Object.assign(s, { ageDays: x.ageDays, accMax: x.accMax, z: x.z, rating });

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const inputs = {
      v9Evidence: Math.log10(1 + Math.max(0, this._rawByFormat[fmt] ?? 0)),
      lifetimeGames: s.lifetimeGames === null ? null : Math.log10(s.lifetimeGames + 1),
      acc90Share: s.acc90Share === null ? null : s.acc90Share - this._expected(V11_MODEL.expected.acc90Share, rating),
      accMax: s.accMax === null ? null : s.accMax - this._expected(V11_MODEL.expected.accMax, rating),
      clockLeft: s.clockLeft,
      shortGameShare: s.shortGameShare,
      logAge: s.ageDays === null ? null : Math.log10(Math.max(1, s.ageDays) + 1),
      z: s.z === null ? null : clamp(s.z, -3, 8),
    };
    const { z, parts } = this._logit11(inputs);
    const score11 = this._toScore11(z);
    let score = Math.min(100, Math.max(0, Math.round(score11)));

    // Long-time accounts: the v12 model (riskModelV12.js) takes over between 60 and 120 days, so a score never jumps on one day.
    let v12 = null;
    if (typeof crsV12Assess === 'function' && s.ageDays !== null && s.ageDays >= 60) {
      try { v12 = crsV12Assess(this, data.username, data.profile, data.stats, data.recentGames || [], fmt); } catch (e) { v12 = null; }
      if (v12) {
        v12.blend = Math.min(1, (s.ageDays - 60) / 60);
        score = Math.min(100, Math.max(0, Math.round((1 - v12.blend) * score11 + v12.blend * v12.score)));
      }
    }

    const levels = this.cfg.RISK_LEVELS;
    let level = levels.DANGER;
    for (const lvl of Object.values(levels)) { if (score < lvl.max) { level = lvl; break; } }

    return {
      ...result, score, level,
      breakdown: { ...result.breakdown, title, dampener: 1, v11: true, v12, v11Score: Math.round(score11),
        v10: { ...(result.breakdown.v10 || {}), signals: s, contributions: parts, expected: { acc90Share: this._expected(V11_MODEL.expected.acc90Share, rating), accMax: this._expected(V11_MODEL.expected.accMax, rating) } } },
    };
  }
}
