const RiskManager = {
    calculateTradeLevels(marketData, signal, mode, userConfig) {
        const { currentPrice, atr, support, resistance, multiplier, spread, digits } = marketData;
        const { riskPercent, balance } = userConfig;
        let entry, sl, tp1, tp2, rrRatio = 0;
        if (signal.bias === 'BUY') {
            entry = currentPrice;
            const atrMult = mode === 'scalp' ? 0.45 : 1.0;
            let slDist = atr * atrMult;
            sl = entry - slDist;
            if (sl > support) sl = support * 0.998;
            const minRR = mode === 'scalp' ? 1.5 : 4.0;
            const maxRR = mode === 'scalp' ? 4.0 : 12.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            const risk = entry - sl;
            tp1 = entry + risk;        // 1:1
            tp2 = entry + risk * targetRR;
            if (tp2 > resistance) { tp2 = resistance * 0.998; rrRatio = (tp2 - entry) / risk; }
            else rrRatio = targetRR;
        } else if (signal.bias === 'SELL') {
            entry = currentPrice;
            const atrMult = mode === 'scalp' ? 0.45 : 1.0;
            let slDist = atr * atrMult;
            sl = entry + slDist;
            if (sl < resistance) sl = resistance * 1.002;
            const minRR = mode === 'scalp' ? 1.5 : 4.0;
            const maxRR = mode === 'scalp' ? 4.0 : 12.0;
            const targetRR = Math.min(minRR + (signal.confidence / 100) * 3, maxRR);
            const risk = sl - entry;
            tp1 = entry - risk;
            tp2 = entry - risk * targetRR;
            if (tp2 < support) { tp2 = support * 1.002; rrRatio = (entry - tp2) / risk; }
            else rrRatio = targetRR;
        } else return { entry: null, sl: null, tp1: null, tp2: null, rrRatio: 0, lotSize: 0 };
        const minRRReq = mode === 'scalp' ? 1.5 : 4.0;
        if (rrRatio < minRRReq) return { entry: null, sl: null, tp1: null, tp2: null, rrRatio, lotSize: 0, waitReason: `RR ${rrRatio.toFixed(1)} below ${minRRReq}:1` };
        const riskAmount = balance * (riskPercent / 100);
        const stopDist = Math.abs(entry - sl) + spread;
        let lotSize = riskAmount / (stopDist * multiplier);
        lotSize = Math.floor(lotSize * 1000) / 1000;
        lotSize = Math.max(0.01, Math.min(lotSize, 50));
        const effectiveRR = Math.min(rrRatio, mode === 'scalp' ? 4.0 : 12.0);
        return {
            entry: entry.toFixed(digits), sl: sl.toFixed(digits), tp1: tp1.toFixed(digits), tp2: tp2.toFixed(digits),
            rrRatio: effectiveRR, lotSize, riskDistance: Math.abs(entry - sl)
        };
    },
    generatePOI(marketData, mode) {
        const { currentPrice, atr, support, resistance, digits } = marketData;
        const poiDist = atr * (mode === 'scalp' ? 0.5 : 1.0);
        let poi, logic;
        if (currentPrice > resistance * 0.98) { poi = resistance - poiDist; logic = 'Price near resistance. Wait for pullback to POI.'; }
        else if (currentPrice < support * 1.02) { poi = support + poiDist; logic = 'Price near support. Wait for bounce at POI.'; }
        else { poi = (support + resistance) / 2; logic = 'Market indecisive. Wait for clear signal.'; }
        return { level: poi.toFixed(digits), logic };
    },
    getTradeType(mode, volatility) { return (mode === 'scalp') ? (volatility > 0.5 ? 'AGGRESSIVE SCALP' : 'SCALP') : (volatility < 0.3 ? 'SWING DAY' : 'DAY TRADE'); }
};
