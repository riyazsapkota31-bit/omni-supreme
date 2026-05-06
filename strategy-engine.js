/**
 * STRATEGY ENGINE - OPTIMIZED FOR WIN RATE (55-62% target)
 * Upgrades included: 1 (mode-based confidence), 2 (volume confirmation), 5 (choppy filter)
 * Upgrade 7 (MA crossover) omitted due to missing closes array.
 */

const StrategyEngine = {
    
    // Market condition filters
    marketFilters: {
        isHighImpactNews: (timestamp) => {
            const hour = new Date(timestamp).getUTCHours();
            return (hour >= 8 && hour <= 10) || (hour >= 13 && hour <= 15);
        },
        isVolatilityAcceptable: (atr, price) => {
            const volatilityPercent = (atr / price) * 100;
            return volatilityPercent < 1.5 && volatilityPercent > 0.2;
        },
        isSpreadAcceptable: (spread, price, assetClass) => {
            const spreadPercent = (spread / price) * 100;
            if (assetClass === 'forex') return spreadPercent < 0.05;
            if (assetClass === 'commodities') return spreadPercent < 0.1;
            if (assetClass === 'crypto') return spreadPercent < 0.2;
            return true;
        },
        getTrend: (data) => {
            if (data.ema20 > data.ema50 && data.ema50 > data.ema200) return 'BULLISH';
            if (data.ema20 < data.ema50 && data.ema50 < data.ema200) return 'BEARISH';
            return 'SIDEWAYS';
        },
        // Upgrade 5: Choppy market detection
        isChoppy: (data) => {
            const emaDistance = Math.abs(data.ema20 - data.ema50) / data.currentPrice;
            return emaDistance < 0.001; // less than 0.1% separation
        }
    },
    
    detectRSIDivergence(data) {
        const { rsi, currentPrice, prevPrice } = data;
        const priceHigher = currentPrice > prevPrice;
        const rsiHigher = rsi > 50;
        if (!priceHigher && rsiHigher) return { signal: 'BUY', strength: 85, reason: 'Bullish RSI divergence' };
        if (priceHigher && !rsiHigher) return { signal: 'SELL', strength: 85, reason: 'Bearish RSI divergence' };
        return { signal: null, strength: 0 };
    },
    
    // Upgrade 2: Volume confirmation added
    detectEMAPullback(data) {
        const { currentPrice, ema20, ema50, trend, volumeSpike } = data;
        const distanceToEMA20 = Math.abs(currentPrice - ema20) / currentPrice * 100;
        if (trend === 'BULLISH' && currentPrice < ema20 && currentPrice > ema50 && distanceToEMA20 < 0.3 && volumeSpike) {
            return { signal: 'BUY', strength: 75, reason: 'Bullish EMA pullback with volume' };
        }
        if (trend === 'BEARISH' && currentPrice > ema20 && currentPrice < ema50 && distanceToEMA20 < 0.3 && volumeSpike) {
            return { signal: 'SELL', strength: 75, reason: 'Bearish EMA pullback with volume' };
        }
        return { signal: null, strength: 0 };
    },
    
    detectSupportResistanceBounce(data) {
        const { currentPrice, support, resistance, atr } = data;
        const atrPercent = atr / currentPrice * 100;
        const isNearSupport = Math.abs(currentPrice - support) / currentPrice * 100 < atrPercent * 0.5;
        const isNearResistance = Math.abs(currentPrice - resistance) / currentPrice * 100 < atrPercent * 0.5;
        if (isNearSupport && data.rsi < 50) return { signal: 'BUY', strength: 80, reason: 'Bounced from support' };
        if (isNearResistance && data.rsi > 50) return { signal: 'SELL', strength: 80, reason: 'Rejected from resistance' };
        return { signal: null, strength: 0 };
    },
    
    detectVolumeConfirmation(data) {
        if (!data.volumeSpike) return { signal: null, strength: 0 };
        const { currentPrice, support, resistance } = data;
        if (currentPrice > resistance * 0.995) return { signal: 'BUY', strength: 70, reason: 'Volume breakout' };
        if (currentPrice < support * 1.005) return { signal: 'SELL', strength: 70, reason: 'Volume breakdown' };
        return { signal: null, strength: 0 };
    },
    
    // Upgrade 2: Volume confirmation added to FVG as well
    detectFVG(data) {
        const { currentPrice, ema20, ema50, volumeSpike } = data;
        const gap = Math.abs(ema20 - ema50) / ema50 * 100;
        if (gap > 0.1 && gap < 0.5 && volumeSpike) {
            if (ema20 > ema50 && currentPrice < ema50) return { signal: 'BUY', strength: 70, reason: 'FVG with volume' };
            if (ema20 < ema50 && currentPrice > ema50) return { signal: 'SELL', strength: 70, reason: 'FVG with volume' };
        }
        return { signal: null, strength: 0 };
    },
    
    shouldTrade(marketData, mode) {
        const filters = this.marketFilters;
        // Upgrade 5: reject choppy markets
        if (filters.isChoppy(marketData)) {
            return { allowed: false, reason: 'Market choppy - no clear direction' };
        }
        if (filters.isHighImpactNews(Date.now())) {
            return { allowed: false, reason: 'Major news event' };
        }
        if (!filters.isVolatilityAcceptable(marketData.atr, marketData.currentPrice)) {
            return { allowed: false, reason: 'Volatility too high' };
        }
        if (!filters.isSpreadAcceptable(marketData.spread, marketData.currentPrice, marketData.class)) {
            return { allowed: false, reason: 'Spreads too wide' };
        }
        const trend = filters.getTrend(marketData);
        if (mode === 'day' && trend === 'SIDEWAYS') {
            return { allowed: false, reason: 'Sideways market' };
        }
        return { allowed: true, reason: 'All filters passed' };
    },
    
    async analyze(marketData, mode, config) {
        const filterResult = this.shouldTrade(marketData, mode);
        if (!filterResult.allowed) {
            return { bias: 'WAIT', confidence: 40, primaryStrategy: 'Market Filter', reasons: [filterResult.reason], conditionsDetected: '' };
        }
        
        const signals = [
            this.detectRSIDivergence(marketData),
            this.detectEMAPullback(marketData),
            this.detectSupportResistanceBounce(marketData),
            this.detectVolumeConfirmation(marketData),
            this.detectFVG(marketData)
        ];
        
        let buyScore = 0, sellScore = 0, activeReasons = [];
        for (const s of signals) {
            if (s.signal === 'BUY') { buyScore += s.strength; activeReasons.push(s.reason); }
            else if (s.signal === 'SELL') { sellScore += s.strength; activeReasons.push(s.reason); }
        }
        
        const trend = this.marketFilters.getTrend(marketData);
        if (trend === 'BULLISH') buyScore += 15;
        if (trend === 'BEARISH') sellScore += 15;
        
        let bias = 'WAIT', confidence = 50, usedStrategy = '';
        if (buyScore > 120 && buyScore > sellScore) {
            bias = 'BUY';
            confidence = Math.min(85, 50 + Math.floor(buyScore / 3));
            usedStrategy = activeReasons.slice(0,2).join(' + ');
        } else if (sellScore > 120 && sellScore > buyScore) {
            bias = 'SELL';
            confidence = Math.min(85, 50 + Math.floor(sellScore / 3));
            usedStrategy = activeReasons.slice(0,2).join(' + ');
        }
        
        // Upgrade 1: Mode-based confidence threshold
        const minConfidence = (mode === 'scalp') ? 55 : 65;
        if (confidence < minConfidence) {
            bias = 'WAIT';
            confidence = 50;
            usedStrategy = 'Insufficient confidence';
        }
        
        // DXY filter
        if (config.dxyData && marketData.symbol && marketData.symbol.includes('USD')) {
            const dxyStrong = config.dxyData.dxyStrength === 'STRONG';
            const dxyWeak = config.dxyData.dxyStrength === 'WEAK';
            if ((bias === 'BUY' && dxyStrong) || (bias === 'SELL' && dxyWeak)) {
                bias = 'WAIT';
                confidence = 40;
                usedStrategy = 'DXY conflict';
            }
        }
        
        return {
            bias, confidence,
            primaryStrategy: usedStrategy || 'Signal Confluence',
            conditionsDetected: activeReasons.slice(0,3).join(', '),
            reasons: activeReasons
        };
    }
};
