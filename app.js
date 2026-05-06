/**
 * OMNI—SUPREME V1.0
 * Main Application Controller
 * SUPPORTED MODELS ONLY: gemini-2.5-flash, gemini-2.5-flash-lite
 */

// DOM Elements
const elements = {
    analyzeBtn: document.getElementById('analyzeBtn'),
    symbolInput: document.getElementById('symbolInput'),
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
    poiLogic: document.getElementById('poiLogic')
};

// App State
let currentMode = 'scalp';
let currentMarketData = null;

// SUPPORTED MODELS ONLY (from compatibility report)
const SUPPORTED_MODELS = {
    primary: 'gemini-2.5-flash-lite',  // Faster, great quality
    fallback: 'gemini-2.5-flash',       // Higher quality, backup
    description: {
        'gemini-2.5-flash-lite': 'Fast & Efficient - Best for daily analysis',
        'gemini-2.5-flash': 'High Quality - Best for complex setups'
    }
};

// Mode descriptions
const modeDescriptions = {
    scalp: '⚡ AGGRESSIVE | 1:1.5 to 1:4 RR | Lower-Medium Risk | 4 Scalping Strategies Active',
    day: '📊 LOGICAL | 1:4 to 1:10 RR | Conservative Risk | 4 Day Trading Strategies Active'
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadSavedSettings();
    setupEventListeners();
    loadDefaultData();
    addModelSelector();
});

function addModelSelector() {
    // Add model selector to settings drawer if not exists
    const settingsContent = document.querySelector('#settingsDrawer .space-y-6');
    if (settingsContent && !document.getElementById('modelSelect')) {
        const modelDiv = document.createElement('div');
        modelDiv.innerHTML = `
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">🤖 AI MODEL</label>
            <select id="modelSelect" class="input-dark w-full">
                <option value="gemini-2.5-flash-lite">🚀 Gemini 2.5 Flash Lite (Recommended - Faster)</option>
                <option value="gemini-2.5-flash">🎯 Gemini 2.5 Flash (Premium Quality)</option>
                <option value="both">🔄 Both (Primary Lite + Fallback Flash)</option>
            </select>
            <p class="text-[8px] text-slate-500 mt-1">Both models are fully compatible with your API</p>
        `;
        settingsContent.insertBefore(modelDiv, settingsContent.children[2]);
    }
}

function setupEventListeners() {
    elements.analyzeBtn.addEventListener('click', executeAnalysis);
    elements.modeScalp.addEventListener('click', () => setMode('scalp'));
    elements.modeDay.addEventListener('click', () => setMode('day'));
    elements.settingsBtn.addEventListener('click', toggleSettings);
    elements.closeSettings.addEventListener('click', toggleSettings);
    elements.drawerOverlay.addEventListener('click', toggleSettings);
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // Quick symbol buttons
    document.querySelectorAll('.quick-sym').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.symbolInput.value = btn.dataset.sym;
            loadMarketData();
        });
    });
    
    elements.symbolInput.addEventListener('change', loadMarketData);
}

function setMode(mode) {
    currentMode = mode;
    
    if (mode === 'scalp') {
        elements.modeScalp.classList.add('active');
        elements.modeDay.classList.remove('active');
        elements.modeDescription.textContent = modeDescriptions.scalp;
    } else {
        elements.modeDay.classList.add('active');
        elements.modeScalp.classList.remove('active');
        elements.modeDescription.textContent = modeDescriptions.day;
    }
    
    if (currentMarketData) {
        executeAnalysis();
    }
}

function loadSavedSettings() {
    const saved = localStorage.getItem('omni_supreme_config');
    if (saved) {
        const config = JSON.parse(saved);
        elements.apiKey.value = config.apiKey || '';
        elements.balance.value = config.balance || '10000';
        elements.riskPercent.value = config.riskPercent || '1.0';
        
        // Set model selector if exists
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect && config.model) {
            modelSelect.value = config.model;
        }
    }
}

function saveSettings() {
    const modelSelect = document.getElementById('modelSelect');
    const config = {
        apiKey: elements.apiKey.value,
        balance: elements.balance.value,
        riskPercent: elements.riskPercent.value,
        model: modelSelect ? modelSelect.value : 'gemini-2.5-flash-lite'
    };
    
    localStorage.setItem('omni_supreme_config', JSON.stringify(config));
    
    elements.saveSettings.textContent = '✓ SAVED';
    setTimeout(() => {
        elements.saveSettings.textContent = 'SAVE & SECURE';
    }, 1500);
    
    toggleSettings();
}

