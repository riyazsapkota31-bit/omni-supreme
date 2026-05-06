/**
 * RISK MANAGER - XM Broker Calibration
 * Calculates Entry, SL, TP, Lot Size based on market data and user risk
 * RR Guard: Min 1:1.5 (scalp) | Max based on mode
 */

const RiskManager = {
    
    calculateTradeLevels(marketData, signal, mode, userConfig) {
        const { currentPrice, atr, support, resistance, trend, assetClass, multiplier, spread } = marketData;
        const { riskPercent, balance } = userConfig;
        
        let entry, stopLoss, takeProfit;
        let rrRatio = 0;
        
        if (signal.bias === 'BUY') {
            entry = currentPrice;
            
            // SL calculation based on mode and ATR
            const atrMultiplier = mode === 'scalp' ? 0.5 : 1.0;
            const slDistance = atr * atrMultiplier;
            stopLoss = currentPrice - slDistance;
            
            // Ensure SL is below support
            if (stopLoss > support) {
                stopLoss = support * 0.998;
            }
            
            // TP based on mode
            const minRR = mode === 'scalp' ? 1.5 : 3.0;
            const maxRR = mode === 'scalp' ? 4.0 : 10.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            
            const actualRisk = Math.abs(entry - stopLoss);
            const rewardDistance = actualRisk * targetRR;
            takeProfit = entry + rewardDistance;
            
            // Cap TP at resistance
            if (takeProfit > resistance) {
                takeProfit = resistance * 0.998;
                const adjustedRR = Math.abs(takeProfit - entry) / actualRisk;
                rrRatio = adjustedRR;
            } else {
                rrRatio = targetRR;
            }
            
        } else if (signal.bias === 'SELL') {
            entry = currentPrice;
            
            const atrMultiplier = mode === 'scalp' ? 0.5 : 1.0;
            const slDistance = atr * atrMultiplier;
            stopLoss = currentPrice + slDistance;
            
            // Ensure SL is above resistance
            if (stopLoss < resistance) {
                stopLoss = resistance * 1.002;
            }
            
            const minRR = mode === 'scalp' ? 1.5 : 3.0;
            const maxRR = mode === 'scalp' ? 4.0 : 10.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            
            const actualRisk = Math.abs(stopLoss - entry);
            const rewardDistance = actualRisk * targetRR;
            takeProfit = entry - rewardDistance;
            
            // Cap TP at support
            if (takeProfit < support) {
                takeProfit = support * 1.002;
                const adjustedRR = Math.abs(entry - takeProfit) / actualRisk;
                rrRatio = adjustedRR;
            } else {
                rrRatio = targetRR;
            }
        } else {
            // WAIT mode - no trade levels
            return { entry: null, stopLoss: null, takeProfit: null, rrRatio: 0, lotSize: 0 };
        }
        
        // RR Guard: Minimum 1:1.5 for scalping, 1:3 for day trading
        const minRRRequired = mode === 'scalp' ? 1.5 : 3.0;
        
        if (rrRatio < minRRRequired) {
            return {
                entry: null,
                stopLoss: null,
                takeProfit: null,
                rrRatio: rrRatio,
                lotSize: 0,
                waitReason: `RR ${rrRatio.toFixed(1)} below minimum ${minRRRequired}:1`
            };
        }
        
        // Calculate lot size
        const lotSize = this.calculateLotSize(entry, stopLoss, balance, riskPercent, multiplier, spread, signal.bias);
        
        // Upper limit enforcement
        const effectiveRR = Math.min(rrRatio, mode === 'scalp' ? 4.0 : 10.0);
        
        return {
            entry: this.roundPrice(entry, assetClass),
            stopLoss: this.roundPrice(stopLoss, assetClass),
            takeProfit: this.roundPrice(takeProfit, assetClass),
            rrRatio: effectiveRR,
            lotSize: lotSize,
            riskDistance: Math.abs(entry - stopLoss)
        };
    },
    
    calculateLotSize(entry, stopLoss, balance, riskPercent, multiplier, spread, bias) {
        const riskAmount = balance * (riskPercent / 100);
        const stopDistance = Math.abs(entry - stopLoss) + spread;
        
        if (stopDistance <= 0) return 0;
        
        // XM Broker calibration
        let lotSize = riskAmount / (stopDistance * multiplier);
        
        // Round to XM lot size standards (3 decimal places)
        lotSize = Math.floor(lotSize * 1000) / 1000;
        
        // Minimum and maximum lot constraints
        lotSize = Math.max(0.01, Math.min(lotSize, 50));
        
        return lotSize;
    },
    
    roundPrice(price, assetClass) {
        if (assetClass === 'crypto') {
            return Math.round(price * 10) / 10;
        } else if (assetClass === 'commodities') {
            return Math.round(price * 100) / 100;
        } else {
            return Math.round(price * 100000) / 100000;
        }
    },
    
    // Generate Point of Interest for WAIT scenarios
    generatePOI(marketData, mode) {
        const { currentPrice, atr, support, resistance } = marketData;
        const atrMultiplier = mode === 'scalp' ? 0.5 : 1.0;
        const poiDistance = atr * atrMultiplier;
        
        // Suggest waiting near support for buys, near resistance for sells
        const nearSupportPOI = support + (poiDistance * 0.3);
        const nearResistancePOI = resistance - (poiDistance * 0.3);
        
        let poi = currentPrice;
        let logic = '';
        
        if (currentPrice > resistance * 0.98) {
            poi = nearResistancePOI;
            logic = 'Price near resistance. Wait for pullback to POI before re-evaluating.';
        } else if (currentPrice < support * 1.02) {
            poi = nearSupportPOI;
            logic = 'Price near support. Wait for confirmation bounce at POI.';
        } else {
            poi = (support + resistance) / 2;
            logic = 'Market indecisive. Wait for break of structure or POI touch.';
        }
        
        return {
            level: this.roundPrice(poi, marketData.assetClass),
            logic: logic
        };
    },
    
    // Determine trade type based on mode and market conditions
    getTradeType(mode, volatility) {
        if (mode === 'scalp') {
            return volatility > 0.5 ? 'AGGRESSIVE SCALP' : 'SCALP';
        } else {
            return volatility < 0.3 ? 'SWING DAY' : 'DAY TRADE';
        }
    }
};
