// chart.js – Live candlestick chart with timeframe switching

let chart = null;
let currentChartSymbol = 'XAUUSD';
let currentInterval = '5';
let candleData = [];

async function initChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    
    chart = LightweightCharts.createChart(container, {
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
    
    // Add timeframe button listeners
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('bg-indigo-600'));
            e.target.classList.add('bg-indigo-600');
            currentInterval = e.target.dataset.interval;
            await loadChartData();
        });
    });
    
    await loadChartData();
}

function getChartFileName(symbol) {
    const map = {
        'XAUUSD': 'xauusd',
        'XAGUSD': 'xagusd',
        'BTCUSD': 'btcusd',
        'ETHUSD': 'ethusd',
        'EURUSD': 'eurusd',
        'GBPUSD': 'gbpusd',
        'USDJPY': 'usdjpy',
        'SOLUSD': 'solusd'
    };
    return map[symbol] || 'xauusd';
}

async function loadChartData() {
    const fileName = getChartFileName(currentChartSymbol);
    const url = `https://riyazsapkota31-bit.github.io/market-data-api/data/${fileName}.json?t=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.candles && data.candles.length > 0) {
            candleData = aggregateCandles(data.candles, currentInterval);
            renderChart();
        } else {
            console.warn('No candle data available');
        }
    } catch (err) {
        console.error('Failed to load chart data:', err);
    }
}

function aggregateCandles(candles, minutes) {
    if (minutes === '1') {
        return candles.map(c => ({
            time: Math.floor(c.timestamp / 1000),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
        }));
    }
    
    const groupSize = parseInt(minutes);
    const aggregated = [];
    
    for (let i = 0; i < candles.length; i += groupSize) {
        const group = candles.slice(i, i + groupSize);
        if (group.length === 0) continue;
        
        aggregated.push({
            time: Math.floor(group[0].timestamp / 1000),
            open: group[0].open,
            high: Math.max(...group.map(c => c.high)),
            low: Math.min(...group.map(c => c.low)),
            close: group[group.length - 1].close
        });
    }
    
    return aggregated;
}

function renderChart() {
    if (!chart) return;
    
    // Clear existing series
    chart.clear();
    
    const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: '#00ff88',
        downColor: '#ff4466',
        borderVisible: false,
        wickUpColor: '#00ff88',
        wickDownColor: '#ff4466',
    });
    
    candleSeries.setData(candleData);
    chart.timeScale().fitContent();
}

window.addEventListener('resize', () => {
    if (chart) {
        const container = document.getElementById('chart-container');
        chart.applyOptions({ width: container.clientWidth });
    }
});