function toggleSettings() {
    const isOpen = elements.settingsDrawer.classList.contains('translate-x-0');
    if (isOpen) {
        elements.settingsDrawer.classList.remove('translate-x-0');
        elements.settingsDrawer.classList.add('translate-x-full');
        elements.drawerOverlay.classList.add('hidden');
    } else {
        elements.settingsDrawer.classList.remove('translate-x-full');
        elements.settingsDrawer.classList.add('translate-x-0');
        elements.drawerOverlay.classList.remove('hidden');
    }
}

async function loadDefaultData() {
    try {
        currentMarketData = await MarketData.fetch(elements.symbolInput.value);
        updateMetricsDisplay(currentMarketData);
    } catch (error) {
        console.error('Initial data load failed:', error);
        elements.currentPrice.textContent = 'ERROR';
    }
}

async function loadMarketData() {
    showLoading(true);
    try {
        currentMarketData = await MarketData.fetch(elements.symbolInput.value);
        updateMetricsDisplay(currentMarketData);
    } catch (error) {
        elements.currentPrice.textContent = 'ERROR';
        elements.logicText.textContent = `Failed to fetch data: ${error.message}`;
    } finally {
        showLoading(false);
    }
}

function updateMetricsDisplay(data) {
    if (!data) return;
    
    elements.currentPrice.textContent = data.currentPrice.toFixed(data.assetClass === 'crypto' ? 0 : 2);
    elements.rsiValue.textContent = data.rsi.toFixed(1);
    elements.atrValue.textContent = data.atr.toFixed(data.assetClass === 'crypto' ? 0 : 4);
    elements.highValue.textContent = data.high24h.toFixed(data.assetClass === 'crypto' ? 0 : 2);
    elements.lowValue.textContent = data.low24h.toFixed(data.assetClass === 'crypto' ? 0 : 2);
    
    if (data.rsi > 70) elements.rsiValue.style.color = '#ff4466';
    else if (data.rsi < 30) elements.rsiValue.style.color = '#00ff88';
    else elements.rsiValue.style.color = '#e8edf5';
}

async function executeAnalysis() {
    const config = JSON.parse(localStorage.getItem('omni_supreme_config') || '{}');
    const apiKey = config.apiKey;
    
    if (!apiKey) {
        toggleSettings();
        alert('Please configure your Gemini API key first');
        return;
    }
    
    showLoading(true);
    
    try {
        currentMarketData = await MarketData.fetch(elements.symbolInput.value);
        updateMetricsDisplay(currentMarketData);
        
        const dxyData = await MarketData.fetchDXY();
        const balance = parseFloat(config.balance) || 10000;
        const riskPercent = parseFloat(config.riskPercent) || 1.0;
        
        // Run Strategy Engine
        const signal = await StrategyEngine.analyze(currentMarketData, currentMode, { dxyData });
        
        // Get AI enhancement with dual-model support
        const modelSetting = config.model || 'gemini-2.5-flash-lite';
        const aiAnalysis = await getGeminiAnalysisWithFallback(
            currentMarketData, signal, currentMode, apiKey, modelSetting
        );
        
        const tradeLevels = RiskManager.calculateTradeLevels(
            currentMarketData, signal, currentMode, { balance, riskPercent }
        );
        
        let poiData = null;
        if (signal.bias === 'WAIT' || tradeLevels.waitReason) {
            poiData = RiskManager.generatePOI(currentMarketData, currentMode);
        }
        
        renderResults(signal, tradeLevels, poiData, aiAnalysis, currentMarketData, modelSetting);
        
    } catch (error) {
        console.error('Analysis failed:', error);
        elements.logicText.innerHTML = `<span class="text-rose-400">⚠️ Error: ${error.message}</span>`;
    } finally {
        showLoading(false);
    }
}

/**
 * Gemini Analysis with Dual-Model Support
 * Uses compatible models only: gemini-2.5-flash-lite and gemini-2.5-flash
 */
