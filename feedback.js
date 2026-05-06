/**
 * TRADE FEEDBACK SYSTEM with Auto Price Tracking
 */

let tradeHistory = [];
let strategyWeights = {};

const STRATEGY_TYPES = [
    'RSI oversold', 'RSI overbought', 'EMA alignment',
    'Support bounce', 'Resistance reject', 'Signal Confluence'
];

function loadFeedbackData() {
    const saved = localStorage.getItem('omni_feedback_history');
    if (saved) { try { tradeHistory = JSON.parse(saved); } catch(e) {} }
    const savedWeights = localStorage.getItem('omni_strategy_weights');
    if (savedWeights) { try { strategyWeights = JSON.parse(savedWeights); } catch(e) {} }
    if (Object.keys(strategyWeights).length === 0) {
        STRATEGY_TYPES.forEach(s => { strategyWeights[s] = 1.0; });
    }
}

function saveFeedbackData() {
    localStorage.setItem('omni_feedback_history', JSON.stringify(tradeHistory.slice(-200)));
    localStorage.setItem('omni_strategy_weights', JSON.stringify(strategyWeights));
}

function addOpenTrade(signal, marketData, tradeLevels) {
    const trade = {
        id: Date.now(), timestamp: new Date().toISOString(), symbol: marketData.symbol,
        bias: signal.bias, entry: tradeLevels.entry, sl: tradeLevels.stopLoss,
        tp1: tradeLevels.takeProfit1, tp2: tradeLevels.takeProfit2,
        strategy: signal.primaryStrategy || 'Signal Confluence', confidence: signal.confidence,
        status: 'OPEN', result: null, feedbackGiven: false, tpAlmostHit: false
    };
    tradeHistory.unshift(trade);
    saveFeedbackData();
    renderOpenTrades();
}

function getOpenTradesForTracking() { return tradeHistory.filter(t => t.status === 'OPEN'); }

function recordFeedback(tradeId, outcome, notes = '') {
    const trade = tradeHistory.find(t => t.id === tradeId);
    if (!trade || trade.feedbackGiven) return;
    trade.status = 'CLOSED'; trade.result = outcome; trade.feedbackNotes = notes;
    trade.closedAt = new Date().toISOString(); trade.feedbackGiven = true;
    let weightChange = 0;
    switch(outcome) {
        case 'WIN': weightChange = 0.05; break;
        case 'PARTIAL': weightChange = -0.01; break;
        case 'REVERSAL': weightChange = -0.03; break;
        default: weightChange = -0.03;
    }
    const strategies = [trade.strategy];
    for (const strat of strategies) {
        if (strategyWeights[strat] !== undefined) {
            let newWeight = strategyWeights[strat] + weightChange;
            newWeight = Math.max(0.4, Math.min(1.6, newWeight));
            strategyWeights[strat] = newWeight;
        }
    }
    saveFeedbackData();
    renderOpenTrades();
    renderFeedbackHistory();
    updateStrategyPerformance();
    updateWinRateDisplay();
    showToastMessage(`${outcome} recorded for ${trade.symbol}`, outcome === 'WIN' ? 'success' : 'warning');
}

function getCurrentWinRate() {
    const closed = tradeHistory.filter(t => t.status === 'CLOSED' && t.feedbackGiven);
    if (closed.length === 0) return 0;
    const wins = closed.filter(t => t.result === 'WIN').length;
    return Math.round((wins / closed.length) * 100);
}

function updateWinRateDisplay() {
    const winRateEl = document.getElementById('winRateDisplay');
    if (winRateEl) {
        const rate = getCurrentWinRate();
        winRateEl.textContent = `${rate}%`;
        winRateEl.className = rate >= 55 ? 'text-emerald-400' : (rate >= 45 ? 'text-yellow-400' : 'text-rose-400');
    }
}

function getAdjustedConfidence(signal) {
    let weight = strategyWeights[signal.primaryStrategy] || 1.0;
    let adjusted = signal.confidence * weight;
    const similarTrades = tradeHistory.filter(t => t.strategy === signal.primaryStrategy && t.status === 'CLOSED').slice(0,20);
    if (similarTrades.length > 5) {
        const wins = similarTrades.filter(t => t.result === 'WIN').length;
        const recentWR = wins / similarTrades.length;
        adjusted = adjusted * (0.7 + recentWR * 0.6);
    }
    return Math.min(92, Math.max(35, Math.round(adjusted)));
}

