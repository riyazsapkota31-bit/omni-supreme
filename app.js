/**
 * OMNI—SUPREME V1.0
 * Main Application Controller
 * Integrates: Market Data + Strategy Engine + Risk Manager
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
    failoverModel: document.getElementById('failoverModel'),
    
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
let geminiFallback = false;

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
});

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
    
    // Re-analyze if we have data
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
        elements.failoverModel.value = config.failoverModel || 'gemini-2.0-flash-lite';
    }
}

function saveSettings() {
    const config = {
        apiKey: elements.apiKey.value,
        balance: elements.balance.value,
        riskPercent: elements.riskPercent.value,
        failoverModel: elements.failoverModel.value
    };
    
    localStorage.setItem('omni_supreme_config', JSON.stringify(config));
    
    // Visual feedback
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
    
    // Color RSI based on value
    if (data.rsi > 70) elements.rsiValue.style.color = '#ff4466';
    else if (data.rsi < 30) elements.rsiValue.style.color = '#00ff88';
    else elements.rsiValue.style.color = '#e8edf5';
}

async function executeAnalysis() {
    // Validate API key
    const config = JSON.parse(localStorage.getItem('omni_supreme_config') || '{}');
    const apiKey = config.apiKey;
    
    if (!apiKey) {
        toggleSettings();
        alert('Please configure your Gemini API key first');
        return;
    }
    
    showLoading(true);
    
    try {
        // Fetch fresh market data
        currentMarketData = await MarketData.fetch(elements.symbolInput.value);
        updateMetricsDisplay(currentMarketData);
        
        // Fetch DXY data for filter
        const dxyData = await MarketData.fetchDXY();
        
        // Get user config
        const balance = parseFloat(config.balance) || 10000;
        const riskPercent = parseFloat(config.riskPercent) || 1.0;
        
        // Run Strategy Engine (Council of 8)
        const signal = await StrategyEngine.analyze(currentMarketData, currentMode, { dxyData });
        
        // Get AI enhancement from Gemini
        let aiAnalysis = null;
        if (apiKey && signal.bias !== 'WAIT') {
            aiAnalysis = await getGeminiAnalysis(currentMarketData, signal, currentMode, apiKey, config.failoverModel);
        }
        
        // Calculate trade levels
        const tradeLevels = RiskManager.calculateTradeLevels(
            currentMarketData, 
            signal, 
            currentMode,
            { balance, riskPercent }
        );
        
        // Generate POI if WAIT
        let poiData = null;
        if (signal.bias === 'WAIT' || tradeLevels.waitReason) {
            poiData = RiskManager.generatePOI(currentMarketData, currentMode);
        }
        
        // Render results
        renderResults(signal, tradeLevels, poiData, aiAnalysis, currentMarketData);
        
    } catch (error) {
        console.error('Analysis failed:', error);
        elements.logicText.innerHTML = `<span class="text-rose-400">⚠️ Analysis Error: ${error.message}</span>`;
    } finally {
        showLoading(false);
    }
}

async function getGeminiAnalysis(marketData, signal, mode, apiKey, failoverModel) {
    const prompt = `
        You are the OMNI-SUPREME trading analyzer. Analyze this data:
        
        SYMBOL: ${marketData.symbol}
        MODE: ${mode.toUpperCase()}
        CURRENT PRICE: ${marketData.currentPrice}
        RSI: ${marketData.rsi.toFixed(1)}
        ATR: ${marketData.atr.toFixed(4)}
        TREND: ${marketData.trend}
        SUPPORT: ${marketData.support}
        RESISTANCE: ${marketData.resistance}
        
        SIGNAL FROM 8-CORE ENGINE: ${signal.bias}
        CONFIDENCE: ${signal.confidence}%
        PRIMARY STRATEGY: ${signal.primaryStrategy}
        
        Provide a 10-15 word surgical logic summary explaining WHY this trade setup exists.
        Output ONLY valid JSON: {"logic": "your 10-15 word explanation here"}
    `;
    
    const models = ['gemini-2.0-flash', failoverModel || 'gemini-2.0-flash-lite'];
    
    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
                })
            });
            
            const data = await response.json();
            if (data.candidates && data.candidates[0]) {
                const text = data.candidates[0].content.parts[0].text;
                const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
                return parsed;
            }
        } catch (err) {
            console.warn(`${model} failed:`, err);
            continue;
        }
    }
    
    return null;
}

function renderResults(signal, tradeLevels, poiData, aiAnalysis, marketData) {
    // Update bias display
    const bias = signal.bias;
    elements.signalBias.textContent = bias;
    elements.signalBias.className = `text-6xl md:text-7xl font-black italic tracking-tighter ${
        bias === 'BUY' ? 'signal-buy' : bias === 'SELL' ? 'signal-sell' : 'signal-wait'
    }`;
    
    elements.confidenceScore.textContent = `${signal.confidence}%`;
    elements.activeStrategy.textContent = signal.primaryStrategy;
    elements.assetClass.textContent = marketData.assetName;
    elements.tradeType.textContent = RiskManager.getTradeType(currentMode, marketData.volatility);
    
    // Check if we have valid trade levels (not WAIT)
    const hasValidTrade = tradeLevels.entry && tradeLevels.entry !== null && bias !== 'WAIT';
    
    if (hasValidTrade) {
        elements.entryPrice.textContent = tradeLevels.entry;
        elements.stopLoss.textContent = tradeLevels.stopLoss;
        elements.takeProfit.textContent = tradeLevels.takeProfit;
        elements.lotSize.textContent = tradeLevels.lotSize.toFixed(3);
        elements.rrRatio.textContent = `1:${tradeLevels.rrRatio.toFixed(1)}`;
        
        // Color RR based on value
        const minGood = currentMode === 'scalp' ? 2.0 : 4.0;
        if (tradeLevels.rrRatio >= minGood) {
            elements.rrRatio.style.color = '#00ff88';
        } else {
            elements.rrRatio.style.color = '#ffaa00';
        }
        
        // Hide POI container
        elements.poiContainer.classList.add('hidden');
        
        // Generate logic text
        let logicText = `${signal.primaryStrategy} strategy triggered. `;
        if (aiAnalysis && aiAnalysis.logic) {
            logicText = aiAnalysis.logic;
        } else if (signal.strategyReasons && signal.strategyReasons.length) {
            logicText = signal.strategyReasons.join('. ') + '.';
        } else {
            logicText = `${signal.confidence}% confluence across ${signal.primaryStrategy} and supporting strategies.`;
        }
        
        elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${bias} SIGNAL</span><br>${logicText}`;
        
    } else {
        // WAIT state - show dashes
        elements.entryPrice.textContent = '--';
        elements.stopLoss.textContent = '--';
        elements.takeProfit.textContent = '--';
        elements.lotSize.textContent = '--';
        
        // Show POI if available
        if (poiData) {
            elements.poiLevel.textContent = poiData.level;
            elements.poiLogic.textContent = poiData.logic;
            elements.poiContainer.classList.remove('hidden');
        } else {
            elements.poiContainer.classList.add('hidden');
        }
        
        // RR display based on mode
        const targetRR = currentMode === 'scalp' ? '1:1.5' : '1:4';
        elements.rrRatio.textContent = `0:0 (min ${targetRR})`;
        elements.rrRatio.style.color = '#ffaa00';
        
        // Logic for WAIT
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
