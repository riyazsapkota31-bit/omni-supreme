/**
 * OMNI-SIGNAL - Main Application with Auto Price Tracking
 */

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

// Load settings
function loadSettings() {
    const saved = localStorage.getItem('omni_signal_config');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('balance').value = config.balance || '10000';
            document.getElementById('riskPercent').value = config.riskPercent || '1.0';
            document.getElementById('modeSelect').value = config.mode || 'scalp';
            document.getElementById('autoTrackSelect').value = config.autoTrack || 'on';
            currentMode = config.mode || 'scalp';
            autoTrackingEnabled = config.autoTrack !== 'off';
            updateAutoTrackStatus();
        } catch(e) {}
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

// UI Helpers
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

// Market Data
const MarketData = {
    async fetch(symbol) {
        let yahooSymbol = symbol;
        const map = { 'XAUUSD': 'GC=F', 'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD' };
        if (map[symbol]) yahooSymbol = map[symbol];
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1h&range=5d`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.chart?.result?.[0]) throw new Error('No data');
        
        const quotes = data.chart.result[0].indicators.quote[0];
        const closes = quotes.close.filter(c => c !== null);
        const highs = quotes.high.filter(h => h !== null);
        const lows = quotes.low.filter(l => l !== null);
        const currentPrice = closes[closes.length - 1];
        
        // Calculate RSI
        let rsi = 50;
        if (closes.length > 14) {
            let gains = 0, losses = 0;
            for (let i = closes.length - 15; i < closes.length - 1; i++) {
                const diff = closes[i + 1] - closes[i];
                if (diff > 0) gains += diff;
                else losses -= diff;
            }
            const avgGain = gains / 14;
            const avgLoss = losses / 14;
            if (avgLoss > 0) rsi = 100 - (100 / (1 + (avgGain / avgLoss)));
            else rsi = 100;
        }
        
        // EMAs
        const ema20 = closes.slice(-20).reduce((a,b) => a + b, 0) / 20;
        const ema50 = closes.slice(-50).reduce((a,b) => a + b, 0) / 50;
        const ema200 = closes.slice(-200).reduce((a,b) => a + b, 0) / 200;
        
        // Support/Resistance
        const support = Math.min(...lows.slice(-50));
        const resistance = Math.max(...highs.slice(-50));
        
        // ATR
        let atr = 0;
        if (highs.length > 14) {
            let trSum = 0;
            for (let i = highs.length - 14; i < highs.length; i++) {
                const hl = highs[i] - lows[i];
                const hc = Math.abs(highs[i] - closes[i-1]);
                const lc = Math.abs(lows[i] - closes[i-1]);
                trSum += Math.max(hl, hc, lc);
            }
            atr = trSum / 14;
        } else {
            atr = currentPrice * 0.005;
        }
        
        // Trend
        let trend = 'SIDEWAYS';
        if (ema20 > ema50 && ema50 > ema200) trend = 'BULLISH';
        if (ema20 < ema50 && ema50 < ema200) trend = 'BEARISH';
        
        return {
            currentPrice, rsi, ema20, ema50, ema200,
            support, resistance, atr, trend,
            symbol, prevPrice: closes[closes.length - 2] || currentPrice,
            spread: 0.0001, multiplier: symbol.includes('USD') ? 10000 : 1,
            digits: symbol.includes('BTC') ? 0 : 2
        };
    }
};

// Signal Engine
const SignalEngine = {
    analyze(data, mode) {
        const { rsi, currentPrice, ema20, ema50, support, resistance, trend } = data;
        
        let bias = 'WAIT';
        let confidence = 50;
        let reason = '';
        
        // RSI signal
        if (rsi < 30 && currentPrice > support) {
            bias = 'BUY';
            confidence = 65 + (30 - rsi);
            reason = `RSI oversold at ${rsi.toFixed(1)}. Support nearby.`;
        } else if (rsi > 70 && currentPrice < resistance) {
            bias = 'SELL';
            confidence = 65 + (rsi - 70);
            reason = `RSI overbought at ${rsi.toFixed(1)}. Resistance above.`;
        }
        
        // EMA confirmation
        if (bias === 'BUY' && ema20 > ema50) {
            confidence += 15;
            reason += ' Bullish EMA alignment.';
        } else if (bias === 'SELL' && ema20 < ema50) {
            confidence += 15;
            reason += ' Bearish EMA alignment.';
        } else if (bias !== 'WAIT' && ((bias === 'BUY' && ema20 < ema50) || (bias === 'SELL' && ema20 > ema50))) {
            confidence -= 20;
        }
        
        // Trend filter for day trading
        if (mode === 'day' && trend === 'SIDEWAYS' && bias !== 'WAIT') {
            confidence -= 25;
            reason += ' Sideways market - day trading not ideal.';
        }
        
        // Confidence threshold
        if (confidence < 55) {
            bias = 'WAIT';
            confidence = 50;
            reason = 'Insufficient confluence. Wait for better setup.';
        }
        
        // Calculate levels
        let entry = null, sl = null, tp = null;
        if (bias === 'BUY') {
            entry = currentPrice;
            sl = support * 0.998;
            const targetRR = mode === 'scalp' ? 1.5 : 2.0;
            const risk = entry - sl;
            tp = entry + (risk * targetRR);
            if (tp > resistance) tp = resistance * 0.998;
        } else if (bias === 'SELL') {
            entry = currentPrice;
            sl = resistance * 1.002;
            const targetRR = mode === 'scalp' ? 1.5 : 2.0;
            const risk = sl - entry;
            tp = entry - (risk * targetRR);
            if (tp < support) tp = support * 1.002;
        }
        
        return { bias, confidence, reason, entry, sl, tp };
    },
    
    calculateLotSize(entry, sl, balance, riskPercent) {
        if (!entry || !sl) return 0;
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
        const openTrades = window.getOpenTradesForTracking ? window.getOpenTradesForTracking() : [];
        if (openTrades.length === 0) return;
        
        try {
            const currentPriceData = await MarketData.fetch(currentSymbol);
            const price = currentPriceData.currentPrice;
            
            for (const trade of openTrades) {
                if (trade.status !== 'OPEN') continue;
                
                // Check if TP hit
                if (trade.bias === 'BUY' && price >= trade.tp) {
                    window.recordFeedback?.(trade.id, 'WIN', 'Auto-detected: TP hit');
                    showToast(`${trade.symbol} - TP HIT! Trade closed as WIN.`, 'success');
                }
                else if (trade.bias === 'SELL' && price <= trade.tp) {
                    window.recordFeedback?.(trade.id, 'WIN', 'Auto-detected: TP hit');
                    showToast(`${trade.symbol} - TP HIT! Trade closed as WIN.`, 'success');
                }
                // Check if SL hit
                else if (trade.bias === 'BUY' && price <= trade.sl) {
                    window.recordFeedback?.(trade.id, 'LOSS', 'Auto-detected: SL hit');
                    showToast(`${trade.symbol} - SL HIT! Trade closed as LOSS.`, 'error');
                }
                else if (trade.bias === 'SELL' && price >= trade.sl) {
                    window.recordFeedback?.(trade.id, 'LOSS', 'Auto-detected: SL hit');
                    showToast(`${trade.symbol} - SL HIT! Trade closed as LOSS.`, 'error');
                }
                // Check for partial TP touch (price touched TP but reversed)
                else if (trade.bias === 'BUY' && price >= trade.tp * 0.99 && price < trade.tp) {
                    // Track that it got close to TP
                    if (!trade.tpAlmostHit) {
                        trade.tpAlmostHit = true;
                        trade.tpAlmostHitTime = Date.now();
                    }
                    // If it got close to TP then dropped significantly
                    if (trade.tpAlmostHit && price < trade.entry) {
                        window.recordFeedback?.(trade.id, 'PARTIAL', 'Auto-detected: TP almost hit then reversed');
                        showToast(`${trade.symbol} - TP almost hit! Trade reversed to loss.`, 'warning');
                    }
                }
                else if (trade.bias === 'SELL' && price <= trade.tp * 1.01 && price > trade.tp) {
                    if (!trade.tpAlmostHit) {
                        trade.tpAlmostHit = true;
                        trade.tpAlmostHitTime = Date.now();
                    }
                    if (trade.tpAlmostHit && price > trade.entry) {
                        window.recordFeedback?.(trade.id, 'PARTIAL', 'Auto-detected: TP almost hit then reversed');
                        showToast(`${trade.symbol} - TP almost hit! Trade reversed to loss.`, 'warning');
                    }
                }
            }
            
            // Save updated trades
            window.saveFeedbackData?.();
            window.renderOpenTrades?.();
            
        } catch (e) {
            console.log('Auto-track error:', e);
        }
    }, 30000); // Check every 30 seconds
}

function stopAutoTracking() {
    if (autoTrackInterval) {
        clearInterval(autoTrackInterval);
        autoTrackInterval = null;
    }
}

// Main Analysis
async function analyze() {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
        openDrawer();
        showToast('Please enter your Gemini API key', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        currentSymbol = elements.symbolSelect.value;
        currentData = await MarketData.fetch(currentSymbol);
        
        elements.currentPrice.textContent = currentData.currentPrice.toFixed(2);
        elements.updateTime.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        
        const balance = parseFloat(document.getElementById('balance').value);
        const riskPercent = parseFloat(document.getElementById('riskPercent').value);
        
        currentSignal = SignalEngine.analyze(currentData, currentMode);
        
        // Apply adjusted confidence from feedback system if available
        if (typeof getAdjustedConfidence === 'function') {
            const adjustedConf = getAdjustedConfidence(currentSignal);
            currentSignal.confidence = adjustedConf;
        }
        
        // Display signal
        elements.signalBias.textContent = currentSignal.bias;
        elements.signalBias.className = `text-7xl font-black italic ${
            currentSignal.bias === 'BUY' ? 'signal-buy' : 
            currentSignal.bias === 'SELL' ? 'signal-sell' : 'signal-wait'
        }`;
        elements.confidenceText.textContent = `${currentSignal.confidence}% confidence`;
        
        // Calculate trade levels
        if (currentSignal.bias !== 'WAIT' && currentSignal.entry && currentSignal.sl && currentSignal.tp) {
            currentTradeLevels = {
                entry: currentSignal.entry,
                stopLoss: currentSignal.sl,
                takeProfit: currentSignal.tp
            };
            
            elements.entryPrice.textContent = currentSignal.entry.toFixed(5);
            elements.stopLoss.textContent = currentSignal.sl.toFixed(5);
            elements.takeProfit.textContent = currentSignal.tp.toFixed(5);
            
            const lotSize = SignalEngine.calculateLotSize(currentSignal.entry, currentSignal.sl, balance, riskPercent);
            elements.lotSize.textContent = lotSize.toFixed(2);
            
            const risk = Math.abs(currentSignal.entry - currentSignal.sl);
            const reward = Math.abs(currentSignal.tp - currentSignal.entry);
            const rr = risk > 0 ? (reward / risk).toFixed(1) : 0;
            elements.rrValue.textContent = `1:${rr}`;
            elements.tradeType.textContent = currentMode === 'scalp' ? 'SCALP' : 'DAY';
            
            elements.poiBox.classList.add('hidden');
            
            // Add to open trades for tracking
            if (typeof addOpenTrade === 'function') {
                addOpenTrade(currentSignal, currentData, currentTradeLevels);
            }
            
            // Start auto tracking if enabled
            if (autoTrackingEnabled) {
                startAutoTracking();
            }
            
            // Get Gemini explanation
            try {
                const explanation = await getGeminiExplanation(apiKey);
                if (explanation) {
                    elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${currentSignal.bias}</span><br>${explanation}`;
                } else {
                    elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${currentSignal.bias}</span><br>${currentSignal.reason}`;
                }
            } catch(e) {
                elements.logicText.innerHTML = `<span class="text-cyan-400">🎯 ${currentSignal.bias}</span><br>${currentSignal.reason}`;
            }
        } else {
            elements.entryPrice.textContent = '--';
            elements.stopLoss.textContent = '--';
            elements.takeProfit.textContent = '--';
            elements.lotSize.textContent = '--';
            elements.rrValue.textContent = '0:0';
            
            // Show POI for WAIT
            const poi = currentData.currentPrice;
            elements.poiLevel.textContent = poi.toFixed(2);
            elements.poiLogic.textContent = currentSignal.reason || 'No clear setup. Wait for price action.';
            elements.poiBox.classList.remove('hidden');
            elements.logicText.innerHTML = `<span class="text-amber-400">⏸️ WAIT MODE</span><br>${currentSignal.reason}`;
        }
        
    } catch (error) {
        console.error(error);
        elements.signalBias.textContent = 'ERROR';
        elements.logicText.textContent = `Failed: ${error.message}`;
        showToast('Data fetch failed. Check internet.', 'error');
    } finally {
        showLoading(false);
    }
}

async function getGeminiExplanation(apiKey) {
    const prompt = `Explain this trade signal in 10-15 words: ${currentSymbol} price ${currentData.currentPrice}. RSI ${currentData.rsi.toFixed(1)}. Signal: ${currentSignal.bias} with ${currentSignal.confidence}% confidence. ${currentSignal.reason}`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 60 }
        })
    });
    
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
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
    
    // Load feedback UI functions if available
    setTimeout(() => {
        if (typeof renderOpenTrades === 'function') renderOpenTrades();
        if (typeof renderFeedbackHistory === 'function') renderFeedbackHistory();
        if (typeof updateStrategyPerformance === 'function') updateStrategyPerformance();
        if (typeof loadFeedbackData === 'function') loadFeedbackData();
        
        // Set win rate display
        const winRateEl = document.getElementById('winRateDisplay');
        if (winRateEl && typeof getCurrentWinRate === 'function') {
            const rate = getCurrentWinRate();
            winRateEl.textContent = `${rate}%`;
            winRateEl.className = rate >= 55 ? 'text-emerald-400' : (rate >= 45 ? 'text-yellow-400' : 'text-rose-400');
        }
    }, 100);
}

// Start app
init();
