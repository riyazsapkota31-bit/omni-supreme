/**
 * MARKET DATA FETCHER – Alpha Vantage + Twelve Data WebSocket (diagnostic)
 * Shows all errors on screen. No more guessing.
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

    // Helper to show error on screen
    showError(msg) {
        let errDiv = document.getElementById('errorLog');
        if (!errDiv) {
            errDiv = document.createElement('div');
            errDiv.id = 'errorLog';
            errDiv.style.cssText = 'position:fixed; bottom:0; left:0; right:0; background:#1a1a2e; border-top:2px solid #ff4466; color:#ff4466; font-size:10px; padding:8px; max-height:120px; overflow-y:auto; z-index:10000; font-family:monospace;';
            document.body.appendChild(errDiv);
        }
        errDiv.style.display = 'block';
        errDiv.innerHTML += `[${new Date().toLocaleTimeString()}] ${msg}<br>`;
        console.log(msg);
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

    async fetchHistoricalData(symbol) {
        const key = this.getAlphaKey();
        if (!key) throw new Error('No Alpha Vantage key');
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`;
        this.showError(`Fetching historical data for ${symbol}...`);
        const data = await this.fetchWithProxy(url);
        if (data['Error Message']) throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
        const timeSeries = data['Time Series (Daily)'];
        if (!timeSeries) throw new Error('No daily data');
        const dates = Object.keys(timeSeries).sort();
        const closes = dates.map(d => parseFloat(timeSeries[d]['4. close']));
        this.showError(`Got ${closes.length} daily closes for ${symbol}`);
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
        for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
        return ema;
    },

    async fetchCurrentQuote(symbol) {
        const key = this.getAlphaKey();
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;
        const data = await this.fetchWithProxy(url);
        if (data['Error Message']) throw new Error(`Quote error: ${data['Error Message']}`);
        const quote = data['Global Quote'];
        if (!quote || !quote['05. price']) throw new Error('No quote');
        return {
            price: parseFloat(quote['05. price']),
            prevClose: parseFloat(quote['08. previous close']),
            changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || '0')
        };
    },

    // WebSocket (Twelve Data)
    initWebSocket() {
        const key = this.getTwelveKey();
        if (!key) {
            this.showError('Twelve Data key missing – WebSocket disabled');
            return;
        }
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${key}`;
        this.showError(`Attempting WebSocket connection to ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            this.showError('WebSocket connected ✅');
            this.wsConnected = true;
            this.ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'XAUUSD,XAGUSD,CL' } }));
        };
        this.ws.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (d.symbol && d.price) {
                    this.realtimePrices[d.symbol] = { price: d.price, ts: Date.now() };
                    this.showError(`WebSocket price: ${d.symbol}=${d.price}`);
                } else if (d.event === 'error') {
                    this.showError(`WebSocket error: ${d.message}`);
                }
            } catch(err) {}
        };
        this.ws.onerror = (err) => { this.showError(`WebSocket error event: ${err.message}`); this.wsConnected = false; };
        this.ws.onclose = () => {
            this.showError('WebSocket closed, reconnecting in 10s');
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

    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        const cached = this.restCache[xmSymbol];
        if (cached && (Date.now() - cached.ts) < 60000) return cached.data;

        try {
            // Try to get full historical data (for indicators)
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

            // Override price with WebSocket if available
            if (this.wsConnected) {
                const wsPrice = await this.getRealtimePrice(xmSymbol);
                if (wsPrice) {
                    result.currentPrice = wsPrice;
                    result._source = 'WebSocket (real‑time) + Alpha Vantage indicators';
                }
            }
            return result;
        } catch (err) {
            this.showError(`Alpha Vantage fetch failed for ${xmSymbol}: ${err.message}`);
            // Fallback to Yahoo (simpler, last resort)
            return await this.fallbackToYahoo(xmSymbol);
        }
    },

    async fallbackToYahoo(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;
        const yahooSym = ({ 'XAUUSD':'GC=F', 'XAGUSD':'SI=F', 'OILCash':'CL=F', 'EURUSD':'EURUSD=X', 'GBPUSD':'GBPUSD=X', 'BTCUSD':'BTC-USD', 'ETHUSD':'ETH-USD' })[xmSymbol];
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1h&range=2d`)}`;
        try {
            const resp = await fetch(proxyUrl);
            const data = await resp.json();
            const result = data.chart?.result?.[0];
            if (!result) throw new Error();
            const quotes = result.indicators.quote[0];
            const closes = quotes.close.filter(c => c !== null);
            const highs = quotes.high.filter(h => h !== null);
            const lows = quotes.low.filter(l => l !== null);
            const current = closes[closes.length-1];
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
                currentPrice: current, prevClose: closes[closes.length-2] || current,
                dailyChange: ((current - closes[0]) / closes[0]) * 100,
                high24h: Math.max(...highs.slice(-24)), low24h: Math.min(...lows.slice(-24)),
                volumeSpike: false, rsi, atr, ema20, ema50, ema200, support, resistance, trend, volatility,
                ...info, _source: 'Yahoo (fallback)'
            };
        } catch(e) {
            this.showError(`Yahoo fallback also failed: ${e.message}`);
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

// Auto‑start WebSocket if key exists
if (MarketData.getTwelveKey()) {
    MarketData.initWebSocket();
}
