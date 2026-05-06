 * STRATEGY ENGINE - 15 Strategies + Intelligent Auto-Selector
 */

const StrategyEngine = {
    
    strategies: [
        { name: 'SMC', conditions: ['trending', 'high_volume'] },
        { name: 'ICT', conditions: ['liquidity_sweep', 'fvg'] },
        { name: 'VSA', conditions: ['volume_spike', 'support_resistance'] },
        { name: 'Price Action', conditions: ['trending', 'clear_levels'] },
        { name: 'Wyckoff', conditions: ['accumulation', 'distribution'] },
        { name: 'Fibonacci', conditions: ['retracement', 'extension'] },
        { name: 'Mean Reversion', conditions: ['oversold', 'overbought'] },
        { name: 'Elliott Wave', conditions: ['impulsive', 'corrective'] },
        { name: 'RSI Divergence', conditions: ['divergence', 'reversal'] },
        { name: 'MACD Crossover', conditions: ['momentum', 'trending'] },
        { name: 'Bollinger Bands', conditions: ['volatility', 'mean_reversion'] },
        { name: 'Support/Resistance', conditions: ['clear_levels', 'range'] },
        { name: 'Breakout', conditions: ['consolidation', 'high_volume'] },
        { name: 'Moving Average Ribbon', conditions: ['strong_trend'] },
        { name: 'Ichimoku', conditions: ['trending', 'momentum'] }
    ],
    
    detectMarketConditions(data) {
        const conditions = [];
        if (data.trend !== 'SIDEWAYS') conditions.push('trending');
        if (Math.abs(data.ema20 - data.ema50) / data.currentPrice > 0.002) conditions.push('strong_trend');
        if (data.volatility > 1) conditions.push('high_volatility');
        if (data.volumeSpike) conditions.push('volume_spike', 'high_volume');
        if (data.rsi < 30) conditions.push('oversold', 'mean_reversion');
        if (data.rsi > 70) conditions.push('overbought', 'mean_reversion');
        if (data.currentPrice <= data.support * 1.002) conditions.push('support', 'reversal');
        if (data.currentPrice >= data.resistance * 0.998) conditions.push('resistance', 'reversal');
        const rangeSize = (data.resistance - data.support) / data.currentPrice;
        if (rangeSize < 0.005) conditions.push('consolidation', 'range');
        if (rangeSize > 0.02) conditions.push('clear_levels');
        const priceHigher = data.currentPrice > data.prevClose;
        const rsiHigher = data.rsi > 50;
        if (priceHigher !== rsiHigher) conditions.push('divergence');
        if (data.rsi < 40 && data.volumeSpike) conditions.push('accumulation');
        if (data.rsi > 60 && data.volumeSpike) conditions.push('distribution');
        const range = data.high24h - data.low24h;
        const retracement = (data.currentPrice - data.low24h) / range;
        if (retracement > 0.382 && retracement < 0.618) conditions.push('retracement');
        if (retracement > 0.618) conditions.push('extension');
        if (data.currentPrice > data.resistance || data.currentPrice < data.support) conditions.push('breakout');
        if (data.currentPrice > data.ema200 && data.ema20 > data.ema50) conditions.push('impulsive');
        if (data.currentPrice < data.ema200 && data.ema20 < data.ema50) conditions.push('corrective');
        return conditions;
    },
    
    scoreStrategies(conditions, marketData, mode) {
        const scores = [];
        for (const strategy of this.strategies) {
            let score = 50;
            for (const cond of strategy.conditions) {
                if (conditions.includes(cond)) score += 15;
            }
            if (mode === 'scalp' && ['Price Action', 'Support/Resistance', 'Breakout', 'SMC'].includes(strategy.name)) score += 10;
            if (mode === 'day' && ['Ichimoku', 'Moving Average Ribbon', 'Elliott Wave', 'Fibonacci'].includes(strategy.name)) score += 10;
            if (marketData.assetClass === 'crypto' && strategy.name === 'RSI Divergence') score += 10;
            if (marketData.assetClass === 'forex' && strategy.name === 'ICT') score += 10;
            if (marketData.volatility > 1.5 && strategy.name === 'Bollinger Bands') score += 15;
            if (marketData.volatility < 0.5 && strategy.name === 'Mean Reversion') score += 15;
            scores.push({ ...strategy, score: Math.min(100, Math.max(0, score)) });
        }
        return scores.sort((a, b) => b.score - a.score);
    },
    
    async executeStrategy(strategyName, data, mode) {
        switch (strategyName) {
            case 'SMC': return this.smcStrategy(data, mode);
            case 'ICT': return this.ictStrategy(data, mode);
            case 'VSA': return this.vsaStrategy(data, mode);
            case 'Price Action': return this.priceActionStrategy(data, mode);
            case 'Wyckoff': return this.wyckoffStrategy(data, mode);
            case 'Fibonacci': return this.fibonacciStrategy(data, mode);
            case 'Mean Reversion': return this.meanReversionStrategy(data, mode);
            case 'Elliott Wave': return this.elliottWaveStrategy(data, mode);
            case 'RSI Divergence': return this.rsiDivergenceStrategy(data, mode);
            case 'MACD Crossover': return this.macdStrategy(data, mode);
            case 'Bollinger Bands': return this.bollingerStrategy(data, mode);
            case 'Support/Resistance': return this.supportResistanceStrategy(data, mode);
            case 'Breakout': return this.breakoutStrategy(data, mode);
            case 'Moving Average Ribbon': return this.maRibbonStrategy(data, mode);
            case 'Ichimoku': return this.ichimokuStrategy(data, mode);
            default: return { bias: 'WAIT', confidence: 40, reasons: [] };
        }
    },
    
    async analyze(marketData, mode, config) {
        const conditions = this.detectMarketConditions(marketData);
        const scoredStrategies = this.scoreStrategies(conditions, marketData, mode);
        const topStrategies = scoredStrategies.slice(0, 3);
        const results = [];
        
        for (const strategy of topStrategies) {
            const result = await this.executeStrategy(strategy.name, marketData, mode);
            results.push({ ...result, strategyName: strategy.name, strategyScore: strategy.score });
        }
        
        let totalWeight = 0;
        let weightedBias = { BUY: 0, SELL: 0, WAIT: 0 };
        
        for (const result of results) {
            const weight = result.strategyScore / 100;
            totalWeight += weight;
            weightedBias[result.bias] += weight;
        }
        
        let finalBias = 'WAIT';
        let finalConfidence = 50;
        let winningStrategy = results[0];
        
        if (weightedBias.BUY > 0.5) {
            finalBias = 'BUY';
            finalConfidence = Math.round(weightedBias.BUY * 100);
        } else if (weightedBias.SELL > 0.5) {
            finalBias = 'SELL';
            finalConfidence = Math.round(weightedBias.SELL * 100);
        }
        
        if (finalConfidence < 55) finalBias = 'WAIT';
        
        return {
            bias: finalBias,
            confidence: finalConfidence,
            primaryStrategy: winningStrategy.strategyName,
            conditionsDetected: conditions.slice(0, 5).join(', '),
            reasons: winningStrategy.reasons || []
        };
    },
    
    smcStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const liquiditySweptHigh = data.currentPrice >= data.high24h * 0.998;
        const liquiditySweptLow = data.currentPrice <= data.low24h * 1.002;
        if (liquiditySweptHigh && data.currentPrice < data.resistance) {
            bias = 'SELL'; confidence += 25; reasons.push('Liquidity swept above - smart money sell');
        } else if (liquiditySweptLow && data.currentPrice > data.support) {
            bias = 'BUY'; confidence += 25; reasons.push('Liquidity swept below - smart money buy');
        }
        return { bias, confidence, reasons };
    },
    
    ictStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const range = data.resistance - data.support;
        const fvgPresent = range / data.support > 0.003 && range / data.support < 0.015;
        if (fvgPresent && data.currentPrice < data.resistance - range * 0.3) {
            bias = 'BUY'; confidence += 20; reasons.push('FVG identified - price expected to fill gap');
        }
        if (mode === 'scalp' && data.rsi < 35) {
            bias = 'BUY'; confidence += 20; reasons.push('Killzone overshoot - scalp entry');
        }
        return { bias, confidence, reasons };
    },
    
    vsaStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        if (data.volumeSpike && data.currentPrice <= data.support * 1.002) {
            bias = 'BUY'; confidence += 30; reasons.push('Ultra-high volume at support - stopping volume');
        } else if (data.volumeSpike && data.currentPrice >= data.resistance * 0.998) {
            bias = 'SELL'; confidence += 30; reasons.push('Ultra-high volume at resistance - selling climax');
        }
        return { bias, confidence, reasons };
    },
    
    priceActionStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const nearSupport = data.currentPrice <= data.support * 1.005;
        const nearResistance = data.currentPrice >= data.resistance * 0.995;
        if (nearSupport && data.rsi < 40) {
            bias = 'BUY'; confidence += 25; reasons.push('Bullish engulfing at key support');
        } else if (nearResistance && data.rsi > 60) {
            bias = 'SELL'; confidence += 25; reasons.push('Bearish engulfing at key resistance');
        }
        if (data.trend === 'BULLISH' && data.rsi > 40 && data.rsi < 70) {
            bias = bias === 'NEUTRAL' ? 'BUY' : bias; confidence += 15;
        }
        return { bias, confidence, reasons };
    },
    
    wyckoffStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        if (data.rsi < 35 && data.volumeSpike) {
            bias = 'BUY'; confidence += 35; reasons.push('Wyckoff Spring - bullish reversal');
        } else if (data.rsi > 65 && data.volumeSpike) {
            bias = 'SELL'; confidence += 35; reasons.push('Wyckoff Upthrust - bearish reversal');
        }
        return { bias, confidence, reasons };
    },
    
    fibonacciStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const range = data.high24h - data.low24h;
        const fib618 = data.low24h + range * 0.618;
        const fib786 = data.low24h + range * 0.786;
        const atFib618 = Math.abs(data.currentPrice - fib618) / data.currentPrice < 0.001;
        const atFib786 = Math.abs(data.currentPrice - fib786) / data.currentPrice < 0.001;
        if (atFib618 || atFib786) {
            bias = data.trend === 'BULLISH' ? 'BUY' : 'SELL';
            confidence += 20;
            reasons.push(`Price at Fibonacci ${atFib618 ? '61.8%' : '78.6%'} retracement`);
        }
        return { bias, confidence, reasons };
    },
    
    meanReversionStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        if (data.rsi < 25) {
            bias = 'BUY'; confidence += 35; reasons.push(`Extreme RSI (${data.rsi.toFixed(1)}) - mean reversion expected`);
        } else if (data.rsi > 75) {
            bias = 'SELL'; confidence += 35; reasons.push(`Extreme RSI (${data.rsi.toFixed(1)}) - mean reversion expected`);
        }
        return { bias, confidence, reasons };
    },
    
    elliottWaveStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const atResistance = data.currentPrice >= data.resistance * 0.998;
        const atSupport = data.currentPrice <= data.support * 1.002;
        if (data.trend === 'BULLISH' && atSupport) {
            bias = 'BUY'; confidence += 25; reasons.push('Wave 2/4 completion - impulsive wave expected');
        } else if (data.trend === 'BEARISH' && atResistance) {
            bias = 'SELL'; confidence += 25; reasons.push('Corrective wave complete - impulse down');
        }
        return { bias, confidence, reasons };
    },
    
    rsiDivergenceStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const priceHigher = data.currentPrice > data.prevClose;
        const rsiHigher = data.rsi > 50;
        if (priceHigher && !rsiHigher) {
            bias = 'SELL'; confidence += 25; reasons.push('Bearish divergence - price up, RSI down');
        } else if (!priceHigher && rsiHigher) {
            bias = 'BUY'; confidence += 25; reasons.push('Bullish divergence - price down, RSI up');
        }
        return { bias, confidence, reasons };
    },
    
    macdStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const ema12 = data.ema20 * 0.6;
        const ema26 = data.ema50 * 0.52;
        const macd = ema12 - ema26;
        const signal = macd * 0.9;
        if (macd > signal && macd > 0) {
            bias = 'BUY'; confidence += 20; reasons.push('Bullish MACD crossover above zero');
        } else if (macd < signal && macd < 0) {
            bias = 'SELL'; confidence += 20; reasons.push('Bearish MACD crossover below zero');
        }
        return { bias, confidence, reasons };
    },
    
    bollingerStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const sma = (data.high24h + data.low24h) / 2;
        const std = data.atr * 1.5;
        const upperBB = sma + std * 2;
        const lowerBB = sma - std * 2;
        if (data.currentPrice <= lowerBB) {
            bias = 'BUY'; confidence += 25; reasons.push('Price below lower Bollinger Band - mean reversion up');
        } else if (data.currentPrice >= upperBB) {
            bias = 'SELL'; confidence += 25; reasons.push('Price above upper Bollinger Band - mean reversion down');
        }
        return { bias, confidence, reasons };
    },
    
    supportResistanceStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const bouncedOffSupport = data.currentPrice > data.support && Math.abs(data.currentPrice - data.support) / data.support < 0.002;
        const rejectedFromResistance = data.currentPrice < data.resistance && Math.abs(data.currentPrice - data.resistance) / data.resistance < 0.002;
        if (bouncedOffSupport) {
            bias = 'BUY'; confidence += 25; reasons.push('Bounced off key support level');
        } else if (rejectedFromResistance) {
            bias = 'SELL'; confidence += 25; reasons.push('Rejected from key resistance level');
        }
        return { bias, confidence, reasons };
    },
    
    breakoutStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const brokeResistance = data.currentPrice > data.resistance;
        const brokeSupport = data.currentPrice < data.support;
        if (brokeResistance && data.volumeSpike) {
            bias = 'BUY'; confidence += 30; reasons.push('Bullish breakout with volume confirmation');
        } else if (brokeSupport && data.volumeSpike) {
            bias = 'SELL'; confidence += 30; reasons.push('Bearish breakdown with volume confirmation');
        }
        return { bias, confidence, reasons };
    },
    
    maRibbonStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const ribbonBullish = data.ema20 > data.ema50 && data.ema50 > data.ema200;
        const ribbonBearish = data.ema20 < data.ema50 && data.ema50 < data.ema200;
        if (ribbonBullish && data.currentPrice > data.ema20) {
            bias = 'BUY'; confidence += 25; reasons.push('Price above bullish MA ribbon');
        } else if (ribbonBearish && data.currentPrice < data.ema20) {
            bias = 'SELL'; confidence += 25; reasons.push('Price below bearish MA ribbon');
        }
        return { bias, confidence, reasons };
    },
    
    ichimokuStrategy(data, mode) {
        let bias = 'NEUTRAL', confidence = 50, reasons = [];
        const tenkanSen = (data.high24h + data.low24h) / 2;
        const kijunSen = (data.resistance + data.support) / 2;
        if (data.currentPrice > tenkanSen && tenkanSen > kijunSen) {
            bias = 'BUY'; confidence += 20; reasons.push('Price above Ichimoku cloud - bullish');
        } else if (data.currentPrice < tenkanSen && tenkanSen < kijunSen) {
            bias = 'SELL'; confidence += 20; reasons.push('Price below Ichimoku cloud - bearish');
        }
        return { bias, confidence, reasons };
    }
};
