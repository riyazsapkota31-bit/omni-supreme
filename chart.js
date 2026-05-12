// chart.js – Recreate chart on each data load (avoids addSeries errors)

let currentChartSymbol = 'XAUUSD';
let currentInterval = '5';
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment for the library to load
    setTimeout(() => {
        loadAndRenderChart();
        setupEventListeners();
        
        // Auto-refresh every 2 minutes
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            loadAndRenderChart();
        }, 120000);
    }, 200);
});

function setupEventListeners() {
    // Timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('bg-indigo-600'));
            e.target.classList.add('bg-indigo-600');
            currentInterval = e.target.dataset.interval;
            loadAndRenderChart();
        });
    });
    
    // Asset selector
    const selector = document.getElementById('chartSymbolSelect');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentChartSymbol = e.target.value;
            loadAndRenderChart();
        });
    }
}

function getFileName(symbol) {
    const map = {
        'XAUUSD': 'xauusd',
        'XAGUSD': 'xagusd',
        'BTCUSD': 'btcusd',
        'ETHUSD': 'ethusd',
        'EURUSD': 'eurusd',
        'GBPUSD': 'gbpusd',
        'USDJPY': 'usdjpy',
        'USDCAD': 'usdcad',
        'USDCHF': 'usdchf',
        'USDSEK': 'usdsek',
        'SOLUSD': 'solusd'
    };
    return map[symbol] || 'xauusd';
}

async function loadAndRenderChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    
    const fileName = getFileName(currentChartSymbol);
    const url = `https://riyazsapkota31-bit.github.io/market-data-api/data/${fileName}.json?t=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.candles || data.candles.length === 0) {
            console.warn('No candle data');
            return;
        }
        
        const chartData = aggregateCandles(data.candles, currentInterval);
        
        // Completely remove old chart and create a new one
        if (container.firstChild) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
        
        // Check if library is loaded
        if (typeof LightweightCharts === 'undefined') {
            console.error('LightweightCharts not loaded');
            return;
        }
        
        const chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: 400,
            layout: {
                background: { color: '#0f1522' },
                textColor: '#e8edf5',
            },
            grid: {
                vertLines: { color: '#1a2030' },
                horzLines: { color: '#1a2030' },
            },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
            rightPriceScale: { borderColor: '#2a2e38' },
            timeScale: { borderColor: '#2a2e38', timeVisible: true, secondsVisible: false },
        });
        
        const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor: '#00ff88',
            downColor: '#ff4466',
            borderVisible: false,
            wickUpColor: '#00ff88',
            wickDownColor: '#ff4466',
        });
        
        candleSeries.setData(chartData);
        chart.timeScale().fitContent();
        
        // Handle window resize
        const resizeHandler = () => {
            chart.applyOptions({ width: container.clientWidth });
        };
        window.removeEventListener('resize', resizeHandler);
        window.addEventListener('resize', resizeHandler);
        
    } catch (err) {
        console.error('Chart error:', err);
    }
}

function aggregateCandles(candles, interval) {
    if (interval === '1') {
        return candles.map(c => ({
            time: Math.floor(c.timestamp / 1000),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
        }));
    }
    const groupSize = parseInt(interval);
    const result = [];
    for (let i = 0; i < candles.length; i += groupSize) {
        const group = candles.slice(i, i + groupSize);
        if (group.length === 0) continue;
        result.push({
            time: Math.floor(group[0].timestamp / 1000),
            open: group[0].open,
            high: Math.max(...group.map(c => c.high)),
            low: Math.min(...group.map(c => c.low)),
            close: group[group.length - 1].close
        });
    }
    return result;
}
