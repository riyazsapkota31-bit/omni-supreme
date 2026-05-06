/**
 * MARKET DATA FETCHER – Alpha Vantage (primary) with full indicators + optional WebSocket
 * - Fetches daily time series to calculate RSI, EMAs, support/resistance
 * - Uses current price from latest quote
 * - Twelve Data WebSocket overrides price only (optional)
 */

const MarketData = {
    alphaKey: null,
    twelveKey: null,

    ws: null,
    wsConnected: false,
    realtimePrices: {},
    restCache: {},

    assetInfo: {
        'XAUUSD': { class: 'commodities', spread: 0.20, multiplier: 100, name: 'Gold', digits: 2, wsSymbol: 'XAUUSD' },
        'XAGUSD': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'Silver', digits: 3, wsSymbol: 'XAGUSD' },
        'OILCash': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'WTI Oil', digits: 2, wsSymbol: 'CL' },
        'EURUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'EUR/USD', digits: 5 },
        'GBPUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'GBP/USD', digits: 5 },
        'BTCUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Bitcoin', digits: 0 },
        'ETHUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Ethereum', digits: 0 }
    },

    setAlphaKey(key) { this.alphaKey = key; localStorage.setItem('alpha_api_key', key); },
    getAlphaKey() { if (!this.alphaKey) this.alphaKey = localStorage.getItem('alpha_api_key'); return this.alphaKey; },
    setTwelveKey(key) { this.twelveKey = key; localStorage.setItem('twelve_data_key', key); },
    getTwelveKey() { if (!this.twelveKey) this.twelveKey = localStorage.getItem('twelve_data_key'); return this.twelveKey; },

    async fetchWithProxy(url) {
        const proxy = 'https://corsproxy.io/?';
        const resp = await fetch(proxy + encodeURIComponent(url));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    },

    // ---- Fetch historical daily prices and calculate indicators ----
    async fetchHistoricalData(symbol) {
        const key = this.getAlphaKey();
        if (!key) throw new Error('No Alpha Vantage key');
        // Use DAILY adjusted (or DAILY) – free tier allows 5 calls/min
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`;
        const data = await this.fetchWithProxy(url);
        const timeSeries = data['Time Series (Daily)'];
        if (!timeSeries) throw new Error('No daily data');
        const dates = Object.keys(timeSeries).sort(); // oldest first
        const closes = dates.map(d => parseFloat(timeSeries[d]['4. close']));
        return closes;
    },

    // ---- Calculate RSI from array of prices ----
    calcRSI(closes, period = 14) {
        if (closes.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length - 1; i++) {
            const diff = closes[i+1] - closes[i];
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
        let ema = prices.slice(0, period).reduce((a,b) => a+b,0)/period;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    },

    // ---- Fetch current quote (price) ----
    async fetchCurrentQuote(symbol) {
        const key = this.getAlphaKey();
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;
        const data = await this.fetchWithProxy(url);
        const quote = data['Global Quote'];
        if (!quote || !quote['05. price']) throw new Error('No quote');
        return {
            price: parseFloat(quote['05. price']),
            prevClose: parseFloat(quote['08. previous close']),
            changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || '0')
        };
    },

    // ---- Main fetch (combines historical indicators + current price) ----
    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        const cacheKey = xmSymbol;
        const cached = this.restCache[cacheKey];
        if (cached && (Date.now() - cached.ts) < 60000) return cached.data;

        try {
            // Get historical closes for indicators (only for commodities and forex – for crypto we can skip or use same)
            let closes = [];
            if (xmSymbol === 'XAUUSD' || xmSymbol === 'XAGUSD' || xmSymbol === 'OILCash' ||
                xmSymbol === 'EURUSD' || xmSymbol === 'GBPUSD') {
                closes = await this.fetchHistoricalData(xmSymbol);
            } else {
                // For crypto, we'll use a simple fallback (or you can add Binance later)
                closes = [];
            }
            
            // Get current quote
            const quote = await this.fetchCurrentQuote(xmSymbol);
            const currentPrice = quote.price;

            let rsi = 50, ema20 = currentPrice, ema50 = currentPrice, ema200 = currentPrice;
            let support = currentPrice * 0.99, resistance = currentPrice * 1.01;
            let trend = 'SIDEWAYS', atr = currentPrice * 0.005, volatility = 0.5;

            if (closes.length >= 50) {
                // Calculate indicators from historical data
                rsi = this.calcRSI(closes);
                ema20 = this.calcEMA(closes, 20);
                ema50 = this.calcEMA(closes, 50);
                ema200 = this.calcEMA(closes, 200);
                support = Math.min(...closes.slice(-50)) * 0.998;
                resistance = Math.max(...closes.slice(-50)) * 1.002;
                if (ema20 > ema50 && ema50 > ema200) trend = 'BULLISH';
                else if (ema20 < ema50 && ema50 < ema200) trend = 'BEARISH';
                else trend = 'SIDEWAYS';
                // Simple ATR approximation using daily range (not perfect but enough)
                atr = (Math.max(...closes.slice(-14)) - Math.min(...closes.slice(-14))) / 14;
                volatility = (atr / currentPrice) * 100;
            }

            const result = {
                currentPrice,
                prevClose: quote.prevClose,
                dailyChange: quote.changePercent,
                high24h: currentPrice * 1.005,
                low24h: currentPrice * 0.995,
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
                ...info,
                _source: 'Alpha Vantage (with indicators)'
            };
            this.restCache[cacheKey] = { data: result, ts: Date.now() };
            return result;
        } catch (err) {
            console.warn('Alpha Vantage historical fetch failed:', err);
            // Fallback to simple quote (no indicators) but still try to give a signal
            try {
                const quote = await this.fetchCurrentQuote(xmSymbol);
                return {
                    currentPrice: quote.price,
                    prevClose: quote.prevClose,
                    dailyChange: quote.changePercent,
                    high24h: quote.price * 1.005,
                    low24h: quote.price * 0.995,
                    volumeSpike: false,
                    rsi: 50,
                    atr: quote.price * 0.001,
                    ema20: quote.price,
                    ema50: quote.price,
                    ema200: quote.price,
                    support: quote.price * 0.998,
                    resistance: quote.price * 1.002,
                    trend: 'SIDEWAYS',
                    volatility: 0.3,
                    ...info,
                    _source: 'Alpha Vantage (price only)'
                };
            } catch(e) {
                return null;
            }
        }
    },

    // ---- WebSocket for real‑time price override (optional) ----
    initWebSocket() {
        const key = this.getTwelveKey();
        if (!key) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        const wsUrl = `wss://ws.twelvedata.com/v1/quotes?apikey=${key}`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            this.wsConnected = true;
            this.ws.send(JSON.stringify({ action: 'subscribe', symbols: ['XAUUSD', 'XAGUSD', 'CL'] }));
        };
        this.ws.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (d.event === 'price' && d.symbol && d.price) {
                    this.realtimePrices[d.symbol] = { price: d.price, ts: Date.now() };
                }
            } catch(err) {}
        };
        this.ws.onerror = () => { this.wsConnected = false; };
        this.ws.onclose = () => {
            this.wsConnected = false;
            setTimeout(() => this.initWebSocket(), 10000);
        };
    },

    async getRealtimePrice(xmSymbol) {
        if (!this.wsConnected) return null;
        const wsSym = this.assetInfo[xmSymbol]?.wsSymbol;
        if (!wsSym) return null;
        const p = this.realtimePrices[wsSym];
        if (p && (Date.now() - p.ts) < 5000) return p.price;
        return null;
    },

    // ---- Final fetch used by app.js (with optional WebSocket override) ----
    async fetchRealtime(xmSymbol) {
        let data = await this.fetch(xmSymbol);
        if (!data) return null;
        if (this.wsConnected && (xmSymbol === 'XAUUSD' || xmSymbol === 'XAGUSD' || xmSymbol === 'OILCash')) {
            const wsPrice = await this.getRealtimePrice(xmSymbol);
            if (wsPrice) {
                data.currentPrice = wsPrice;
                data._source = 'WebSocket (real‑time) + ' + data._source;
            }
        }
        return data;
    },

    async fetchPriceForTracking(symbol) {
        const data = await this.fetchRealtime(symbol);
        return data ? data.currentPrice : null;
    },

    async fetchDXY() {
        return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
    },

    // Keep old method signatures for compatibility
    async fetch(symbol) {
        return this.fetchRealtime(symbol);
    }
};

// Auto‑start WebSocket if Twelve Data key exists
if (MarketData.getTwelveKey()) {
    MarketData.initWebSocket();
}