function renderOpenTrades() {
    const container = document.getElementById('openTradesContainer');
    if (!container) return;
    const open = tradeHistory.filter(t => t.status === 'OPEN');
    if (open.length === 0) { container.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No open trades.</p>'; return; }
    container.innerHTML = open.map(trade => `
        <div class="bg-black/30 rounded-xl p-3 mb-2 border-l-4 ${trade.bias === 'BUY' ? 'border-emerald-500' : 'border-rose-500'}">
            <div class="flex justify-between items-center mb-2">
                <div><span class="font-bold ${trade.bias === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}">${trade.bias}</span><span class="text-xs ml-2">${trade.symbol}</span><span class="text-[9px] ml-2 text-slate-500">${new Date(trade.timestamp).toLocaleTimeString()}</span></div>
                <span class="text-[9px] text-indigo-400">${trade.confidence}%</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[10px] mb-2">
                <div>Entry: ${trade.entry?.toFixed(5)}</div><div>SL: ${trade.sl?.toFixed(5)}</div><div>TP: ${trade.tp1?.toFixed(5)} / ${trade.tp2?.toFixed(5)}</div>
            </div>
            <div class="text-[9px] text-slate-400 mb-3">${trade.strategy}</div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="window.recordFeedback(${trade.id}, 'WIN')" class="bg-emerald-500/20 text-emerald-400 px-2 py-1.5 rounded-lg text-[9px] hover:bg-emerald-500/30">✅ WIN</button>
                <button onclick="window.recordFeedback(${trade.id}, 'PARTIAL')" class="bg-yellow-500/20 text-yellow-400 px-2 py-1.5 rounded-lg text-[9px] hover:bg-yellow-500/30">⚠️ PARTIAL</button>
                <button onclick="window.recordFeedback(${trade.id}, 'REVERSAL')" class="bg-orange-500/20 text-orange-400 px-2 py-1.5 rounded-lg text-[9px] hover:bg-orange-500/30">🔄 REVERSAL</button>
                <button onclick="window.recordFeedback(${trade.id}, 'LOSS')" class="bg-rose-500/20 text-rose-400 px-2 py-1.5 rounded-lg text-[9px] hover:bg-rose-500/30">❌ LOSS</button>
            </div>
        </div>
    `).join('');
}

function renderFeedbackHistory() {
    const container = document.getElementById('feedbackHistoryContainer');
    if (!container) return;
    const closed = tradeHistory.filter(t => t.status === 'CLOSED').slice(0,30);
    if (closed.length === 0) { container.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No feedback yet.</p>'; return; }
    const wins = closed.filter(t => t.result === 'WIN').length;
    const partials = closed.filter(t => t.result === 'PARTIAL').length;
    const reversals = closed.filter(t => t.result === 'REVERSAL').length;
    const losses = closed.filter(t => t.result === 'LOSS').length;
    container.innerHTML = `
        <div class="grid grid-cols-5 gap-1 mb-3 text-center text-[9px]">
            <div class="bg-emerald-500/10 rounded p-1"><span class="text-emerald-400">WIN</span><br>${wins}</div>
            <div class="bg-yellow-500/10 rounded p-1"><span class="text-yellow-400">PARTIAL</span><br>${partials}</div>
            <div class="bg-orange-500/10 rounded p-1"><span class="text-orange-400">REV</span><br>${reversals}</div>
            <div class="bg-rose-500/10 rounded p-1"><span class="text-rose-400">LOSS</span><br>${losses}</div>
            <div class="bg-indigo-500/10 rounded p-1"><span class="text-indigo-400">TOTAL</span><br>${closed.length}</div>
        </div>
        ${closed.slice(0,10).map(trade => `
            <div class="bg-black/30 rounded-lg p-2 mb-1 text-[10px]">
                <div class="flex justify-between items-center">
                    <div><span class="${trade.result === 'WIN' ? 'text-emerald-400' : trade.result === 'PARTIAL' ? 'text-yellow-400' : trade.result === 'REVERSAL' ? 'text-orange-400' : 'text-rose-400'} font-bold">${trade.result}</span><span class="text-slate-500 ml-2">${trade.symbol}</span></div>
                    <span class="text-[8px] text-slate-600">${new Date(trade.closedAt).toLocaleDateString()}</span>
                </div>
                <div class="text-[8px] text-slate-500 mt-1">${trade.strategy} | ${trade.confidence}%</div>
            </div>
        `).join('')}
    `;
}

function updateStrategyPerformance() {
    const container = document.getElementById('strategyPerformanceContainer');
    if (!container) return;
    const perf = Object.entries(strategyWeights).slice(0,5);
    if (perf.length === 0) { container.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No performance data yet.</p>'; return; }
    container.innerHTML = perf.map(([name, weight]) => `
        <div class="flex justify-between items-center text-[10px] mb-1">
            <span class="w-24 truncate">${name.slice(0,15)}</span>
            <div class="flex items-center gap-2 flex-1">
                <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full ${weight >= 1 ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${Math.min(100, weight * 60)}%"></div>
                </div>
                <span class="w-8 text-right text-[9px]">${Math.round(weight * 100)}%</span>
            </div>
        </div>
    `).join('');
}

function clearAllFeedback() {
    if (confirm('Clear all feedback history?')) {
        tradeHistory = [];
        STRATEGY_TYPES.forEach(s => { strategyWeights[s] = 1.0; });
        saveFeedbackData();
        renderOpenTrades();
        renderFeedbackHistory();
        updateStrategyPerformance();
        showToastMessage('Feedback history cleared', 'info');
    }
}

function showToastMessage(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.recordFeedback = recordFeedback;
window.addOpenTrade = addOpenTrade;
window.getOpenTradesForTracking = getOpenTradesForTracking;
window.saveFeedbackData = saveFeedbackData;
window.renderOpenTrades = renderOpenTrades;
window.renderFeedbackHistory = renderFeedbackHistory;
window.updateStrategyPerformance = updateStrategyPerformance;
window.getCurrentWinRate = getCurrentWinRate;
window.getAdjustedConfidence = getAdjustedConfidence;

document.addEventListener('DOMContentLoaded', () => {
    loadFeedbackData();
    const clearBtn = document.getElementById('clearFeedbackBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAllFeedback);
});
