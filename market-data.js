/**
 * MARKET DATA FETCHER – Alpha Vantage (primary) + Twelve Data WebSocket (real‑time) + Yahoo (fallback)
 * - Alpha Vantage: provides daily historical data for RSI, EMAs, support/resistance.
 * - Twelve Data WebSocket: overrides currentPrice with real‑time ticks if available.
 * - Yahoo: ultimate fallback if Alpha Vantage fails.
 * All API keys are read from localStorage (set in index.html settings).
 */

const MarketData = {
    alphaKey: null,
    twelveKey: null,
    ws: null,
    wsConnected: false,
    webSocketPrice: null,
    webSocketPriceTime: 0,
    restCache: {},

    assetInfo: {
        'XAUUSD': { class: 'commodities', spread: 0.20, multiplier: 100, name: 'Gold', digits: 2, alphaSymbol: 'XAUUSD', wsSymbol: 'XAUUSD' },
        'XAGUSD': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'Silver', digits: 3, alphaSymbol: 'XAGUSD', wsSymbol: 'XAGUSD' },
        'OILCash': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'WTI Oil', digits: 2, alphaSymbol: 'CL', wsSymbol: 'CL' },
        'EURUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'EUR/USD', digits: 5, alphaSymbol: 'EURUSD' },
        'GBPUSD': { class: 'forex', spread: 0.0001, multiplier: 10000, name: 'GBP/USD', digits: 5, alphaSymbol: 'GBPUSD' },
        'BTCUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Bitcoin', digits: 0, alphaSymbol: 'BTCUSD' },
        'ETHUSD': { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Ethereum', digits: 0, alphaSymbol: 'ETHUSD' }
    },

    setAlphaKey(key) { this.alphaKey = key; localStorage.setItem('alpha_api_key', key); },
    getAlphaKey() { if (!this.alphaKey) this.alphaKey = localStorage.getItem('alpha_api_key'); return this.alphaKey; },
    setTwelveKey(key) { this.twelveKey = key; localStorage.setItem('twelve_data_key', key); },
    getTwelveKey() { if (!this.twelveKey) this.twelveKey = localStorage.getItem('twelve_data_key'); return this.twelveKey; },

    // CORS proxy (free, works)
    async fetchWithProxy(url) {
        const proxy = 'https://corsproxy.io/?';
        const resp = await fetch(proxy + encodeURIComponent(url));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    },

    // ---- Alpha Vantage: historical daily data (for indicators) ----
    async fetchHistoricalData(symbol) {
        const key = this.getAlphaKey();
        if (!key) throw new Error('No Alpha Vantage key');
        let url;
        if (symbol === 'XAUUSD' || symbol === 'XAGUSD') {
            // For gold and silver, Alpha Vantage uses FOREX endpoint with XAU/USD, XAG/USD
            const from = symbol.slice(0,3), to = symbol.slice(3);
            url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=compact&apikey=${key}`;
        } else if (symbol === 'OILCash') {
            // Oil is not directly available via FX_DAILY; fallback to Yahoo later
            return [];
        } else if (symbol === 'EURUSD' || symbol === 'GBPUSD') {
            const from = symbol.slice(0,3), to = symbol.slice(3);
            url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=compact&apikey=${key}`;
        } else {
            // Crypto, use DIGITAL_CURRENCY_DAILY? But not needed, we'll rely on Yahoo.
            return [];
        }
        const data = await this.fetchWithProxy(url);
        const timeSeries = data['Time Series FX (Daily)'];
        if (!timeSeries) throw new Error('No FX daily data');
        const dates = Object.keys(timeSeries).sort();
        const closes = dates.map(d => parseFloat(timeSeries[d]['4. close']));
        return closes;
    },

    // ---- Alpha Vantage: current quote (price) ----
    async fetchCurrentQuote(symbol) {
        const key = this.getAlphaKey();
        // Use GLOBAL_QUOTE for forex and crypto (works for XAUUSD too)
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

    // ---- Yahoo Finance (fallback) ----
    async fetchFromYahoo(symbol) {
        const yahooMap = {
            'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'OILCash': 'CL=F',
            'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X',
            'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD'
        };
        const yahooSym = yahooMap[symbol];
        if (!yahooSym) throw new Error('No Yahoo mapping');
        const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1h&range=2d`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
        const resp = await fetch(proxyUrl);
        const data = await resp.json();
        const result = data.chart?.result?.[0];
        if (!result) throw new Error('No chart');
        const quotes = result.indicators.quote[0];
        const closes = quotes.close.filter(c => c !== null);
        const highs = quotes.high.filter(h => h !== null);
        const lows = quotes.low.filter(l => l !== null);
        if (closes.length === 0) throw new Error('No price');
        const current = closes[closes.length-1];
        // RSI
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
            if (avgLoss > 0) rsi = 100 - (100 / (1 + avgGain / avgLoss));
        }
        const ema20 = closes.slice(-20).reduce((a,b)=>a+b,0)/20;
        const ema50 = closes.slice(-50).reduce((a,b)=>a+b,0)/50;
        const ema200 = closes.slice(-200).reduce((a,b)=>a+b,0)/200;
        const support = Math.min(...lows.slice(-50));
        const resistance = Math.max(...highs.slice(-50));
        let atr = 0;
        if (highs.length > 14) {
            let trSum = 0;
            for (let i = highs.length-14; i < highs.length; i++) {
                const hl = highs[i] - lows[i];
                const hc = Math.abs(highs[i] - closes[i-1]);
                const lc = Math.abs(lows[i] - closes[i-1]);
                trSum += Math.max(hl, hc, lc);
            }
            atr = trSum / 14;
        } else atr = current * 0.005;
        const trend = (ema20 > ema50 && ema50 > ema200) ? 'BULLISH' : (ema20 < ema50 && ema50 < ema200) ? 'BEARISH' : 'SIDEWAYS';
        const volatility = (atr / current) * 100;
        return {
            currentPrice: current,
            prevClose: closes[closes.length-2] || current,
            dailyChange: ((current - closes[0]) / closes[0]) * 100,
            high24h: Math.max(...highs.slice(-24)),
            low24h: Math.min(...lows.slice(-24)),
            volumeSpike: false,
            rsi, atr, ema20, ema50, ema200, support, resistance, trend, volatility,
            _source: 'Yahoo'
        };
    },

    // ---- Twelve Data WebSocket (real‑time) ----
    initWebSocket() {
        const key = this.getTwelveKey();
        if (!key) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${key}`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.wsConnected = true;
            // Subscribe format: {"action":"subscribe","symbols":"XAUUSD,XAGUSD,CL"}
            this.ws.send(JSON.stringify({ action: 'subscribe', symbols: 'XAUUSD,XAGUSD,CL' }));
        };
        this.ws.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (d.symbol && d.price) {
                    this.webSocketPrice = parseFloat(d.price);
                    this.webSocketPriceTime = Date.now();
                }
            } catch(err) {}
        };
        this.ws.onerror = () => { this.wsConnected = false; };
        this.ws.onclose = () => {
            this.wsConnected = false;
            setTimeout(() => this.initWebSocket(), 10000);
        };
    },

    getWebSocketPrice() {
        if (this.wsConnected && this.webSocketPrice && (Date.now() - this.webSocketPriceTime) < 5000) {
            return this.webSocketPrice;
        }
        return null;
    },

    // ---- Main fetch with caching and multi-source fallback ----
    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        // Check cache (60 seconds)
        const cached = this.restCache[xmSymbol];
        if (cached && (Date.now() - cached.ts) < 60000) {
            // If we have a newer WebSocket price, override
            const wsPrice = this.getWebSocketPrice();
            if (wsPrice && cached.data) {
                cached.data.currentPrice = wsPrice;
                cached.data._source += ' + WebSocket price';
            }
            return cached.data;
        }

        let data = null;
        let usedSource = '';

        // 1. Try Alpha Vantage (historical + quote)
        if (this.getAlphaKey()) {
            try {
                let closes = [];
                try {
                    closes = await this.fetchHistoricalData(xmSymbol);
                } catch(e) { console.warn('Historical fetch failed, using defaults', e); }
                const quote = await this.fetchCurrentQuote(xmSymbol);
                const price = quote.price;
                let rsi = 50, ema20 = price, ema50 = price, ema200 = price;
                let support = price * 0.998, resistance = price * 1.002;
                let trend = 'SIDEWAYS', atr = price * 0.001, volatility = 0.3;
                if (closes.length >= 50) {
                    // Calculate indicators only if we have enough history
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
                data = {
                    currentPrice: price,
                    prevClose: quote.prevClose,
                    dailyChange: quote.changePercent,
                    high24h: price * 1.005,
                    low24h: price * 0.995,
                    volumeSpike: false,
                    rsi, atr, ema20, ema50, ema200, support, resistance, trend, volatility,
                    _source: 'Alpha Vantage'
                };
                usedSource = 'Alpha Vantage';
            } catch(err) {
                console.warn('Alpha Vantage failed:', err);
            }
        }

        // 2. Fallback to Yahoo if Alpha Vantage failed
        if (!data) {
            try {
                data = await this.fetchFromYahoo(xmSymbol);
                if (data) usedSource = 'Yahoo';
            } catch(err) {
                console.warn('Yahoo failed:', err);
            }
        }

        if (!data) return null;

        // Add asset info
        data = { ...data, ...info, _source: usedSource };

        // Override price with WebSocket if available and symbol is supported (XAUUSD, XAGUSD, OILCash)
        const wsPrice = this.getWebSocketPrice();
        if (wsPrice && (xmSymbol === 'XAUUSD' || xmSymbol === 'XAGUSD' || xmSymbol === 'OILCash')) {
            data.currentPrice = wsPrice;
            data._source += ' + WebSocket price';
        }

        // Store in cache
        this.restCache[xmSymbol] = { data, ts: Date.now() };
        return data;
    },

    // Technical indicators (same as before)
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
        for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
        return ema;
    },

    async fetchPriceForTracking(symbol) {
        const data = await this.fetch(symbol);
        return data ? data.currentPrice : null;
    },

    async fetchDXY() {
        return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
    }
};

// Auto‑start WebSocket if key exists
if (MarketData.getTwelveKey()) {
    MarketData.initWebSocket();
}
