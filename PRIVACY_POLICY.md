# Chess Risk Score — Privacy Policy

**Last updated:** November 4, 2026 (version 1.8.0)

## Overview

Chess Risk Score is a browser extension that analyses publicly available chess data to show opponent risk scores on Chess.com and Lichess, and stats for any player on its My stats page.

## Data collection

**Chess Risk Score does not collect or transmit any personal data to us or to any third party.**

- No analytics or telemetry
- No browsing history is tracked or recorded
- No cookies are set by the extension
- No accounts are created or required
- No data is sold or shared

## How the extension works

All analysis happens **locally in your browser**. The extension:

1. Reads public data from the Chess.com and Lichess APIs: player profiles, ratings and game histories that anyone can see.
2. Calculates risk scores and stats inside your browser. The My stats page also runs a chess engine (Stockfish) inside your browser to analyse games. Nothing is sent to an engine server.
3. Shows the results on the chess site you are using and in the extension's popup.

## What is stored on your device

The extension's local browser storage holds:

- your settings
- a short cache of recent results, so the overlay appears instantly on a rematch
- the results of your My stats searches: game summaries and engine results for the players you looked up

This never leaves your device. You can clear it from the My stats page or by removing the extension.

## Requests made with your own sign-in

- **Lichess:** while you are on lichess.org, Lichess API requests are sent with your existing Lichess sign-in (if you have one), because Lichess answers signed-in users faster. Nothing else is done with your account.
- **Report button:** only when you press it, the extension opens Chess.com's own report window, or on Lichess sends a cheat report through Lichess's report form from your account, with a link to the game. Nothing is reported without you pressing the button.

## Permissions

- **storage:** saves your settings, the cache and your My stats results locally
- **offscreen (Chrome only):** runs the chess engine for My stats so it keeps going when the popup closes
- **Host permissions (chess.com, api.chess.com, lichess.org):** to read the game page, show the overlay and fetch public data from these sites

## Third-party services

The extension only contacts:

- **Chess.com Public API** (api.chess.com)
- **Lichess** (lichess.org, including lichess.org/api, and lichess.org/report when you press Report)

## Changes to this policy

When this policy changes, the "Last updated" date above changes too.

## Contact

Questions about this policy: azec.1993@gmail.com

## Open source

Chess Risk Score is open source, so you can check these claims against the code.
