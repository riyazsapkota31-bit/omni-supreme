/**
 * OMNI—SUPREME V2.1
 * Fixed: API key persistence + Unlimited symbols
 */

// DOM Elements
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
    addSymbolBtn: document.getElementById('addSymbolBtn'),
    currentSymbolDisplay: document.getElementById('currentSymbolDisplay'),
    
    // Display elements
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
    historyList: document.getElementById('historyList')
};

// App State
let currentMode = 'scalp';
let currentMarketData = null;
let currentSymbol = 'XAUUSD';
let soundEnabled = true;
let activeChartIndex = 0;
let multiChartSymbols = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD'];  // Now 4 but can add unlimited

// Backtest History
let history = [];

// Load history from localStorage
function loadHistory() {
    const saved = localStorage.getItem('omni_supreme_history');
    if (saved) {
        try {
            history = JSON.parse(saved);
            renderHistory();
        } catch(e) { console.error('History load error:', e); }
    }
}

// Save history to localStorage
function saveHistory() {
    localStorage.setItem('omni_supreme_history', JSON.stringify(history.slice(-100))); // Save last 100
    renderHistory();
}

// Add signal to history
function addToHistory(signalData, marketData, tradeLevels) {
    const record = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        symbol: currentSymbol,
        mode: currentMode,
        bias: signalData.bias,
        confidence: signalData.confidence,
        entry: tradeLevels.entry,
        stopLoss: tradeLevels.stopLoss,
        takeProfit: tradeLevels.takeProfit,
        rr: tradeLevels.rrRatio,
        price: marketData.currentPrice,
        strategy: signalData.primaryStrategy
    };
    
    history.unshift(record);
    saveHistory();
}

// Render backtest history
function renderHistory() {
    if (!elements.historyList) return;
    
    if (history.length === 0) {
        elements.historyList.innerHTML = '<p class="text-center text-slate-500 text-xs py-4">No signals recorded yet. Run analysis to save history.</p>';
        return;
    }
    
    elements.historyList.innerHTML = history.slice(0, 30).map(record => `
        <div class="backtest-item slide-in">
            <div class="flex justify-between items-start">
                <div>
                    <span class="font-bold ${record.bias === 'BUY' ? 'text-emerald-400' : record.bias === 'SELL' ? 'text-rose-400' : 'text-amber-400'}">
                        ${record.bias}
                    </span>
                    <span class="text-[10px] text-slate-500 ml-2">${record.symbol}</span>
                    <span class="text-[9px] text-slate-600 ml-2">${record.mode}</span>
                </div>
                <span class="text-[9px] text-slate-500">${new Date(record.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="flex gap-3 mt-1 text-[10px] flex-wrap">
                <span>Entry: ${record.entry || '--'}</span>
                <span>SL: ${record.stopLoss || '--'}</span>
                <span>TP: ${record.takeProfit || '--'}</span>
                <span>RR: 1:${record.rr?.toFixed(1) || '0'}</span>
            </div>
            <div class="text-[9px] text-slate-400 mt-1">${record.strategy} | ${record.confidence}% confidence</div>
        </div>
    `).join('');
}

// Clear history
function clearHistory() {
    if (confirm('Clear all backtest history?')) {
        history = [];
        saveHistory();
        showToast('History cleared', 'info');
    }
}

// Theme Toggle
function initTheme() {
    const savedTheme = localStorage.getItem('omni_supreme_theme');
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (elements.themeToggle) elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun text-yellow-400 text-xl"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (elements.themeToggle) elements.themeToggle.innerHTML = '<i class="fa-solid fa-moon text-slate-400 text-xl"></i>';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('omni_supreme_theme', 'dark');
        if (elements.themeToggle) elements.themeToggle.innerHTML = '<i class="fa-solid fa-moon text-slate-400 text-xl"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('omni_supreme_theme', 'light');
        if (elements.themeToggle) elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun text-yellow-400 text-xl"></i>';
    }
}

