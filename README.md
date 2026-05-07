# OMNI—SIGNAL | XM Trading Signal Analyzer

## Hybrid Ultimate Version

A professional-grade trading signal analyzer for XM Broker. It uses a **two‑repository architecture**:

- **Repository A (`market-data-api`)** – a GitHub Actions pipeline that fetches live prices from Twelve Data (batch) + Alpha Vantage (fallback) every 5 minutes and stores them as static JSON files.
- **Repository B (`omni-signal`)** – your main frontend app that reads those JSON files, calculates high‑win‑rate signals (RSI, EMAs, support/resistance), and displays BUY/SELL/WAIT with XM‑calibrated lot sizes, partial profits, auto tracking, and trade feedback learning.

**No CORS, no API keys in the frontend, no rate limits for your app.** Only the data pipeline uses API keys (kept as GitHub Secrets).

---

## 🔧 Features

- **Real‑time data** (≈5 min delay) via Twelve Data batch endpoint (1 credit for all 7 symbols)
- **Fallback to Alpha Vantage** if any symbol fails
- **5‑signal strategy engine** (RSI divergence, EMA pullback, S/R bounce, volume confirmation, FVG)
- **Market filters** (news, volatility, spread, choppy)
- **DXY filter** for USD pairs
- **Scalping & Day Trading modes** with different RR targets (1:1.5–1:4 / 1:4–1:12)
- **Partial profit taking** (TP1 at 1:1, TP2 at full target)
- **Auto price tracking** every 30 seconds (uses cached JSON – no extra API calls)
- **Trade feedback learning** (WIN / PARTIAL / REVERSAL / LOSS) – improves strategy weights
- **Dark/light theme**, responsive dashboard, toast notifications

---

## 📦 Setup (Two Repositories)

### Repository A: `market-data-api` (Data Pipeline)

1. Create a new GitHub repository.
2. Add `fetch-prices.js` and `.github/workflows/fetch.yml` (see the provided code).
3. Add two secrets:
   - `TWELVE_DATA_KEY` – your free Twelve Data API key
   - `ALPHA_VANTAGE_KEY` – your free Alpha Vantage API key (fallback)
4. Enable GitHub Pages (Settings → Pages → branch `main`, folder `/`).
5. After the first workflow run, your JSON files will be available at:  
   `https://<your-username>.github.io/market-data-api/data/xauusd.json`

### Repository B: `omni-signal` (Frontend App)

1. Copy all frontend files (`index.html`, `app.js`, `market-data.js`, `strategy-engine.js`, `risk-manager.js`, `feedback.js`) into a new repository.
2. In `market-data.js`, change the `BASE_URL` to your own GitHub Pages URL:
   `'https://<your-username>.github.io/market-data-api/data/'`
3. Enable GitHub Pages (branch `main`).
4. Open the live URL.

---

## 🚀 How to Use

1. **Open the app** (your GitHub Pages URL).
2. **Click the ⚙️ Settings icon** and enter:
   - Your **Gemini API key** (free from aistudio.google.com) – used for signal explanations and a final risk check.
   - Your **XM Balance** and **Risk %**.
   - Choose **Scalping** or **Day Trading** mode.
   - Enable **Auto Price Tracking** (recommended).
3. **Select a symbol** (Gold, Silver, Oil, Forex, Crypto) and click **GO**.
4. After enough price history (~50 points), the app will show **BUY/SELL signals** with entry, stop loss, and two take‑profit levels (TP1 = 1:1, TP2 = full target).
5. **Execute the trade manually on XM**. The trade will appear in the "OPEN TRADES" section.
6. When the trade closes, click the corresponding outcome button (WIN / PARTIAL / REVERSAL / LOSS). The app learns and adjusts future signals.

---

## 📊 Data Flow

```

External APIs (Twelve Data + Alpha Vantage)
│
│ (GitHub Actions every 5 min)
▼
Repository A (market-data-api) – writes JSON files
│
│ (GitHub Pages)
▼
Repository B (omni-signal) – reads JSON, calculates signals
│
│ (your browser)
▼
You – execute trade on XM, record feedback

```

---

## 🛠️ Troubleshooting

- **No data / WAIT forever** – Wait at least 30 minutes for the price history to accumulate (50 points). Auto‑tracking will build it automatically.
- **Oil price shows 3.82** – The symbol `WTI/USD` is correct; if it fails, check your Twelve Data key or fallback to Alpha Vantage (`WTICOUSD`).
- **`setAlphaKey is not a function`** – You are using an outdated frontend `market-data.js`. Replace it with the static‑JSON reader (provided).
- **Workflow fails in Repository A** – Check the GitHub Actions log; verify that `TWELVE_DATA_KEY` and `ALPHA_VANTAGE_KEY` secrets are correctly named and valid.

---

## 📁 File Structure (Repository B)

```

omni-signal/
├── index.html           # Main dashboard
├── app.js               # App logic (no direct API calls)
├── market-data.js       # Reads static JSON, maintains history, calculates indicators
├── strategy-engine.js   # 5‑signal high‑win‑rate strategy + filters
├── risk-manager.js      # XM lot sizing, partial profits, POI
├── feedback.js          # Trade learning system
└── README.md

```

---

## 🧠 Credits

- **Twelve Data** – batch quote endpoint (real‑time)
- **Alpha Vantage** – fallback for any missing symbol
- **Gemini** – signal explanations and final check
- **TailwindCSS** – UI framework

---

## ⚠️ Disclaimer

**Educational only.** Past performance does not guarantee future results. Trading involves substantial risk. Never trade with money you cannot afford to lose.

---
