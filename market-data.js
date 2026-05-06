/**
 * MARKET DATA FETCHER - Multi-API Fallback
 * Priority: Alpha Vantage → Twelve Data → Binance → Yahoo
 */

const MarketData = {
    alphaKey: null,
    
    // Yahoo Finance symbol mapping (for fallback)
    yahooMap: {
        'XAUUSD': 'GC=F',
        'XAGUSD': 'SI=F',
        'OILCash': 'CL=F',
        'EURUSD': 'EURUSD=X',
        'GBPUSD': 'GBPUSD=X',
        'BTCUSD': 'BTC-USD',
        'ETHUSD': 'ETH-USD'
    },
    
    // Asset info per XM symbol
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
    
    async fetch(xmSymbol) {
        const info = this.assetInfo[xmSymbol] || { class: 'forex', spread: 0.0001, multiplier: 10000, name: xmSymbol, digits: 5 };
        
        // 1. Try Alpha Vantage (if key exists)
        if (this.getAlphaKey()) {
            try {
                const data = await this.fetchFromAlphaVantage(xmSymbol);
                if (data) return { ...data, ...info, xmSymbol: xmSymbol, _source: 'Alpha Vantage' };
            } catch(e) { console.log('Alpha Vantage failed', e); }
        }
        
        // 2. Try Twelve Data (no key needed)
        try {
            const data = await this.fetchFromTwelveData(xmSymbol);
            if (data) return { ...data, ...info, xmSymbol: xmSymbol, _source: 'Twelve Data' };
        } catch(e) { console.log('Twelve Data failed', e); }
        
        // 3. For crypto, try Binance
        if (info.class === 'crypto') {
            try {
                const data = await this.fetchFromBinance(xmSymbol);
                if (data) return { ...data, ...info, xmSymbol: xmSymbol, _source: 'Binance', _realtime: true };
            } catch(e) { console.log('Binance failed', e); }
        }
        
        // 4. Last resort: Yahoo Finance
        try {
            const data = await this.fetchFromYahoo(xmSymbol);
            if (data) return { ...data, ...info, xmSymbol: xmSymbol, _source: 'Yahoo (delayed)' };
        } catch(e) { console.log('Yahoo failed', e); }
        
        return null;
    },
    
    async fetchFromAlphaVantage(symbol) {
        const key = this.getAlphaKey();
        let functionName = 'CURRENCY_EXCHANGE_RATE';
        let fromCurr = symbol.slice(0,3);
        let toCurr = symbol.slice(3);
        if (symbol === 'XAUUSD') { functionName = 'QUOTE'; fromCurr = 'XAU'; toCurr = 'USD'; }
        if (symbol === 'XAGUSD') { functionName = 'QUOTE'; fromCurr = 'XAG'; toCurr = 'USD'; }
        if (symbol === 'OILCash') { functionName = 'QUOTE'; fromCurr = 'WTI'; toCurr = 'USD'; }
        
        let url;
        if (functionName === 'CURRENCY_EXCHANGE_RATE') {
            url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurr}&to_currency=${toCurr}&apikey=${key}`;
        } else {
            url = `https://www.alphavantage.co/query?function=QUOTE&symbol=${symbol}&apikey=${key}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        let price;
        if (data['Realtime Currency Exchange Rate']) price = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate']);
        else if (data['Global Quote']) price = parseFloat(data['Global Quote']['05. price']);
        else throw new Error('No price');
        
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
            volatility: 0.3
        };
    },
    
    async fetchFromTwelveData(symbol) {
        const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&outputsize=100&apikey=demo`);
        const data = await response.json();
        if (!data.values || data.values.length === 0) throw new Error();
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
            volatility: (this.calcATR(highs, lows, closes, 14) / current) * 100
        };
    },
    
    async fetchFromBinance(symbol) {
        let binSym = symbol === 'BTCUSD' ? 'BTCUSDT' : (symbol === 'ETHUSD' ? 'ETHUSDT' : null);
        if (!binSym) throw new Error();
        const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binSym}`);
        const data = await resp.json();
        if (data.code) throw new Error();
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
            volatility: this.calcATR(highs, lows, closes, 14) / price * 100
        };
    },
    
    async fetchFromYahoo(symbol) {
        const yahooSym = this.yahooMap[symbol] || symbol;
        const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1h&range=7d`);
        const data = await resp.json();
        const quotes = data.chart.result[0].indicators.quote[0];
        const closes = quotes.close.filter(c => c !== null);
        const highs = quotes.high.filter(h => h !== null);
        const lows = quotes.low.filter(l => l !== null);
        const current = closes[closes.length-1];
        return {
            currentPrice: current,
            prevClose: closes[closes.length-2] || current,
            dailyChange: ((current - closes[0])/closes[0])*100,
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
            volatility: this.calcATR(highs, lows, closes, 14)/current*100
        };
    },
    
    calcRSI(prices, period) {
        if (prices.length < period+1) return 50;
        let gains=0, losses=0;
        for(let i=prices.length-period; i<prices.length-1; i++) {
            let diff = prices[i+1]-prices[i];
            if(diff>0) gains+=diff; else losses-=diff;
        }
        let avgGain=gains/period, avgLoss=losses/period;
        if(avgLoss===0) return 100;
        let rs=avgGain/avgLoss;
        return 100-(100/(1+rs));
    },
    
    calcATR(highs, lows, closes, period) {
        if(highs.length<period) return (highs[highs.length-1]-lows[highs.length-1])/2;
        let trs=[];
        for(let i=highs.length-period; i<highs.length; i++) {
            let hl=highs[i]-lows[i];
            let hc=Math.abs(highs[i]-closes[i-1]);
            let lc=Math.abs(lows[i]-closes[i-1]);
            trs.push(Math.max(hl, hc, lc));
        }
        return trs.reduce((a,b)=>a+b,0)/period;
    },
    
    calcEMA(prices, period) {
        if(prices.length<period) return prices[prices.length-1];
        let k=2/(period+1);
        let ema=prices.slice(0,period).reduce((a,b)=>a+b,0)/period;
        for(let i=period; i<prices.length; i++) ema=prices[i]*k+ema*(1-k);
        return ema;
    },
    
    determineTrend(prices) {
        let ema20=this.calcEMA(prices,20);
        let ema50=this.calcEMA(prices,50);
        if(ema20>ema50) return 'BULLISH';
        if(ema20<ema50) return 'BEARISH';
        return 'SIDEWAYS';
    }
};
