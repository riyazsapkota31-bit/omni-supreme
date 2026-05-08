/**
 * OMNI-SIGNAL - Main Application (credit‑efficient auto tracking)
 */

const elements = {
    analyzeBtn: document.getElementById('analyzeBtn'),
    symbolSelect: document.getElementById('symbolSelect'),
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettings: document.getElementById('closeSettings'),
    saveSettings: document.getElementById('saveSettings'),
    themeToggle: document.getElementById('themeToggle'),
    drawer: document.getElementById('settingsDrawer'),
    overlay: document.getElementById('drawerOverlay'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    currentPrice: document.getElementById('currentPrice'),
    signalBias: document.getElementById('signalBias'),
    confidenceText: document.getElementById('confidenceText'),
    entryPrice: document.getElementById('entryPrice'),
    stopLoss: document.getElementById('stopLoss'),
    takeProfit: document.getElementById('takeProfit'),
    lotSize: document.getElementById('lotSize'),
    rrValue: document.getElementById('rrValue'),
    tradeType: document.getElementById('tradeType'),
    logicText: document.getElementById('logicText'),
    poiBox: document.getElementById('poiBox'),
    poiLevel: document.getElementById('poiLevel'),
    poiLogic: document.getElementById('poiLogic'),
    updateTime: document.getElementById('updateTime'),
    autoTrackStatus: document.getElementById('autoTrackStatus')
};

let currentMode = 'scalp';
let currentSymbol = 'XAUUSD';
let currentData = null;
let currentSignal = null;
let currentTradeLevels = null;
let autoTrackInterval = null;
let autoTrackingEnabled = true;

// ========== TELEGRAM INTEGRATION ==========
async function sendTelegramAlert(signal, data, tradeLevels) {
    const token = localStorage.getItem('telegram_bot_token');
    const chatId = localStorage.getItem('telegram_chat_id');
    
    if (!token || !chatId) {
        console.log('Telegram not configured');
        return false;
    }
    
    const message = formatTradeMessage(signal, data, tradeLevels);
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_notification: false
            })
        });
        
        const result = await response.json();
        if (result.ok) {
            showToast('📨 Alert sent to Telegram!', 'success');
            return true;
        } else {
            console.error('Telegram error:', result);
            showToast('❌ Telegram failed: Check token/chat ID', 'error');
            return false;
        }
    } catch (error) {
        console.error('Failed to send:', error);
        return false;
    }
}

function formatTradeMessage(signal, data, tradeLevels) {
    const timestamp = new Date().toLocaleString();
    const icon = signal.bias === 'BUY' ? '🟢 BUY' : '🔴 SELL';
    const stars = '★'.repeat(Math.floor(signal.confidence / 20)) + '☆'.repeat(5 - Math.floor(signal.confidence / 20));
    
    return `
🤖 <b>OMNI-SIGNAL ALERT</b> 🤖
━━━━━━━━━━━━━━━━━━━
${icon} | ${stars} ${signal.confidence}%
⏰ ${timestamp}

📊 <b>${currentSymbol}</b>
💰 Price: ${data.currentPrice.toFixed(data.digits)}
📈 RSI: ${data.rsi.toFixed(1)} | Trend: ${data.trend}

━━━━━━━━━━━━━━━━━━━
🎯 <b>TRADE SETUP</b>
📥 Entry: ${tradeLevels.entry}
🛑 Stop Loss: ${tradeLevels.stopLoss}
🎯 TP1: ${tradeLevels.takeProfit1} | TP2: ${tradeLevels.takeProfit2}
📐 R:R: 1:${tradeLevels.riskReward || '?'}

💡 ${signal.primaryStrategy || 'Multiple confluence signal'}
${signal.reasons ? `📝 ${signal.reasons.slice(0,2).join(', ')}` : ''}

⚠️ <i>Not financial advice. Trade at your own risk.</i>
    `.trim();
}