async function getGeminiAnalysisWithFallback(marketData, signal, mode, apiKey, modelSetting) {
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
    
    // Define compatible models in order of preference
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
            
            // Check for errors
            if (data.error) {
                console.warn(`${model} error:`, data.error.message);
                continue;
            }
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const text = data.candidates[0].content.parts[0].text;
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return { ...parsed, modelUsed: model };
                }
            }
        } catch (err) {
            console.warn(`${model} failed:`, err.message);
            continue;
        }
    }
    
    return { logic: `${signal.primaryStrategy} triggered with ${signal.confidence}% confluence.`, modelUsed: 'fallback' };
}

function renderResults(signal, tradeLevels, poiData, aiAnalysis, marketData, modelSetting) {
    const bias = signal.bias;
    elements.signalBias.textContent = bias;
    elements.signalBias.className = `text-6xl md:text-7xl font-black italic tracking-tighter ${
        bias === 'BUY' ? 'signal-buy' : bias === 'SELL' ? 'signal-sell' : 'signal-wait'
    }`;
    
    elements.confidenceScore.textContent = `${signal.confidence}%`;
    elements.activeStrategy.textContent = signal.primaryStrategy;
    elements.assetClass.textContent = marketData.assetName;
    elements.tradeType.textContent = RiskManager.getTradeType(currentMode, marketData.volatility);
    
    // Add model badge
    const modelBadge = document.getElementById('modelBadge');
    if (!modelBadge && aiAnalysis?.modelUsed) {
        const badge = document.createElement('div');
        badge.id = 'modelBadge';
        badge.className = 'metric-badge text-[8px]';
        badge.innerHTML = `🤖 ${aiAnalysis.modelUsed}`;
        document.querySelector('.flex.justify-between.items-center.flex-wrap.gap-3.mb-6.p-4.bg-black\\/20.rounded-2xl')?.appendChild(badge);
    } else if (modelBadge && aiAnalysis?.modelUsed) {
        modelBadge.innerHTML = `🤖 ${aiAnalysis.modelUsed}`;
    }
    
    const hasValidTrade = tradeLevels.entry && tradeLevels.entry !== null && bias !== 'WAIT';
    
    if (hasValidTrade) {
        elements.entryPrice.textContent = tradeLevels.entry;
        elements.stopLoss.textContent = tradeLevels.stopLoss;
        elements.takeProfit.textContent = tradeLevels.takeProfit;
        elements.lotSize.textContent = tradeLevels.lotSize.toFixed(3);
        elements.rrRatio.textContent = `1:${tradeLevels.rrRatio.toFixed(1)}`;
        
        const minGood = currentMode === 'scalp' ? 2.0 : 4.0;
        elements.rrRatio.style.color = tradeLevels.rrRatio >= minGood ? '#00ff88' : '#ffaa00';
        elements.poiContainer.classList.add('hidden');
        
        let logicText = aiAnalysis?.logic || `${signal.primaryStrategy} triggered. ${signal.confidence}% confluence.`;
        elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${bias} SIGNAL</span><br>${logicText}`;
        
    } else {
        elements.entryPrice.textContent = '--';
        elements.stopLoss.textContent = '--';
        elements.takeProfit.textContent = '--';
        elements.lotSize.textContent = '--';
        
        if (poiData) {
            elements.poiLevel.textContent = poiData.level;
            elements.poiLogic.textContent = poiData.logic;
            elements.poiContainer.classList.remove('hidden');
        } else {
            elements.poiContainer.classList.add('hidden');
        }
        
        const targetRR = currentMode === 'scalp' ? '1:1.5' : '1:4';
        elements.rrRatio.textContent = `0:0 (min ${targetRR})`;
        elements.rrRatio.style.color = '#ffaa00';
        
        let waitReason = tradeLevels.waitReason || 'Insufficient confluence across 8-core strategies.';
        elements.logicText.innerHTML = `<span class="text-amber-400">⏸️ WAIT MODE</span><br>${waitReason}`;
    }
}

function showLoading(show) {
    if (show) {
        elements.loadingOverlay.style.display = 'flex';
        elements.analyzeBtn.disabled = true;
        elements.analyzeBtn.style.opacity = '0.6';
    } else {
        elements.loadingOverlay.style.display = 'none';
        elements.analyzeBtn.disabled = false;
        elements.analyzeBtn.style.opacity = '1';
    }
}
