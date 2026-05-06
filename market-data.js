/**
 * MARKET DATA FETCHER – Alpha Vantage (primary) + optional Twelve Data WebSocket (real‑time)
 * - Alpha Vantage REST always works (via CORS proxy)
 * - Twelve Data WebSocket adds real‑time prices for XAUUSD, XAGUSD, OILCash if key is valid
 * - No Twelve Data REST calls – avoids 404 errors
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

    // CORS proxy for Alpha Vantage (and Yahoo fallback)
    async fetchWithProxy(url) {
        const proxy = 'https://corsproxy.io/?';
        const resp = await fetch(proxy + encodeURIComponent(url));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    },

    // ---- Alpha Vantage REST (primary data source) ----
    async fetchFromAlphaVantage(symbol) {
        const key = this.getAlphaKey();
        if (!key) throw new Error('No Alpha Vantage key');
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;
        const data = await this.fetchWithProxy(url);
        const quote = data['Global Quote'];
        if (!quote || !quote['05. price']) throw new Error('No price');
        const price = parseFloat(quote['05. price']);
        return {
            currentPrice: price,
            prevClose: parseFloat(quote['08. previous close']),
            dailyChange: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
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
            _source: 'Alpha Vantage'
        };
    },

    // ---- Yahoo fallback (if Alpha Vantage fails) ----
    async fetchFromYahoo(symbol) {
        const yahooMap = {
            'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'OILCash': 'CL=F',
            'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X',
            'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD'
        };
        const yahooSym = yahooMap[symbol];
        if (!yahooSym) throw new Error('No Yahoo symbol');
        const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1h&range=2d`;
        const data = await this.fetchWithProxy(directUrl);
        const result = data.chart?.result?.[0];
        if (!result) throw new Error('No chart data');
        const quotes = result.indicators.quote[0];
        const closes = quotes.close.filter(c => c !== null);
        if (!closes.length) throw new Error('No price');
        const current = closes[closes.length-1];
        return {
            currentPrice: current,
            prevClose: closes[closes.length-2] || current,
            dailyChange: ((current - closes[0]) / closes[0]) * 100,
            high24h: current * 1.01,
            low24h: current * 0.99,
            volumeSpike: false,
            rsi: 50,
            atr: current * 0.005,
            ema20: current,
            ema50: current,
            ema200: current,
            support: current * 0.99,
            resistance: current * 1.01,
            trend: 'SIDEWAYS',
            volatility: 0.5,
            _source: 'Yahoo (fallback)'
        };
    },

    // ---- Main REST fetch (cached, 60 seconds) ----
    async fetchRest(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        const cached = this.restCache[xmSymbol];
        if (cached && (Date.now() - cached.ts) < 60000) return cached.data;

        let data = null;
        if (this.getAlphaKey()) {
            try {
                data = await this.fetchFromAlphaVantage(xmSymbol);
                if (data) {
                    data = { ...data, ...info };
                    this.restCache[xmSymbol] = { data, ts: Date.now() };
                    return data;
                }
            } catch(e) { console.warn('Alpha Vantage failed', e); }
        }
        try {
            data = await this.fetchFromYahoo(xmSymbol);
            if (data) {
                data = { ...data, ...info };
                this.restCache[xmSymbol] = { data, ts: Date.now() };
                return data;
            }
        } catch(e) { console.warn('Yahoo failed', e); }
        return null;
    },

    // ---- Twelve Data WebSocket (real‑time) ----
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

    // ---- Public fetch (used by app.js) ----
    async fetch(xmSymbol) {
        // Get base data from REST
        let data = await this.fetchRest(xmSymbol);
        if (!data) return null;

        // If it's a real‑time symbol and WebSocket is connected, override price
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
        const data = await this.fetch(symbol);
        return data ? data.currentPrice : null;
    },

    async fetchDXY() {
        return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
    },

    // Technical indicators (simple versions – app.js uses StrategyEngine, these are fallbacks)
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
        return trs.reduce((a,b) => a+b,0) / period;
    },

    calcEMA(prices, period) {
        if (prices.length < period) return prices[prices.length-1];
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a,b) => a+b,0) / period;
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

// Auto‑start WebSocket if Twelve Data key exists
if (MarketData.getTwelveKey()) {
    MarketData.initWebSocket();
}