async function testTelegramAlert() {
    const token = localStorage.getItem('telegram_bot_token');
    const chatId = localStorage.getItem('telegram_chat_id');
    
    if (!token || !chatId) {
        showToast('❌ Please save Telegram settings first', 'error');
        return false;
    }
    
    const testMsg = await sendTelegramAlert(
        { bias: 'TEST', confidence: 100, primaryStrategy: 'Test message', reasons: ['Telegram integration working!'] },
        { currentPrice: 1.36210, digits: 5, rsi: 55, trend: 'TEST' },
        { entry: 1.36200, stopLoss: 1.36100, takeProfit1: 1.36300, takeProfit2: 1.36400, riskReward: 2.0 }
    );
    
    if (testMsg) {
        showToast('✅ Telegram test sent! Check your Telegram', 'success');
    }
    return testMsg;
}
// ========== END TELEGRAM INTEGRATION ==========

function loadSettings() {
    const saved = localStorage.getItem('omni_signal_config');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            if (document.getElementById('apiKey')) document.getElementById('apiKey').value = config.apiKey || '';
            if (document.getElementById('balance')) document.getElementById('balance').value = config.balance || '10000';
            if (document.getElementById('riskPercent')) document.getElementById('riskPercent').value = config.riskPercent || '1.0';
            if (document.getElementById('modeSelect')) document.getElementById('modeSelect').value = config.mode || 'scalp';
            if (document.getElementById('autoTrackSelect')) document.getElementById('autoTrackSelect').value = config.autoTrack || 'on';
            currentMode = config.mode || 'scalp';
            autoTrackingEnabled = config.autoTrack !== 'off';
        } catch(e) { console.error('Load settings error:', e); }
    }
    
    // Load Telegram settings
    const telegramToken = localStorage.getItem('telegram_bot_token');
    const telegramChatId = localStorage.getItem('telegram_chat_id');
    if (document.getElementById('telegramToken')) {
        document.getElementById('telegramToken').value = telegramToken || '';
        document.getElementById('telegramChatId').value = telegramChatId || '';
    }
}

function saveSettings() {
    const config = {
        apiKey: document.getElementById('apiKey').value,
        balance: document.getElementById('balance').value,
        riskPercent: document.getElementById('riskPercent').value,
        mode: document.getElementById('modeSelect').value,
        autoTrack: document.getElementById('autoTrackSelect').value
    };
    localStorage.setItem('omni_signal_config', JSON.stringify(config));
    
    // Save Telegram settings
    const telegramToken = document.getElementById('telegramToken').value;
    const telegramChatId = document.getElementById('telegramChatId').value;
    if (telegramToken) localStorage.setItem('telegram_bot_token', telegramToken);
    if (telegramChatId) localStorage.setItem('telegram_chat_id', telegramChatId);
    
    currentMode = config.mode;
    autoTrackingEnabled = config.autoTrack !== 'off';
    updateAutoTrackStatus();
    closeDrawer();
    showToast('Settings saved!', 'success');
    if (autoTrackingEnabled && currentTradeLevels) startAutoTracking();
    else stopAutoTracking();
}

function updateAutoTrackStatus() {
    if (elements.autoTrackStatus) {
        if (autoTrackingEnabled) {
            elements.autoTrackStatus.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Auto-Tracking ON';
            elements.autoTrackStatus.className = 'auto-track-badge';
        } else {
            elements.autoTrackStatus.innerHTML = '<i class="fa-solid fa-pause"></i> Auto-Tracking OFF';
            elements.autoTrackStatus.style.background = 'rgba(100,100,100,0.2)';
            elements.autoTrackStatus.style.borderColor = 'rgba(100,100,100,0.3)';
            elements.autoTrackStatus.style.color = '#9ca3af';
        }
    }
}

function openDrawer() { elements.drawer.classList.add('open'); elements.overlay.classList.remove('hidden'); }
function closeDrawer() { elements.drawer.classList.remove('open'); elements.overlay.classList.add('hidden'); }

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function initTheme() {
    const saved = localStorage.getItem('omni_theme');
    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light') {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('omni_theme', 'dark');
        elements.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('omni_theme', 'light');
        elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
}

function calculateLotSize(entry, sl, balance, riskPercent) {
    if (!entry || !sl) return 0.01;
    const riskAmount = balance * (riskPercent / 100);
    const stopDistance = Math.abs(entry - sl);
    if (stopDistance === 0) return 0.01;
    let lot = riskAmount / (stopDistance * 10000);
    lot = Math.floor(lot * 100) / 100;
    return Math.max(0.01, Math.min(lot, 50));
}

