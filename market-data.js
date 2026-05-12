// market-data.js – Reads OHLC candles from data API (13 assets)
const MarketData = {
    BASE_URL: 'https://riyazsapkota31-bit.github.io/market-data-api/data/',

    assetMap: {
        // Commodities
        'XAUUSD': { file: 'xauusd', digits: 2, multiplier: 100, spread: 0.040, name: 'Gold', class: 'commodities' },
        'XAGUSD': { file: 'xagusd', digits: 3, multiplier: 100, spread: 0.030, name: 'Silver', class: 'commodities' },
        'OILCash': { file: 'wtiusd', digits: 2, multiplier: 100, spread: 0.030, name: 'WTI Oil', class: 'commodities' },
        
        // Forex (6 pairs)
        'EURUSD': { file: 'eurusd', digits: 5, multiplier: 10000, spread: 0.00016, name: 'EUR/USD', class: 'forex' },
        'GBPUSD': { file: 'gbpusd', digits: 5, multiplier: 10000, spread: 0.00019, name: 'GBP/USD', class: 'forex' },
        'USDJPY': { file: 'usdjpy', digits: 3, multiplier: 100, spread: 0.03, name: 'USD/JPY', class: 'forex' },
        'USDCAD': { file: 'usdcad', digits: 5, multiplier: 10000, spread: 0.00015, name: 'USD/CAD', class: 'forex' },
        'USDCHF': { file: 'usdchf', digits: 5, multiplier: 10000, spread: 0.00015, name: 'USD/CHF', class: 'forex' },
        'USDSEK': { file: 'usdsek', digits: 5, multiplier: 10000, spread: 0.0003, name: 'USD/SEK', class: 'forex' },
        
        // Crypto
        'BTCUSD': { file: 'btcusd', digits: 0, multiplier: 10, spread: 75.00, name: 'Bitcoin', class: 'crypto' },
        'ETHUSD': { file: 'ethusd', digits: 0, multiplier: 10, spread: 6.00, name: 'Ethereum', class: 'crypto' },
        'SOLUSD': { file: 'solusd', digits: 2, multiplier: 10, spread: 0.50, name: 'Solana', class: 'crypto' }
    },

    history: {},
    candleCache: {},

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

    async fetch(symbol) {
        const cfg = this.assetMap[symbol];
        if (!cfg) return null;

        try {
            const url = this.BASE_URL + cfg.file + '.json';
            const response = await fetch(url + '?t=' + Date.now());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();

            if (json.error && !json.currentPrice) {
                console.warn(`Data error for ${symbol}: ${json.error}`);
                return null;
            }
            
            const currentPrice = json.currentPrice;
            const timestamp = json.timestamp;
            
            // Read OHLC candles
            let candles = json.candles || [];
            let prices = [];
            
            if (candles.length > 0) {
                prices = candles.map(c => c.close);
                this.candleCache[symbol] = candles;
            } else {
                // Fallback to old format
                let oldPrices = json.history;
                if (oldPrices && oldPrices.length >= 50) {
                    this.history[symbol] = oldPrices.map(p => ({ price: p, timestamp: json.timestamp }));
                    this.saveHistory(symbol);
                } else {
                    this.addPrice(symbol, currentPrice, timestamp);
                    oldPrices = this.getPrices(symbol);
                }
                prices = oldPrices;
            }

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
                prevClose: prices.length >= 2 ? prices[prices.length-2] : currentPrice,
                dailyChange: json.change || 0,
                high24h: json.high || currentPrice * 1.005,
                low24h: json.low || currentPrice * 0.995,
                volumeSpike,
                rsi, atr, ema20, ema50, ema200, support, resistance, trend, volatility,
                symbol, digits: cfg.digits, multiplier: cfg.multiplier, spread: cfg.spread, class: cfg.class,
                candles: candles,
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
            if (data.error) return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
            let trend = 'NEUTRAL', strength = 'NEUTRAL';
            if (data.change > 0.3) trend = 'STRONG';
            else if (data.change < -0.3) trend = 'WEAK';
            return { dxyPrice: data.currentPrice, dxyTrend: trend, dxyStrength: strength };
        } catch(e) {
            return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
        }
    }
};
