// chart.js – Lightweight Charts without .clear()

let chartInstance = null;
let candleSeriesInstance = null;
let currentChartSymbol = 'XAUUSD';
let currentInterval = '5';

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    attachEventListeners();
    
    // Auto-refresh every 2 minutes
    setInterval(() => {
        if (typeof loadChartData === 'function') {
            loadChartData();
        }
    }, 120000);
});

function initChart() {
    const container = document.getElementById('chart-container');
    if (!container) {
        console.error('No chart container');
        return;
    }

    // Destroy existing instance
    if (chartInstance) {
        chartInstance.remove();
        chartInstance = null;
        candleSeriesInstance = null;
    }

    chartInstance = LightweightCharts.createChart(container, {
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

    loadChartData();
}

function attachEventListeners() {
    // Timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.removeEventListener('click', handleTimeframeClick);
        btn.addEventListener('click', handleTimeframeClick);
    });
    // Asset selector
    const selector = document.getElementById('chartSymbolSelect');
    if (selector) {
        selector.removeEventListener('change', handleSymbolChange);
        selector.addEventListener('change', handleSymbolChange);
    }
    // Resize
    window.addEventListener('resize', () => {
        if (chartInstance) {
            const container = document.getElementById('chart-container');
            chartInstance.applyOptions({ width: container.clientWidth });
        }
    });
}

function handleTimeframeClick(e) {
    document.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('bg-indigo-600'));
    e.target.classList.add('bg-indigo-600');
    currentInterval = e.target.dataset.interval;
    loadChartData();
}

function handleSymbolChange(e) {
    currentChartSymbol = e.target.value;
    loadChartData();
}

function getFileName(symbol) {
    const mapping = {
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
    return mapping[symbol] || 'xauusd';
}

async function loadChartData() {
    const fileName = getFileName(currentChartSymbol);
    const url = `https://riyazsapkota31-bit.github.io/market-data-api/data/${fileName}.json?t=${Date.now()}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.candles || data.candles.length === 0) {
            console.warn('No candles');
            return;
        }
        const chartData = aggregateCandles(data.candles, currentInterval);
        renderChart(chartData);
    } catch (err) {
        console.error('Chart data error:', err);
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
        if (!group.length) continue;
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

function renderChart(data) {
    if (!chartInstance) return;
    if (candleSeriesInstance) {
        chartInstance.removeSeries(candleSeriesInstance);
    }
    candleSeriesInstance = chartInstance.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: '#00ff88',
        downColor: '#ff4466',
        borderVisible: false,
        wickUpColor: '#00ff88',
        wickDownColor: '#ff4466',
    });
    candleSeriesInstance.setData(data);
    chartInstance.timeScale().fitContent();
}

// Expose for external calls if needed
window.loadChartData = loadChartData;
window.initChart = initChart;
