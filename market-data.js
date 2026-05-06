/**
 * MARKET DATA FETCHER - OANDA + Binance + Alpha Vantage
 * Real-time for forex, gold, silver | 1-2 min for oil
 */

const MarketData = {
    oandaApiKey: null,
    
    xmSymbols: {
        'GOLD': { xmName: 'GOLD', apiSource: 'oanda', apiSymbol: 'XAU_USD', class: 'commodities', spread: 0.20, multiplier: 100, displayName: '🪙 GOLD', digits: 2 },
        'SILVER': { xmName: 'SILVER', apiSource: 'oanda', apiSymbol: 'XAG_USD', class: 'commodities', spread: 0.03, multiplier: 100, displayName: '🥈 SILVER', digits: 3 },
        'OILCash': { xmName: 'OILCash', apiSource: 'alpha', apiSymbol: 'WTI', class: 'commodities', spread: 0.03, multiplier: 100, displayName: '🛢️ WTI OIL', digits: 2 },
        'EURUSD': { xmName: 'EURUSD', apiSource: 'oanda', apiSymbol: 'EUR_USD', class: 'forex', spread: 0.0001, multiplier: 1, displayName: '💶 EUR/USD', digits: 5 },
        'GBPUSD': { xmName: 'GBPUSD', apiSource: 'oanda', apiSymbol: 'GBP_USD', class: 'forex', spread: 0.0001, multiplier: 1, displayName: '💷 GBP/USD', digits: 5 },
        'BTCUSD': { xmName: 'BTCUSD', apiSource: 'binance', apiSymbol: 'BTCUSDT', class: 'crypto', spread: 0.50, multiplier: 10, displayName: '₿ BTC/USD', digits: 0 },
        'ETHUSD': { xmName: 'ETHUSD', apiSource: 'binance', apiSymbol: 'ETHUSDT', class: 'crypto', spread: 0.50, multiplier: 10, displayName: 'Ξ ETH/USD', digits: 0 }
    },
    
    detectAssetClass(xmSymbol) {
        return this.xmSymbols[xmSymbol] || { class: 'forex', spread: 0.0001, multiplier: 1, displayName: xmSymbol, digits: 5 };
    },
    
    setOandaKey(key) { this.oandaApiKey = key; localStorage.setItem('oanda_api_key', key); },
    getOandaKey() { if (!this.oandaApiKey) this.oandaApiKey = localStorage.getItem('oanda_api_key'); return this.oandaApiKey; },
    
    async fetch(xmSymbol) {
        const assetInfo = this.detectAssetClass(xmSymbol);
        
        if (assetInfo.apiSource === 'binance') {
            const data = await this.fetchFromBinance(assetInfo.apiSymbol);
            if (data) return { ...data, ...assetInfo, xmSymbol: xmSymbol };
        }
        
        if (assetInfo.apiSource === 'oanda') {
            const data = await this.fetchFromOanda(assetInfo.apiSymbol);
            if (data) return { ...data, ...assetInfo, xmSymbol: xmSymbol };
        }
        
        if (assetInfo.apiSource === 'alpha') {
            const data = await this.fetchFromAlphaVantage(assetInfo.apiSymbol);
            if (data) return { ...data, ...assetInfo, xmSymbol: xmSymbol };
        }
        
        const data = await this.fetchFromYahoo(xmSymbol);
        if (data) return { ...data, ...assetInfo, xmSymbol: xmSymbol, _delayed: true };
        
        return null;
    },
    
    async fetchFromOanda(symbol) {
        const apiKey = this.getOandaKey();
        if (!apiKey) throw new Error('OANDA API key missing');
        
        const response = await fetch(`https://api-fxtrade.oanda.com/v3/accounts?instruments=${symbol}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!response.ok) throw new Error(`OANDA error: ${response.status}`);
        
        const data = await response.json();
        const price = data.prices?.[0];
        if (!price) throw new Error('No price data');
        
        const currentPrice = (parseFloat(price.bids[0].price) + parseFloat(price.asks[0].price)) / 2;
        
        let closes = [currentPrice], highs = [currentPrice], lows = [currentPrice];
        try {
            const histData = await this.fetchFromAlphaVantage(symbol.replace('_', ''));
            if (histData) { closes = histData._closes || [currentPrice]; highs = histData._highs || [currentPrice]; lows = histData._lows || [currentPrice]; }
        } catch(e) {}
        
        return {
            currentPrice: currentPrice,
            prevClose: closes[closes.length - 2] || currentPrice,
            dailyChange: 0,
            high24h: Math.max(...highs.slice(-24)),
            low24h: Math.min(...lows.slice(-24)),
            volumeSpike: false,
            rsi: this.calculateRSI(closes, 14),
            atr: this.calculateATR(highs, lows, closes, 14),
            ema20: this.calculateEMA(closes, 20),
            ema50: this.calculateEMA(closes, 50),
            ema200: this.calculateEMA(closes, 200),
            support: Math.min(...lows.slice(-50)),
            resistance: Math.max(...highs.slice(-50)),
            trend: this.determineTrend(closes),
            volatility: this.calculateATR(highs, lows, closes, 14) / currentPrice * 100,
            _realtime: true, _source: 'OANDA'
        };
    },
    
    async fetchFromBinance(symbol) {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.code) throw new Error(data.msg);
        
        const klines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
        const klineData = await klines.json();
        const closes = klineData.map(c => parseFloat(c[4]));
        const highs = klineData.map(c => parseFloat(c[2]));
        const lows = klineData.map(c => parseFloat(c[3]));
        
        return {
            currentPrice: parseFloat(data.lastPrice),
            prevClose: parseFloat(data.prevClosePrice),
            dailyChange: parseFloat(data.priceChangePercent),
            high24h: parseFloat(data.highPrice),
            low24h: parseFloat(data.lowPrice),
            volumeSpike: parseFloat(data.volume) > parseFloat(data.quoteVolume) / 2,
            rsi: this.calculateRSI(closes, 14),
            atr: this.calculateATR(highs, lows, closes, 14),
            ema20: this.calculateEMA(closes, 20),
            ema50: this.calculateEMA(closes, 50),
            ema200: this.calculateEMA(closes, 200),
            support: Math.min(...lows.slice(-50)),
            resistance: Math.max(...highs.slice(-50)),
            trend: this.determineTrend(closes),
            volatility: this.calculateATR(highs, lows, closes, 14) / parseFloat(data.lastPrice) * 100,
            _realtime: true, _source: 'Binance'
        };
    },
    
    async fetchFromAlphaVantage(symbol) {
        let alphaSymbol = symbol === 'WTI' ? 'WTI' : symbol;
        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${alphaSymbol}&interval=60min&apikey=demo&outputsize=compact`);
        const data = await response.json();
        const timeSeries = data['Time Series (60min)'];
        if (!timeSeries) throw new Error('No Alpha Vantage data');
        
        const times = Object.keys(timeSeries).sort().reverse();
        const closes = times.map(t => parseFloat(timeSeries[t]['4. close']));
        const highs = times.map(t => parseFloat(timeSeries[t]['2. high']));
        const lows = times.map(t => parseFloat(timeSeries[t]['3. low']));
        const currentPrice = closes[0];
        
        return {
            currentPrice: currentPrice,
            prevClose: closes[1] || currentPrice,
            dailyChange: ((currentPrice - closes[23]) / currentPrice) * 100,
            high24h: Math.max(...highs.slice(0, 24)),
            low24h: Math.min(...lows.slice(0, 24)),
            volumeSpike: false,
            rsi: this.calculateRSI(closes, 14),
            atr: this.calculateATR(highs, lows, closes, 14),
            ema20: this.calculateEMA(closes, 20),
            ema50: this.calculateEMA(closes, 50),
            ema200: this.calculateEMA(closes, 200),
            support: Math.min(...lows.slice(0, 50)),
            resistance: Math.max(...highs.slice(0, 50)),
            trend: this.determineTrend(closes),
            volatility: this.calculateATR(highs, lows, closes, 14) / currentPrice * 100,
            _closes: closes, _highs: highs, _lows: lows, _source: 'Alpha Vantage'
        };
    },
    
    async fetchFromYahoo(symbol) {
        const yahooMap = { 'GOLD': 'GC=F', 'SILVER': 'SI=F', 'OILCash': 'CL=F', 'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD' };
        const yahooSymbol = yahooMap[symbol] || symbol;
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1h&range=7d`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.chart?.result?.[0]) throw new Error('No Yahoo data');
        
        const quotes = data.chart.result[0].indicators.quote[0];
        const closes = quotes.close.filter(c => c !== null);
        const highs = quotes.high.filter(h => h !== null);
        const lows = quotes.low.filter(l => l !== null);
        const currentPrice = closes[closes.length - 1];
        
        return {
            currentPrice: currentPrice,
            prevClose: closes[closes.length - 2] || currentPrice,
            dailyChange: ((currentPrice - closes[0]) / closes[0]) * 100,
            high24h: Math.max(...highs.slice(-24)),
            low24h: Math.min(...lows.slice(-24)),
            volumeSpike: false,
            rsi: this.calculateRSI(closes, 14),
            atr: this.calculateATR(highs, lows, closes, 14),
            ema20: this.calculateEMA(closes, 20),
            ema50: this.calculateEMA(closes, 50),
            ema200: this.calculateEMA(closes, 200),
            support: Math.min(...lows.slice(-50)),
            resistance: Math.max(...highs.slice(-50)),
            trend: this.determineTrend(closes),
            volatility: this.calculateATR(highs, lows, closes, 14) / currentPrice * 100,
            _delayed: true, _source: 'Yahoo (delayed)'
        };
    },
    
    async fetchDXY() {
        try {
            const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1h&range=5d');
            const data = await response.json();
            const quotes = data.chart.result[0].indicators.quote[0];
            const closes = quotes.close.filter(c => c !== null);
            const rsi = this.calculateRSI(closes, 14);
            return { dxyPrice: closes[closes.length - 1], dxyTrend: rsi > 70 ? 'STRONG' : (rsi < 30 ? 'WEAK' : 'NEUTRAL'), dxyStrength: rsi > 70 ? 'STRONG' : (rsi < 30 ? 'WEAK' : 'NEUTRAL') };
        } catch { return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' }; }
    },
    
    calculateRSI(prices, period) {
        if (!prices || prices.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length - 1; i++) {
            const diff = prices[i + 1] - prices[i];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },
    
    calculateATR(highs, lows, closes, period) {
        if (!highs || highs.length < period) return 0.001;
        const trs = [];
        for (let i = highs.length - period; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i-1]);
            const lc = Math.abs(lows[i] - closes[i-1]);
            trs.push(Math.max(hl, hc, lc));
        }
        return trs.reduce((a,b) => a + b, 0) / period;
    },
    
    calculateEMA(prices, period) {
        if (!prices || prices.length < period) return prices?.[prices.length-1] || 1;
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a,b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
        return ema;
    },
    
    determineTrend(closes) {
        if (!closes || closes.length < 50) return 'SIDEWAYS';
        const ema20 = this.calculateEMA(closes, 20);
        const ema50 = this.calculateEMA(closes, 50);
        if (ema20 > ema50) return 'BULLISH';
        if (ema20 < ema50) return 'BEARISH';
        return 'SIDEWAYS';
    }
};
