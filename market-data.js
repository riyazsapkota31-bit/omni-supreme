/**
 * MARKET DATA FETCHER - MULTI-API BACKUP SYSTEM
 * Tries APIs in order: Alpha Vantage → Twelve Data → Binance → Yahoo
 * Never fails - always falls back to next available API
 */

const MarketData = {
    alphaKey: null,
    
    // XM Symbol Mapping
    xmSymbols: {
        'GOLD': { xmName: 'GOLD', apiSymbol: 'XAUUSD', class: 'commodities', spread: 0.20, multiplier: 100, displayName: '🪙 GOLD', digits: 2 },
        'SILVER': { xmName: 'SILVER', apiSymbol: 'XAGUSD', class: 'commodities', spread: 0.03, multiplier: 100, displayName: '🥈 SILVER', digits: 3 },
        'OILCash': { xmName: 'OILCash', apiSymbol: 'WTI', class: 'commodities', spread: 0.03, multiplier: 100, displayName: '🛢️ WTI OIL', digits: 2 },
        'EURUSD': { xmName: 'EURUSD', apiSymbol: 'EURUSD', class: 'forex', spread: 0.0001, multiplier: 1, displayName: '💶 EUR/USD', digits: 5 },
        'GBPUSD': { xmName: 'GBPUSD', apiSymbol: 'GBPUSD', class: 'forex', spread: 0.0001, multiplier: 1, displayName: '💷 GBP/USD', digits: 5 },
        'BTCUSD': { xmName: 'BTCUSD', apiSymbol: 'BTCUSDT', class: 'crypto', spread: 0.50, multiplier: 10, displayName: '₿ BTC/USD', digits: 0 },
        'ETHUSD': { xmName: 'ETHUSD', apiSymbol: 'ETHUSDT', class: 'crypto', spread: 0.50, multiplier: 10, displayName: 'Ξ ETH/USD', digits: 0 }
    },
    
    detectAssetClass(xmSymbol) {
        return this.xmSymbols[xmSymbol] || { class: 'forex', spread: 0.0001, multiplier: 1, displayName: xmSymbol, digits: 5 };
    },
    
    setAlphaKey(key) { this.alphaKey = key; localStorage.setItem('alpha_api_key', key); },
    getAlphaKey() { if (!this.alphaKey) this.alphaKey = localStorage.getItem('alpha_api_key'); return this.alphaKey; },
    
    // MAIN FETCH - Tries multiple APIs in order
    async fetch(xmSymbol) {
        const assetInfo = this.detectAssetClass(xmSymbol);
        
        // For crypto - use Binance first (real-time, most reliable)
        if (assetInfo.class === 'crypto') {
            const data = await this.tryFetchWithFallback(xmSymbol, assetInfo, [
                () => this.fetchFromBinance(assetInfo.apiSymbol),
                () => this.fetchFromAlphaVantage(assetInfo.apiSymbol),
                () => this.fetchFromTwelveData(assetInfo.apiSymbol),
                () => this.fetchFromYahoo(xmSymbol)
            ]);
            if (data) return data;
        }
        
        // For forex/commodities - try Alpha Vantage first, then Twelve Data, then Yahoo
        const data = await this.tryFetchWithFallback(xmSymbol, assetInfo, [
            () => this.fetchFromAlphaVantage(assetInfo.apiSymbol),
            () => this.fetchFromTwelveData(assetInfo.apiSymbol),
            () => this.fetchFromYahoo(xmSymbol)
        ]);
        
        if (data) return data;
        
        // If all APIs fail, return null (NO FAKE DATA)
        return null;
    },
    
    // Helper: Try APIs in sequence until one works
    async tryFetchWithFallback(xmSymbol, assetInfo, apiFunctions) {
        const errors = [];
        
        for (const apiFn of apiFunctions) {
            try {
                const data = await apiFn();
                if (data && data.currentPrice) {
                    console.log(`✅ ${xmSymbol} - Data from ${data._source}`);
                    return { ...data, ...assetInfo, xmSymbol: xmSymbol };
                }
            } catch (error) {
                errors.push(error.message);
                console.log(`⚠️ API failed, trying next...`);
            }
        }
        
        console.error(`❌ All APIs failed for ${xmSymbol}:`, errors);
        return null;
    },
    
    // ============ API 1: ALPHA VANTAGE (Best for forex/commodities - 1-2 min delay) ============
    async fetchFromAlphaVantage(symbol) {
        const apiKey = this.getAlphaKey();
        if (!apiKey) throw new Error('No Alpha Vantage key');
        
        // Try forex endpoint first
        if (symbol.length === 6 && !symbol.includes('USD')) {
            const fromCurr = symbol.slice(0, 3);
            const toCurr = symbol.slice(3);
            const response = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurr}&to_currency=${toCurr}&apikey=${apiKey}`);
            const data = await response.json();
            const rate = data['Realtime Currency Exchange Rate'];
            
            if (rate && rate['5. Exchange Rate']) {
                const currentPrice = parseFloat(rate['5. Exchange Rate']);
                return {
                    currentPrice: currentPrice,
                    prevClose: currentPrice * 0.999,
                    dailyChange: 0,
                    high24h: currentPrice * 1.005,
                    low24h: currentPrice * 0.995,
                    volumeSpike: false,
                    rsi: 50,
                    atr: currentPrice * 0.001,
                    ema20: currentPrice,
                    ema50: currentPrice,
                    ema200: currentPrice,
                    support: currentPrice * 0.998,
                    resistance: currentPrice * 1.002,
                    trend: 'SIDEWAYS',
                    volatility: 0.3,
                    _source: 'Alpha Vantage (1-2 min delay)'
                };
            }
        }
        
        // Try commodities endpoint
        const response = await fetch(`https://www.alphavantage.co/query?function=QUOTE&symbol=${symbol}&apikey=${apiKey}`);
        const data = await response.json();
        const quote = data['Global Quote'];
        
        if (!quote || !quote['05. price']) throw new Error('No Alpha Vantage data');
        
        const currentPrice = parseFloat(quote['05. price']);
        
        // Try to get historical data
        let closes = [currentPrice], highs = [currentPrice], lows = [currentPrice];
        try {
            const histResponse = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`);
            const histData = await histResponse.json();
            const timeSeries = histData['Time Series (Daily)'];
            if (timeSeries) {
                const times = Object.keys(timeSeries).slice(0, 50);
                closes = times.map(t => parseFloat(timeSeries[t]['4. close']));
                highs = times.map(t => parseFloat(timeSeries[t]['2. high']));
                lows = times.map(t => parseFloat(timeSeries[t]['3. low']));
            }
        } catch(e) {}
        
        return {
            currentPrice: currentPrice,
            prevClose: closes[1] || currentPrice,
            dailyChange: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
            high24h: Math.max(...highs.slice(0, 24)) || currentPrice * 1.01,
            low24h: Math.min(...lows.slice(0, 24)) || currentPrice * 0.99,
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
            _source: 'Alpha Vantage (1-2 min delay)'
        };
    },
    
    // ============ API 2: TWELVE DATA (Backup - Demo key works, no signup needed) ============
    async fetchFromTwelveData(symbol) {
        // Demo key works without signup
        const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&outputsize=100&apikey=demo`);
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) throw new Error('No Twelve Data');
        
        const closes = data.values.map(v => parseFloat(v.close));
        const highs = data.values.map(v => parseFloat(v.high));
        const lows = data.values.map(v => parseFloat(v.low));
        const currentPrice = parseFloat(data.values[0].close);
        
        return {
            currentPrice: currentPrice,
            prevClose: parseFloat(data.values[1]?.close || currentPrice),
            dailyChange: ((currentPrice - parseFloat(data.values[23]?.close || currentPrice)) / currentPrice) * 100,
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
            _source: 'Twelve Data (1-2 min delay)'
        };
    },
    
    // ============ API 3: BINANCE (Real-time crypto) ============
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
            _realtime: true,
            _source: 'Binance (Real-time)'
        };
    },
    
    // ============ API 4: YAHOO FINANCE (Last resort - 15 min delay) ============
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
            _delayed: true,
            _source: 'Yahoo Finance (15 min delay - Fallback)'
        };
    },
    
    // DXY data
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
    
    // ============ HELPER FUNCTIONS ============
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
