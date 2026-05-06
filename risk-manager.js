/**
 * RISK MANAGER - XM Broker Calibration
 * Upgrades: 4 (tighter stops for scalp: ATR multiplier 0.45), 6 (partial profit taking), 10 (max RR day=12)
 */

const RiskManager = {
    
    calculateTradeLevels(marketData, signal, mode, userConfig) {
        const { currentPrice, atr, support, resistance, assetClass, multiplier, spread, digits } = marketData;
        const { riskPercent, balance } = userConfig;
        
        let entry, stopLoss, takeProfit1, takeProfit2;
        let rrRatio = 0;
        
        if (signal.bias === 'BUY') {
            entry = currentPrice;
            // Upgrade 4: ATR multiplier 0.45 for scalp (instead of 0.5)
            const atrMultiplier = (mode === 'scalp') ? 0.45 : 1.0;
            const slDistance = atr * atrMultiplier;
            stopLoss = currentPrice - slDistance;
            if (stopLoss > support) stopLoss = support * 0.998;
            
            const minRR = (mode === 'scalp') ? 1.5 : 4.0;
            // Upgrade 10: maxRR for day trading set to 12
            const maxRR = (mode === 'scalp') ? 4.0 : 12.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            const actualRisk = Math.abs(entry - stopLoss);
            const rewardDistance = actualRisk * targetRR;
            
            // Upgrade 6: Partial profit taking – first TP at 1:1, second at full target
            const riskAmount = actualRisk;
            takeProfit1 = entry + riskAmount;      // 1:1 RR
            takeProfit2 = entry + rewardDistance;  // full target
            
            if (takeProfit2 > resistance) {
                takeProfit2 = resistance * 0.998;
                rrRatio = Math.abs(takeProfit2 - entry) / actualRisk;
            } else {
                rrRatio = targetRR;
            }
            
        } else if (signal.bias === 'SELL') {
            entry = currentPrice;
            const atrMultiplier = (mode === 'scalp') ? 0.45 : 1.0;
            const slDistance = atr * atrMultiplier;
            stopLoss = currentPrice + slDistance;
            if (stopLoss < resistance) stopLoss = resistance * 1.002;
            
            const minRR = (mode === 'scalp') ? 1.5 : 4.0;
            const maxRR = (mode === 'scalp') ? 4.0 : 12.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            const actualRisk = Math.abs(stopLoss - entry);
            const rewardDistance = actualRisk * targetRR;
            
            const riskAmount = actualRisk;
            takeProfit1 = entry - riskAmount;
            takeProfit2 = entry - rewardDistance;
            
            if (takeProfit2 < support) {
                takeProfit2 = support * 1.002;
                rrRatio = Math.abs(entry - takeProfit2) / actualRisk;
            } else {
                rrRatio = targetRR;
            }
        } else {
            return { entry: null, stopLoss: null, takeProfit1: null, takeProfit2: null, rrRatio: 0, lotSize: 0 };
        }
        
        const minRRRequired = (mode === 'scalp') ? 1.5 : 4.0;
        if (rrRatio < minRRRequired) {
            return { entry: null, stopLoss: null, takeProfit1: null, takeProfit2: null, rrRatio, lotSize: 0, waitReason: `RR ${rrRatio.toFixed(1)} below ${minRRRequired}:1` };
        }
        
        const lotSize = this.calculateLotSize(entry, stopLoss, balance, riskPercent, multiplier, spread);
        const effectiveRR = Math.min(rrRatio, (mode === 'scalp') ? 4.0 : 12.0);
        
        return {
            entry: this.roundPrice(entry, digits || 5),
            stopLoss: this.roundPrice(stopLoss, digits || 5),
            takeProfit1: this.roundPrice(takeProfit1, digits || 5),
            takeProfit2: this.roundPrice(takeProfit2, digits || 5),
            rrRatio: effectiveRR,
            lotSize: lotSize,
            riskDistance: Math.abs(entry - stopLoss)
        };
    },
    
    calculateLotSize(entry, stopLoss, balance, riskPercent, multiplier, spread) {
        const riskAmount = balance * (riskPercent / 100);
        const stopDistance = Math.abs(entry - stopLoss) + spread;
        if (stopDistance <= 0) return 0.01;
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
        const atrMultiplier = (mode === 'scalp') ? 0.5 : 1.0;
        const poiDistance = atr * atrMultiplier;
        const nearSupportPOI = support + (poiDistance * 0.3);
        const nearResistancePOI = resistance - (poiDistance * 0.3);
        
        let poi = currentPrice;
        let logic = '';
        if (currentPrice > resistance * 0.98) {
            poi = nearResistancePOI;
            logic = 'Price near resistance. Wait for pullback to POI.';
        } else if (currentPrice < support * 1.02) {
            poi = nearSupportPOI;
            logic = 'Price near support. Wait for bounce at POI.';
        } else {
            poi = (support + resistance) / 2;
            logic = 'Market indecisive. Wait for clear signal.';
        }
        return { level: this.roundPrice(poi, digits || 5), logic };
    },
    
    getTradeType(mode, volatility) {
        if (mode === 'scalp') return (volatility > 0.5) ? 'AGGRESSIVE SCALP' : 'SCALP';
        return (volatility < 0.3) ? 'SWING DAY' : 'DAY TRADE';
    }
};