// Sound Alert
function playSound() {
    if (!soundEnabled) return;
    try {
        const audio = document.getElementById('alertSound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
    } catch (e) {
        console.log('Sound error:', e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    if (elements.soundToggle) {
        elements.soundToggle.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-up mr-1"></i> Sound ON' : '<i class="fa-solid fa-volume-mute mr-1"></i> Sound OFF';
    }
    localStorage.setItem('omni_supreme_sound', soundEnabled);
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1';
    toast.innerHTML = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Telegram Alert
async function sendTelegramAlert(message) {
    const botToken = localStorage.getItem('omni_supreme_telegram_bot');
    const chatId = localStorage.getItem('omni_supreme_telegram_chat');
    
    if (!botToken || !chatId) return false;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
        const data = await response.json();
        return data.ok;
    } catch (error) {
        console.error('Telegram error:', error);
        return false;
    }
}

async function testTelegram() {
    const botToken = elements.telegramBotToken?.value;
    const chatId = elements.telegramChatId?.value;
    
    if (!botToken || !chatId) {
        showToast('Enter Bot Token and Chat ID first', 'error');
        return;
    }
    
    showToast('Sending test message...', 'info');
    const success = await sendTelegramAlert('✅ OMNI-SUPREME Test: Your Telegram alerts are working!');
    if (success) {
        showToast('Test message sent! Check Telegram', 'success');
    } else {
        showToast('Failed to send. Check your token and chat ID', 'error');
    }
}

// Multi-Chart Functions - UNLIMITED SYMBOLS
function renderMultiChart() {
    const container = document.getElementById('multiChartContainer');
    if (!container) return;
    
    container.innerHTML = multiChartSymbols.map((symbol, idx) => `
        <div class="chart-card ${idx === activeChartIndex ? 'active' : ''}" data-symbol="${symbol}" data-index="${idx}" onclick="window.selectChart(${idx})">
            <div class="flex justify-between items-center">
                <span class="font-bold font-mono text-sm">${getSymbolEmoji(symbol)} ${symbol}</span>
                <div class="flex gap-1">
                    ${idx > 0 ? `<button class="remove-symbol text-slate-500 hover:text-rose-400 text-xs px-2" onclick="event.stopPropagation(); window.removeSymbol(${idx})">✕</button>` : '<span class="text-[8px] text-indigo-400">★</span>'}
                </div>
            </div>
            <div class="mt-2">
                <p class="text-[10px] text-slate-400">Price: <span id="price${idx}">--</span></p>
                <p class="text-[8px] text-slate-500">Click to analyze</p>
            </div>
        </div>
    `).join('');
    
    // Fetch prices for all symbols
    multiChartSymbols.forEach(async (sym, idx) => {
        try {
            const data = await MarketData.fetch(sym);
            const priceSpan = document.getElementById(`price${idx}`);
            if (priceSpan) priceSpan.textContent = data.currentPrice.toFixed(2);
        } catch (e) {
            console.log(`Failed to fetch ${sym}`);
        }
    });
}

function getSymbolEmoji(symbol) {
    const emojis = { 
        'XAUUSD': '🪙', 'GOLD': '🪙',
        'EURUSD': '💶', 'GBPUSD': '💷', 'USDJPY': '💴', 'AUDUSD': '🦘',
        'BTCUSD': '₿', 'ETHUSD': 'Ξ', 'SOLUSD': '◎', 'BNBUSD': '🟡',
        'SPX500': '📊', 'NAS100': '📈', 'US30': '🏛️'
    };
    return emojis[symbol?.toUpperCase()] || '📈';
}

window.selectChart = function(index) {
    if (index >= 0 && index < multiChartSymbols.length) {
        activeChartIndex = index;
        currentSymbol = multiChartSymbols[index];
        if (elements.currentSymbolDisplay) elements.currentSymbolDisplay.textContent = currentSymbol;
        renderMultiChart();
        loadMarketData();
        showToast(`Switched to ${currentSymbol}`, 'info');
    }
};

function addSymbol() {
    const newSymbol = prompt('Enter symbol (e.g., GBPUSD, ETHUSD, NAS100, USDJPY, SOLUSD):', 'GBPUSD');
    if (newSymbol) {
        const upperSymbol = newSymbol.trim().toUpperCase();
        if (!multiChartSymbols.includes(upperSymbol)) {
            multiChartSymbols.push(upperSymbol);
            renderMultiChart();
            showToast(`✅ Added ${upperSymbol}`, 'success');
        } else {
            showToast(`⚠️ ${upperSymbol} already exists`, 'error');
        }
    }
}

window.removeSymbol = function(index) {
    if (multiChartSymbols.length <= 1) {
        showToast('Cannot remove the last symbol', 'error');
        return;
    }
    const removed = multiChartSymbols[index];
    multiChartSymbols.splice(index, 1);
    if (activeChartIndex >= multiChartSymbols.length) activeChartIndex = 0;
    if (activeChartIndex < 0) activeChartIndex = 0;
    currentSymbol = multiChartSymbols[activeChartIndex];
    if (elements.currentSymbolDisplay) elements.currentSymbolDisplay.textContent = currentSymbol;
    renderMultiChart();
    loadMarketData();
    showToast(`Removed ${removed}`, 'info');
};

// Initialize App
function init() {
    loadHistory();
    initTheme();
    
    const savedSound = localStorage.getItem('omni_supreme_sound');
    if (savedSound !== null) soundEnabled = savedSound === 'true';
    if (elements.soundToggle) {
        elements.soundToggle.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-up mr-1"></i> Sound ON' : '<i class="fa-solid fa-volume-mute mr-1"></i> Sound OFF';
    }
    
    // Load saved symbols from localStorage
    const savedSymbols = localStorage.getItem('omni_supreme_symbols');
    if (savedSymbols) {
        try {
            const parsed = JSON.parse(savedSymbols);
            if (parsed.length > 0) multiChartSymbols = parsed;
        } catch(e) {}
    }
    
    loadSavedSettings();
    setupEventListeners();
    renderMultiChart();
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
    if (elements.addSymbolBtn) elements.addSymbolBtn.addEventListener('click', addSymbol);
    if (elements.testTelegramBtn) elements.testTelegramBtn.addEventListener('click', testTelegram);
}

function setMode(mode) {
    currentMode = mode;
    if (mode === 'scalp') {
        if (elements.modeScalp) elements.modeScalp.classList.add('active');
        if (elements.modeDay) elements.modeDay.classList.remove('active');
        if (elements.modeDescription) elements.modeDescription.textContent = '⚡ AGGRESSIVE | 1:1.5 to 1:4 RR | Lower-Medium Risk | 4 Scalping Strategies Active';
    } else {
        if (elements.modeDay) elements.modeDay.classList.add('active');
        if (elements.modeScalp) elements.modeScalp.classList.remove('active');
        if (elements.modeDescription) elements.modeDescription.textContent = '📊 LOGICAL | 1:4 to 1:10 RR | Conservative Risk | 4 Day Trading Strategies Active';
    }
    if (currentMarketData) executeAnalysis();
}

function loadSavedSettings() {
    const saved = localStorage.getItem('omni_supreme_config');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            if (elements.apiKey) elements.apiKey.value = config.apiKey || '';
            if (elements.balance) elements.balance.value = config.balance || '10000';
            if (elements.riskPercent) elements.riskPercent.value = config.riskPercent || '1.0';
            if (elements.modelSelect) elements.modelSelect.value = config.model || 'gemini-2.5-flash-lite';
            if (elements.telegramBotToken) elements.telegramBotToken.value = config.telegramBot || '';
            if (elements.telegramChatId) elements.telegramChatId.value = config.telegramChat || '';
            
            // Also store telegram separately for easy access
            if (config.telegramBot) localStorage.setItem('omni_supreme_telegram_bot', config.telegramBot);
            if (config.telegramChat) localStorage.setItem('omni_supreme_telegram_chat', config.telegramChat);
        } catch(e) { console.error('Load settings error:', e); }
    }
    
    // Also check for direct API key in localStorage
    const directApiKey = localStorage.getItem('gemini_api_key');
    if (directApiKey && elements.apiKey && !elements.apiKey.value) {
        elements.apiKey.value = directApiKey;
    }
}

function saveSettings() {
    const config = {
        apiKey: elements.apiKey?.value || '',
        balance: elements.balance?.value || '10000',
        riskPercent: elements.riskPercent?.value || '1.0',
        model: elements.modelSelect?.value || 'gemini-2.5-flash-lite',
        telegramBot: elements.telegramBotToken?.value || '',
        telegramChat: elements.telegramChatId?.value || ''
    };
    
    // Save to localStorage
    localStorage.setItem('omni_supreme_config', JSON.stringify(config));
    localStorage.setItem('gemini_api_key', config.apiKey); // Backup for direct access
    localStorage.setItem('omni_supreme_telegram_bot', config.telegramBot);
    localStorage.setItem('omni_supreme_telegram_chat', config.telegramChat);
    
    if (elements.saveSettings) {
        elements.saveSettings.textContent = '✓ SAVED';
        setTimeout(() => { 
            if (elements.saveSettings) elements.saveSettings.textContent = 'SAVE & SECURE'; 
        }, 1500);
    }
    
    toggleSettings();
    showToast('✅ Settings saved permanently!', 'success');
}

function toggleSettings() {
    const isOpen = elements.settingsDrawer?.classList.contains('translate-x-0');
    if (isOpen) {
        if (elements.settingsDrawer) elements.settingsDrawer.classList.remove('translate-x-0');
        if (elements.settingsDrawer) elements.settingsDrawer.classList.add('translate-x-full');
        if (elements.drawerOverlay) elements.drawerOverlay.classList.add('hidden');
    } else {
        if (elements.settingsDrawer) elements.settingsDrawer.classList.remove('translate-x-full');
        if (elements.settingsDrawer) elements.settingsDrawer.classList.add('translate-x-0');
        if (elements.drawerOverlay) elements.drawerOverlay.classList.remove('hidden');
    }
}

async function loadDefaultData() {
    try {
        currentMarketData = await MarketData.fetch(currentSymbol);
        updateMetricsDisplay(currentMarketData);
    } catch (error) {
        console.error('Initial data load failed:', error);
        if (elements.currentPrice) elements.currentPrice.textContent = 'ERROR';
    }
}

async function loadMarketData() {
    showLoading(true);
    try {
        currentMarketData = await MarketData.fetch(currentSymbol);
        updateMetricsDisplay(currentMarketData);
        
        // Update the price for this symbol in multi-chart view
        const priceSpan = document.getElementById(`price${activeChartIndex}`);
        if (priceSpan && currentMarketData) {
            priceSpan.textContent = currentMarketData.currentPrice.toFixed(2);
        }
    } catch (error) {
        if (elements.currentPrice) elements.currentPrice.textContent = 'ERROR';
        if (elements.logicText) elements.logicText.textContent = `Failed to fetch data: ${error.message}`;
    } finally {
        showLoading(false);
    }
}

function updateMetricsDisplay(data) {
    if (!data) return;
    if (elements.currentPrice) elements.currentPrice.textContent = data.currentPrice.toFixed(data.assetClass === 'crypto' ? 0 : 2);
    if (elements.rsiValue) elements.rsiValue.textContent = data.rsi.toFixed(1);
    if (elements.atrValue) elements.atrValue.textContent = data.atr.toFixed(data.assetClass === 'crypto' ? 0 : 4);
    if (elements.highValue) elements.highValue.textContent = data.high24h.toFixed(data.assetClass === 'crypto' ? 0 : 2);
    if (elements.lowValue) elements.lowValue.textContent = data.low24h.toFixed(data.assetClass === 'crypto' ? 0 : 2);
    
    if (data.rsi > 70 && elements.rsiValue) elements.rsiValue.style.color = '#ff4466';
    else if (data.rsi < 30 && elements.rsiValue) elements.rsiValue.style.color = '#00ff88';
    else if (elements.rsiValue) elements.rsiValue.style.color = '';
}

async function executeAnalysis() {
    const config = JSON.parse(localStorage.getItem('omni_supreme_config') || '{}');
    const apiKey = config.apiKey;
    
    if (!apiKey) {
        toggleSettings();
        alert('⚠️ Please configure your Gemini API key first\n\nGet one free from: aistudio.google.com');
        return;
    }
    
    showLoading(true);
    
    try {
        currentMarketData = await MarketData.fetch(currentSymbol);
        updateMetricsDisplay(currentMarketData);
        
        const dxyData = await MarketData.fetchDXY();
        const balance = parseFloat(config.balance) || 10000;
        const riskPercent = parseFloat(config.riskPercent) || 1.0;
        
        const signal = await StrategyEngine.analyze(currentMarketData, currentMode, { dxyData });
        
        const modelSetting = config.model || 'gemini-2.5-flash-lite';
        const aiAnalysis = await getGeminiAnalysis(currentMarketData, signal, currentMode, apiKey, modelSetting);
        
        const tradeLevels = RiskManager.calculateTradeLevels(currentMarketData, signal, currentMode, { balance, riskPercent });
        
        let poiData = null;
        if (signal.bias === 'WAIT' || tradeLevels.waitReason) {
            poiData = RiskManager.generatePOI(currentMarketData, currentMode);
        }
        
        renderResults(signal, tradeLevels, poiData, aiAnalysis, currentMarketData);
        
        // Add to history if not WAIT
        if (signal.bias !== 'WAIT' && tradeLevels.entry) {
            addToHistory(signal, currentMarketData, tradeLevels);
            
            // Send Telegram Alert
            const message = `🚀 <b>OMNI-SUPREME SIGNAL</b>\n\n` +
                `Symbol: ${currentSymbol}\n` +
                `Mode: ${currentMode.toUpperCase()}\n` +
                `Bias: <b>${signal.bias}</b>\n` +
                `Confidence: ${signal.confidence}%\n` +
                `Entry: ${tradeLevels.entry}\n` +
                `SL: ${tradeLevels.stopLoss}\n` +
                `TP: ${tradeLevels.takeProfit}\n` +
                `RR: 1:${tradeLevels.rrRatio.toFixed(1)}\n` +
                `Strategy: ${signal.primaryStrategy}`;
            
            await sendTelegramAlert(message);
            playSound();
            showToast(`🔔 ${signal.bias} signal generated for ${currentSymbol}!`, 'success');
        }
        
    } catch (error) {
        console.error('Analysis failed:', error);
        if (elements.logicText) elements.logicText.innerHTML = `<span class="text-rose-400">⚠️ Error: ${error.message}</span>`;
        showToast(`Analysis failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function getGeminiAnalysis(marketData, signal, mode, apiKey, modelSetting) {
    const prompt = `
        You are OMNI-SUPREME trading analyzer. Analyze:
        
        SYMBOL: ${marketData.symbol}
        MODE: ${mode.toUpperCase()}
        PRICE: ${marketData.currentPrice}
        RSI: ${marketData.rsi.toFixed(1)}
        ATR: ${marketData.atr.toFixed(4)}
        TREND: ${marketData.trend}
        SUPPORT: ${marketData.support}
        RESISTANCE: ${marketData.resistance}
        
        SIGNAL: ${signal.bias}
        CONFIDENCE: ${signal.confidence}%
        STRATEGY: ${signal.primaryStrategy}
        
        Provide 10-15 word logic summary.
        Output ONLY JSON: {"logic": "your explanation here"}
    `;
    
    let modelsToTry = [];
    if (modelSetting === 'both') {
        modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    } else if (modelSetting === 'gemini-2.5-flash') {
        modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    } else {
        modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    }
    
    for (const model of modelsToTry) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
                })
            });
            
            const data = await response.json();
            if (data.error) continue;
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const text = data.candidates[0].content.parts[0].text;
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) return JSON.parse(jsonMatch[0]);
            }
        } catch (err) {
            continue;
        }
    }
    return { logic: `${signal.primaryStrategy} triggered with ${signal.confidence}% confluence.` };
}

function renderResults(signal, tradeLevels, poiData, aiAnalysis, marketData) {
    const bias = signal.bias;
    if (elements.signalBias) {
        elements.signalBias.textContent = bias;
        elements.signalBias.className = `text-6xl md:text-7xl font-black italic tracking-tighter ${
            bias === 'BUY' ? 'signal-buy' : bias === 'SELL' ? 'signal-sell' : 'signal-wait'
        }`;
    }
    
    if (elements.confidenceScore) elements.confidenceScore.textContent = `${signal.confidence}%`;
    if (elements.activeStrategy) elements.activeStrategy.textContent = signal.primaryStrategy;
    if (elements.assetClass) elements.assetClass.textContent = marketData.assetName;
    if (elements.tradeType) elements.tradeType.textContent = RiskManager.getTradeType(currentMode, marketData.volatility);
    
    const hasValidTrade = tradeLevels.entry && tradeLevels.entry !== null && bias !== 'WAIT';
    
    if (hasValidTrade) {
        if (elements.entryPrice) elements.entryPrice.textContent = tradeLevels.entry;
        if (elements.stopLoss) elements.stopLoss.textContent = tradeLevels.stopLoss;
        if (elements.takeProfit) elements.takeProfit.textContent = tradeLevels.takeProfit;
        if (elements.lotSize) elements.lotSize.textContent = tradeLevels.lotSize.toFixed(3);
        if (elements.rrRatio) {
            elements.rrRatio.textContent = `1:${tradeLevels.rrRatio.toFixed(1)}`;
            const minGood = currentMode === 'scalp' ? 2.0 : 4.0;
            elements.rrRatio.style.color = tradeLevels.rrRatio >= minGood ? '#00ff88' : '#ffaa00';
        }
        if (elements.poiContainer) elements.poiContainer.classList.add('hidden');
        
        let logicText = aiAnalysis?.logic || `${signal.primaryStrategy} triggered. ${signal.confidence}% confluence.`;
        if (elements.logicText) elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${bias} SIGNAL</span><br>${logicText}`;
        
    } else {
        if (elements.entryPrice) elements.entryPrice.textContent = '--';
        if (elements.stopLoss) elements.stopLoss.textContent = '--';
        if (elements.takeProfit) elements.takeProfit.textContent = '--';
        if (elements.lotSize) elements.lotSize.textContent = '--';
        
        if (poiData && elements.poiContainer) {
            if (elements.poiLevel) elements.poiLevel.textContent = poiData.level;
            if (elements.poiLogic) elements.poiLogic.textContent = poiData.logic;
            elements.poiContainer.classList.remove('hidden');
        } else if (elements.poiContainer) {
            elements.poiContainer.classList.add('hidden');
        }
        
        const targetRR = currentMode === 'scalp' ? '1:1.5' : '1:4';
        if (elements.rrRatio) {
            elements.rrRatio.textContent = `0:0 (min ${targetRR})`;
            elements.rrRatio.style.color = '#ffaa00';
        }
        
        let waitReason = tradeLevels.waitReason || 'Insufficient confluence across 8-core strategies.';
        if (elements.logicText) elements.logicText.innerHTML = `<span class="text-amber-400">⏸️ WAIT MODE</span><br>${waitReason}`;
    }
}

function showLoading(show) {
    if (elements.loadingOverlay) {
        if (show) {
            elements.loadingOverlay.style.display = 'flex';
            if (elements.analyzeBtn) {
                elements.analyzeBtn.disabled = true;
                elements.analyzeBtn.style.opacity = '0.6';
            }
        } else {
            elements.loadingOverlay.style.display = 'none';
            if (elements.analyzeBtn) {
                elements.analyzeBtn.disabled = false;
                elements.analyzeBtn.style.opacity = '1';
            }
        }
    }
}

// Start the app
init();
