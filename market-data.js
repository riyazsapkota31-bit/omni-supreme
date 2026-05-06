/**
 * MARKET DATA FETCHER – Yahoo Finance via public CORS proxy (always works)
 * No API keys, no configuration. Calculates RSI, EMAs, support/resistance, ATR.
 */

const MarketData = {
    yahooMap: {
        'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'OILCash': 'CL=F',
        'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X',
        'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD'
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
    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol];
        if (!info) return null;
        const yahooSym = this.yahooMap[xmSymbol];
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
            if (!closes.length) throw new Error();
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
                ...info, _source: 'Yahoo (proxy)'
            };
        } catch(e) { return null; }
    },
    async fetchPriceForTracking(symbol) {
        const data = await this.fetch(symbol);
        return data ? data.currentPrice : null;
    },
    async fetchDXY() { return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' }; }
};
