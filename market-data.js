/**
 * MARKET DATA FETCHER – Twelve Data REST API (uses your API key from settings)
 * No WebSocket, no CORS issues (Twelve Data supports CORS).
 * Works for: XAUUSD, XAGUSD, OILCash, EURUSD, GBPUSD, BTCUSD, ETHUSD
 */

const MarketData = {
    getApiKey() {
        return localStorage.getItem('twelve_data_key');
    },

    assetInfo: {
        'XAUUSD': { class: 'commodities', spread: 0.20, multiplier: 100, name: 'Gold', digits: 2 },
        'XAGUSD': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'Silver', digits: 3 },
        'OILCash': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'WTI Oil', digits: 2 },
        'EURUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'EUR/USD', digits: 5 },
        'GBPUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'GBP/USD', digits: 5 },
        'BTCUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Bitcoin', digits: 0 },
        'ETHUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Ethereum', digits: 0 }
    },

    showError(msg) {
        let errDiv = document.getElementById('dataError');
        if (!errDiv) {
            errDiv = document.createElement('div');
            errDiv.id = 'dataError';
            errDiv.style.cssText = 'position:fixed; bottom:10px; left:10px; right:10px; background:#ef4444; color:white; padding:10px; border-radius:12px; font-size:12px; z-index:9999; text-align:center;';
            document.body.appendChild(errDiv);
        }
        errDiv.innerHTML = msg;
        errDiv.style.display = 'block';
        setTimeout(() => { if(errDiv) errDiv.style.display = 'none'; }, 8000);
    },

    async fetchFromTwelveData(symbol, apiKey) {
        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&outputsize=100&apikey=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.code === 401 || data.message === 'Invalid API key') {
            throw new Error('Invalid API key');
        }
        if (!data.values || data.values.length === 0) throw new Error('No data');
        const vals = data.values;
        const closes = vals.map(v => parseFloat(v.close));
        const highs = vals.map(v => parseFloat(v.high));
        const lows = vals.map(v => parseFloat(v.low));
        const current = parseFloat(vals[0].close);
        return {
            currentPrice: current,
            prevClose: parseFloat(vals[1]?.close || current),
            dailyChange: ((current - parseFloat(vals[23]?.close || current)) / current) * 100,
            high24h: Math.max(...highs.slice(0,24)),
            low24h: Math.min(...lows.slice(0,24)),
            volumeSpike: false,
            rsi: this.calcRSI(closes, 14),
            atr: this.calcATR(highs, lows, closes, 14),
            ema20: this.calcEMA(closes, 20),
            ema50: this.calcEMA(closes, 50),
            ema200: this.calcEMA(closes, 200),
            support: Math.min(...lows.slice(0,50)),
            resistance: Math.max(...highs.slice(0,50)),
            trend: this.determineTrend(closes),
            volatility: (this.calcATR(highs, lows, closes, 14) / current) * 100,
            _source: 'Twelve Data (REST)'
        };
    },

    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        const apiKey = this.getApiKey();
        if (!apiKey) {
            this.showError('⚠️ Twelve Data API key missing. Please enter your key in Settings.');
            return null;
        }

        try {
            const data = await this.fetchFromTwelveData(xmSymbol, apiKey);
            return { ...data, ...info };
        } catch (err) {
            console.error(err);
            this.showError(`Twelve Data error: ${err.message}. Check your API key.`);
            return null;
        }
    },

    async fetchPriceForTracking(symbol) {
        const data = await this.fetch(symbol);
        return data ? data.currentPrice : null;
    },

    async fetchDXY() {
        return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
    },

    // Technical indicators (same as before)
    calcRSI(prices, period) {
        if (prices.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length - 1; i++) {
            const diff = prices[i+1] - prices[i];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },

    calcATR(highs, lows, closes, period) {
        if (highs.length < period) return (highs[highs.length-1] - lows[highs.length-1]) / 2;
        let trs = [];
        for (let i = highs.length - period; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i-1]);
            const lc = Math.abs(lows[i] - closes[i-1]);
            trs.push(Math.max(hl, hc, lc));
        }
        return trs.reduce((a,b) => a + b, 0) / period;
    },

    calcEMA(prices, period) {
        if (prices.length < period) return prices[prices.length-1];
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a,b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
        return ema;
    },

    determineTrend(prices) {
        const ema20 = this.calcEMA(prices, 20);
        const ema50 = this.calcEMA(prices, 50);
        if (ema20 > ema50) return 'BULLISH';
        if (ema20 < ema50) return 'BEARISH';
        return 'SIDEWAYS';
    }
};
