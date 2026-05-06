/**
 * MARKET DATA FETCHER – WebSocket only (Twelve Data)
 * Computes all indicators (RSI, EMAs, support/resistance) from the live price stream.
 * No API keys needed except WebSocket (already working).
 * Only supports XAUUSD, XAGUSD, OILCash (add more symbols to subscription if needed).
 */

const MarketData = {
    twelveKey: null,
    ws: null,
    wsConnected: false,
    priceHistory: {},
    lastPrices: {},

    assetInfo: {
        'XAUUSD': { class: 'commodities', spread: 0.20, multiplier: 100, name: 'Gold', digits: 2, wsSymbol: 'XAUUSD' },
        'XAGUSD': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'Silver', digits: 3, wsSymbol: 'XAGUSD' },
        'OILCash': { class: 'commodities', spread: 0.03, multiplier: 100, name: 'WTI Oil', digits: 2, wsSymbol: 'CL' }
    },

    showMessage(msg) {
        let errDiv = document.getElementById('errorLog');
        if (!errDiv) {
            errDiv = document.createElement('div');
            errDiv.id = 'errorLog';
            errDiv.style.cssText = 'position:fixed; bottom:0; left:0; right:0; background:#1a1a2e; border-top:2px solid #00ff88; color:#00ff88; font-size:10px; padding:8px; max-height:120px; overflow-y:auto; z-index:10000; font-family:monospace;';
            document.body.appendChild(errDiv);
        }
        errDiv.style.display = 'block';
        errDiv.innerHTML += `[${new Date().toLocaleTimeString()}] ${msg}<br>`;
        console.log(msg);
    },

    setTwelveKey(key) { this.twelveKey = key; localStorage.setItem('twelve_data_key', key); },
    getTwelveKey() { if (!this.twelveKey) this.twelveKey = localStorage.getItem('twelve_data_key'); return this.twelveKey; },

    initWebSocket() {
        const key = this.getTwelveKey();
        if (!key) {
            this.showMessage('Twelve Data key missing');
            return;
        }
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${key}`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            this.showMessage('WebSocket connected – collecting live prices');
            this.wsConnected = true;
            this.ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'XAUUSD,XAGUSD,CL' } }));
        };
        this.ws.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (d.symbol && d.price) {
                    const sym = d.symbol;
                    const price = parseFloat(d.price);
                    const now = Date.now();
                    if (!this.priceHistory[sym]) this.priceHistory[sym] = [];
                    this.priceHistory[sym].push({ price, timestamp: now });
                    if (this.priceHistory[sym].length > 200) this.priceHistory[sym].shift();
                    this.lastPrices[sym] = price;
                    if (this.priceHistory[sym].length === 50) {
                        this.showMessage(`✅ ${sym}: enough data for indicators`);
                    }
                }
            } catch(err) {}
        };
        this.ws.onerror = () => { this.showMessage('WebSocket error'); this.wsConnected = false; };
        this.ws.onclose = () => {
            this.showMessage('WebSocket closed, reconnecting');
            this.wsConnected = false;
            setTimeout(() => this.initWebSocket(), 5000);
        };
    },

    getPriceHistory(symbol) {
        const wsSym = this.assetInfo[symbol]?.wsSymbol;
        if (!wsSym) return [];
        const hist = this.priceHistory[wsSym];
        return hist ? hist.map(h => h.price) : [];
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
        let ema = prices.slice(0, period).reduce((a,b) => a+b,0) / period;
        for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
        return ema;
    },

    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;

        if (!this.wsConnected) {
            this.showMessage('WebSocket not connected');
            return null;
        }

        const wsSym = info.wsSymbol;
        const currentPrice = this.lastPrices[wsSym];
        if (!currentPrice) {
            this.showMessage(`Waiting for first price tick for ${xmSymbol}...`);
            return null;
        }

        const prices = this.getPriceHistory(xmSymbol);
        let rsi = 50, ema20 = currentPrice, ema50 = currentPrice, ema200 = currentPrice;
        let support = currentPrice * 0.998, resistance = currentPrice * 1.002;
        let trend = 'SIDEWAYS', atr = currentPrice * 0.001, volatility = 0.3;

        if (prices.length >= 50) {
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
        } else {
            this.showMessage(`Collecting more data for ${xmSymbol} (${prices.length}/50)`);
        }

        return {
            currentPrice,
            prevClose: prices.length >= 2 ? prices[prices.length-2] : currentPrice,
            dailyChange: 0,
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
            _source: 'WebSocket (real‑time)'
        };
    },

    async fetchPriceForTracking(symbol) {
        const data = await this.fetch(symbol);
        return data ? data.currentPrice : null;
    },

    async fetchDXY() {
        return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
    }
};

// Start WebSocket automatically if key exists
if (MarketData.getTwelveKey()) {
    MarketData.initWebSocket();
}
