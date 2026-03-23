# ♟ Chess Risk Score

**Instant opponent risk assessment for Chess.com & Lichess.**

A browser extension that automatically detects your opponent and calculates a composite risk score based on win rates, accuracy analysis, and account age — all from publicly available data.

![Chess Risk Score](https://img.shields.io/badge/version-1.0.0-blue) ![Chrome Web Store](https://img.shields.io/badge/platform-Chrome%20%7C%20Brave%20%7C%20Edge-green) ![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## Features

- **Works on Chess.com AND Lichess** — auto-detects which platform you're on
- **Auto-detects opponent** — triggers when a game starts or when spectating
- **Composite risk score (0–100)** — weighted blend of multiple signals
- **Format-specific analysis** — bullet, blitz, and rapid scored independently
- **Toggle between opponent & self** — check your own stats too
- **Draggable overlay** — position it wherever you like
- **Dark & light theme support** — matches the site theme
- **Keyboard shortcut** — Alt+C to manually trigger
- **100% private** — zero data collection, all analysis happens locally

## How Risk is Calculated

```
Risk = AgeFactor × (0.35 × OWR + 0.30 × RWR + 0.35 × ACC) × RatingDampener
```

| Component | Weight | Description |
|-----------|--------|-------------|
| **Overall Win Rate (OWR)** | 35% | All-time win percentage. Above 60% begins contributing to risk. |
| **Recent Win Rate (RWR)** | 30% | Last 2 months. Catches players who recently started using assistance. |
| **Accuracy Risk (ACC)** | 35% | Research-calibrated thresholds per rating band and time format. |
| **Age Factor** | Multiplier | New accounts get up to ×5 multiplier. Over 1 year = ×1. |
| **Rating Dampener** | Multiplier | High-rated players with many games get reduced risk scores. |

## Risk Levels

| Score | Level | Meaning |
|-------|-------|---------|
| 0–25 | 🟢 Low Risk | Normal player patterns |
| 26–50 | 🟡 Moderate Risk | Some elevated signals |
| 51–75 | 🟠 High Risk | Multiple concerning indicators |
| 76–100 | 🔴 Extreme Risk | Strongly unusual patterns |

## Installation

### From Chrome Web Store
(https://chromewebstore.google.com/detail/chess-risk-score/ookpbnahncodokhafpfgamlkfjdmfjjo?authuser=1&hl=en)

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open `chrome://extensions` in Chrome/Brave/Edge
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the repository folder
5. Navigate to Chess.com or Lichess and start a game

## Accuracy Calibration

Accuracy thresholds are based on measured CAPS2 data from thousands of games across rating bands:

| Rating | Bullet Expected | Blitz Expected | Rapid Expected |
|--------|----------------|----------------|----------------|
| <1000 | 76% | 76% | 75% |
| <1500 | 79% | 80% | 80% |
| <2000 | 82% | 83% | 84% |
| <2500 | 85% | 86% | 88% |
| 3000+ | 89% | 89% | 92% |

Lichess uses ACPL-to-accuracy conversion with thresholds ~3–4% lower than Chess.com CAPS2.

## File Structure

```
chess-risk-score/
├── manifest.json          # Extension manifest (v3)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic & settings
├── icons/                 # Extension icons (16/48/128px)
├── src/
│   ├── config.js          # Scoring constants & accuracy tables
│   ├── api.js             # Chess.com API client
│   ├── lichessApi.js      # Lichess API client (ACPL→accuracy)
│   ├── riskCalculator.js  # Core scoring engine
│   ├── detector.js        # Chess.com opponent detection
│   ├── lichessDetector.js # Lichess opponent detection
│   ├── overlay.js         # Game overlay UI
│   ├── overlay.css        # Overlay styles
│   ├── insights.js        # W/L/D badge injector
│   ├── content.js         # Content script entry point
│   └── background.js      # Service worker
├── PRIVACY_POLICY.md      # Privacy policy
└── README.md              # This file
```

## Privacy

- **No data collection** — all analysis happens locally in your browser
- **No tracking or analytics** — we don't know who uses the extension
- **Only public APIs** — same data available to any web browser
- **No authentication** — no accounts, no logins, no tokens
- **Open source** — audit every line of code yourself

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the full privacy policy.

## Disclaimer

This extension provides **risk indicators, not proof of cheating**. A high risk score suggests unusual patterns worth attention — players deserve the benefit of the doubt. Use this tool responsibly and in good faith. Report suspected cheaters through official Chess.com or Lichess channels.

## Credits

Created by **az_93** · BTTW Media

## License

[MIT](LICENSE)
