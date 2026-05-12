const StrategyEngine = {
    marketFilters: {
        isHighImpactNews: (ts) => { const h = new Date(ts).getUTCHours(); return (h>=8 && h<=10) || (h>=13 && h<=15); },
        isVolatilityAcceptable: (atr, price) => (atr/price)*100 < 1.5 && (atr/price)*100 > 0.2,
        isSpreadAcceptable: (spread, price, cls) => ((spread/price)*100) < (cls==='forex' ? 0.05 : cls==='commodities' ? 0.1 : 0.2),
        getTrend: (d) => {
            if (d.ema20 > d.ema50 && d.ema50 > d.ema200) return 'BULLISH';
            if (d.ema20 < d.ema50 && d.ema50 < d.ema200) return 'BEARISH';
            return 'SIDEWAYS';
        },
        isChoppy: (d) => Math.abs(d.ema20 - d.ema50) / d.currentPrice < 0.001
    },

    // Smart Money: Liquidity Sweep Detection
    detectLiquiditySweep(data) {
        const candles = data.candles || [];
        if (!candles || candles.length < 3) return { signal: null, strength: 0 };
        
        const lastCandle = candles[candles.length - 1];
        const recentHighs = Math.max(...candles.slice(-20).map(c => c.high));
        const recentLows = Math.min(...candles.slice(-20).map(c => c.low));
        
        const upperSweep = lastCandle.high > recentHighs && lastCandle.close < recentHighs;
        const lowerSweep = lastCandle.low < recentLows && lastCandle.close > recentLows;
        
        if (upperSweep) return { signal: 'SELL', strength: 70, reason: 'Liquidity sweep (upper)' };
        if (lowerSweep) return { signal: 'BUY', strength: 70, reason: 'Liquidity sweep (lower)' };
        return { signal: null, strength: 0 };
    },

    // Smart Money: Fair Value Gap Detection
    detectFairValueGap(data) {
        const candles = data.candles || [];
        if (!candles || candles.length < 3) return { signal: null, strength: 0 };
        
        const c1 = candles[candles.length - 3];
        const c2 = candles[candles.length - 2];
        const c3 = candles[candles.length - 1];
        
        const bullishFVG = c1.high < c3.low && c2.close > c1.high;
        const bearishFVG = c3.high < c1.low && c2.close < c1.low;
        
        if (bullishFVG) return { signal: 'BUY', strength: 65, reason: 'Fair Value Gap (bullish)' };
        if (bearishFVG) return { signal: 'SELL', strength: 65, reason: 'Fair Value Gap (bearish)' };
        return { signal: null, strength: 0 };
    },

    // Smart Money: Break & Retest Detection
    detectBreakRetest(data) {
        const { currentPrice, support, resistance, candles } = data;
        if (!candles || candles.length < 5) return { signal: null, strength: 0 };
        
        const recentCandles = candles.slice(-5);
        const brokeResistance = recentCandles.some(c => c.close > resistance);
        const retestedResistance = Math.abs(currentPrice - resistance) / currentPrice * 100 < 0.1;
        const brokeSupport = recentCandles.some(c => c.close < support);
        const retestedSupport = Math.abs(currentPrice - support) / currentPrice * 100 < 0.1;
        
        if (brokeResistance && retestedResistance) return { signal: 'BUY', strength: 60, reason: 'Break & retest (resistance)' };
        if (brokeSupport && retestedSupport) return { signal: 'SELL', strength: 60, reason: 'Break & retest (support)' };
        return { signal: null, strength: 0 };
    },

    detectRSIDivergence(data) {
        const { rsi, currentPrice, prevPrice } = data;
        const priceHigher = currentPrice > prevPrice;
        const rsiHigher = rsi > 50;
        if (!priceHigher && rsiHigher) return { signal: 'BUY', strength: 85, reason: 'Bullish RSI divergence' };
        if (priceHigher && !rsiHigher) return { signal: 'SELL', strength: 85, reason: 'Bearish RSI divergence' };
        return { signal: null, strength: 0 };
    },

    detectEMAPullback(data) {
        const { currentPrice, ema20, ema50, trend, volumeSpike } = data;
        const dist = Math.abs(currentPrice - ema20) / currentPrice * 100;
        if (trend === 'BULLISH' && currentPrice < ema20 && currentPrice > ema50 && dist < 0.3 && volumeSpike)
            return { signal: 'BUY', strength: 75, reason: 'Bullish EMA pullback' };
        if (trend === 'BEARISH' && currentPrice > ema20 && currentPrice < ema50 && dist < 0.3 && volumeSpike)
            return { signal: 'SELL', strength: 75, reason: 'Bearish EMA pullback' };
        return { signal: null, strength: 0 };
    },

    detectSupportResistanceBounce(data) {
        const { currentPrice, support, resistance, atr, rsi } = data;
        const atrPerc = atr / currentPrice * 100;
        const nearSupport = Math.abs(currentPrice - support) / currentPrice * 100 < atrPerc * 0.5;
        const nearResistance = Math.abs(currentPrice - resistance) / currentPrice * 100 < atrPerc * 0.5;
        if (nearSupport && rsi < 50) return { signal: 'BUY', strength: 80, reason: 'Bounce from support' };
        if (nearResistance && rsi > 50) return { signal: 'SELL', strength: 80, reason: 'Rejection from resistance' };
        return { signal: null, strength: 0 };
    },

    detectVolumeConfirmation(data) {
        if (!data.volumeSpike) return { signal: null, strength: 0 };
        const { currentPrice, support, resistance } = data;
        if (currentPrice > resistance * 0.995) return { signal: 'BUY', strength: 70, reason: 'Volume breakout' };
        if (currentPrice < support * 1.005) return { signal: 'SELL', strength: 70, reason: 'Volume breakdown' };
        return { signal: null, strength: 0 };
    },

    detectFVG(data) {
        const { currentPrice, ema20, ema50, volumeSpike } = data;
        const gap = Math.abs(ema20 - ema50) / ema50 * 100;
        if (gap > 0.1 && gap < 0.5 && volumeSpike) {
            if (ema20 > ema50 && currentPrice < ema50) return { signal: 'BUY', strength: 70, reason: 'FVG' };
            if (ema20 < ema50 && currentPrice > ema50) return { signal: 'SELL', strength: 70, reason: 'FVG' };
        }
        return { signal: null, strength: 0 };
    },

    shouldTrade(marketData, mode) {
        const f = this.marketFilters;
        if (f.isChoppy(marketData)) return { allowed: false, reason: 'Market choppy' };
        if (f.isHighImpactNews(Date.now())) return { allowed: false, reason: 'News event' };
        if (!f.isVolatilityAcceptable(marketData.atr, marketData.currentPrice)) return { allowed: false, reason: 'Volatility too high' };
        if (!f.isSpreadAcceptable(marketData.spread, marketData.currentPrice, marketData.class)) return { allowed: false, reason: 'Wide spread' };
        const trend = f.getTrend(marketData);
        if (mode === 'day' && trend === 'SIDEWAYS') return { allowed: false, reason: 'Sideways market' };
        return { allowed: true, reason: 'Filters passed' };
    },

    async analyze(marketData, mode, config) {
        const filter = this.shouldTrade(marketData, mode);
        if (!filter.allowed) return { bias: 'WAIT', confidence: 40, primaryStrategy: 'Market Filter', reasons: [filter.reason] };

        const candles = marketData.candles || [];
        const recentHighs = candles.length >= 20 ? Math.max(...candles.slice(-20).map(c => c.high)) : marketData.resistance;
        const recentLows = candles.length >= 20 ? Math.min(...candles.slice(-20).map(c => c.low)) : marketData.support;

        const extendedData = {
            ...marketData,
            candles,
            recentHighs,
            recentLows
        };

        const signals = [
            this.detectRSIDivergence(extendedData),
            this.detectEMAPullback(extendedData),
            this.detectSupportResistanceBounce(extendedData),
            this.detectVolumeConfirmation(extendedData),
            this.detectFVG(extendedData),
            this.detectLiquiditySweep(extendedData),
            this.detectFairValueGap(extendedData),
            this.detectBreakRetest(extendedData)
        ];
        
        let buyScore = 0, sellScore = 0, reasons = [];
        for (const s of signals) {
            if (s.signal === 'BUY') { buyScore += s.strength; reasons.push(s.reason); }
            else if (s.signal === 'SELL') { sellScore += s.strength; reasons.push(s.reason); }
        }
        
        const trend = this.marketFilters.getTrend(marketData);
        if (trend === 'BULLISH') buyScore += 15;
        if (trend === 'BEARISH') sellScore += 15;

        let bias = 'WAIT', confidence = 50;
        
        if (buyScore > 90 && buyScore > sellScore) {
            bias = 'BUY';
            confidence = Math.min(85, 50 + Math.floor(buyScore / 3));
        } else if (sellScore > 90 && sellScore > buyScore) {
            bias = 'SELL';
            confidence = Math.min(85, 50 + Math.floor(sellScore / 3));
        }
        
        const minConf = (mode === 'scalp') ? 55 : 65;
        if (confidence < minConf) { bias = 'WAIT'; confidence = 50; }

        if (config.dxyData && marketData.symbol && marketData.symbol.includes('USD')) {
            const dxyStrong = config.dxyData.dxyStrength === 'STRONG';
            const dxyWeak = config.dxyData.dxyStrength === 'WEAK';
            if ((bias === 'BUY' && dxyStrong) || (bias === 'SELL' && dxyWeak)) {
                bias = 'WAIT';
                confidence = 40;
            }
        }
        return { bias, confidence, primaryStrategy: (bias!=='WAIT')?reasons.slice(0,2).join('+'):'No confluence', reasons };
    }
};
