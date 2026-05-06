# OMNI—SUPREME | XM Trading Signal Analyzer

Version 3.0 | Alpha Vantage Powered | Multi-API Backup | Auto-Tracking & Learning System

A professional-grade trading signal analyzer specifically designed for XM Broker that generates BUY/SELL/WAIT signals using live market data with multi-API fallback (Alpha Vantage → Twelve Data → Binance → Yahoo). Features automatic price tracking, trade feedback learning, and strategy performance analytics.

---

## Features

**Core Trading Features:**
- Live Market Data: Real-time prices via Alpha Vantage + multi-API backup
- BUY/SELL/WAIT Signals: Clear, actionable trading signals
- Entry/SL/TP Levels: Automatically calculated based on market structure
- XM Lot Sizing: Position size calculated from your balance and risk %
- Scalping & Day Trading Modes: Different RR targets for each strategy
- Point of Interest (POI): Tells you where to re-enter on WAIT signals
- Multi-API Fallback: Alpha Vantage → Twelve Data → Binance → Yahoo

**Auto Price Tracking:**
- Automatic Monitoring: Checks price every 30 seconds
- TP/SL Detection: Auto-detects when trades hit targets
- Real-time Updates: Open trades update automatically
- Smart Alerts: Toast notifications for trade closures

**Trade Feedback & Learning:**
- 4 Outcome Types: WIN, PARTIAL, REVERSAL, LOSS
- Strategy Weighting: Winning strategies get higher confidence
- Win Rate Tracking: See your actual performance over time
- Performance Analytics: Which strategies work best on which pairs

**User Interface:**
- Dark/Light Theme: Toggle between themes
- Responsive Design: Works on desktop and mobile
- Clean Dashboard: Focus on what matters - the signal
- Toast Notifications: Real-time feedback alerts

---

## How It Works

SIGNAL GENERATION FLOW:

1. FETCH LIVE MARKET DATA
   - Alpha Vantage (Primary - You have this key)
   - Twelve Data (Backup 1 - Demo key works)
   - Binance (Backup 2 - Crypto only, real-time)
   - Yahoo Finance (Backup 3 - Last resort, 15 min delay)

2. CALCULATE INDICATORS
   - RSI, EMAs, Support/Resistance, ATR

3. APPLY STRATEGY ENGINE
   - 5 High-probability signals + market filters

4. GENERATE SIGNAL
   - BUY / SELL / WAIT with confidence score

5. CALCULATE TRADE LEVELS
   - Entry, Stop Loss, Take Profit (XM-calibrated)

6. TRADE EXECUTION
   - You execute manually on XM platform

7. FEEDBACK & LEARNING
   - Record outcome → App learns → Better signals

---

## Signal Outcomes

When your trade closes, you can record one of four outcomes:

- WIN (✅): TP hit directly → +5% weight to strategy
- PARTIAL (⚡): TP touched then reversed to SL → -1% weight to strategy
- REVERSAL (🔄): Moved toward TP but reversed to SL → -3% weight to strategy
- LOSS (❌): SL hit directly → -3% weight to strategy

Why this matters: The app tracks which strategies work best for YOU and adjusts future signal confidence accordingly.

---

## Installation

Option 1: Deploy to GitHub Pages (Recommended)

1. Fork or download this repository
2. Go to GitHub.com → New Repository
3. Upload all files (index.html, app.js, feedback.js, market-data.js, strategy-engine.js, risk-manager.js)
4. Settings → Pages → Set branch to "main"
5. Your app is live at: https://YOUR_USERNAME.github.io/REPO_NAME/

Option 2: Run Locally

1. Download all files to a folder
2. Open index.html in your browser
3. No server required - works completely offline (except market data)

---

## Setup Guide

Step 1: Get Your API Keys

To get Alpha Vantage Key:
1. Go to alphavantage.co/support/#api-key
2. Enter your name and email
3. Select "Student" or "Investor"
4. Click "GET FREE API KEY"
5. Check your email (arrives instantly)
6. Copy the key

To get Gemini Key:
1. Go to aistudio.google.com
2. Sign in with Google account
3. Click "Get API Key"
4. Copy the key

Step 2: Configure the App

1. Open the app in your browser
2. Click the Settings icon (top right)
3. Enter your Gemini API Key (required)
4. Enter your Alpha Vantage API Key (recommended)
5. Set your XM Balance (e.g., 10000)
6. Set your Risk % (recommended: 0.5-1.5%)
7. Choose Trading Mode (Scalping or Day Trading)
8. Toggle Auto Price Tracking (ON by default)
9. Click SAVE & SECURE

Step 3: Start Trading

1. Select a symbol from the dropdown (XAUUSD, EURUSD, GBPUSD, BTCUSD, ETHUSD)
2. Click GO to analyze
3. Wait 2-5 seconds for analysis
4. If signal is BUY/SELL, execute the trade on XM
5. The trade appears in "OPEN TRADES" section
6. When trade closes, click the appropriate outcome button
7. App learns and improves future signals

---

## File Structure

omni-supreme/
├── index.html          # Main dashboard (UI + structure)
├── app.js              # Core application logic + auto tracking
├── feedback.js         # Trade feedback & learning system
├── market-data.js      # Market data fetching (Multi-API fallback)
├── strategy-engine.js  # Signal generation logic (15 strategies)
├── risk-manager.js     # XM position sizing & risk
└── README.md           # This file

---

## Usage Guide

Getting a Signal:

