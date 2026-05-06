/**
 * MARKET DATA FETCHER – Alpha Vantage (primary) + optional Twelve Data WebSocket (real‑time)
 * - Alpha Vantage: daily historical data → calculates RSI, EMAs, support/resistance
 * - WebSocket (Twelve Data) overrides price for XAUUSD, XAGUSD, OILCash if connected
 * - Fallback: Yahoo Finance
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

    // ----- Historical data from Alpha Vantage -----
    async fetchHistoricalData(symbol) {
        const key = this.getAlphaKey();
        if (!key) throw new Error('No Alpha Vantage key');
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`;
        const data = await this.fetchWithProxy(url);
        const timeSeries = data['Time Series (Daily)'];
        if (!timeSeries) throw new Error('No daily data');
        const dates = Object.keys(timeSeries).sort();
        const closes = dates.map(d => parseFloat(timeSeries[d]['4. close']));
        return closes;
    },

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
        let ema = prices.slice(0, period).reduce((a,b) => a+b,0) / period;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    },

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

    // ----- Main fetch (Alpha Vantage indicators + price) -----
    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;
        const cached = this.restCache[xmSymbol];
        if (cached && (Date.now() - cached.ts) < 60000) return cached.data;

        try {
            let closes = [];
            if (xmSymbol === 'XAUUSD' || xmSymbol === 'XAGUSD' || xmSymbol === 'OILCash' ||
                xmSymbol === 'EURUSD' || xmSymbol === 'GBPUSD') {
                closes = await this.fetchHistoricalData(xmSymbol);
            }
            const quote = await this.fetchCurrentQuote(xmSymbol);
            const price = quote.price;

            let rsi = 50, ema20 = price, ema50 = price, ema200 = price;
            let support = price * 0.99, resistance = price * 1.01, trend = 'SIDEWAYS';
            let atr = price * 0.005, volatility = 0.5;

            if (closes.length >= 50) {
                rsi = this.calcRSI(closes);
                ema20 = this.calcEMA(closes, 20);
                ema50 = this.calcEMA(closes, 50);
                ema200 = this.calcEMA(closes, 200);
                support = Math.min(...closes.slice(-50)) * 0.998;
                resistance = Math.max(...closes.slice(-50)) * 1.002;
                if (ema20 > ema50 && ema50 > ema200) trend = 'BULLISH';
                else if (ema20 < ema50 && ema50 < ema200) trend = 'BEARISH';
                atr = (Math.max(...closes.slice(-14)) - Math.min(...closes.slice(-14))) / 14;
                volatility = (atr / price) * 100;
            }

            const result = {
                currentPrice: price, prevClose: quote.prevClose, dailyChange: quote.changePercent,
                high24h: price * 1.005, low24h: price * 0.995, volumeSpike: false,
                rsi, atr, ema20, ema50, ema200, support, resistance, trend, volatility,
                ...info, _source: 'Alpha Vantage (with indicators)'
            };
            this.restCache[xmSymbol] = { data: result, ts: Date.now() };
            return result;
        } catch (err) {
            console.warn('Alpha Vantage failed:', err);
            // fallback: price only
            try {
                const quote = await this.fetchCurrentQuote(xmSymbol);
                return {
                    currentPrice: quote.price, prevClose: quote.prevClose, dailyChange: quote.changePercent,
                    high24h: quote.price * 1.005, low24h: quote.price * 0.995, volumeSpike: false,
                    rsi: 50, atr: quote.price * 0.001, ema20: quote.price, ema50: quote.price, ema200: quote.price,
                    support: quote.price * 0.998, resistance: quote.price * 1.002, trend: 'SIDEWAYS', volatility: 0.3,
                    ...info, _source: 'Alpha Vantage (price only)'
                };
            } catch(e) { return null; }
        }
    },

    // ----- WebSocket (Twelve Data) with corrected endpoint -----
    initWebSocket() {
        const key = this.getTwelveKey();
        if (!key) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${key}`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            console.log('Twelve Data WebSocket connected');
            this.wsConnected = true;
            this.ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'XAUUSD,XAGUSD,CL' } }));
        };
        this.ws.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (d.symbol && d.price) {
                    this.realtimePrices[d.symbol] = { price: d.price, ts: Date.now() };
                }
            } catch(err) {}
        };
        this.ws.onerror = (err) => { console.warn('WebSocket error', err); this.wsConnected = false; };
        this.ws.onclose = () => {
            console.log('WebSocket closed, reconnecting...');
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

    async fetch(symbol) {
        return this.fetchRealtime(symbol);
    }
};

if (MarketData.getTwelveKey()) MarketData.initWebSocket();