function startAutoTracking() {
    if (autoTrackInterval) clearInterval(autoTrackInterval);
    if (!autoTrackingEnabled) return;
    autoTrackInterval = setInterval(async () => {
        const openTrades = typeof getOpenTradesForTracking === 'function' ? getOpenTradesForTracking() : [];
        if (openTrades.length === 0) return;
        const price = await MarketData.fetchPriceForTracking(currentSymbol);
        if (price === null) return;
        for (const trade of openTrades) {
            if (trade.status !== 'OPEN') continue;
            let hitTP = false;
            if (trade.bias === 'BUY' && (price >= trade.tp1 || price >= trade.tp2)) hitTP = true;
            if (trade.bias === 'SELL' && (price <= trade.tp1 || price <= trade.tp2)) hitTP = true;
            if (hitTP) {
                if (typeof recordFeedback === 'function') recordFeedback(trade.id, 'WIN', 'Auto: TP hit');
                showToast(`${trade.symbol} - TP HIT! WIN.`, 'success');
            } else if (trade.bias === 'BUY' && price <= trade.sl) {
                if (typeof recordFeedback === 'function') recordFeedback(trade.id, 'LOSS', 'Auto: SL hit');
                showToast(`${trade.symbol} - SL HIT! LOSS.`, 'error');
            } else if (trade.bias === 'SELL' && price >= trade.sl) {
                if (typeof recordFeedback === 'function') recordFeedback(trade.id, 'LOSS', 'Auto: SL hit');
                showToast(`${trade.symbol} - SL HIT! LOSS.`, 'error');
            }
        }
    }, 30000);
}

function stopAutoTracking() {
    if (autoTrackInterval) { clearInterval(autoTrackInterval); autoTrackInterval = null; }
}

async function getGeminiExplanation(apiKey) {
    if (!apiKey) return null;
    const prompt = `Explain this trade signal in 10-15 words: ${currentSymbol} price ${currentData?.currentPrice}. RSI ${currentData?.rsi?.toFixed(1)}. Signal: ${currentSignal?.bias} with ${currentSignal?.confidence}% confidence.`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 60 } })
        });
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch(e) { return null; }
}

async function geminiFinalCheck(apiKey, data, signal) {
    if (!apiKey) return { approved: true };
    if (signal.confidence < 65 || signal.confidence > 75) return { approved: true };
    const prompt = `You are a risk officer. Analyze: ${data.symbol} price ${data.currentPrice}, RSI ${data.rsi.toFixed(1)}. Signal: ${signal.bias} with ${signal.confidence}%. Answer ONLY with "APPROVE" or "REJECT". If REJECT, give short reason.`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 50 } })
        });
        const result = await response.json();
        const answer = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (answer.includes('REJECT')) return { approved: false, reason: answer };
        return { approved: true };
    } catch(e) { return { approved: true }; }
}

