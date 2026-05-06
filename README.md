# OMNI—SUPREME V1.0

## The Ultimate 8-Core AI Trading Analyzer

### Features
- ✅ **Council of 8 Strategies**: SMC, ICT, VSA, Price Action, Wyckoff, Fibonacci, Mean Reversion, Elliott Wave
- ✅ **No manual chart uploads** - Auto-fetches live data from Yahoo Finance
- ✅ **Scalping & Day Trading modes** with different RR requirements
- ✅ **XM Broker calibration** for accurate lot sizing
- ✅ **DXY Filter** prevents Dollar Traps
- ✅ **RR Guard**: Minimum 1:1.5 (scalp) / 1:4 (day) up to 1:10 max
- ✅ **POI Protocol** for WAIT scenarios
- ✅ **Gemini 2.5 Flash and 2.5 Flash Lite integration** for enhanced analysis

### Setup

1. Get a free Gemini API key from [aistudio.google.com](https://aistudio.google.com)
2. Open `index.html` in your browser
3. Click settings ⚙️ and enter your API key
4. Set your balance and risk %
5. Enter a symbol (XAUUSD, EURUSD, BTCUSD, etc.)
6. Select SCALPING or DAY TRADING mode
7. Click EXECUTE SURGICAL SCAN

### How It Works

1. **Market Data** is fetched live from Yahoo Finance (no manual screenshots)
2. **8 Strategies** evaluate the data simultaneously
3. **Consensus algorithm** finds highest conviction setup
4. **Risk Manager** calculates Entry/SL/TP/Lot with XM calibration
5. **Gemini** provides final surgical logic (10-15 words)
6. **You execute** the trade on XM

### Files Structure
- `index.html` - Main dashboard
- `market-data.js` - Yahoo Finance fetcher
- `strategy-engine.js` - 8-core strategy aggregator
- `risk-manager.js` - XM risk calculations
- `app.js` - Main controller

### Disclaimer
For educational purposes only. Not financial advice. Past performance does not guarantee future results.
