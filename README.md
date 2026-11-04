# ♟ Chess Risk Score

**Opponent risk overlay for Chess.com & Lichess, plus stats for any player.**

A browser extension that detects your opponent and shows a 0–100 risk score with the numbers behind it, all from public data and calculated in your browser.

![Version](https://img.shields.io/badge/version-1.8.0-blue) ![Platforms](https://img.shields.io/badge/platform-Chrome%20%7C%20Brave%20%7C%20Edge%20%7C%20Firefox-green) ![License](https://img.shields.io/badge/license-MIT%20%2B%20GPL--3.0%20engine-brightgreen)

---

## Features

- **Works on Chess.com and Lichess:** detects the opponent when a game starts or when you watch one
- **Risk score (0–100):** with a plain label and the full calculation in the overlay
- **Per-format table:** wins, losses, draws, win rate, accuracy, current and peak rating
- **My stats (new in 1.8):** look up any Chess.com or Lichess player
  - **Insights:** what is and isn't holding you back, each compared with typical players at your rating
  - **Form:** recent results and rating
  - **Skills:** every game checked by Stockfish in your browser (opening, tactics, endgame, clock)
  - **Cheaters:** how many of your opponents had their accounts closed for fair play
- **Sound alerts:** Harp, Low bell or a Russian GM voice when a risky opponent loads (off by default)
- **Report button:** opens Chess.com's report window, or reports on Lichess in one click
- **Stats beside usernames,** zen modes, a draggable overlay, and Alt+C to trigger it by hand
- **Private:** no data collection, no tracking, no servers of ours

## How risk is calculated

- **Chess.com accounts older than 60 days:** a gradient-boosted model trained on public data from closed and normal accounts (bullet, blitz and rapid).
- **Newer Chess.com accounts and Lichess:** a rule-based score from win rates, accuracy, account age and rating.
- **Cut-offs are set per rating group,** so a strong player isn't flagged just for being strong. 25 marks the top 2% of normal long-time accounts, 50 the top 0.5%, and 75 the top 0.1%.

The popup's **Guide** page explains each part, and the overlay shows the full breakdown for every player.

## Risk levels

| Score | Level |
|-------|-------|
| 0–24 | Low |
| 25–49 | Moderate |
| 50–74 | High |
| 75–100 | Extreme |

## Installation

### From the stores
- Chrome Web Store: https://chromewebstore.google.com/detail/chess-risk-score/ookpbnahncodokhafpfgamlkfjdmfjjo
- Firefox Add-ons: search "Chess Risk Score"

### Manual installation (developer mode)
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome, Brave or Edge.
3. Turn on "Developer mode" (top right).
4. Click "Load unpacked" and pick the repository folder.
5. Open a game on Chess.com or Lichess.

## File structure

```
├── manifest.json            Extension manifest (MV3)
├── popup.html / popup.js    Settings, Guide, About
├── history-ui.js            My stats page
├── history-core.js          My stats: game scan and tallies
├── skills-core.js           Skills: turns engine output into per-game numbers
├── skills-host.html         Offscreen page that runs the engine (Chrome)
├── sounds/                  Russian GM voice clips (Piper TTS, CC0 voice)
├── vendor/stockfish/        Stockfish 19 Lite, unmodified (GPL-3.0)
└── src/
    ├── config.js, api.js, lichessApi.js          API clients
    ├── riskCalculator*.js, riskModelV12.js       Scoring
    ├── detector.js, lichessDetector.js           Opponent detection
    ├── overlay.js, overlay.css, overlayStyle.js  Overlay
    ├── insights.js                               Stats beside usernames
    ├── report.js, sound.js                       Report button, sound alerts
    ├── historyEngine.js, histBridge.js           My stats scan (background)
    ├── skillsEngine.js, skillsHost*.js, skillsBench.js   Engine runs and benchmarks
    ├── content.js                                Content script entry point
    └── background.js                             Service worker / background page
```

## Privacy

- **No data collection.** All analysis happens in your browser.
- **No tracking or analytics.**
- **Public APIs only:** Chess.com and Lichess, the same data any browser can see.
- **Open source:** audit every line yourself.

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the full policy.

## Disclaimer

The score is a **risk indicator, not proof of cheating**. Most accounts with a high score are honest players on a good run. Report suspected cheating through the official Chess.com or Lichess channels.

## Credits

Created by **az_93** · BTTW Media

## License

The extension's own code is [MIT](LICENSE).

It bundles **Stockfish 19 Lite** (from [Stockfish.js](https://github.com/nmrugg/stockfish.js), npm `stockfish` 19.0.1) unmodified in `vendor/stockfish/`. That is licensed under the **GNU GPL v3** ([vendor/stockfish/Copying.txt](vendor/stockfish/Copying.txt)), so the extension as distributed, with the engine, is covered by the GPL v3. Stockfish: https://github.com/official-stockfish/Stockfish