1. Select your symbol (e.g., XAUUSD for Gold)
2. Click GO
3. Wait 2-5 seconds for analysis
4. Read the signal:
   - BUY (green) → Consider long position
   - SELL (red) → Consider short position
   - WAIT (yellow) → No trade, check POI

Understanding the Display:

- Current Price: Live price from Alpha Vantage (or fallback)
- TRADE SIGNAL: BUY, SELL, or WAIT (big letters)
- Confidence: 0-100% signal strength
- Entry/SL/TP: Your trade levels (XM-calibrated)
- Lot Size: Recommended position size
- RR: Risk-to-Reward ratio
- Signal Logic: Why the signal was generated
- Data Source: Which API provided the data

Recording Feedback (Critical for Learning):

1. After executing a trade, it appears in OPEN TRADES
2. When the trade closes on XM, click the matching outcome:
   - WIN → TP hit directly
   - PARTIAL → TP touched then SL
   - REVERSAL → Toward TP but reversed to SL
   - LOSS → SL hit directly
3. The app records this and adjusts future signals

Auto Price Tracking:

When enabled (default ON):
- App checks price every 30 seconds using multi-API fallback
- Automatically detects TP/SL hits
- Closes trades and records outcomes automatically
- Sends toast notifications for closures

---

## API Keys Required

- Gemini API: Required. Free tier: 1,500 requests/day. Purpose: Signal explanations
- Alpha Vantage: Recommended. Free tier: 5 req/min, 500/day. Purpose: Primary live market data
- Twelve Data: No key needed (built-in fallback). Demo key works. Purpose: Backup data source
- Yahoo Finance: No key needed (built-in fallback). Unlimited. Purpose: Last resort data source

---

## Multi-API Fallback System

Your app never shows "Failed to fetch" because it tries 4 different data sources in order:

Priority 1: Alpha Vantage (1-2 minutes delay) - Primary (if you have key)
Priority 2: Twelve Data (1-2 minutes delay) - Backup (demo key works)
Priority 3: Binance (Real-time) - Crypto only fallback
Priority 4: Yahoo Finance (15 minutes delay) - Last resort

If ALL APIs fail, the app shows WAIT with a POI level instead of fake data.

---

## Technical Specifications

Supported Symbols:
- Commodities: XAUUSD (Gold)
- Forex: EURUSD, GBPUSD
- Crypto: BTCUSD, ETHUSD

More symbols can be added by modifying the dropdown in index.html

Trading Modes:
- Scalping: Risk:Reward 1:1.5 to 1:4 | Best for fast moves, lower timeframes | Min confidence 65%
- Day Trading: Risk:Reward 1:2 to 1:5 | Best for trend following, 1H-4H charts | Min confidence 70%

Default Strategy Parameters:
- RSI: Period 14, Signal Buy < 30, Sell > 70
- EMA: Period 20/50, Signal Crossover confirmation
- ATR: Period 14, Signal Stop loss distance
- Support/Resistance: 50 bars, Signal Key levels

---

## Troubleshooting

Issue: "Alpha Vantage API key missing"
Solution: Enter your key in Settings → Alpha Vantage API Key

Issue: "Invalid API key"
Solution: Your Alpha Vantage key is incorrect. Get a new one from alphavantage.co

Issue: "Rate limit exceeded"
Solution: Alpha Vantage allows 5 requests per minute. Wait a few seconds and retry.

Issue: "All APIs failed"
Solution: Check your internet connection. The app tried 4 different data sources.

Issue: No signal appears
Solution: Try a different symbol. Some pairs have lower liquidity.

Issue: Auto-tracking not working
Solution: Check that Auto Tracking is ON in settings. Ensure trade is still OPEN.

Issue: Gemini explanation missing
Solution: Check your Gemini API key. App still works without it.

---

## Disclaimer

IMPORTANT: This software is for educational purposes only.

- Past performance does not guarantee future results
- Trading forex, commodities, and cryptocurrencies carries substantial risk
- Never trade with money you cannot afford to lose
- Test any strategy on a demo account before using real funds
- The developers assume no responsibility for financial losses

By using this software, you agree that:
1. You are solely responsible for your trading decisions
2. This is not financial advice
3. You have tested the system on a demo account first
4. Multi-API fallback improves reliability but does not guarantee accuracy

---

## Version History

Version 3.0 (2025): Auto price tracking, trade feedback learning, strategy weights, multi-API fallback system
Version 2.0 (2025): 15 strategies, POI protocol, risk management
Version 1.0 (2025): Initial release with basic signals

---

## Credits

- Alpha Vantage for live market data API
- Gemini API for AI signal explanations
- Twelve Data for backup data source
- Binance for crypto real-time data
- Yahoo Finance as final fallback
- TailwindCSS for UI framework

---

## Support

For issues or feature requests:
1. Check the Troubleshooting section above
2. Open an issue on GitHub
3. Ensure you have the latest version
4. Verify your API keys are correct

---

## Quick Reference

Minimum setup (30 seconds):
1. Get Gemini API key from aistudio.google.com
2. Open app → Settings → Paste key → Save
3. Select symbol → Click GO

Recommended setup (2 minutes):
1. Get Gemini API key
2. Get Alpha Vantage key from alphavantage.co
3. Open app → Settings → Paste both keys → Save
4. Set balance and risk % → Click GO

---

Built for XM Broker traders who want disciplined, data-driven signals without the noise.

Your Alpha Vantage key is already set up. Multi-API fallback ensures reliability. You're ready to trade!

Last Updated: 2025 | Version 3.0
