// chart.js – FINAL (With footprint markers)

let chart = null;
let currentSymbol = 'XAUUSD';
let currentInterval = '5';

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initChart();
        setupEventListeners();
        setInterval(() => refreshChart(), 120000);
    }, 500);
});

function setupEventListeners() {
    const selector = document.getElementById('chartSymbolSelect');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentSymbol = e.target.value;
            refreshChart();
        });
    }
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('bg-indigo-600'));
            e.target.classList.add('bg-indigo-600');
            currentInterval = e.target.dataset.interval;
            refreshChart();
        });
    });
}

function getFileName(symbol) {
    const map = {
        'XAUUSD': 'xauusd', 'XAGUSD': 'xagusd', 'BTCUSD': 'btcusd', 'ETHUSD': 'ethusd',
        'EURUSD': 'eurusd', 'GBPUSD': 'gbpusd', 'USDJPY': 'usdjpy', 'USDCAD': 'usdcad',
        'USDCHF': 'usdchf', 'USDSEK': 'usdsek', 'SOLUSD': 'solusd'
    };
    return map[symbol] || 'xauusd';
}

async function refreshChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    
    const fileName = getFileName(currentSymbol);
    const url = `https://riyazsapkota31-bit.github.io/market-data-api/data/${fileName}.json?t=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (!data.candles || data.candles.length === 0) {
            console.log('No candle data yet');
            return;
        }
        
        let chartData = data.candles.map(c => ({
            time: Math.floor(c.timestamp / 1000),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
        }));
        
        if (currentInterval !== '1') {
            const groupSize = parseInt(currentInterval);
            const aggregated = [];
            for (let i = 0; i < chartData.length; i += groupSize) {
                const group = chartData.slice(i, i + groupSize);
                if (group.length === 0) continue;
                aggregated.push({
                    time: group[0].time,
                    open: group[0].open,
                    high: Math.max(...group.map(c => c.high)),
                    low: Math.min(...group.map(c => c.low)),
                    close: group[group.length - 1].close
                });
            }
            chartData = aggregated;
        }
        
        if (chart) {
            chart.remove();
            chart = null;
        }
        
        if (typeof LightweightCharts === 'undefined') {
            console.error('LightweightCharts not loaded');
            return;
        }
        
        chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: 400,
            layout: { background: { color: '#0f1522' }, textColor: '#e8edf5' },
            grid: { vertLines: { color: '#1a2030' }, horzLines: { color: '#1a2030' } },
            timeScale: { timeVisible: true, secondsVisible: false }
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
        
    } catch (err) {
        console.error('Chart error:', err);
    }
}

function initChart() {
    refreshChart();
}
