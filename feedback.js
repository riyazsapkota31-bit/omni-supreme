let tradeHistory = [];
let strategyWeights = {};

const STRATEGY_TYPES = ['RSI oversold', 'RSI overbought', 'EMA alignment', 'Support bounce', 'Resistance reject', 'Signal Confluence'];
function loadFeedbackData() {
    const saved = localStorage.getItem('omni_feedback_history');
    if (saved) try { tradeHistory = JSON.parse(saved); } catch(e) {}
    const savedW = localStorage.getItem('omni_strategy_weights');
    if (savedW) try { strategyWeights = JSON.parse(savedW); } catch(e) {}
    if (Object.keys(strategyWeights).length === 0) STRATEGY_TYPES.forEach(s => strategyWeights[s] = 1.0);
}
function saveFeedbackData() {
    localStorage.setItem('omni_feedback_history', JSON.stringify(tradeHistory.slice(-200)));
    localStorage.setItem('omni_strategy_weights', JSON.stringify(strategyWeights));
}
function addOpenTrade(signal, marketData, tradeLevels) {
    tradeHistory.unshift({ id: Date.now(), timestamp: new Date().toISOString(), symbol: marketData.symbol, bias: signal.bias,
        entry: tradeLevels.entry, sl: tradeLevels.sl, tp1: tradeLevels.tp1, tp2: tradeLevels.tp2,
        strategy: signal.primaryStrategy, confidence: signal.confidence, status: 'OPEN', result: null, feedbackGiven: false });
    saveFeedbackData(); renderOpenTrades();
}
function getOpenTradesForTracking() { return tradeHistory.filter(t => t.status === 'OPEN'); }
function recordFeedback(tradeId, outcome, notes = '') {
    const trade = tradeHistory.find(t => t.id === tradeId);
    if (!trade || trade.feedbackGiven) return;
    trade.status = 'CLOSED'; trade.result = outcome; trade.feedbackNotes = notes; trade.closedAt = new Date().toISOString(); trade.feedbackGiven = true;
    let weightChange = outcome === 'WIN' ? 0.05 : (outcome === 'PARTIAL' ? -0.01 : -0.03);
    const strategies = [trade.strategy];
    for (const strat of strategies) if (strategyWeights[strat] !== undefined) strategyWeights[strat] = Math.max(0.4, Math.min(1.6, strategyWeights[strat] + weightChange));
    saveFeedbackData(); renderOpenTrades(); renderFeedbackHistory(); updateStrategyPerformance(); updateWinRateDisplay();
    showToastMessage(`${outcome} recorded for ${trade.symbol}`, outcome === 'WIN' ? 'success' : 'warning');
}
function getCurrentWinRate() {
    const closed = tradeHistory.filter(t => t.status === 'CLOSED' && t.feedbackGiven);
    if (!closed.length) return 0;
    return Math.round((closed.filter(t => t.result === 'WIN').length / closed.length) * 100);
}
function updateWinRateDisplay() {
    const el = document.getElementById('winRateDisplay');
    if (el) { const wr = getCurrentWinRate(); el.textContent = `${wr}%`; el.className = wr >= 55 ? 'text-emerald-400' : (wr >= 45 ? 'text-yellow-400' : 'text-rose-400'); }
}
function renderOpenTrades() {
    const container = document.getElementById('openTradesContainer');
    if (!container) return;
    const open = tradeHistory.filter(t => t.status === 'OPEN');
    if (!open.length) { container.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No open trades.</p>'; return; }
    container.innerHTML = open.map(t => `
        <div class="bg-black/30 rounded-xl p-3 mb-2 border-l-4 ${t.bias === 'BUY' ? 'border-emerald-500' : 'border-rose-500'}">
            <div class="flex justify-between items-center mb-2"><div><span class="font-bold ${t.bias === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}">${t.bias}</span><span class="text-xs ml-2">${t.symbol}</span><span class="text-[9px] ml-2 text-slate-500">${new Date(t.timestamp).toLocaleTimeString()}</span></div><span class="text-[9px] text-indigo-400">${t.confidence}%</span></div>
            <div class="grid grid-cols-3 gap-2 text-[10px] mb-2"><div>Entry: ${t.entry}</div><div>SL: ${t.sl}</div><div>TP: ${t.tp1} / ${t.tp2}</div></div>
            <div class="text-[9px] text-slate-400 mb-3">${t.strategy}</div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="window.recordFeedback(${t.id}, 'WIN')" class="bg-emerald-500/20 text-emerald-400 px-2 py-1.5 rounded-lg text-[9px]">✅ WIN</button>
                <button onclick="window.recordFeedback(${t.id}, 'PARTIAL')" class="bg-yellow-500/20 text-yellow-400 px-2 py-1.5 rounded-lg text-[9px]">⚠️ PARTIAL</button>
                <button onclick="window.recordFeedback(${t.id}, 'REVERSAL')" class="bg-orange-500/20 text-orange-400 px-2 py-1.5 rounded-lg text-[9px]">🔄 REVERSAL</button>
                <button onclick="window.recordFeedback(${t.id}, 'LOSS')" class="bg-rose-500/20 text-rose-400 px-2 py-1.5 rounded-lg text-[9px]">❌ LOSS</button>
            </div>
        </div>`).join('');
}
function renderFeedbackHistory() {
    const container = document.getElementById('feedbackHistoryContainer');
    if (!container) return;
    const closed = tradeHistory.filter(t => t.status === 'CLOSED').slice(0,30);
    if (!closed.length) { container.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No feedback yet.</p>'; return; }
    const wins = closed.filter(t => t.result === 'WIN').length, partials = closed.filter(t => t.result === 'PARTIAL').length, revs = closed.filter(t => t.result === 'REVERSAL').length, losses = closed.filter(t => t.result === 'LOSS').length;
    container.innerHTML = `<div class="grid grid-cols-5 gap-1 mb-3 text-center text-[9px]"><div class="bg-emerald-500/10 rounded p-1"><span class="text-emerald-400">WIN</span><br>${wins}</div><div class="bg-yellow-500/10 rounded p-1"><span class="text-yellow-400">PARTIAL</span><br>${partials}</div><div class="bg-orange-500/10 rounded p-1"><span class="text-orange-400">REV</span><br>${revs}</div><div class="bg-rose-500/10 rounded p-1"><span class="text-rose-400">LOSS</span><br>${losses}</div><div class="bg-indigo-500/10 rounded p-1"><span class="text-indigo-400">TOTAL</span><br>${closed.length}</div></div>${closed.slice(0,10).map(t => `<div class="bg-black/30 rounded-lg p-2 mb-1 text-[10px]"><div class="flex justify-between items-center"><div><span class="${t.result === 'WIN' ? 'text-emerald-400' : t.result === 'PARTIAL' ? 'text-yellow-400' : t.result === 'REVERSAL' ? 'text-orange-400' : 'text-rose-400'} font-bold">${t.result}</span><span class="text-slate-500 ml-2">${t.symbol}</span></div><span class="text-[8px] text-slate-600">${new Date(t.closedAt).toLocaleDateString()}</span></div><div class="text-[8px] text-slate-500 mt-1">${t.strategy} | ${t.confidence}%</div></div>`).join('')}`;
}
function updateStrategyPerformance() {
    const container = document.getElementById('strategyPerformanceContainer');
    if (!container) return;
    const perf = Object.entries(strategyWeights).slice(0,5);
    if (!perf.length) { container.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No data.</p>'; return; }
    container.innerHTML = perf.map(([name, weight]) => `<div class="flex justify-between items-center text-[10px] mb-1"><span class="w-24 truncate">${name.slice(0,15)}</span><div class="flex items-center gap-2 flex-1"><div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div class="h-full ${weight >= 1 ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${Math.min(100, weight * 60)}%"></div></div><span class="w-8 text-right text-[9px]">${Math.round(weight * 100)}%</span></div></div>`).join('');
}
function clearAllFeedback() { if (confirm('Clear all feedback?')) { tradeHistory = []; STRATEGY_TYPES.forEach(s => strategyWeights[s] = 1.0); saveFeedbackData(); renderOpenTrades(); renderFeedbackHistory(); updateStrategyPerformance(); showToastMessage('History cleared', 'info'); } }
function showToastMessage(msg, type) { const toast = document.createElement('div'); toast.className = `toast toast-${type}`; toast.textContent = msg; document.body.appendChild(toast); setTimeout(() => toast.remove(), 3000); }
window.recordFeedback = recordFeedback; window.addOpenTrade = addOpenTrade; window.getOpenTradesForTracking = getOpenTradesForTracking; window.saveFeedbackData = saveFeedbackData; window.renderOpenTrades = renderOpenTrades; window.renderFeedbackHistory = renderFeedbackHistory; window.updateStrategyPerformance = updateStrategyPerformance; window.getCurrentWinRate = getCurrentWinRate;
document.addEventListener('DOMContentLoaded', () => { loadFeedbackData(); const btn = document.getElementById('clearFeedbackBtn'); if (btn) btn.addEventListener('click', clearAllFeedback); });
