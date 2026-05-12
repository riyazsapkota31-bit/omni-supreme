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
            return { signal: 'BUY', strength: 75, reason: 'Bullish EMA pullback with volume' };
        if (trend === 'BEARISH' && currentPrice > ema20 && currentPrice < ema50 && dist < 0.3 && volumeSpike)
            return { signal: 'SELL', strength: 75, reason: 'Bearish EMA pullback with volume' };
        return { signal: null, strength: 0 };
    },
    detectSupportResistanceBounce(data) {
        const { currentPrice, support, resistance, atr, rsi } = data;
        const atrPerc = atr / currentPrice * 100;
        const nearSupport = Math.abs(currentPrice - support) / currentPrice * 100 < atrPerc * 0.5;
        const nearResistance = Math.abs(currentPrice - resistance) / currentPrice * 100 < atrPerc * 0.5;
        if (nearSupport && rsi < 50) return { signal: 'BUY', strength: 80, reason: 'Bounced from support' };
        if (nearResistance && rsi > 50) return { signal: 'SELL', strength: 80, reason: 'Rejected from resistance' };
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
            if (ema20 > ema50 && currentPrice < ema50) return { signal: 'BUY', strength: 70, reason: 'FVG with volume' };
            if (ema20 < ema50 && currentPrice > ema50) return { signal: 'SELL', strength: 70, reason: 'FVG with volume' };
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

        const signals = [
            this.detectRSIDivergence(marketData),
            this.detectEMAPullback(marketData),
            this.detectSupportResistanceBounce(marketData),
            this.detectVolumeConfirmation(marketData),
            this.detectFVG(marketData)
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
        
        // ========== THRESHOLD CHANGED FROM 120 TO 90 ==========
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
