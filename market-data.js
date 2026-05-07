// market-data.js – Reads static JSON, maintains full price history
const MarketData = {
    BASE_URL: 'https://riyazsapkota31-bit.github.io/market-data-api/data/',

    assetMap: {
        'XAUUSD': { file: 'xauusd', digits: 2, multiplier: 100, name: 'Gold' },
        'XAGUSD': { file: 'xagusd', digits: 3, multiplier: 100, name: 'Silver' },
        'OILCash': { file: 'wtiusd', digits: 2, multiplier: 100, name: 'WTI Oil' },
        'EURUSD': { file: 'eurusd', digits: 5, multiplier: 10000, name: 'EUR/USD' },
        'GBPUSD': { file: 'gbpusd', digits: 5, multiplier: 10000, name: 'GBP/USD' },
        'BTCUSD': { file: 'btcusd', digits: 2, multiplier: 10, name: 'Bitcoin' },
        'ETHUSD': { file: 'ethusd', digits: 2, multiplier: 10, name: 'Ethereum' }
    },

    history: {},

    loadHistory(symbol) {
        const key = `hist_${symbol}`;
        const stored = localStorage.getItem(key);
        this.history[symbol] = stored ? JSON.parse(stored) : [];
    },

    saveHistory(symbol) {
        const key = `hist_${symbol}`;
        const toStore = this.history[symbol].slice(-100);
        localStorage.setItem(key, JSON.stringify(toStore));
    },

    addPrice(symbol, price, timestamp) {
        if (!this.history[symbol]) this.loadHistory(symbol);
        this.history[symbol].push({ price, timestamp });
        if (this.history[symbol].length > 100) this.history[symbol].shift();
        this.saveHistory(symbol);
    },

    getPrices(symbol) {
        if (!this.history[symbol]) this.loadHistory(symbol);
        return this.history[symbol].map(p => p.price);
    },

    calcRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length - 1; i++) {
            const diff = prices[i + 1] - prices[i];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },

    calcEMA(prices, period) {
        if (prices.length < period) return prices[prices.length - 1];
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    },

    async fetch(symbol) {
        const cfg = this.assetMap[symbol];
        if (!cfg) return null;

        try {
            const url = this.BASE_URL + cfg.file + '.json';
            const response = await fetch(url + '?t=' + Date.now());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();

            if (json.error) {
                console.warn(`Data error for ${symbol}: ${json.error}`);
                return null;
            }

            const currentPrice = json.price;
            const timestamp = json.timestamp;

            this.addPrice(symbol, currentPrice, timestamp);
            const prices = this.getPrices(symbol);
            const hasHistory = prices.length >= 50;

            let rsi = 50, ema20 = currentPrice, ema50 = currentPrice, ema200 = currentPrice;
            let support = currentPrice * 0.998, resistance = currentPrice * 1.002;
            let trend = 'SIDEWAYS';
            let atr = currentPrice * 0.001;
            let volatility = 0.3;
            let volumeSpike = false;

            if (hasHistory) {
                rsi = this.calcRSI(prices);
                ema20 = this.calcEMA(prices, 20);
                ema50 = this.calcEMA(prices, 50);
                ema200 = this.calcEMA(prices, 200);
                support = Math.min(...prices.slice(-50)) * 0.998;
                resistance = Math.max(...prices.slice(-50)) * 1.002;
                if (ema20 > ema50 && ema50 > ema200) trend = 'BULLISH';
                else if (ema20 < ema50 && ema50 < ema200) trend = 'BEARISH';
                const recent = prices.slice(-14);
                atr = (Math.max(...recent) - Math.min(...recent)) / 14;
                volatility = (atr / currentPrice) * 100;
            }

            return {
                currentPrice,
                prevClose: prices.length >= 2 ? prices[prices.length - 2] : currentPrice,
                dailyChange: json.change || 0,
                high24h: json.high || currentPrice * 1.005,
                low24h: json.low || currentPrice * 0.995,
                volumeSpike,
                rsi,
                atr,
                ema20,
                ema50,
                ema200,
                support,
                resistance,
                trend,
                volatility,
                symbol,
                digits: cfg.digits,
                multiplier: cfg.multiplier,
                spread: { 'XAUUSD': 0.20, 'XAGUSD': 0.03, 'OILCash': 0.03, 'EURUSD': 0.0001, 'GBPUSD': 0.0001, 'BTCUSD': 0.50, 'ETHUSD': 0.50 }[symbol],
                class: symbol.includes('USD') ? (symbol === 'XAUUSD' || symbol === 'XAGUSD' || symbol === 'OILCash' ? 'commodities' : (symbol === 'BTCUSD' || symbol === 'ETHUSD' ? 'crypto' : 'forex')) : 'forex',
                _source: 'Static API'
            };
        } catch (err) {
            console.error(`Fetch error for ${symbol}:`, err);
            return null;
        }
    },

    async fetchPriceForTracking(symbol) {
        const data = await this.fetch(symbol);
        return data ? data.currentPrice : null;
    },

    async fetchDXY() {
        try {
            const url = this.BASE_URL + 'dxy.json';
            const res = await fetch(url + '?t=' + Date.now());
            const data = await res.json();
            
            if (data.error || !data.price) return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
            
            // PROXY LOGIC: Compare current USDJPY price to daily open
            let trend = 'NEUTRAL', strength = 'NEUTRAL';
            const diff = ((data.price - data.open) / data.open) * 100;
            
            if (diff > 0.05) { trend = 'BULLISH 🟢'; strength = 'STRONG'; }
            else if (diff < -0.05) { trend = 'BEARISH 🔴'; strength = 'WEAK'; }
            
            return { dxyPrice: data.price, dxyTrend: trend, dxyStrength: strength, dxyRawDiff: diff };
        } catch (e) {
            return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
        }
    }
};
