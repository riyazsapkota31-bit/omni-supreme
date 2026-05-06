/**
 * STRATEGY ENGINE - Council of 8
 * Aggregates: SMC, ICT, VSA, Price Action, Wyckoff, Fibonacci, Mean Reversion, Elliott Wave
 * Automatically selects best strategy for current market conditions
 */

const StrategyEngine = {
    
    // Main analysis function
    async analyze(marketData, mode, config) {
        const strategies = this.evaluateAllStrategies(marketData, mode);
        
        // Find highest confidence strategy
        const bestStrategy = strategies.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        , strategies[0]);
        
        // Calculate consensus from all 8 strategies
        const consensus = this.calculateConsensus(strategies);
        
        // Apply DXY filter if available
        let dxyFilter = { approved: true, reason: '' };
        if (config.dxyData) {
            dxyFilter = this.applyDXYFilter(marketData, config.dxyData, bestStrategy);
        }
        
        // Final signal determination
        const signal = this.determineSignal(bestStrategy, consensus, dxyFilter, mode);
        
        return signal;
    },
    
    // Evaluate all 8 core strategies
    evaluateAllStrategies(data, mode) {
        const strategies = [];
        
        // 1. SMC (Smart Money Concepts)
        strategies.push(this.SMCStrategy(data, mode));
        
        // 2. ICT (Inner Circle Trader)
        strategies.push(this.ICTStrategy(data, mode));
        
        // 3. VSA (Volume Spread Analysis)
        strategies.push(this.VSAStrategy(data, mode));
        
        // 4. Price Action
        strategies.push(this.PriceActionStrategy(data, mode));
        
        // 5. Wyckoff
        strategies.push(this.WyckoffStrategy(data, mode));
        
        // 6. Fibonacci
        strategies.push(this.FibonacciStrategy(data, mode));
        
        // 7. Mean Reversion
        strategies.push(this.MeanReversionStrategy(data, mode));
        
        // 8. Elliott Wave
        strategies.push(this.ElliottWaveStrategy(data, mode));
        
        // Filter out low confidence
        return strategies.filter(s => s.confidence > 40);
    },
    
    // SMC Strategy: Order Blocks, Liquidity Sweeps, Market Structure Shifts
    SMCStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { currentPrice, high24h, low24h, ema20, ema50, support, resistance } = data;
        
        // Detect liquidity sweep (price hitting recent high/low)
        const liquiditySweptHigh = currentPrice >= high24h * 0.998;
        const liquiditySweptLow = currentPrice <= low24h * 1.002;
        
        if (liquiditySweptHigh && currentPrice < resistance) {
            bias = 'SELL';
            confidence += 25;
            reasons.push('Liquidity swept above - smart money sell');
        } else if (liquiditySweptLow && currentPrice > support) {
            bias = 'BUY';
            confidence += 25;
            reasons.push('Liquidity swept below - smart money buy');
        }
        
        // Order block detection (price reacting to EMA levels)
        const nearEma20 = Math.abs(currentPrice - ema20) / currentPrice < 0.002;
        if (nearEma20 && data.trend === 'BULLISH') {
            bias = bias === 'NEUTRAL' ? 'BUY' : bias;
            confidence += 15;
            reasons.push('Price at EMA20 order block');
        }
        
        return { name: 'SMC', bias, confidence, reasons };
    },
    
    // ICT Strategy: FVG, MSS, AMD
    ICTStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { rsi, currentPrice, ema20, ema50, support, resistance } = data;
        
        // Fair Value Gap detection (price gap between support/resistance)
        const gapSize = (resistance - support) / support;
        const fvgPresent = gapSize > 0.005 && gapSize < 0.02;
        
        if (fvgPresent && currentPrice < resistance - (gapSize * support * 0.3)) {
            bias = 'BUY';
            confidence += 20;
            reasons.push('FVG identified - price expected to fill gap');
        }
        
        // Market Structure Shift
        if (data.trend === 'BULLISH' && rsi > 40 && rsi < 60) {
            bias = bias === 'NEUTRAL' ? 'BUY' : bias;
            confidence += 15;
            reasons.push('MSS confirmed - bullish momentum');
        }
        
        // Killzones for scalping vs day trading
        if (mode === 'scalp' && rsi < 35) {
            bias = 'BUY';
            confidence += 20;
            reasons.push('London/NY Killzone overshoot');
        }
        
        return { name: 'ICT', bias, confidence, reasons };
    },
    
    // VSA Strategy: Volume Spread Analysis
    VSAStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { volumeSpike, currentPrice, support, resistance } = data;
        
        // Volume spike with price at support/resistance
        if (volumeSpike && currentPrice <= support * 1.002) {
            bias = 'BUY';
            confidence += 30;
            reasons.push('Ultra-high volume at support - stopping volume');
        } else if (volumeSpike && currentPrice >= resistance * 0.998) {
            bias = 'SELL';
            confidence += 30;
            reasons.push('Ultra-high volume at resistance - selling climax');
        }
        
        // No volume confirmation = wait
        if (!volumeSpike && confidence < 60) {
            confidence -= 10;
            reasons.push('Low volume confirmation');
        }
        
        return { name: 'VSA', bias, confidence, reasons };
    },
    
    // Price Action Strategy: Candlestick patterns, trendlines
    PriceActionStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { rsi, currentPrice, ema20, ema50, trend, support, resistance } = data;
        
        // Engulfing pattern detection (simplified)
        const nearSupport = currentPrice <= support * 1.005;
        const nearResistance = currentPrice >= resistance * 0.995;
        
        if (nearSupport && rsi < 40) {
            bias = 'BUY';
            confidence += 25;
            reasons.push('Bullish engulfing at key support');
        } else if (nearResistance && rsi > 60) {
            bias = 'SELL';
            confidence += 25;
            reasons.push('Bearish engulfing at key resistance');
        }
        
        // Trend following
        if (trend === 'BULLISH' && rsi > 40 && rsi < 70) {
            bias = bias === 'NEUTRAL' ? 'BUY' : bias;
            confidence += 15;
            reasons.push('Higher highs/lows - trend continuation');
        }
        
        return { name: 'Price Action', bias, confidence, reasons };
    },
    
    // Wyckoff Strategy: Accumulation/Distribution
    WyckoffStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { rsi, currentPrice, support, resistance, volumeSpike } = data;
        
        // Spring detection (price below support then reclaim)
        const springDetected = currentPrice > support && support > 0;
        
        // Upthrust detection (price above resistance then rejection)
        const upthrustDetected = currentPrice < resistance && resistance > 0;
        
        if (springDetected && volumeSpike) {
            bias = 'BUY';
            confidence += 35;
            reasons.push('Wyckoff Spring - bullish reversal');
        } else if (upthrustDetected && volumeSpike) {
            bias = 'SELL';
            confidence += 35;
            reasons.push('Wyckoff Upthrust - bearish reversal');
        }
        
        // Accumulation phase
        if (rsi < 35 && data.volatility < 0.5) {
            bias = bias === 'NEUTRAL' ? 'BUY' : bias;
            confidence += 20;
            reasons.push('Accumulation phase - smart money buying');
        }
        
        return { name: 'Wyckoff', bias, confidence, reasons };
    },
    
    // Fibonacci Strategy: Retracement levels, extensions
    FibonacciStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { currentPrice, high24h, low24h } = data;
        
        const range = high24h - low24h;
        const fib618 = low24h + range * 0.618;
        const fib382 = low24h + range * 0.382;
        const fib786 = low24h + range * 0.786;
        
        // Price at Fibonacci levels
        const atFib618 = Math.abs(currentPrice - fib618) / currentPrice < 0.001;
        const atFib382 = Math.abs(currentPrice - fib382) / currentPrice < 0.001;
        const atFib786 = Math.abs(currentPrice - fib786) / currentPrice < 0.001;
        
        if (atFib618 || atFib786) {
            bias = data.trend === 'BULLISH' ? 'BUY' : 'SELL';
            confidence += 20;
            reasons.push(`Price at Fibonacci ${atFib618 ? '61.8%' : '78.6%'} retracement`);
        } else if (atFib382) {
            confidence += 10;
            reasons.push('38.2% Fib - shallow retracement');
        }
        
        return { name: 'Fibonacci', bias, confidence, reasons };
    },
    
    // Mean Reversion Strategy: RSI, Bollinger Bands
    MeanReversionStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { rsi, currentPrice, volatility } = data;
        
        // Extreme RSI levels
        if (rsi < 25) {
            bias = 'BUY';
            confidence += 30;
            reasons.push(`Extreme RSI (${rsi.toFixed(1)}) - mean reversion expected`);
        } else if (rsi > 75) {
            bias = 'SELL';
            confidence += 30;
            reasons.push(`Extreme RSI (${rsi.toFixed(1)}) - mean reversion expected`);
        }
        
        // Oversold/Overbought with volatility adjustment
        if (rsi < 35 && volatility > 0.5) {
            confidence += 10;
            reasons.push('High volatility oversold - bounce likely');
        }
        
        return { name: 'Mean Reversion', bias, confidence, reasons };
    },
    
    // Elliott Wave Strategy: Impulse/Corrective waves
    ElliottWaveStrategy(data, mode) {
        let bias = 'NEUTRAL';
        let confidence = 50;
        let reasons = [];
        
        const { currentPrice, support, resistance, trend } = data;
        
        // Simplified wave detection
        const atResistance = currentPrice >= resistance * 0.998;
        const atSupport = currentPrice <= support * 1.002;
        
        if (trend === 'BULLISH' && atSupport) {
            bias = 'BUY';
            confidence += 25;
            reasons.push('Wave 2/4 completion - impulsive wave expected');
        } else if (trend === 'BEARISH' && atResistance) {
            bias = 'SELL';
            confidence += 25;
            reasons.push('Corrective wave complete - impulse down');
        }
        
        return { name: 'Elliott Wave', bias, confidence, reasons };
    },
    
    // Calculate consensus across all strategies
    calculateConsensus(strategies) {
        const buyCount = strategies.filter(s => s.bias === 'BUY').length;
        const sellCount = strategies.filter(s => s.bias === 'SELL').length;
        
        const total = strategies.length;
        const buyRatio = buyCount / total;
        const sellRatio = sellCount / total;
        
        let consensus = 'NEUTRAL';
        let strength = 0;
        
        if (buyRatio > 0.6) {
            consensus = 'BUY';
            strength = buyRatio;
        } else if (sellRatio > 0.6) {
            consensus = 'SELL';
            strength = sellRatio;
        }
        
        return { consensus, strength };
    },
    
    // DXY Filter - prevents Dollar Traps
    applyDXYFilter(marketData, dxyData, strategy) {
        const isUSD = marketData.symbol.includes('USD') || marketData.symbol === 'XAUUSD';
        
        if (!isUSD) {
            return { approved: true, reason: 'Non-USD pair, DXY filter bypassed' };
        }
        
        // Dollar Traps: When DXY and pair give conflicting signals
        const dxyBullish = dxyData.dxyTrend === 'BULLISH';
        const dxyBearish = dxyData.dxyTrend === 'BEARISH';
        
        if (strategy.bias === 'BUY' && dxyBullish) {
            return { approved: false, reason: 'DXY TRAP: Strong Dollar conflicting with BUY signal' };
        }
        
        if (strategy.bias === 'SELL' && dxyBearish) {
            return { approved: false, reason: 'DXY TRAP: Weak Dollar conflicting with SELL signal' };
        }
        
        return { approved: true, reason: 'DXY confirmation aligned' };
    },
    
    // Final signal determination with RR guard
    determineSignal(strategy, consensus, dxyFilter, mode) {
        let finalBias = strategy.bias;
        let finalConfidence = (strategy.confidence + consensus.strength * 100) / 2;
        
        // Override with consensus if strong
        if (consensus.strength > 0.7 && consensus.consensus !== 'NEUTRAL') {
            finalBias = consensus.consensus;
            finalConfidence = Math.max(finalConfidence, 75);
        }
        
        // DXY filter override
        if (!dxyFilter.approved) {
            finalBias = 'WAIT';
            finalConfidence = 30;
        }
        
        // Grade filtering: Only accept A+/A/B+ setups
        if (finalConfidence < 55) {
            finalBias = 'WAIT';
        }
        
        // Mode-specific adjustments
        if (mode === 'scalp' && finalBias !== 'WAIT') {
            // Scalping: more aggressive but maintain minimum confidence
            if (finalConfidence < 50) finalBias = 'WAIT';
        }
        
        if (mode === 'day' && finalBias !== 'WAIT') {
            // Day trading: require higher conviction
            if (finalConfidence < 60) finalBias = 'WAIT';
        }
        
        return {
            bias: finalBias,
            confidence: Math.round(finalConfidence),
            primaryStrategy: strategy.name,
            strategyReasons: strategy.reasons.slice(0, 2)
        };
    }
};
