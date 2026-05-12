// strategy-engine.js – Full Smart Money System (BOS/CHoCH, Order Blocks, OTE, Session Timing, Liquidity Sweep, FVG)

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

    // ========== SESSION TIMING ==========
    getCurrentSession() {
        const now = new Date();
        const utcHour = now.getUTCHours();
        
        // London Session: 7:00 - 16:00 UTC
        if (utcHour >= 7 && utcHour < 16) return 'LONDON';
        // New York Session: 12:00 - 20:00 UTC
        if (utcHour >= 12 && utcHour < 20) return 'NEW_YORK';
        // Tokyo Session: 23:00 - 8:00 UTC
        if (utcHour >= 23 || utcHour < 8) return 'TOKYO';
        // Asian Session: 23:00 - 7:00 UTC
        if (utcHour >= 0 && utcHour < 7) return 'ASIAN';
        return 'OFF_HOURS';
    },

    // ========== MARKET STRUCTURE (BOS/CHoCH) ==========
    detectMarketStructure(candles) {
        if (!candles || candles.length < 20) return { structure: 'UNKNOWN', bos: null, choch: null };
        
        // Find swing highs and lows
        const swingHighs = [];
        const swingLows = [];
        
        for (let i = 5; i < candles.length - 5; i++) {
            const isSwingHigh = candles[i].high > candles[i-1].high && candles[i].high > candles[i-2].high &&
                                candles[i].high > candles[i+1].high && candles[i].high > candles[i+2].high;
            const isSwingLow = candles[i].low < candles[i-1].low && candles[i].low < candles[i-2].low &&
                               candles[i].low < candles[i+1].low && candles[i].low < candles[i+2].low;
            
            if (isSwingHigh) swingHighs.push({ index: i, price: candles[i].high });
            if (isSwingLow) swingLows.push({ index: i, price: candles[i].low });
        }
        
        if (swingHighs.length < 2 || swingLows.length < 2) return { structure: 'UNKNOWN', bos: null, choch: null };
        
        const lastSwingHigh = swingHighs[swingHighs.length - 1];
        const prevSwingHigh = swingHighs[swingHighs.length - 2];
        const lastSwingLow = swingLows[swingLows.length - 1];
        const prevSwingLow = swingLows[swingLows.length - 2];
        
        // Detect BOS (Break of Structure)
        let bos = null;
        let choch = null;
        
        // Bullish BOS: price breaks above previous swing high
        if (lastSwingHigh.price > prevSwingHigh.price) {
            bos = { direction: 'BULLISH', price: lastSwingHigh.price };
        }
        // Bearish BOS: price breaks below previous swing low
        if (lastSwingLow.price < prevSwingLow.price) {
            bos = { direction: 'BEARISH', price: lastSwingLow.price };
        }
        
        // Detect CHoCH (Change of Character) - when BOS happens after trend change
        const lastCandle = candles[candles.length - 1];
        if (bos && bos.direction === 'BULLISH' && lastCandle.close > prevSwingHigh.price) {
            choch = { direction: 'BULLISH_CHOCH', price: lastCandle.close };
        }
        if (bos && bos.direction === 'BEARISH' && lastCandle.close < prevSwingLow.price) {
            choch = { direction: 'BEARISH_CHOCH', price: lastCandle.close };
        }
        
        return { structure: bos ? (bos.direction === 'BULLISH' ? 'UPTREND' : 'DOWNTREND') : 'CONSOLIDATION', bos, choch };
    },

    // ========== ORDER BLOCKS ==========
    detectOrderBlock(candles) {
        if (!candles || candles.length < 3) return { signal: null, strength: 0 };
        
        const lastCandle = candles[candles.length - 1];
        const prevCandle = candles[candles.length - 2];
        const prevPrevCandle = candles[candles.length - 3];
        
        // Bullish Order Block: Last bearish candle before a strong bullish move
        const isBullishOB = prevCandle.close < prevCandle.open && // Bearish candle
                            lastCandle.close > lastCandle.open && // Current candle bullish
                            lastCandle.close > prevCandle.high; // Strong move up
        
        // Bearish Order Block: Last bullish candle before a strong bearish move
        const isBearishOB = prevCandle.close > prevCandle.open && // Bullish candle
                            lastCandle.close < lastCandle.open && // Current candle bearish
                            lastCandle.close < prevCandle.low; // Strong move down
        
        if (isBullishOB) {
            const entry = prevCandle.low;
            return { signal: 'BUY', strength: 72, reason: 'Order Block (bullish)', entry, stopLoss: entry - (prevCandle.high - prevCandle.low) };
        }
        if (isBearishOB) {
            const entry = prevCandle.high;
            return { signal: 'SELL', strength: 72, reason: 'Order Block (bearish)', entry, stopLoss: entry + (prevCandle.high - prevCandle.low) };
        }
        
        return { signal: null, strength: 0 };
    },

    // ========== OPTIMAL TRADE ENTRY (OTE) - Fibonacci Retracement ==========
    calculateOTE(swingHigh, swingLow, currentPrice) {
        const range = swingHigh - swingLow;
        const fib618 = swingLow + range * 0.618;
        const fib705 = swingLow + range * 0.705;
        const fib382 = swingHigh - range * 0.382;
        const fib50 = swingHigh - range * 0.5;
        
        // Bullish OTE: price retraced to 61.8%-70.5% of bullish move
        const isBullishOTE = currentPrice >= fib618 && currentPrice <= fib705;
        // Bearish OTE: price retraced to 38.2%-50% of bearish move
        const isBearishOTE = currentPrice <= fib382 && currentPrice >= fib50;
        
        return { bullish: isBullishOTE, bearish: isBearishOTE, fib618, fib705, fib382, fib50 };
    },

    // ========== LIQUIDITY SWEEP ==========
    detectLiquiditySweep(data) {
        const candles = data.candles || [];
        if (!candles || candles.length < 5) return { signal: null, strength: 0 };
        
        const lastCandle = candles[candles.length - 1];
        const prevCandle = candles[candles.length - 2];
        const recentHighs = Math.max(...candles.slice(-20).map(c => c.high));
        const recentLows = Math.min(...candles.slice(-20).map(c => c.low));
        
        // Upper sweep (stop hunt) - bullish reversal
        const upperSweep = lastCandle.high > recentHighs && lastCandle.close < recentHighs && lastCandle.close > prevCandle.close;
        // Lower sweep (stop hunt) - bearish reversal
        const lowerSweep = lastCandle.low < recentLows && lastCandle.close > recentLows && lastCandle.close < prevCandle.close;
        
        if (lowerSweep) return { signal: 'BUY', strength: 70, reason: 'Liquidity sweep (bullish reversal)' };
        if (upperSweep) return { signal: 'SELL', strength: 70, reason: 'Liquidity sweep (bearish reversal)' };
        return { signal: null, strength: 0 };
    },

    // ========== FAIR VALUE GAP (FVG) ==========
    detectFairValueGap(data) {
        const candles = data.candles || [];
        if (!candles || candles.length < 3) return { signal: null, strength: 0 };
        
        const c1 = candles[candles.length - 3];
        const c2 = candles[candles.length - 2];
        const c3 = candles[candles.length - 1];
        
        // Bullish FVG: Gap between c1 high and c3 low
        const bullishFVG = c1.high < c3.low && c2.close > c1.high;
        // Bearish FVG: Gap between c3 high and c1 low
        const bearishFVG = c3.high < c1.low && c2.close < c1.low;
        
        if (bullishFVG) return { signal: 'BUY', strength: 65, reason: 'Fair Value Gap (bullish)' };
        if (bearishFVG) return { signal: 'SELL', strength: 65, reason: 'Fair Value Gap (bearish)' };
        return { signal: null, strength: 0 };
    },

    // ========== BREAK & RETEST ==========
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

    // ========== ORIGINAL STRATEGIES ==========
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

        // Detect market structure (BOS/CHoCH)
        const marketStructure = this.detectMarketStructure(candles);
        
        // Detect Order Block
        const orderBlock = this.detectOrderBlock(candles);
        
        // Detect OTE (Fibonacci)
        let oteSignal = null;
        if (candles.length >= 20) {
            const swingHigh = recentHighs;
            const swingLow = recentLows;
            const ote = this.calculateOTE(swingHigh, swingLow, marketData.currentPrice);
            if (ote.bullish) oteSignal = { signal: 'BUY', strength: 55, reason: 'OTE (61.8-70.5% retracement)' };
            if (ote.bearish) oteSignal = { signal: 'SELL', strength: 55, reason: 'OTE (38.2-50% retracement)' };
        }
        
        // Get current session
        const currentSession = this.getCurrentSession();
        const sessionBonus = (currentSession === 'LONDON' || currentSession === 'NEW_YORK') ? 10 : 0;
        
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
            this.detectBreakRetest(extendedData),
            orderBlock,
            oteSignal
        ];
        
        let buyScore = 0, sellScore = 0, reasons = [];
        
        // Add market structure bonus
        if (marketStructure.bos) {
            if (marketStructure.bos.direction === 'BULLISH') { buyScore += 15; reasons.push(`BOS (${marketStructure.bos.price.toFixed(2)})`); }
            if (marketStructure.bos.direction === 'BEARISH') { sellScore += 15; reasons.push(`BOS (${marketStructure.bos.price.toFixed(2)})`); }
        }
        if (marketStructure.choch) {
            if (marketStructure.choch.direction === 'BULLISH_CHOCH') { buyScore += 20; reasons.push('CHoCH (bullish)'); }
            if (marketStructure.choch.direction === 'BEARISH_CHOCH') { sellScore += 20; reasons.push('CHoCH (bearish)'); }
        }
        
        for (const s of signals) {
            if (s && s.signal === 'BUY') { buyScore += s.strength; if (s.reason) reasons.push(s.reason); }
            else if (s && s.signal === 'SELL') { sellScore += s.strength; if (s.reason) reasons.push(s.reason); }
        }
        
        // Add session bonus
        buyScore += sessionBonus;
        sellScore += sessionBonus;
        
        const trend = this.marketFilters.getTrend(marketData);
        if (trend === 'BULLISH') buyScore += 15;
        if (trend === 'BEARISH') sellScore += 15;

        let bias = 'WAIT', confidence = 50;
        
        if (buyScore > 85 && buyScore > sellScore) {
            bias = 'BUY';
            confidence = Math.min(85, 50 + Math.floor(buyScore / 3));
        } else if (sellScore > 85 && sellScore > buyScore) {
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
        
        const uniqueReasons = [...new Set(reasons)];
        return { bias, confidence, primaryStrategy: (bias!=='WAIT')?uniqueReasons.slice(0,3).join('+'):'No confluence', reasons: uniqueReasons };
    }
};
