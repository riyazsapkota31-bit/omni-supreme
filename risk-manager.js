/**
 * RISK MANAGER - XM Broker Calibration
 */

const RiskManager = {
    
    calculateTradeLevels(marketData, signal, mode, userConfig) {
        const { currentPrice, atr, support, resistance, assetClass, multiplier, spread, digits } = marketData;
        const { riskPercent, balance } = userConfig;
        
        let entry, stopLoss, takeProfit;
        let rrRatio = 0;
        
        if (signal.bias === 'BUY') {
            entry = currentPrice;
            const atrMultiplier = mode === 'scalp' ? 0.5 : 1.0;
            const slDistance = atr * atrMultiplier;
            stopLoss = currentPrice - slDistance;
            if (stopLoss > support) stopLoss = support * 0.998;
            
            // CORRECTED: Day trading min RR changed from 3.0 to 4.0
            const minRR = mode === 'scalp' ? 1.5 : 4.0;
            const maxRR = mode === 'scalp' ? 4.0 : 10.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            const actualRisk = Math.abs(entry - stopLoss);
            const rewardDistance = actualRisk * targetRR;
            takeProfit = entry + rewardDistance;
            if (takeProfit > resistance) {
                takeProfit = resistance * 0.998;
                rrRatio = Math.abs(takeProfit - entry) / actualRisk;
            } else {
                rrRatio = targetRR;
            }
            
        } else if (signal.bias === 'SELL') {
            entry = currentPrice;
            const atrMultiplier = mode === 'scalp' ? 0.5 : 1.0;
            const slDistance = atr * atrMultiplier;
            stopLoss = currentPrice + slDistance;
            if (stopLoss < resistance) stopLoss = resistance * 1.002;
            
            // CORRECTED: Day trading min RR changed from 3.0 to 4.0
            const minRR = mode === 'scalp' ? 1.5 : 4.0;
            const maxRR = mode === 'scalp' ? 4.0 : 10.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            const actualRisk = Math.abs(stopLoss - entry);
            const rewardDistance = actualRisk * targetRR;
            takeProfit = entry - rewardDistance;
            if (takeProfit < support) {
                takeProfit = support * 1.002;
                rrRatio = Math.abs(entry - takeProfit) / actualRisk;
            } else {
                rrRatio = targetRR;
            }
        } else {
            return { entry: null, stopLoss: null, takeProfit: null, rrRatio: 0, lotSize: 0 };
        }
        
        // CORRECTED: Day trading min RR changed from 3.0 to 4.0
        const minRRRequired = mode === 'scalp' ? 1.5 : 4.0;
        if (rrRatio < minRRRequired) {
            return { entry: null, stopLoss: null, takeProfit: null, rrRatio: rrRatio, lotSize: 0, waitReason: `RR ${rrRatio.toFixed(1)} below minimum ${minRRRequired}:1` };
        }
        
        const lotSize = this.calculateLotSize(entry, stopLoss, balance, riskPercent, multiplier, spread);
        const effectiveRR = Math.min(rrRatio, mode === 'scalp' ? 4.0 : 10.0);
        
        return {
            entry: this.roundPrice(entry, digits || 5),
            stopLoss: this.roundPrice(stopLoss, digits || 5),
            takeProfit: this.roundPrice(takeProfit, digits || 5),
            rrRatio: effectiveRR,
            lotSize: lotSize,
            riskDistance: Math.abs(entry - stopLoss)
        };
    },
    
    calculateLotSize(entry, stopLoss, balance, riskPercent, multiplier, spread) {
        const riskAmount = balance * (riskPercent / 100);
        const stopDistance = Math.abs(entry - stopLoss) + spread;
        if (stopDistance <= 0) return 0;
        let lotSize = riskAmount / (stopDistance * multiplier);
        lotSize = Math.floor(lotSize * 1000) / 1000;
        lotSize = Math.max(0.01, Math.min(lotSize, 50));
        return lotSize;
    },
    
    roundPrice(price, digits) {
        return price.toFixed(digits);
    },
    
    generatePOI(marketData, mode) {
        const { currentPrice, atr, support, resistance, digits } = marketData;
        const atrMultiplier = mode === 'scalp' ? 0.5 : 1.0;
        const poiDistance = atr * atrMultiplier;
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
        
        return { level: this.roundPrice(poi, digits || 5), logic: logic };
    },
    
    getTradeType(mode, volatility) {
        if (mode === 'scalp') return volatility > 0.5 ? 'AGGRESSIVE SCALP' : 'SCALP';
        return volatility < 0.3 ? 'SWING DAY' : 'DAY TRADE';
    }
};
