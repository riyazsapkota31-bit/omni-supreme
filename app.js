/**
 * OMNI-SIGNAL - Main Application
 * Uses market-data.js with Multi-API Fallback
 */

// Global variable for Alpha Vantage (used by market-data.js)
var alphaVantageKey = null;

// DOM Elements
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

// App State
let currentMode = 'scalp';
let currentSymbol = 'XAUUSD';
let currentData = null;
let currentSignal = null;
let currentTradeLevels = null;
let autoTrackInterval = null;
let autoTrackingEnabled = true;

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('omni_signal_config');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('alphaKey').value = config.alphaKey || '';
            document.getElementById('balance').value = config.balance || '10000';
            document.getElementById('riskPercent').value = config.riskPercent || '1.0';
            document.getElementById('modeSelect').value = config.mode || 'scalp';
            document.getElementById('autoTrackSelect').value = config.autoTrack || 'on';
            currentMode = config.mode || 'scalp';
            autoTrackingEnabled = config.autoTrack !== 'off';
            
            if (typeof MarketData !== 'undefined' && config.alphaKey) {
                MarketData.setAlphaKey(config.alphaKey);
            }
        } catch(e) { console.error('Load settings error:', e); }
    }
}

function saveSettings() {
    const config = {
        apiKey: document.getElementById('apiKey').value,
        alphaKey: document.getElementById('alphaKey').value,
        balance: document.getElementById('balance').value,
        riskPercent: document.getElementById('riskPercent').value,
        mode: document.getElementById('modeSelect').value,
        autoTrack: document.getElementById('autoTrackSelect').value
    };
    localStorage.setItem('omni_signal_config', JSON.stringify(config));
    
    if (typeof MarketData !== 'undefined' && config.alphaKey) {
        MarketData.setAlphaKey(config.alphaKey);
    }
    
    currentMode = config.mode;
    autoTrackingEnabled = config.autoTrack !== 'off';
    updateAutoTrackStatus();
    closeDrawer();
    showToast('Settings saved!', 'success');
    
    if (autoTrackingEnabled && currentTradeLevels) {
        startAutoTracking();
    } else {
        stopAutoTracking();
    }
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

// Theme
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

// Signal Engine
const SignalEngine = {
    analyze(data, mode) {
        const { rsi, currentPrice, ema20, ema50, support, resistance, trend } = data;
        let bias = 'WAIT';
        let confidence = 50;
        let reason = '';
        
        if (rsi < 30 && currentPrice > support) {
            bias = 'BUY';
            confidence = 65 + (30 - rsi);
            reason = `RSI oversold at ${rsi.toFixed(1)}. Support nearby.`;
        } else if (rsi > 70 && currentPrice < resistance) {
            bias = 'SELL';
            confidence = 65 + (rsi - 70);
            reason = `RSI overbought at ${rsi.toFixed(1)}. Resistance above.`;
        }
        
        if (bias === 'BUY' && ema20 > ema50) {
            confidence += 15;
            reason += ' Bullish EMA alignment.';
        } else if (bias === 'SELL' && ema20 < ema50) {
            confidence += 15;
            reason += ' Bearish EMA alignment.';
        } else if (bias !== 'WAIT' && ((bias === 'BUY' && ema20 < ema50) || (bias === 'SELL' && ema20 > ema50))) {
            confidence -= 20;
            reason += ' EMA conflict.';
        }
        
        if (mode === 'day' && trend === 'SIDEWAYS' && bias !== 'WAIT') {
            confidence -= 25;
            reason += ' Sideways market - not ideal for day trading.';
        }
        
        if (confidence < 55) {
            bias = 'WAIT';
            confidence = 50;
            reason = 'Insufficient confluence. Wait for better setup.';
        }
        
        let entry = null, sl = null, tp = null;
        if (bias === 'BUY') {
            entry = currentPrice;
            sl = support * 0.998;
            const targetRR = mode === 'scalp' ? 1.5 : 4.0;
            const risk = entry - sl;
            tp = entry + (risk * targetRR);
            if (tp > resistance) tp = resistance * 0.998;
        } else if (bias === 'SELL') {
            entry = currentPrice;
            sl = resistance * 1.002;
            const targetRR = mode === 'scalp' ? 1.5 : 4.0;
            const risk = sl - entry;
            tp = entry - (risk * targetRR);
            if (tp < support) tp = support * 1.002;
        }
        
        return { bias, confidence, reason, entry, sl, tp };
    },
    
    calculateLotSize(entry, sl, balance, riskPercent) {
        if (!entry || !sl) return 0.01;
        const riskAmount = balance * (riskPercent / 100);
        const stopDistance = Math.abs(entry - sl);
        if (stopDistance === 0) return 0.01;
        let lot = riskAmount / (stopDistance * 10000);
        lot = Math.floor(lot * 100) / 100;
        return Math.max(0.01, Math.min(lot, 10));
    }
};

// Auto Price Tracking
function startAutoTracking() {
    if (autoTrackInterval) clearInterval(autoTrackInterval);
    if (!autoTrackingEnabled) return;
    
    autoTrackInterval = setInterval(async () => {
        const openTrades = typeof getOpenTradesForTracking === 'function' ? getOpenTradesForTracking() : [];
        if (openTrades.length === 0) return;
        
        try {
            const currentPriceData = await MarketData.fetch(currentSymbol);
            const price = currentPriceData.currentPrice;
            
            for (const trade of openTrades) {
                if (trade.status !== 'OPEN') continue;
                if (trade.bias === 'BUY' && price >= trade.tp) {
                    if (typeof recordFeedback === 'function') recordFeedback(trade.id, 'WIN', 'Auto: TP hit');
                    showToast(`${trade.symbol} - TP HIT! WIN.`, 'success');
                }
                else if (trade.bias === 'SELL' && price <= trade.tp) {
                    if (typeof recordFeedback === 'function') recordFeedback(trade.id, 'WIN', 'Auto: TP hit');
                    showToast(`${trade.symbol} - TP HIT! WIN.`, 'success');
                }
                else if (trade.bias === 'BUY' && price <= trade.sl) {
                    if (typeof recordFeedback === 'function') recordFeedback(trade.id, 'LOSS', 'Auto: SL hit');
                    showToast(`${trade.symbol} - SL HIT! LOSS.`, 'error');
                }
                else if (trade.bias === 'SELL' && price >= trade.sl) {
                    if (typeof recordFeedback === 'function') recordFeedback(trade.id, 'LOSS', 'Auto: SL hit');
                    showToast(`${trade.symbol} - SL HIT! LOSS.`, 'error');
                }
            }
        } catch (e) { console.log('Auto-track error:', e); }
    }, 30000);
}

function stopAutoTracking() {
    if (autoTrackInterval) { clearInterval(autoTrackInterval); autoTrackInterval = null; }
}

// Gemini Explanation (optional)
async function getGeminiExplanation(apiKey) {
    if (!apiKey) return null;
    const prompt = `Explain this trade signal in 10-15 words: ${currentSymbol} price ${currentData?.currentPrice}. RSI ${currentData?.rsi?.toFixed(1)}. Signal: ${currentSignal?.bias} with ${currentSignal?.confidence}% confidence.`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 60 } })
        });
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch(e) { return null; }
}

