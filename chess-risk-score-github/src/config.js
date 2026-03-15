// ============================================================
// CONFIG v9 — Research-calibrated accuracy tables
// Chess.com: based on measured CAPS2 data by rating/format
// Lichess: ACPL conversion runs ~3-4% below CAPS2
// ============================================================

const CONFIG = {
  WINRATE: { WEIGHTING_K: 20 },

  ACCURACY: {
    WEIGHTING_K: 20,
    T1_LO: 10, T1_HI: 20, T2_LO: 20, T2_HI: 30, T3_LO: 30,
    ANOMALY_WEIGHT: 0.6, SPIKE_WEIGHT: 0.4,
  },

  // ── Chess.com CAPS2 accuracy (measured data) ────────────────
  // [maxRating, avgLo, avgHi, expected, flagThreshold]
  FORMAT_ACCURACY: {
    bullet: [
      [700,  65, 75, 70, 78],
      [1000, 73, 80, 76, 83],
      [1500, 77, 82, 79, 85],
      [2000, 80, 84, 82, 87],
      [2500, 83, 87, 85, 90],
      [3000, 86, 90, 88, 93],
      [Infinity, 87, 91, 89, 94],
    ],
    blitz: [
      [700,  65, 73, 69, 76],
      [1000, 73, 80, 76, 83],
      [1500, 78, 83, 80, 86],
      [2000, 81, 85, 83, 88],
      [2500, 84, 88, 86, 91],
      [3000, 86, 90, 88, 93],
      [Infinity, 87, 91, 89, 94],
    ],
    rapid: [
      [700,  65, 73, 69, 76],
      [1000, 72, 79, 75, 82],
      [1500, 78, 83, 80, 86],
      [2000, 82, 86, 84, 89],
      [2500, 86, 90, 88, 93],
      [3000, 88, 92, 90, 95],
      [Infinity, 90, 93, 92, 97],
    ],
  },

  // ── Lichess ACPL-converted accuracy (~3-4% below CAPS2) ─────
  LICHESS_FORMAT_ACCURACY: {
    bullet: [
      [1000, 55, 68, 62, 72],
      [1300, 65, 75, 70, 78],
      [1800, 72, 80, 76, 83],
      [2300, 76, 83, 80, 86],
      [2800, 79, 85, 82, 88],
      [Infinity, 84, 90, 87, 93],
    ],
    blitz: [
      [1000, 58, 70, 64, 74],
      [1300, 68, 77, 72, 80],
      [1800, 74, 82, 78, 85],
      [2300, 79, 85, 82, 88],
      [2800, 82, 88, 85, 91],
      [Infinity, 84, 90, 87, 93],
    ],
    rapid: [
      [1000, 60, 72, 66, 76],
      [1300, 70, 78, 74, 82],
      [1800, 76, 83, 80, 86],
      [2300, 80, 87, 84, 90],
      [2800, 84, 90, 87, 93],
      [Infinity, 86, 92, 89, 95],
    ],
  },

  ACCOUNT_AGE: {
    MAX_AGE_DAYS: 365,
    MULTIPLIERS: [
      [7,5.0],[14,4.0],[30,3.5],[60,2.5],[90,2.0],[180,1.5],[365,1.2],
    ],
  },

  WEIGHTS: { OVERALL_WINRATE: 0.35, RECENT_WINRATE: 0.30, ACC_RISK: 0.35 },

  RATING_ANOMALY: { MILD_EXCESS: 8, HIGH_EXCESS: 15, EXTREME_EXCESS: 22 },

  RISK_LEVELS: {
    LOW:    { max: 25,  label: 'LOW RISK',     color: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
    MEDIUM: { max: 50,  label: 'MODERATE RISK', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
    HIGH:   { max: 75,  label: 'HIGH RISK',     color: '#f97316', glow: 'rgba(249,115,22,0.4)' },
    DANGER: { max: 101, label: 'EXTREME RISK', color: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
  },

  MIN_GAMES_FOR_RATING: 3,
  MIN_GAMES_FOR_ACCURACY: 3,
  RECENT_MONTHS: 2,
  FORMATS: ['rapid', 'blitz', 'bullet'],
  LICHESS_FORMATS: ['rapid', 'blitz', 'bullet'],
  RATED_ONLY: true,

  DETECTION: {
    INITIAL_CHECK_DELAY: 200, POLL_INTERVAL: 600,
    MUTATION_DEBOUNCE: 250, URL_WATCH_INTERVAL: 300, URL_CHANGE_DELAY: 800,
  },
};