async function analyze() {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) { openDrawer(); showToast('Please enter your Gemini API key', 'error'); return; }

    showLoading(true);
    elements.logicText.textContent = "Fetching market data...";
    try {
        currentSymbol = elements.symbolSelect.value;
        currentData = await MarketData.fetch(currentSymbol);
        if (!currentData) throw new Error('No data from any source');
        elements.currentPrice.textContent = currentData.currentPrice.toFixed(currentData.digits);
        elements.updateTime.textContent = `Updated: ${new Date().toLocaleTimeString()}`;

        let dxyData = null;
        try { dxyData = await MarketData.fetchDXY(); } catch(e) {}

        const balance = parseFloat(document.getElementById('balance').value);
        const riskPercent = parseFloat(document.getElementById('riskPercent').value);
        currentSignal = await StrategyEngine.analyze(currentData, currentMode, { dxyData });

        const aiCheck = await geminiFinalCheck(apiKey, currentData, currentSignal);
        if (!aiCheck.approved) {
            currentSignal.bias = 'WAIT';
            currentSignal.confidence = 40;
            currentSignal.primaryStrategy = `AI Rejected: ${aiCheck.reason}`;
            showToast(`AI filter rejected: ${aiCheck.reason}`, 'warning');
        }

        elements.signalBias.textContent = currentSignal.bias;
        elements.signalBias.className = `text-7xl font-black italic ${
            currentSignal.bias === 'BUY' ? 'signal-buy' : 
            currentSignal.bias === 'SELL' ? 'signal-sell' : 'signal-wait'
        }`;
        elements.confidenceText.textContent = `${currentSignal.confidence}% confidence`;

        let tradeLevels = null;
        if (currentSignal.bias !== 'WAIT') {
            tradeLevels = RiskManager.calculateTradeLevels(currentData, currentSignal, currentMode, { balance, riskPercent });
        }

        if (currentSignal.bias !== 'WAIT' && tradeLevels && tradeLevels.entry && tradeLevels.stopLoss && tradeLevels.takeProfit1 && tradeLevels.takeProfit2) {
            currentTradeLevels = tradeLevels;
            elements.entryPrice.textContent = tradeLevels.entry;
            elements.stopLoss.textContent = tradeLevels.stopLoss;
            elements.takeProfit.textContent = `${tradeLevels.takeProfit1} / ${tradeLevels.takeProfit2}`;
            const lotSize = calculateLotSize(tradeLevels.entry, tradeLevels.stopLoss, balance, riskPercent);
            elements.lotSize.textContent = lotSize.toFixed(2);
            const risk = Math.abs(tradeLevels.entry - tradeLevels.stopLoss);
            const reward = Math.abs(tradeLevels.takeProfit2 - tradeLevels.entry);
            const rr = risk > 0 ? (reward / risk).toFixed(1) : 0;
            elements.rrValue.textContent = `1:${rr}`;
            tradeLevels.riskReward = rr;
            elements.tradeType.textContent = currentMode === 'scalp' ? 'SCALP' : 'DAY';
            elements.poiBox.classList.add('hidden');
            if (typeof addOpenTrade === 'function') {
                const adapted = { ...tradeLevels, takeProfit: tradeLevels.takeProfit2 };
                addOpenTrade(currentSignal, currentData, adapted);
            }
            if (autoTrackingEnabled) startAutoTracking();
            const geminiText = await getGeminiExplanation(apiKey);
            const reasoning = currentSignal.reasons?.join(' ') || currentSignal.conditionsDetected || currentSignal.primaryStrategy;
            elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${currentSignal.bias}</span><br>${geminiText || reasoning}`;
            
            // ========== SEND TELEGRAM ALERT ==========
            await sendTelegramAlert(currentSignal, currentData, tradeLevels);
            // ==========================================
            
        } else {
            elements.entryPrice.textContent = '--';
            elements.stopLoss.textContent = '--';
            elements.takeProfit.textContent = '--';
            elements.lotSize.textContent = '--';
            elements.rrValue.textContent = '0:0';
            const poi = currentData.currentPrice;
            elements.poiLevel.textContent = poi.toFixed(currentData.digits);
            elements.poiLogic.textContent = currentSignal.reasons?.[0] || 'Insufficient confluence. Wait for better setup.';
            elements.poiBox.classList.remove('hidden');
            elements.logicText.innerHTML = `<span class="text-amber-400">⏸️ WAIT MODE</span><br>${currentSignal.primaryStrategy || 'No clear setup'}`;
        }
    } catch (error) {
        console.error(error);
        elements.signalBias.textContent = 'ERROR';
        elements.logicText.textContent = `Data fetch failed: ${error.message}`;
        showToast('Data fetch failed. Multiple APIs attempted.', 'error');
    } finally { showLoading(false); }
}

function init() {
    loadSettings();
    initTheme();
    elements.analyzeBtn.addEventListener('click', analyze);
    elements.settingsBtn.addEventListener('click', openDrawer);
    elements.closeSettings.addEventListener('click', closeDrawer);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.symbolSelect.addEventListener('change', analyze);
    
    // Telegram test button
    const testTelegramBtn = document.getElementById('testTelegramBtn');
    if (testTelegramBtn) {
        testTelegramBtn.addEventListener('click', testTelegramAlert);
    }
    
    setTimeout(() => {
        if (typeof renderOpenTrades === 'function') renderOpenTrades();
        if (typeof renderFeedbackHistory === 'function') renderFeedbackHistory();
        if (typeof updateStrategyPerformance === 'function') updateStrategyPerformance();
    }, 100);
    showToast('App ready. Advanced strategy active.', 'info');
}

init();
