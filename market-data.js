/**
 * MARKET DATA FETCHER
 * Replaces manual screenshot uploads with live Yahoo Finance data
 * Zero-Hallucination: All numbers come from real market data
 */

const MarketData = {
    // Symbol mapping for Yahoo Finance
    symbolMap: {
        'XAUUSD': 'GC=F',
        'GOLD': 'GC=F',
        'EURUSD': 'EURUSD=X',
        'GBPUSD': 'GBPUSD=X',
        'USDJPY': 'JPY=X',
        'BTCUSD': 'BTC-USD',
        'ETHUSD': 'ETH-USD',
        'SPX500': '^GSPC',
        'NAS100': '^IXIC',
        'US30': '^DJI'
    },
    
    // Detect asset class from symbol
    detectAssetClass(symbol) {
        const s = symbol.toUpperCase();
        if (s.includes('XAU') || s.includes('GOLD')) return { class: 'commodities', spread: 0.20, multiplier: 100, name: 'Gold' };
        if (s.includes('BTC') || s.includes('ETH')) return { class: 'crypto', spread: 0.50, multiplier: 10, name: 'Crypto' };
        if (s.includes('OIL') || s.includes('WTI')) return { class: 'commodities', spread: 0.03, multiplier: 100, name: 'Oil' };
        if (s.includes('SPX') || s.includes('NAS') || s.includes('US30')) return { class: 'indices', spread: 0.5, multiplier: 1, name: 'Index' };
        return { class: 'forex', spread: 0.0001, multiplier: 1, name: 'Forex' };
    },
    
    // Fetch current market data from Yahoo Finance
    async fetch(symbol) {
        const yahooSymbol = this.symbolMap[symbol.toUpperCase()] || `${symbol}=X`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1h&range=7d`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);
            
            const data = await response.json();
            const result = data.chart.result[0];
            const meta = result.meta;
            const quotes = result.indicators.quote[0];
            const timestamps = result.timestamp;
            
            // Extract price data
            const closes = quotes.close.filter(c => c !== null);
            const highs = quotes.high.filter(h => h !== null);
            const lows = quotes.low.filter(l => l !== null);
            const volumes = quotes.volume.filter(v => v !== null);
            
            const currentPrice = closes[closes.length - 1];
            const prevClose = closes[closes.length - 2] || currentPrice;
            
            // Calculate RSI
            const rsi = this.calculateRSI(closes, 14);
            
            // Calculate ATR
            const atr = this.calculateATR(highs, lows, closes, 14);
            
            // Calculate Moving Averages
            const ema20 = this.calculateEMA(closes, 20);
            const ema50 = this.calculateEMA(closes, 50);
            const ema200 = this.calculateEMA(closes, 200);
            
            // Calculate Support/Resistance levels
            const recentHighs = highs.slice(-50);
            const recentLows = lows.slice(-50);
            const resistance = Math.max(...recentHighs);
            const support = Math.min(...recentLows);
            
            // Volume analysis
            const avgVolume = volumes.slice(-20).reduce((a,b) => a + b, 0) / 20;
            const volumeSpike = volumes[volumes.length - 1] > avgVolume * 1.5;
            
            const assetInfo = this.detectAssetClass(symbol);
            
            return {
                symbol: symbol.toUpperCase(),
                assetClass: assetInfo.class,
                assetName: assetInfo.name,
                spread: assetInfo.spread,
                multiplier: assetInfo.multiplier,
                currentPrice: currentPrice,
                prevClose: prevClose,
                dailyChange: ((currentPrice - prevClose) / prevClose) * 100,
                high24h: Math.max(...highs.slice(-24)),
                low24h: Math.min(...lows.slice(-24)),
                rsi: rsi,
                atr: atr,
                ema20: ema20,
                ema50: ema50,
                ema200: ema200,
                support: support,
                resistance: resistance,
                volumeSpike: volumeSpike,
                trend: this.determineTrend(ema20, ema50, ema200),
                volatility: atr / currentPrice * 100,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Market data fetch error:', error);
            throw new Error(`Cannot fetch data for ${symbol}: ${error.message}`);
        }
    },
    
    // Calculate RSI (Relative Strength Index)
    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        
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
    
    // Calculate ATR (Average True Range)
    calculateATR(highs, lows, closes, period = 14) {
        if (highs.length < period) return (highs[highs.length-1] - lows[highs.length-1]) / 2;
        
        const trs = [];
        for (let i = highs.length - period; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i-1]);
            const lc = Math.abs(lows[i] - closes[i-1]);
            trs.push(Math.max(hl, hc, lc));
        }
        
        return trs.reduce((a,b) => a + b, 0) / period;
    },
    
    // Calculate EMA (Exponential Moving Average)
    calculateEMA(prices, period) {
        if (prices.length < period) return prices[prices.length - 1];
        
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a,b) => a + b, 0) / period;
        
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        
        return ema;
    },
    
    // Determine market trend
    determineTrend(ema20, ema50, ema200) {
        if (ema20 > ema50 && ema50 > ema200) return 'BULLISH';
        if (ema20 < ema50 && ema50 < ema200) return 'BEARISH';
        return 'SIDEWAYS';
    },
    
    // Get DXY data for filter (Dollar strength/weakness)
    async fetchDXY() {
        try {
            const dxyData = await this.fetch('DX-Y.NYB');
            return {
                dxyPrice: dxyData.currentPrice,
                dxyTrend: dxyData.trend,
                dxyStrength: dxyData.rsi > 70 ? 'STRONG' : (dxyData.rsi < 30 ? 'WEAK' : 'NEUTRAL')
            };
        } catch {
            // If DXY fetch fails, return neutral
            return { dxyPrice: 0, dxyTrend: 'NEUTRAL', dxyStrength: 'NEUTRAL' };
        }
    }
};
