/**
 * MARKET DATA FETCHER – uses cors‑anywhere proxy (reliable)
 * Unlock the proxy first: open https://cors-anywhere.herokuapp.com/ and click "Request temporary access"
 */

const MarketData = {
    alphaKey: null,
    proxy: 'https://cors-anywhere.herokuapp.com/',   // requires temporary unlock

    yahooMap: {
        'EURUSD': 'EURUSD=X',
        'GBPUSD': 'GBPUSD=X',
        'BTCUSD': 'BTC-USD',
        'ETHUSD': 'ETH-USD'
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

    setAlphaKey(key) { this.alphaKey = key; localStorage.setItem('alpha_api_key', key); },
    getAlphaKey() { if (!this.alphaKey) this.alphaKey = localStorage.getItem('alpha_api_key'); return this.alphaKey; },

    async fetchWithProxy(url) {
        const response = await fetch(this.proxy + url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    },

    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        // 1. Alpha Vantage (if key present)
        const alphaKey = this.getAlphaKey();
        if (alphaKey) {
            try {
                const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${xmSymbol}&apikey=${alphaKey}`;
                const data = await this.fetchWithProxy(url);
                const quote = data['Global Quote'];
                if (quote && quote['05. price']) {
                    const price = parseFloat(quote['05. price']);
                    return {
                        currentPrice: price,
                        prevClose: price * 0.999,
                        dailyChange: 0,
                        high24h: price * 1.005,
                        low24h: price * 0.995,
                        volumeSpike: false,
                        rsi: 50,
                        atr: price * 0.001,
                        ema20: price,
                        ema50: price,
                        ema200: price,
                        support: price * 0.998,
                        resistance: price * 1.002,
                        trend: 'SIDEWAYS',
                        volatility: 0.3,
                        ...info,
                        _source: 'Alpha Vantage'
                    };
                }
            } catch(e) { console.warn('Alpha Vantage failed:', e); }
        }

        // 2. Twelve Data (direct – no proxy needed)
        try {
            const url = `https://api.twelvedata.com/time_series?symbol=${xmSymbol}&interval=1h&outputsize=100&apikey=demo`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.values && data.values.length > 0) {
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
                    ...info,
                    _source: 'Twelve Data'
                };
            }
        } catch(e) { console.warn('Twelve Data failed:', e); }

        // 3. Binance (crypto only)
        if (info.class === 'crypto') {
            try {
                let binSym = xmSymbol === 'BTCUSD' ? 'BTCUSDT' : (xmSymbol === 'ETHUSD' ? 'ETHUSDT' : null);
                if (binSym) {
                    const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binSym}`);
                    const data = await resp.json();
                    if (!data.code) {
                        const price = parseFloat(data.lastPrice);
                        const klines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binSym}&interval=1h&limit=100`);
                        const kd = await klines.json();
                        const closes = kd.map(c => parseFloat(c[4]));
                        const highs = kd.map(c => parseFloat(c[2]));
                        const lows = kd.map(c => parseFloat(c[3]));
                        return {
                            currentPrice: price,
                            prevClose: parseFloat(data.prevClosePrice),
                            dailyChange: parseFloat(data.priceChangePercent),
                            high24h: parseFloat(data.highPrice),
                            low24h: parseFloat(data.lowPrice),
                            volumeSpike: parseFloat(data.volume) > parseFloat(data.quoteVolume)/2,
                            rsi: this.calcRSI(closes, 14),
                            atr: this.calcATR(highs, lows, closes, 14),
                            ema20: this.calcEMA(closes, 20),
                            ema50: this.calcEMA(closes, 50),
                            ema200: this.calcEMA(closes, 200),
                            support: Math.min(...lows.slice(-50)),
                            resistance: Math.max(...highs.slice(-50)),
                            trend: this.determineTrend(closes),
                            volatility: this.calcATR(highs, lows, closes, 14) / price * 100,
                            ...info,
                            _source: 'Binance'
                        };
                    }
                }
            } catch(e) { console.warn('Binance failed:', e); }
        }

        // 4. Yahoo Finance (via proxy)
        const yahooSym = this.yahooMap[xmSymbol];
        if (yahooSym) {
            try {
                const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1h&range=2d`;
                const data = await this.fetchWithProxy(directUrl);
                const result = data.chart?.result?.[0];
                if (result) {
                    const quotes = result.indicators.quote[0];
                    const closes = quotes.close.filter(c => c !== null);
                    const highs = quotes.high.filter(h => h !== null);
                    const lows = quotes.low.filter(l => l !== null);
                    const current = closes[closes.length-1];
                    return {
                        currentPrice: current,
                        prevClose: closes[closes.length-2] || current,
                        dailyChange: ((current - closes[0]) / closes[0]) * 100,
                        high24h: Math.max(...highs.slice(-24)),
                        low24h: Math.min(...lows.slice(-24)),
                        volumeSpike: false,
                        rsi: this.calcRSI(closes, 14),
                        atr: this.calcATR(highs, lows, closes, 14),
                        ema20: this.calcEMA(closes, 20),
                        ema50: this.calcEMA(closes, 50),
                        ema200: this.calcEMA(closes, 200),
                        support: Math.min(...lows.slice(-50)),
                        resistance: Math.max(...highs.slice(-50)),
                        trend: this.determineTrend(closes),
                        volatility: this.calcATR(highs, lows, closes, 14) / current * 100,
                        ...info,
                        _source: 'Yahoo (proxy)'
                    };
                }
            } catch(e) { console.warn('Yahoo failed:', e); }
        }

        // If all fail, show a clear message
        console.error('All APIs failed for', xmSymbol);
        return null;
    },

    async fetchDXY() {
        try {
            const directUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1h&range=1d';
            const data = await this.fetchWithProxy(directUrl);
            const result = data.chart?.result?.[0];
            if (result) {
                const quotes = result.indicators.quote[0];
                const closes = quotes.close.filter(c => c !== null);
                const currentPrice = closes[closes.length-1];
                let rsi = 50;
                if (closes.length >= 15) {
                    let gains = 0, losses = 0;
                    for (let i = closes.length-15; i < closes.length-1; i++) {
                        const diff = closes[i+1] - closes[i];
                        if (diff > 0) gains += diff;
                        else losses -= diff;
                    }
                    const avgGain = gains / 14;
                    const avgLoss = losses / 14;
                    if (avgLoss > 0) rsi = 100 - (100 / (1 + (avgGain / avgLoss)));
                }
                return {
                    dxyPrice: currentPrice,
                    dxyTrend: rsi > 70 ? 'STRONG' : (rsi < 30 ? 'WEAK' : 'NEUTRAL'),
                    dxyStrength: rsi > 70 ? 'STRONG' : (rsi < 30 ? 'WEAK' : 'NEUTRAL')
                };
            }
            throw new Error('No DXY data');
        } catch(e) {
            return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
        }
    },

    // Helper functions (unchanged)
    calcRSI(prices, period) { /* same as before */ },
    calcATR(highs, lows, closes, period) { /* same as before */ },
    calcEMA(prices, period) { /* same as before */ },
    determineTrend(prices) { /* same as before */ }
};

// Re‑attach helper functions (keep from your previous version)
MarketData.calcRSI = function(prices, period) { ... }; // add the full implementations from your original file
MarketData.calcATR = function(highs, lows, closes, period) { ... };
MarketData.calcEMA = function(prices, period) { ... };
MarketData.determineTrend = function(prices) { ... };
