/**
 * MARKET DATA FETCHER – Twelve Data WebSocket + REST with aggressive caching
 * - Real‑time: XAUUSD, XAGUSD via WebSocket (0 credits, permanent free)
 * - Other assets: REST with 60‑second cache (1 credit per symbol per minute max)
 * - Auto tracking uses fetchPriceForTracking() – never consumes credits
 */

const MarketData = {
    ws: null,
    wsConnected: false,
    lastPrices: {},        // real‑time price cache (WebSocket)
    restCache: {},         // REST responses with timestamp
    apiKey: null,

    assetInfo: {
        'XAUUSD': { class: 'commodities', spread: 0.20, multiplier: 100, name: 'Gold', digits: 2, realtime: true },
        'XAGUSD': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'Silver', digits: 3, realtime: true },
        'OILCash': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'WTI Oil', digits: 2 },
        'EURUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'EUR/USD', digits: 5 },
        'GBPUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'GBP/USD', digits: 5 },
        'BTCUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Bitcoin', digits: 0 },
        'ETHUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Ethereum', digits: 0 }
    },

    setApiKey(key) { this.apiKey = key; localStorage.setItem('twelve_data_key', key); },
    getApiKey() { if (!this.apiKey) this.apiKey = localStorage.getItem('twelve_data_key'); return this.apiKey; },

    // ---- WebSocket (real‑time, 0 credits) ----
    initWebSocket(apiKey) {
        if (!apiKey) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        const wsUrl = `wss://ws.twelvedata.com/v1/quotes?apikey=${apiKey}`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            console.log('Twelve Data WebSocket connected');
            this.wsConnected = true;
            this.ws.send(JSON.stringify({ action: 'subscribe', symbols: ['XAUUSD', 'XAGUSD'] }));
        };
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.symbol && data.price) {
                    this.lastPrices[data.symbol] = { price: data.price, timestamp: Date.now() };
                }
            } catch(e) {}
        };
        this.ws.onerror = (err) => console.warn('WebSocket error', err);
        this.ws.onclose = () => {
            this.wsConnected = false;
            setTimeout(() => this.initWebSocket(apiKey), 5000);
        };
    },

    async getRealtimePrice(symbol) {
        if (!this.wsConnected) return null;
        const start = Date.now();
        while (!this.lastPrices[symbol] && Date.now() - start < 3000) {
            await new Promise(r => setTimeout(r, 100));
        }
        const cached = this.lastPrices[symbol];
        if (cached && (Date.now() - cached.timestamp) < 5000) return cached.price;
        return null;
    },

    // ---- Full REST fetch with 60s cache (used only by manual "GO") ----
    async fetchFullData(symbol) {
        const apiKey = this.getApiKey();
        const cached = this.restCache[symbol];
        if (cached && (Date.now() - cached.timestamp) < 60000) {
            console.log(`Using cached full data for ${symbol}`);
            return cached.data;
        }
        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&outputsize=100&apikey=${apiKey || 'demo'}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.values || data.values.length === 0) throw new Error('No data');
        const vals = data.values;
        const closes = vals.map(v => parseFloat(v.close));
        const highs = vals.map(v => parseFloat(v.high));
        const lows = vals.map(v => parseFloat(v.low));
        const current = parseFloat(vals[0].close);
        const result = {
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
            _source: 'Twelve Data REST'
        };
        this.restCache[symbol] = { data: result, timestamp: Date.now() };
        return result;
    },

    // ---- Price-only fetch (used by auto tracking, 0 credits) ----
    async fetchPriceOnly(symbol) {
        const info = this.assetInfo[symbol];
        if (!info) return null;

        // Real‑time assets: use WebSocket price (0 credits)
        if (info.realtime && this.apiKey) {
            if (!this.wsConnected) this.initWebSocket(this.apiKey);
            const realPrice = await this.getRealtimePrice(symbol);
            if (realPrice !== null) return realPrice;
        }

        // For other assets: try to get price from last full cache (still fresh)
        const cachedFull = this.restCache[symbol];
        if (cachedFull && (Date.now() - cachedFull.timestamp) < 60000) {
            return cachedFull.data.currentPrice;
        }

        // If no fresh cache, return last known price (even if expired) – no API call
        if (cachedFull) return cachedFull.data.currentPrice;
        return null;
    },

    // ---- Main fetch for manual "GO" button (uses full data with cache) ----
    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.warn('No API key – using demo REST (delayed)');
        }

        // For real‑time assets: combine WebSocket price with cached indicators
        if (info.realtime && apiKey) {
            if (!this.wsConnected) this.initWebSocket(apiKey);
            const realPrice = await this.getRealtimePrice(xmSymbol);
            let fullData = this.restCache[xmSymbol + '_full']?.data;
            if (!fullData || Date.now() - (this.restCache[xmSymbol + '_full']?.timestamp || 0) > 60000) {
                fullData = await this.fetchFullData(xmSymbol);
                this.restCache[xmSymbol + '_full'] = { data: fullData, timestamp: Date.now() };
            }
            if (fullData) {
                const result = { ...fullData, ...info };
                result.currentPrice = realPrice;
                result._source = 'WebSocket (price) + REST indicators';
                return result;
            }
        }

        // For all others: use full REST with cache
        return await this.fetchFullData(xmSymbol);
    },

    // Explicit method for auto tracking (no credit consumption)
    async fetchPriceForTracking(symbol) {
        return await this.fetchPriceOnly(symbol);
    },

    async fetchDXY() {
        return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
    },

    // Technical indicators (unchanged)
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