// Main Analysis
async function analyze() {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) { openDrawer(); showToast('Please enter your Gemini API key', 'error'); return; }
    
    showLoading(true);
    elements.logicText.textContent = "Fetching market data...";
    
    try {
        currentSymbol = elements.symbolSelect.value;
        currentData = await MarketData.fetch(currentSymbol);
        if (!currentData) throw new Error('All APIs failed. Check connection.');
        
        elements.currentPrice.textContent = currentData.currentPrice.toFixed(currentData.digits || 2);
        elements.updateTime.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        
        const balance = parseFloat(document.getElementById('balance').value);
        const riskPercent = parseFloat(document.getElementById('riskPercent').value);
        currentSignal = SignalEngine.analyze(currentData, currentMode);
        
        elements.signalBias.textContent = currentSignal.bias;
        elements.signalBias.className = `text-7xl font-black italic ${
            currentSignal.bias === 'BUY' ? 'signal-buy' : 
            currentSignal.bias === 'SELL' ? 'signal-sell' : 'signal-wait'
        }`;
        elements.confidenceText.textContent = `${currentSignal.confidence}% confidence`;
        
        if (currentSignal.bias !== 'WAIT' && currentSignal.entry && currentSignal.sl && currentSignal.tp) {
            currentTradeLevels = { entry: currentSignal.entry, stopLoss: currentSignal.sl, takeProfit: currentSignal.tp };
            elements.entryPrice.textContent = currentSignal.entry.toFixed(currentData.digits || 5);
            elements.stopLoss.textContent = currentSignal.sl.toFixed(currentData.digits || 5);
            elements.takeProfit.textContent = currentSignal.tp.toFixed(currentData.digits || 5);
            
            const lotSize = SignalEngine.calculateLotSize(currentSignal.entry, currentSignal.sl, balance, riskPercent);
            elements.lotSize.textContent = lotSize.toFixed(2);
            
            const risk = Math.abs(currentSignal.entry - currentSignal.sl);
            const reward = Math.abs(currentSignal.tp - currentSignal.entry);
            const rr = risk > 0 ? (reward / risk).toFixed(1) : 0;
            elements.rrValue.textContent = `1:${rr}`;
            elements.tradeType.textContent = currentMode === 'scalp' ? 'SCALP' : 'DAY';
            elements.poiBox.classList.add('hidden');
            
            if (typeof addOpenTrade === 'function') addOpenTrade(currentSignal, currentData, currentTradeLevels);
            if (autoTrackingEnabled) startAutoTracking();
            
            const geminiText = await getGeminiExplanation(apiKey);
            elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${currentSignal.bias}</span><br>${geminiText || currentSignal.reason}`;
        } else {
            elements.entryPrice.textContent = '--';
            elements.stopLoss.textContent = '--';
            elements.takeProfit.textContent = '--';
            elements.lotSize.textContent = '--';
            elements.rrValue.textContent = '0:0';
            elements.poiLevel.textContent = currentData.currentPrice.toFixed(currentData.digits || 2);
            elements.poiLogic.textContent = currentSignal.reason;
            elements.poiBox.classList.remove('hidden');
            elements.logicText.innerHTML = `<span class="text-amber-400">⏸️ WAIT MODE</span><br>${currentSignal.reason}`;
        }
    } catch (error) {
        console.error(error);
        elements.signalBias.textContent = 'ERROR';
        elements.logicText.textContent = `Data fetch failed: ${error.message}`;
        showToast('Data fetch failed. Multiple APIs attempted.', 'error');
    } finally { showLoading(false); }
}

// Event Listeners
function init() {
    loadSettings();
    initTheme();
    elements.analyzeBtn.addEventListener('click', analyze);
    elements.settingsBtn.addEventListener('click', openDrawer);
    elements.closeSettings.addEventListener('click', closeDrawer);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.symbolSelect.addEventListener('change', analyze);
    
    setTimeout(() => {
        if (typeof renderOpenTrades === 'function') renderOpenTrades();
        if (typeof renderFeedbackHistory === 'function') renderFeedbackHistory();
        if (typeof updateStrategyPerformance === 'function') updateStrategyPerformance();
    }, 100);
    showToast('App ready. Multi-API active.', 'info');
}

// Start app
init();
