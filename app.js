/**
 * OMNI—SUPREME - XM Edition
 * Complete Application Controller
 */

const elements = {
    analyzeBtn: document.getElementById('analyzeBtn'),
    modeScalp: document.getElementById('modeScalp'),
    modeDay: document.getElementById('modeDay'),
    modeDescription: document.getElementById('modeDescription'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsDrawer: document.getElementById('settingsDrawer'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    closeSettings: document.getElementById('closeSettings'),
    saveSettings: document.getElementById('saveSettings'),
    apiKey: document.getElementById('apiKey'),
    balance: document.getElementById('balance'),
    riskPercent: document.getElementById('riskPercent'),
    modelSelect: document.getElementById('modelSelect'),
    telegramBotToken: document.getElementById('telegramBotToken'),
    telegramChatId: document.getElementById('telegramChatId'),
    testTelegramBtn: document.getElementById('testTelegramBtn'),
    themeToggle: document.getElementById('themeToggle'),
    soundToggle: document.getElementById('soundToggle'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    addXmSymbolBtn: document.getElementById('addXmSymbolBtn'),
    currentSymbolDisplay: document.getElementById('currentSymbolDisplay'),
    currentPrice: document.getElementById('currentPrice'),
    rsiValue: document.getElementById('rsiValue'),
    atrValue: document.getElementById('atrValue'),
    highValue: document.getElementById('highValue'),
    lowValue: document.getElementById('lowValue'),
    signalBias: document.getElementById('signalBias'),
    confidenceScore: document.getElementById('confidenceScore'),
    entryPrice: document.getElementById('entryPrice'),
    stopLoss: document.getElementById('stopLoss'),
    takeProfit: document.getElementById('takeProfit'),
    lotSize: document.getElementById('lotSize'),
    rrRatio: document.getElementById('rrRatio'),
    tradeType: document.getElementById('tradeType'),
    assetClass: document.getElementById('assetClass'),
    activeStrategy: document.getElementById('activeStrategy'),
    logicText: document.getElementById('logicText'),
    poiContainer: document.getElementById('poiContainer'),
    poiLevel: document.getElementById('poiLevel'),
    poiLogic: document.getElementById('poiLogic'),
    historyList: document.getElementById('historyList'),
    xmWatchlistContainer: document.getElementById('xmWatchlistContainer')
};

let currentMode = 'scalp';
let currentMarketData = null;
let currentXmSymbol = 'GOLD';
let soundEnabled = true;
let history = [];
let xmWatchlist = ['GOLD', 'SILVER', 'OILCash', 'EURUSD', 'GBPUSD', 'BTCUSD', 'ETHUSD'];

function loadHistory() {
    const saved = localStorage.getItem('omni_supreme_history');
    if (saved) { history = JSON.parse(saved); renderHistory(); }
}

function saveHistory() { localStorage.setItem('omni_supreme_history', JSON.stringify(history.slice(-100))); renderHistory(); }

function addToHistory(signalData, marketData, tradeLevels) {
    history.unshift({
        id: Date.now(), timestamp: new Date().toISOString(), symbol: currentXmSymbol, mode: currentMode,
        bias: signalData.bias, confidence: signalData.confidence, entry: tradeLevels.entry,
        stopLoss: tradeLevels.stopLoss, takeProfit: tradeLevels.takeProfit, rr: tradeLevels.rrRatio,
        price: marketData.currentPrice, strategy: signalData.primaryStrategy
    });
    saveHistory();
}

function renderHistory() {
    if (!elements.historyList) return;
    if (history.length === 0) { elements.historyList.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No signals recorded yet</p>'; return; }
    elements.historyList.innerHTML = history.slice(0, 30).map(record => `
        <div class="backtest-item slide-in">
            <div class="flex justify-between items-start">
                <div><span class="font-bold ${record.bias === 'BUY' ? 'text-emerald-400' : record.bias === 'SELL' ? 'text-rose-400' : 'text-amber-400'}">${record.bias}</span>
                <span class="text-[10px] text-slate-500 ml-2">${record.symbol}</span><span class="text-[9px] text-slate-600 ml-2">${record.mode}</span></div>
                <span class="text-[9px] text-slate-500">${new Date(record.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="flex gap-3 mt-1 text-[10px] flex-wrap">
                <span>Entry: ${record.entry || '--'}</span><span>SL: ${record.stopLoss || '--'}</span>
                <span>TP: ${record.takeProfit || '--'}</span><span>RR: 1:${record.rr?.toFixed(1) || '0'}</span>
            </div>
            <div class="text-[9px] text-slate-400 mt-1">${record.strategy} | ${record.confidence}% confidence</div>
        </div>
    `).join('');
}

function clearHistory() { if (confirm('Clear all backtest history?')) { history = []; saveHistory(); showToast('History cleared', 'info'); } }

function initTheme() {
    const savedTheme = localStorage.getItem('omni_supreme_theme');
    if (savedTheme === 'light') { document.documentElement.setAttribute('data-theme', 'light'); elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun text-yellow-400 text-xl"></i>'; }
    else { document.documentElement.setAttribute('data-theme', 'dark'); elements.themeToggle.innerHTML = '<i class="fa-solid fa-moon text-slate-400 text-xl"></i>'; }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'light') { document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem('omni_supreme_theme', 'dark'); elements.themeToggle.innerHTML = '<i class="fa-solid fa-moon text-slate-400 text-xl"></i>'; }
    else { document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('omni_supreme_theme', 'light'); elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun text-yellow-400 text-xl"></i>'; }
}

function playSound() { if (!soundEnabled) return; const audio = document.getElementById('alertSound'); if (audio) { audio.currentTime = 0; audio.play().catch(e => console.log('Audio play failed')); } }
function toggleSound() { soundEnabled = !soundEnabled; elements.soundToggle.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-up mr-1"></i> Sound ON' : '<i class="fa-solid fa-volume-mute mr-1"></i> Sound OFF'; localStorage.setItem('omni_supreme_sound', soundEnabled); }

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1';
    toast.innerHTML = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function sendTelegramAlert(message) {
    const botToken = localStorage.getItem('omni_supreme_telegram_bot');
    const chatId = localStorage.getItem('omni_supreme_telegram_chat');
    if (!botToken || !chatId) return false;
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
        });
        const data = await response.json();
        return data.ok;
    } catch (error) { return false; }
}

async function testTelegram() {
    const botToken = elements.telegramBotToken?.value;
    const chatId = elements.telegramChatId?.value;
    if (!botToken || !chatId) { showToast('Enter Bot Token and Chat ID first', 'error'); return; }
    showToast('Sending test message...', 'info');
    const success = await sendTelegramAlert('✅ OMNI-SUPREME Test: Your Telegram alerts are working!');
    if (success) showToast('Test message sent! Check Telegram', 'success');
    else showToast('Failed to send. Check your token and chat ID', 'error');
}

function renderXMWatchlist() {
    if (!elements.xmWatchlistContainer) return;
    elements.xmWatchlistContainer.innerHTML = xmWatchlist.map((symbol, idx) => `
        <div class="xm-symbol-card ${currentXmSymbol === symbol ? 'active' : ''}" data-symbol="${symbol}" onclick="selectXmSymbol('${symbol}')">
            <div class="flex justify-between items-center">
                <span class="font-bold font-mono text-sm">${MarketData.xmSymbols[symbol]?.displayName || symbol}</span>
                <button class="remove-symbol text-slate-500 hover:text-rose-400 text-xs px-2" onclick="event.stopPropagation(); removeXmSymbol('${symbol}')">✕</button>
            </div>
            <div class="mt-1"><p class="text-[10px] text-slate-400">Price: <span id="price_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}">--</span></p></div>
        </div>
    `).join('');
    xmWatchlist.forEach(async (symbol) => {
        try { const data = await MarketData.fetch(symbol); if (data) { const span = document.getElementById(`price_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`); if (span) span.textContent = data.currentPrice.toFixed(data.digits || 2); } } catch(e) {}
    });
}

window.selectXmSymbol = function(symbol) { currentXmSymbol = symbol; elements.currentSymbolDisplay.textContent = MarketData.xmSymbols[symbol]?.displayName || symbol; renderXMWatchlist(); loadMarketData(); showToast(`Switched to ${symbol}`, 'info'); };
window.removeXmSymbol = function(symbol) { if (xmWatchlist.length <= 1) { showToast('Cannot remove last symbol', 'error'); return; } xmWatchlist = xmWatchlist.filter(s => s !== symbol); if (currentXmSymbol === symbol) currentXmSymbol = xmWatchlist[0]; localStorage.setItem('omni_supreme_watchlist', JSON.stringify(xmWatchlist)); renderXMWatchlist(); loadMarketData(); showToast(`Removed ${symbol}`, 'info'); };

function addXmSymbol() {
    const newSymbol = prompt('Enter XM symbol name (e.g., GOLD, EURUSD, BTCUSD):', '');
    if (newSymbol && !xmWatchlist.includes(newSymbol.toUpperCase())) {
        xmWatchlist.push(newSymbol.toUpperCase());
        localStorage.setItem('omni_supreme_watchlist', JSON.stringify(xmWatchlist));
        renderXMWatchlist();
        showToast(`✅ Added ${newSymbol.toUpperCase()}`, 'success');
    } else if (newSymbol) showToast(`⚠️ ${newSymbol} already exists`, 'error');
}

function init() {
    loadHistory();
    initTheme();
    const savedSound = localStorage.getItem('omni_supreme_sound');
    if (savedSound !== null) soundEnabled = savedSound === 'true';
    elements.soundToggle.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-up mr-1"></i> Sound ON' : '<i class="fa-solid fa-volume-mute mr-1"></i> Sound OFF';
    const savedWatchlist = localStorage.getItem('omni_supreme_watchlist');
    if (savedWatchlist) { try { const parsed = JSON.parse(savedWatchlist); if (parsed.length > 0) xmWatchlist = parsed; } catch(e) {} }
    loadSavedSettings();
    setupEventListeners();
    renderXMWatchlist();
    loadDefaultData();
}

function setupEventListeners() {
    if (elements.analyzeBtn) elements.analyzeBtn.addEventListener('click', executeAnalysis);
    if (elements.modeScalp) elements.modeScalp.addEventListener('click', () => setMode('scalp'));
    if (elements.modeDay) elements.modeDay.addEventListener('click', () => setMode('day'));
    if (elements.settingsBtn) elements.settingsBtn.addEventListener('click', toggleSettings);
    if (elements.closeSettings) elements.closeSettings.addEventListener('click', toggleSettings);
    if (elements.drawerOverlay) elements.drawerOverlay.addEventListener('click', toggleSettings);
    if (elements.saveSettings) elements.saveSettings.addEventListener('click', saveSettings);
    if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
    if (elements.soundToggle) elements.soundToggle.addEventListener('click', toggleSound);
    if (elements.clearHistoryBtn) elements.clearHistoryBtn.addEventListener('click', clearHistory);
    if (elements.addXmSymbolBtn) elements.addXmSymbolBtn.addEventListener('click', addXmSymbol);
    if (elements.testTelegramBtn) elements.testTelegramBtn.addEventListener('click', testTelegram);
}

function setMode(mode) {
    currentMode = mode;
    if (mode === 'scalp') { elements.modeScalp?.classList.add('active'); elements.modeDay?.classList.remove('active'); elements.modeDescription.textContent = '⚡ AGGRESSIVE | 1:1.5 to 1:4 RR | Lower-Medium Risk'; }
    else { elements.modeDay?.classList.add('active'); elements.modeScalp?.classList.remove('active'); elements.modeDescription.textContent = '📊 LOGICAL | 1:4 to 1:10 RR | Conservative Risk'; }
    if (currentMarketData) executeAnalysis();
}

function loadSavedSettings() {
    const saved = localStorage.getItem('omni_supreme_config');
    if (saved) {
        try { const config = JSON.parse(saved);
            if (elements.apiKey) elements.apiKey.value = config.apiKey || '';
            if (elements.balance) elements.balance.value = config.balance || '10000';
            if (elements.riskPercent) elements.riskPercent.value = config.riskPercent || '1.0';
            if (elements.modelSelect) elements.modelSelect.value = config.model || 'gemini-2.5-flash-lite';
            if (elements.telegramBotToken) elements.telegramBotToken.value = config.telegramBot || '';
            if (elements.telegramChatId) elements.telegramChatId.value = config.telegramChat || '';
            if (config.telegramBot) localStorage.setItem('omni_supreme_telegram_bot', config.telegramBot);
            if (config.telegramChat) localStorage.setItem('omni_supreme_telegram_chat', config.telegramChat);
        } catch(e) { console.error('Load settings error:', e); }
    }
}

function saveSettings() {
    const config = {
        apiKey: elements.apiKey?.value || '', balance: elements.balance?.value || '10000',
        riskPercent: elements.riskPercent?.value || '1.0', model: elements.modelSelect?.value || 'gemini-2.5-flash-lite',
        telegramBot: elements.telegramBotToken?.value || '', telegramChat: elements.telegramChatId?.value || ''
    };
    localStorage.setItem('omni_supreme_config', JSON.stringify(config));
    localStorage.setItem('gemini_api_key', config.apiKey);
    localStorage.setItem('omni_supreme_telegram_bot', config.telegramBot);
    localStorage.setItem('omni_supreme_telegram_chat', config.telegramChat);
    if (elements.saveSettings) { elements.saveSettings.textContent = '✓ SAVED'; setTimeout(() => { if (elements.saveSettings) elements.saveSettings.textContent = 'SAVE & SECURE'; }, 1500); }
    toggleSettings();
    showToast('✅ Settings saved permanently!', 'success');
}

function toggleSettings() {
    const isOpen = elements.settingsDrawer?.classList.contains('translate-x-0');
    if (isOpen) { elements.settingsDrawer?.classList.remove('translate-x-0'); elements.settingsDrawer?.classList.add('translate-x-full'); elements.drawerOverlay?.classList.add('hidden'); }
    else { elements.settingsDrawer?.classList.remove('translate-x-full'); elements.settingsDrawer?.classList.add('translate-x-0'); elements.drawerOverlay?.classList.remove('hidden'); }
}

async function loadDefaultData() { try { currentMarketData = await MarketData.fetch(currentXmSymbol); if (currentMarketData) updateMetricsDisplay(currentMarketData); } catch (error) { console.error('Initial data load failed:', error); } }

async function loadMarketData() { showLoading(true); try { currentMarketData = await MarketData.fetch(currentXmSymbol); if (currentMarketData) updateMetricsDisplay(currentMarketData); } catch (error) { console.error('Load failed:', error); } finally { showLoading(false); } }

function updateMetricsDisplay(data) {
    if (!data) return;
    const digits = data.digits || 2;
    if (elements.currentPrice) elements.currentPrice.textContent = data.currentPrice.toFixed(digits);
    if (elements.rsiValue) elements.rsiValue.textContent = data.rsi.toFixed(1);
    if (elements.atrValue) elements.atrValue.textContent = data.atr.toFixed(digits+1);
    if (elements.highValue) elements.highValue.textContent = data.high24h.toFixed(digits);
    if (elements.lowValue) elements.lowValue.textContent = data.low24h.toFixed(digits);
    if (data.rsi > 70 && elements.rsiValue) elements.rsiValue.style.color = '#ff4466';
    else if (data.rsi < 30 && elements.rsiValue) elements.rsiValue.style.color = '#00ff88';
    else if (elements.rsiValue) elements.rsiValue.style.color = '';
}

function generateWaitPOI(symbol, lastPrice) {
    const defaultPOIs = { 'GOLD': 2650, 'SILVER': 30.5, 'OILCash': 75, 'EURUSD': 1.0850, 'GBPUSD': 1.3000, 'BTCUSD': 60000, 'ETHUSD': 2500 };
    const poi = lastPrice || defaultPOIs[symbol] || 1.0000;
    return { level: poi, logic: `No market data available. Re-scan when price returns to ${poi} or check internet.` };
}

async function executeAnalysis() {
    const config = JSON.parse(localStorage.getItem('omni_supreme_config') || '{}');
    const apiKey = config.apiKey;
    if (!apiKey) { toggleSettings(); alert('⚠️ Please configure your Gemini API key first'); return; }
    showLoading(true);
    try {
        currentMarketData = await MarketData.fetch(currentXmSymbol);
        if (!currentMarketData) {
            const poi = generateWaitPOI(currentXmSymbol);
            elements.signalBias.textContent = 'WAIT'; elements.signalBias.className = 'text-6xl md:text-7xl font-black italic tracking-tighter signal-wait';
            elements.confidenceScore.textContent = '0%'; elements.entryPrice.textContent = '--'; elements.stopLoss.textContent = '--';
            elements.takeProfit.textContent = '--'; elements.lotSize.textContent = '--'; elements.rrRatio.textContent = '0:0';
            elements.poiLevel.textContent = poi.level; elements.poiLogic.textContent = poi.logic; elements.poiContainer.classList.remove('hidden');
            elements.logicText.innerHTML = `⚠️ NO MARKET DATA AVAILABLE<br>${poi.logic}`;
            showToast(`Cannot fetch data for ${currentXmSymbol}. Will retry at POI.`, 'error');
            setTimeout(() => { if (document.getElementById('signalBias')?.textContent === 'WAIT') executeAnalysis(); }, 10000);
            return;
        }
        updateMetricsDisplay(currentMarketData);
        const dxyData = await MarketData.fetchDXY();
        const balance = parseFloat(config.balance) || 10000;
        const riskPercent = parseFloat(config.riskPercent) || 1.0;
        const signal = await StrategyEngine.analyze(currentMarketData, currentMode, { dxyData });
        const modelSetting = config.model || 'gemini-2.5-flash-lite';
        const aiAnalysis = await getGeminiAnalysis(currentMarketData, signal, currentMode, apiKey, modelSetting);
        const tradeLevels = RiskManager.calculateTradeLevels(currentMarketData, signal, currentMode, { balance, riskPercent });
        let poiData = null;
        if (signal.bias === 'WAIT' || tradeLevels.waitReason) poiData = RiskManager.generatePOI(currentMarketData, currentMode);
        renderResults(signal, tradeLevels, poiData, aiAnalysis, currentMarketData);
        if (signal.bias !== 'WAIT') elements.poiContainer.classList.add('hidden');
        if (signal.bias !== 'WAIT' && tradeLevels.entry) {
            addToHistory(signal, currentMarketData, tradeLevels);
            const message = `🚀 OMNI-SUPREME SIGNAL\n\nSymbol: ${currentXmSymbol}\nBias: ${signal.bias}\nEntry: ${tradeLevels.entry}\nSL: ${tradeLevels.stopLoss}\nTP: ${tradeLevels.takeProfit}\nRR: 1:${tradeLevels.rrRatio.toFixed(1)}\nStrategy: ${signal.primaryStrategy}`;
            await sendTelegramAlert(message);
            playSound();
            showToast(`🔔 ${signal.bias} signal generated for ${currentXmSymbol}!`, 'success');
        }
    } catch (error) {
        console.error('Analysis failed:', error);
        const poi = generateWaitPOI(currentXmSymbol, currentMarketData?.currentPrice);
        elements.signalBias.textContent = 'WAIT';
        elements.poiLevel.textContent = poi.level;
        elements.poiLogic.textContent = poi.logic;
        elements.poiContainer.classList.remove('hidden');
        elements.logicText.innerHTML = `⚠️ ERROR: ${error.message}<br>${poi.logic}`;
    } finally { showLoading(false); }
}

async function getGeminiAnalysis(marketData, signal, mode, apiKey, modelSetting) {
    const prompt = `You are OMNI-SUPREME trading analyzer. Analyze: SYMBOL: ${marketData.xmSymbol}, MODE: ${mode.toUpperCase()}, PRICE: ${marketData.currentPrice}, RSI: ${marketData.rsi.toFixed(1)}, ATR: ${marketData.atr.toFixed(4)}, TREND: ${marketData.trend}, SIGNAL: ${signal.bias}, CONFIDENCE: ${signal.confidence}%, STRATEGY: ${signal.primaryStrategy}. Provide 10-15 word logic summary. Output ONLY JSON: {"logic": "your explanation here"}`;
    let modelsToTry = [];
    if (modelSetting === 'both') modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    else if (modelSetting === 'gemini-2.5-flash') modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    else modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    for (const model of modelsToTry) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 150 } })
            });
            const data = await response.json();
            if (data.error) continue;
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const text = data.candidates[0].content.parts[0].text;
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) return JSON.parse(jsonMatch[0]);
            }
        } catch (err) { continue; }
    }
    return { logic: `${signal.primaryStrategy} triggered with ${signal.confidence}% confluence.` };
}

