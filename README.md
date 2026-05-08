# OMNI—SIGNAL – XM Trading Signal Analyzer

## Hybrid Edition – Free Data Pipeline

This frontend app reads static JSON files from the `market-data-api` repository and generates BUY/SELL/WAIT signals using a 5‑signal high‑win‑rate strategy engine.

### Setup

1. Create a GitHub repository and upload all frontend files.
2. In `market-data.js`, change `BASE_URL` to your actual data API URL (your GitHub username).
3. Enable GitHub Pages (Settings → Pages → branch `main`).
4. Open the live URL.
5. Enter your Gemini API key (free from aistudio.google.com) in the settings.
6. Set your XM balance, risk %, trading mode, and enable auto tracking.
7. Click GO – after about 50 price points (auto tracking will build them), signals will appear.

### Files

- `index.html` – dashboard
- `app.js` – main application logic
- `market-data.js` – fetches JSON files, accumulates price history, calculates RSI/EMA
- `strategy-engine.js` – 5‑signal strategy engine
- `risk-manager.js` – XM lot sizing, partial profits, POI
- `feedback.js` – trade learning system

### Disclaimer

Educational only. You execute trades manually on XM.
