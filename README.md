# OMNI—SIGNAL – XM Trading Signal Analyzer

**Hybrid Ultimate Version** – No CORS, no rate limits, self‑hosted data pipeline.

## Features

- Real‑time data via Twelve Data batch + Alpha Vantage fallback (updated every 5 minutes)
- High win‑rate strategy engine (5 signals + market filters + DXY)
- Scalping and Day Trading modes with configurable RR (1:1.5–1:4 / 1:4–1:12)
- Partial profit taking (TP1 at 1:1, TP2 at full target)
- XM‑calibrated lot sizing, spreads, multipliers
- Auto price tracking (checks open trades every 30s, no extra API calls)
- Trade feedback learning (WIN / PARTIAL / REVERSAL / LOSS) – improves strategy weights
- Dark/light theme, responsive dashboard, toast notifications

## Setup

### Prerequisites

- A **Gemini API key** (free from aistudio.google.com) – for signal explanations and final check.
- The **market-data-api** repository (see separate README) must be deployed and serving JSON files.

### Steps

1. Clone this repository and upload all files to a new GitHub repository.
2. In `market-data.js`, replace `BASE_URL` with your actual data API URL (your username).
3. Enable GitHub Pages (Settings → Pages → branch `main`).
4. Open the live URL.
5. Click the ⚙️ Settings icon and enter your Gemini API key, balance, risk %, and mode.
6. Select a symbol and click **GO**. After ~50 price points (a few hours of intermittent use), signals will appear.

## File Structure

- `index.html` – main dashboard
- `app.js` – application logic
- `market-data.js` – fetches static JSON, maintains price history
- `strategy-engine.js` – 5‑signal strategy with filters
- `risk-manager.js` – XM lot sizing, partial profits, POI
- `feedback.js` – trade learning system

## Disclaimer

Educational only. Trading involves risk. You execute trades manually on XM.
