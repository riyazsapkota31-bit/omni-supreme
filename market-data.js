// market-data.js (for your main OMNI‑SIGNAL app)
const MarketData = {
    // === CHANGE THIS TO YOUR GITHUB USERNAME ===
    API_BASE: 'https://riyazsapkota31-bit.github.io/market-data-api/data/',

    assetMap: {
        'XAUUSD': 'gold',
        'XAGUSD': 'silver',
        'OILCash': 'oil',
        'EURUSD': 'eurusd',
        'GBPUSD': 'gbpusd',
        'BTCUSD': 'btcusd',
        'ETHUSD': 'ethusd'
    },

    // --- Price history management (localStorage) ---
    priceHistory: {},

    loadPriceHistory(symbol) {
        const key = `history_${symbol}`;
        const stored = localStorage.getItem(key);
        this.priceHistory[symbol] = stored ? JSON.parse(stored) : [];
    },

    savePriceHistory(symbol) {
        const key = `history_${symbol}`;
        const toStore = this.priceHistory[symbol].slice(-100);
        localStorage.setItem(key, JSON.stringify(toStore));
    },

    addPrice(symbol, price, timestamp) {
        if (!this.priceHistory[symbol]) this.loadPriceHistory(symbol);
        this.priceHistory[symbol].push({ price, timestamp });
        if (this.priceHistory[symbol].length > 100) this.priceHistory[symbol].shift();
        this.savePriceHistory(symbol);
    },

    getPrices(symbol) {
        if (!this.priceHistory[symbol]) this.loadPriceHistory(symbol);
        return this.priceHistory[symbol].map(p => p.price);
    },

    // --- Indicator calculations ---
    calcRSI(prices, period = 14) {
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

    calcEMA(prices, period) {
        if (prices.length < period) return prices[prices.length-1];
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a,b)=>a+b,0)/period;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    },

    // --- Main fetch ---
    async fetch(xmSymbol) {
        const file = this.assetMap[xmSymbol];
        if (!file) return null;

        try {
            const url = this.API_BASE + file + '.json';
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();

            const currentPrice = json.price;
            const timestamp = json.timestamp;

            // Add to history
            this.addPrice(xmSymbol, currentPrice, timestamp);
            const prices = this.getPrices(xmSymbol);
            const hasHistory = prices.length >= 50;

            // Default values (used when not enough history)
            let rsi = 50, ema20 = currentPrice, ema50 = currentPrice, ema200 = currentPrice;
            let support = currentPrice * 0.998, resistance = currentPrice * 1.002;
            let trend = 'SIDEWAYS';
            let atr = currentPrice * 0.001;
            let volatility = 0.3;

            if (hasHistory) {
                rsi = this.calcRSI(prices);
                ema20 = this.calcEMA(prices, 20);
                ema50 = this.calcEMA(prices, 50);
                ema200 = this.calcEMA(prices, 200);
                support = Math.min(...prices.slice(-50)) * 0.998;
                resistance = Math.max(...prices.slice(-50)) * 1.002;
                if (ema20 > ema50 && ema50 > ema200) trend = 'BULLISH';
                else if (ema20 < ema50 && ema50 < ema200) trend = 'BEARISH';
                // approximate ATR using daily range from history
                const recent = prices.slice(-14);
                atr = (Math.max(...recent) - Math.min(...recent)) / 14;
                volatility = (atr / currentPrice) * 100;
            }

            return {
                currentPrice,
                prevClose: prices.length >= 2 ? prices[prices.length-2] : currentPrice,
                dailyChange: 0,
                high24h: json.high || currentPrice * 1.005,
                low24h: json.low || currentPrice * 0.995,
                volumeSpike: false,
                rsi,
                atr,
                ema20,
                ema50,
                ema200,
                support,
                resistance,
                trend,
                volatility,
                symbol: xmSymbol,
                digits: this.assetMap.digits || (xmSymbol.includes('USD') ? 5 : 2),
                _source: 'Static Data API'
            };
        } catch (err) {
            console.error(`Fetch error for ${xmSymbol}:`, err);
            return null;
        }
    },

    async fetchPriceForTracking(symbol) {
        const data = await this.fetch(symbol);
        return data ? data.currentPrice : null;
    },

    async fetchDXY() {
        return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
    }
};