function renderResults(signal, tradeLevels, poiData, aiAnalysis, marketData) {
    const bias = signal.bias;
    if (elements.signalBias) { elements.signalBias.textContent = bias; elements.signalBias.className = `text-6xl md:text-7xl font-black italic tracking-tighter ${bias === 'BUY' ? 'signal-buy' : bias === 'SELL' ? 'signal-sell' : 'signal-wait'}`; }
    if (elements.confidenceScore) elements.confidenceScore.textContent = `${signal.confidence}%`;
    if (elements.activeStrategy) elements.activeStrategy.textContent = signal.primaryStrategy;
    if (elements.assetClass) elements.assetClass.textContent = marketData.displayName || marketData.xmSymbol;
    if (elements.tradeType) elements.tradeType.textContent = RiskManager.getTradeType(currentMode, marketData.volatility);
    const hasValidTrade = tradeLevels.entry && tradeLevels.entry !== null && bias !== 'WAIT';
    if (hasValidTrade) {
        if (elements.entryPrice) elements.entryPrice.textContent = tradeLevels.entry;
        if (elements.stopLoss) elements.stopLoss.textContent = tradeLevels.stopLoss;
        if (elements.takeProfit) elements.takeProfit.textContent = tradeLevels.takeProfit;
        if (elements.lotSize) elements.lotSize.textContent = tradeLevels.lotSize.toFixed(3);
        if (elements.rrRatio) { elements.rrRatio.textContent = `1:${tradeLevels.rrRatio.toFixed(1)}`; const minGood = currentMode === 'scalp' ? 2.0 : 4.0; elements.rrRatio.style.color = tradeLevels.rrRatio >= minGood ? '#00ff88' : '#ffaa00'; }
        if (elements.poiContainer) elements.poiContainer.classList.add('hidden');
        let logicText = aiAnalysis?.logic || `${signal.primaryStrategy} triggered. ${signal.confidence}% confluence.`;
        if (elements.logicText) elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${bias} SIGNAL</span><br>${logicText}`;
    } else {
        if (elements.entryPrice) elements.entryPrice.textContent = '--';
        if (elements.stopLoss) elements.stopLoss.textContent = '--';
        if (elements.takeProfit) elements.takeProfit.textContent = '--';
        if (elements.lotSize) elements.lotSize.textContent = '--';
        if (poiData && elements.poiContainer) { if (elements.poiLevel) elements.poiLevel.textContent = poiData.level; if (elements.poiLogic) elements.poiLogic.textContent = poiData.logic; elements.poiContainer.classList.remove('hidden'); }
        else if (elements.poiContainer) elements.poiContainer.classList.add('hidden');
        const targetRR = currentMode === 'scalp' ? '1:1.5' : '1:4';
        if (elements.rrRatio) { elements.rrRatio.textContent = `0:0 (min ${targetRR})`; elements.rrRatio.style.color = '#ffaa00'; }
        let waitReason = tradeLevels.waitReason || 'Insufficient confluence across 15 strategies.';
        if (elements.logicText) elements.logicText.innerHTML = `<span class="text-amber-400">⏸️ WAIT MODE</span><br>${waitReason}`;
    }
}

function showLoading(show) {
    if (elements.loadingOverlay) {
        if (show) { elements.loadingOverlay.style.display = 'flex'; if (elements.analyzeBtn) { elements.analyzeBtn.disabled = true; elements.analyzeBtn.style.opacity = '0.6'; } }
        else { elements.loadingOverlay.style.display = 'none'; if (elements.analyzeBtn) { elements.analyzeBtn.disabled = false; elements.analyzeBtn.style.opacity = '1'; } }
    }
}

init();
