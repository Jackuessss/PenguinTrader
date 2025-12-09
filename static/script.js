// Alpha Vantage API key
// Alpha Vantage API key
const API_KEY = 'LA9DKLX13DQCKHV3'; // Replace with your Alpha Vantage API key
const BACKEND_URL = 'https://penguin-trader-render-backend.onrender.com';

// Theme toggle functionality
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('svg');

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    updateThemeIcon(savedTheme === 'dark');
} else {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
    updateThemeIcon(prefersDark);
}

// Theme toggle click handler
themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
});

// Function to update theme icon
function updateThemeIcon(isDark) {
    if (isDark) {
        themeIcon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    `;
    } else {
        themeIcon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    `;
    }
}

// Set the title (remove "Stocks" text, just show the icon)
const watchlistHeader = document.getElementById('watchlist-header');
if (watchlistHeader) {
    watchlistHeader.innerHTML = `<span id="watchlist-name">Stocks</span>`;
}

// Global watchlist variable
let watchlist = new Set();

// Initialize search functionality
console.log('Setting up search functionality');
const searchInput = document.getElementById('stock-search');
const searchResults = document.getElementById('search-results');

if (searchInput && searchResults) {
    console.log('Search elements found, attaching event listeners');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        console.log('Search input event triggered');
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                // Show loading state
                searchResults.innerHTML = `
                                <div class="p-4 text-gray-500">
                                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary inline-block mr-2"></div>
                                    Searching...
                                </div>
                            `;
                searchResults.classList.remove('hidden');
                console.log('Searching for:', query);

                // Convert query to lowercase for case-insensitive search
                const searchQuery = query.toLowerCase();

                // Filter through default stocks
                const results = window.defaultStocks.filter(stock => {
                    // Search in both symbol and name
                    return stock.symbol.toLowerCase().includes(searchQuery) ||
                        stock.name.toLowerCase().includes(searchQuery);
                });

                console.log('Search results:', results.length, 'matches found');

                if (results.length === 0) {
                    searchResults.innerHTML = '<div class="p-4 text-gray-500">No results found</div>';
                } else {
                    searchResults.innerHTML = results.map(stock => `
                                    <div class="p-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-0" onclick="selectStock('${stock.symbol}')">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center space-x-3">
                                                <div class="w-8 h-8 flex-shrink-0">
                                                    <img src="${stock.logoUrl}" alt="${stock.name} logo" class="w-full h-full object-contain">
                                                </div>
                                                <div>
                                                    <div class="font-medium">${stock.name}</div>
                                                    <div class="text-sm text-gray-400">${stock.symbol}</div>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <div class="font-semibold">$${formatPrice(stock.price)}</div>
                                                <div class="text-xs ${stock.isPositive ? 'text-positive' : 'text-negative'}">
                                                    ${stock.isPositive ? '+' : ''}${formatPrice(stock.change)} (${stock.isPositive ? '+' : ''}${formatPrice(stock.changePercent)}%)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('');
                }

                // Check if search results are visible
                setTimeout(() => {
                    const computedStyle = window.getComputedStyle(searchResults);
                    console.log('Search results computed display:', computedStyle.display);
                    console.log('Search results visible:', !searchResults.classList.contains('hidden'));
                }, 100);

            } catch (error) {
                console.error('Error searching stocks:', error);
                searchResults.innerHTML = `
                                <div class="p-4 text-red-500">
                                    Error searching stocks. Please try again.
                                </div>
                            `;
            }
        }, 300);
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
} else {
    console.error('Search elements not found:', {
        searchInput: !!searchInput,
        searchResults: !!searchResults
    });
}

// Make selectStock available globally
window.selectStock = function (symbol) {
    console.log('Select stock called for:', symbol);
    const searchInput = document.getElementById('stock-search');
    const searchResults = document.getElementById('search-results');
    const stockList = document.getElementById('stock-list');

    if (searchResults) {
        searchResults.classList.add('hidden');
    }

    // Find the stock in the default stocks list
    const stock = window.defaultStocks.find(s => s.symbol === symbol);
    if (stock) {
        console.log('Stock found:', stock);
        // Remove active class from all items in the stock list
        document.querySelectorAll('#stock-list > div').forEach(item => {
            item.classList.remove('bg-primary/10', 'dark:bg-primary/20');
        });

        // Find and highlight the selected stock in the list
        const selectedStockElement = stockList.querySelector(`[data-symbol="${symbol}"]`);
        if (selectedStockElement) {
            selectedStockElement.classList.add('bg-primary/10', 'dark:bg-primary/20');
            // Scroll the selected stock into view
            selectedStockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Show stock details
        showStockDetail(stock);
    } else {
        console.error('Stock not found:', symbol);
        showError('Stock not found');
    }
};



// Helper to render the list
function renderStockList(stocks) {
    const stockListEl = document.getElementById('stock-list');
    if (!stockListEl) return;

    stockListEl.innerHTML = '';

    if (stocks.length === 0) {
        stockListEl.innerHTML = '<div class="p-4 text-center text-gray-500">No stocks found</div>';
        return;
    }

    stocks.forEach(stock => {
        const div = document.createElement('div');
        div.className = 'p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-b dark:border-gray-700 border-gray-200';
        div.setAttribute('data-symbol', stock.symbol);

        div.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 flex-shrink-0">
                        <img src="${stock.logo_url}" alt="${stock.name} logo" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/32'">
                    </div>
                    <div>
                        <div class="font-medium">${stock.name}</div>
                        <div class="text-sm text-gray-400">${stock.symbol}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-semibold">$${(stock.price || 0).toFixed(2)}</div>
                    <div class="text-xs text-positive">
                        +0.00%
                    </div>
                </div>
            </div>
        `;

        div.addEventListener('click', () => {
            console.log(`Selected: ${stock.symbol}`);

            // Visual feedback
            document.querySelectorAll('#stock-list > div').forEach(item => {
                item.classList.remove('bg-primary/10', 'dark:bg-primary/20');
            });
            div.classList.add('bg-primary/10', 'dark:bg-primary/20');

            // Update details view
            showStockDetail(stock);
        });

        stockListEl.appendChild(div);
    });
}

// Call init on load
document.addEventListener('DOMContentLoaded', () => {
    initWatchlist();

    // Initialize real-time updates if available
    if (typeof initializeRealTimeUpdates === 'function') {
        initializeRealTimeUpdates();
    }
});

// Set up watchlist toggle with animation
const watchlistButton = document.querySelector('.watchlist-star');
watchlistButton.addEventListener('click', async () => {
    const currentSymbol = document.getElementById('detail-symbol').textContent;
    const starIcon = watchlistButton.querySelector('svg');

    if (watchlist.has(currentSymbol)) {
        // Remove from watchlist with animation
        starIcon.style.transform = 'scale(0.8)';
        await removeFromWatchlist(currentSymbol);
        starIcon.setAttribute('fill', 'none');
        starIcon.setAttribute('stroke', 'currentColor');
    } else {
        // Add to watchlist with animation
        starIcon.style.transform = 'scale(1.2)';
        await addToWatchlist(currentSymbol);
        starIcon.setAttribute('fill', '#FFD700');
        starIcon.setAttribute('stroke', '#FFD700');
    }

    // Reset transform after animation
    setTimeout(() => {
        starIcon.style.transform = 'scale(1)';
    }, 200);
});

// Add transition style to star icon
const starIcon = watchlistButton.querySelector('svg');
starIcon.style.transition = 'transform 0.2s ease-in-out';

// Watchlist buttons
const createWatchlistBtn = document.querySelector('.watchlist-button:first-of-type');
const editWatchlistBtn = document.querySelector('.watchlist-button:last-of-type');

createWatchlistBtn.addEventListener('click', () => {
    // Show create watchlist modal or form
    console.log('Create watchlist clicked');
});

editWatchlistBtn.addEventListener('click', () => {
    // Show edit watchlist modal or form
    console.log('Edit watchlist clicked');
});

// Navigation handling
const stocksNav = document.querySelector('a[data-section="stocks"]');
const forexNav = document.querySelector('a[data-section="forex"]');
const stocksList = document.querySelector('#stock-list');
const forexList = document.querySelector('#forex-list');

const defaultForexPairs = [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
    { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
    { symbol: 'GBP/EUR', name: 'British Pound / Euro' }
];

function updateForexPair(symbol) {
    const detailName = document.querySelector('#detail-name');
    const detailSymbol = document.querySelector('#detail-symbol');
    const detailChange = document.querySelector('#detail-change');
    const sellPrice = document.querySelector('#detail-sell-price');
    const buyPrice = document.querySelector('#detail-buy-price');

    // Show the detail section if it's hidden
    const detailSection = document.querySelector('#stock-detail');
    detailSection.classList.remove('hidden');
    detailSection.classList.add('md:flex');

    // Update the UI with loading state
    detailName.textContent = symbol;
    detailSymbol.textContent = 'Loading...';
    detailChange.textContent = 'Loading...';
    sellPrice.textContent = 'Loading...';
    buyPrice.textContent = 'Loading...';

}

function createForexListItem(symbol, name) {
    const li = document.createElement('li');
    li.className = 'p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200';
    li.setAttribute('data-symbol', symbol);

    li.addEventListener('click', () => {
        document.querySelectorAll('#forex-list li').forEach(item => {
            item.classList.remove('bg-primary/10', 'dark:bg-primary/20');
        });
        li.classList.add('bg-primary/10', 'dark:bg-primary/20');
        updateForexPair(symbol);
    });

    li.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-medium">${symbol}</div>
                            <div class="text-sm text-gray-400">${name}</div>
                        </div>
                        <div class="text-right">
                            <div class="loading-placeholder">Loading...</div>
                            <div class="text-sm loading-placeholder">Loading...</div>
                        </div>
                    </div>
                `;

    return li;
}

function switchToForex() {
    stocksList.classList.add('hidden');
    forexList.classList.remove('hidden');
    stocksNav.classList.remove('text-primary');
    forexNav.classList.add('text-primary');

    // Update forex prices
    defaultForexPairs.forEach(pair => {
        fetch(`${BACKEND_URL}/api/forex/${pair.symbol.replace('/', '')}`)
            .then(response => response.json())
            .then(data => {
                const li = forexList.querySelector(`[data-symbol="${pair.symbol}"]`);
                if (li) {
                    const priceDiv = li.querySelector('.loading-placeholder');
                    const changeDiv = li.querySelectorAll('.loading-placeholder')[1];
                    priceDiv.textContent = data.price.toFixed(4);
                    changeDiv.textContent = `${data.change}%`;
                    changeDiv.className = `text-sm ${data.change >= 0 ? 'text-positive' : 'text-negative'}`;
                }
            });
    });
}

function switchToStocks() {
    forexList.classList.add('hidden');
    stocksList.classList.remove('hidden');
    forexNav.classList.remove('text-primary');
    stocksNav.classList.add('text-primary');
}

// Initialize forex list
const forexListContainer = document.createElement('div');
forexListContainer.id = 'forex-list';
forexListContainer.className = 'space-y-2 p-2 hidden';
defaultForexPairs.forEach(pair => {
    forexListContainer.appendChild(createForexListItem(pair.symbol, pair.name));
});
stocksList.parentNode.insertBefore(forexListContainer, stocksList.nextSibling);

// Add event listeners for navigation
forexNav.addEventListener('click', (e) => {
    e.preventDefault();
    switchToForex();
});

stocksNav.addEventListener('click', (e) => {
    e.preventDefault();
    switchToStocks();
});

function updateForexChart(symbol) {
    const chart = document.querySelector('#stock-chart');
    chart.innerHTML = '<div class="text-gray-400">Loading chart data...</div>';

    fetch(`${BACKEND_URL}/api/forex/history/${symbol.replace('/', '')}`)
        .then(response => response.json())
        .then(data => {
            const trace = {
                x: data.timestamps,
                y: data.prices,
                type: 'scatter',
                mode: 'lines',
                line: {
                    color: '#5D5CDE',
                    width: 2
                }
            };

            const layout = {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                xaxis: {
                    showgrid: false,
                    zeroline: false,
                    visible: false
                },
                yaxis: {
                    showgrid: false,
                    zeroline: false,
                    visible: false
                },
                margin: {
                    l: 0,
                    r: 0,
                    t: 0,
                    b: 0
                }
            };

            Plotly.newPlot(chart, [trace], layout, {
                displayModeBar: false,
                responsive: true
            });
        })
        .catch(error => {
            console.error('Error fetching forex chart data:', error);
            chart.innerHTML = '<div class="text-gray-400">Error loading chart data</div>';
        });
}

// Set initial active state
stocksNav.classList.add('text-primary');

// Add event listeners for time period buttons
const timeButtons = document.querySelectorAll('.time-button');
timeButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        timeButtons.forEach(btn => btn.classList.remove('time-active'));
        // Add active class to clicked button
        button.classList.add('time-active');

        // Get the time period from the button text
        const period = button.textContent;
        let days;
        switch (period) {
            case '1D': days = 1; break;
            case '1W': days = 7; break;
            case '1M': days = 30; break;
            case '3M': days = 90; break;
            case '1Y': days = 365; break;
            case 'MAX': days = 365 * 5; break;
        }

        // Update chart with new time period
        const currentSymbol = document.getElementById('detail-symbol').textContent;
        updateChart(currentSymbol, days);
    });
});

// Add chart type toggle functionality
const chartTypeToggle = document.getElementById('chart-type-toggle');
let isCandlestick = true;

chartTypeToggle.addEventListener('click', () => {
    isCandlestick = !isCandlestick;
    const currentSymbol = document.getElementById('detail-symbol').textContent;
    const currentDays = parseInt(document.querySelector('.time-button.time-active').textContent.replace(/[^0-9]/g, '')) || 30;
    updateChart(currentSymbol, currentDays);
});

// Add placeholder for fullscreen toggle
const fullscreenToggle = document.getElementById('fullscreen-toggle');
fullscreenToggle.addEventListener('click', () => {
    // Placeholder for fullscreen functionality
    console.log('Fullscreen toggle clicked');
});

// Function to load watchlist items
async function loadWatchlistItems(watchlistId) {
    const stockListEl = document.getElementById('stock-list');
    if (!stockListEl) return;

    // Show loading state
    stockListEl.innerHTML = `
                    <div class="flex items-center justify-center p-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                `;

    try {
        const response = await fetch(`/api/watchlist/${watchlistId}`);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            // Update watchlist name
            const watchlistNameEl = document.getElementById('watchlist-name');
            if (watchlistNameEl) {
                watchlistNameEl.textContent = data.watchlist_name;
            }

            // Clear and populate the list
            stockListEl.innerHTML = '';
            data.items.forEach(stock => {
                const div = document.createElement('div');
                div.className = 'p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-b dark:border-gray-700 border-gray-200';
                div.setAttribute('data-symbol', stock.symbol);

                div.innerHTML = `
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-8 h-8 flex-shrink-0">
                                            <img src="${stock.logoUrl}" alt="${stock.name} logo" class="w-full h-full object-contain">
                                        </div>
                                        <div>
                                            <div class="font-medium">${stock.name}</div>
                                            <div class="text-sm text-gray-400">${stock.symbol}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="font-semibold">$${formatPrice(stock.price)}</div>
                                        <div class="text-xs ${stock.isPositive ? 'text-positive' : 'text-negative'}">
                                            ${stock.isPositive ? '+' : ''}${formatPrice(stock.change)} (${stock.isPositive ? '+' : ''}${formatPrice(stock.changePercent)}%)
                                        </div>
                                    </div>
                                </div>
                            `;

                div.addEventListener('click', () => {
                    // Remove active class from all items
                    document.querySelectorAll('#stock-list > div').forEach(item => {
                        item.classList.remove('bg-primary/10', 'dark:bg-primary/20');
                    });

                    // Add active class to clicked item
                    div.classList.add('bg-primary/10', 'dark:bg-primary/20');

                    // Show stock details
                    showStockDetail(stock);
                });

                stockListEl.appendChild(div);
            });

            // Show the first stock as default
            if (data.items.length > 0) {
                showStockDetail(data.items[0]);
            }
        } else {
            stockListEl.innerHTML = `
                            <div class="p-8 text-center text-gray-500">
                                No items in this watchlist
                            </div>
                        `;
        }
    } catch (error) {
        console.error('Error loading watchlist:', error);
        stockListEl.innerHTML = `
                        <div class="p-8 text-center text-red-500">
                            Error loading watchlist. Please try again.
                        </div>
                    `;
    }
}

// Function to switch between watchlists
async function switchWatchlist(watchlistId) {
    // Show loading state in the list
    await loadWatchlistItems(watchlistId);
}

// Add event listeners for watchlist navigation
document.addEventListener('DOMContentLoaded', () => {
    const watchlistLinks = document.querySelectorAll('.watchlist-link');
    watchlistLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const watchlistId = link.getAttribute('data-watchlist-id');

            // Remove active class from all links
            watchlistLinks.forEach(l => l.classList.remove('text-primary'));
            // Add active class to clicked link
            link.classList.add('text-primary');

            // Load the selected watchlist
            await switchWatchlist(watchlistId);
        });
    });

    /**
     * In a full application, the following functions would be implemented to fetch data from Alpha Vantage API
     */

    // Function to show error message
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Function to fetch stock price with better error handling
    async function fetchStockPrice(symbol) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/stock/${symbol}`);
            const data = await response.json();

            if (data.error) {
                if (data.error.includes('API rate limit')) {
                    showError('API rate limit reached. Please try again in a few minutes.');
                } else {
                    showError(data.error);
                }
                return null;
            }

            const quote = data['Global Quote'];
            if (!quote) {
                showError('No data available for this stock');
                return null;
            }

            const price = parseFloat(quote['05. price']);
            const change = parseFloat(quote['09. change']);
            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

            return {
                price,
                change,
                changePercent,
                isPositive: change >= 0
            };
        } catch (error) {
            console.error('Error fetching stock price:', error);
            showError('Failed to fetch stock price. Please try again later.');
            return null;
        }
    }

    // Function to fetch intraday data for chart
    async function fetchIntradayData(symbol, interval = '5min') {
        try {
            const response = await fetch(`${BACKEND_URL}/api/intraday/${symbol}?interval=${interval}`);
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return [];
            }

            if (data['Time Series (5min)']) {
                const timeSeries = data['Time Series (5min)'];
                const chartData = [];

                for (const [timestamp, values] of Object.entries(timeSeries)) {
                    chartData.push({
                        x: new Date(timestamp),
                        o: parseFloat(values['1. open']),
                        h: parseFloat(values['2. high']),
                        l: parseFloat(values['3. low']),
                        c: parseFloat(values['4. close'])
                    });
                }

                return chartData.reverse();
            }

            return [];
        } catch (error) {
            console.error('Error fetching intraday data:', error);
            showError('Failed to fetch chart data. Please try again later.');
            return [];
        }
    }

    // Function to fetch daily data for chart
    async function fetchDailyData(symbol) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/daily/${symbol}`);
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return [];
            }

            if (data['Time Series (Daily)']) {
                const timeSeries = data['Time Series (Daily)'];
                const chartData = [];

                for (const [timestamp, values] of Object.entries(timeSeries)) {
                    chartData.push({
                        x: new Date(timestamp),
                        o: parseFloat(values['1. open']),
                        h: parseFloat(values['2. high']),
                        l: parseFloat(values['3. low']),
                        c: parseFloat(values['4. close'])
                    });
                }

                return chartData.reverse();
            }

            return [];
        } catch (error) {
            console.error('Error fetching daily data:', error);
            showError('Failed to fetch chart data. Please try again later.');
            return [];
        }
    }

    // Function to add a stock to the list
    async function addStockToList(symbol) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(symbol)}`);
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return;
            }

            const stockData = data.result?.find(s => s.symbol === symbol);
            if (!stockData) {
                showError('Stock not found');
                return;
            }

            // Add to the list
            const stockList = document.getElementById('stock-list');
            if (stockList) {
                const div = document.createElement('div');
                div.className = 'p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-b dark:border-gray-700 border-gray-200';
                div.setAttribute('data-symbol', stockData.symbol);

                div.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 flex-shrink-0">
                                    <img src="${stockData.logoUrl}" alt="${stockData.name} logo" class="w-full h-full object-contain">
                                </div>
                                <div>
                                    <div class="font-medium">${stockData.name}</div>
                                    <div class="text-sm text-gray-400">${stockData.symbol}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="font-semibold">$${formatPrice(stockData.price)}</div>
                                <div class="text-xs ${stockData.isPositive ? 'text-positive' : 'text-negative'}">
                                    ${stockData.isPositive ? '+' : ''}${formatPrice(stockData.change)} (${stockData.isPositive ? '+' : ''}${formatPrice(stockData.changePercent)}%)
                                </div>
                            </div>
                        </div>
                    `;

                div.addEventListener('click', () => {
                    // Remove active class from all items
                    document.querySelectorAll('#stock-list > div').forEach(item => {
                        item.classList.remove('bg-primary/10', 'dark:bg-primary/20');
                    });

                    // Add active class to clicked item
                    div.classList.add('bg-primary/10', 'dark:bg-primary/20');

                    // Show stock details
                    showStockDetail(stockData);
                });

                stockList.appendChild(div);

                // Show the newly added stock
                showStockDetail(stockData);
            }
        } catch (error) {
            console.error('Error adding stock to list:', error);
            showError('Failed to add stock to list. Please try again.');
        }
    }

    // Function to format price
    function formatPrice(price) {
        return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Function to show stock detail
    function showStockDetail(stock) {
        const detailSection = document.getElementById('stock-detail');
        if (!detailSection) return;

        detailSection.classList.remove('hidden');
        detailSection.classList.add('md:flex');

        document.getElementById('detail-name').textContent = stock.name;
        document.getElementById('detail-symbol').textContent = stock.symbol;

        const changeElement = document.getElementById('detail-change');
        const changeText = `${stock.isPositive ? '+' : ''}${formatPrice(stock.changePercent)}% (${stock.isPositive ? '+' : ''}${formatPrice(stock.change)})`;
        changeElement.textContent = changeText;
        changeElement.className = stock.isPositive ? 'text-positive' : 'text-negative';

        document.getElementById('detail-sell-price').textContent = `$${formatPrice(stock.price)}`;
        document.getElementById('detail-buy-price').textContent = `$${formatPrice(stock.price + 0.03)}`;

        // Update chart
        updateChart(stock.symbol);
    }



    // ==========================================
    // Socket.IO and TradingView Integration
    // ==========================================

    // Global Chart Variables
    let tvChart = null;
    let tvCandleSeries = null;
    let currentSymbol = null;

    // Connect to Render Backend
    const socket = io('https://penguin-trader-render-backend.onrender.com/');

    socket.on('connect', () => {
        console.log('Connected to Render Backend');
    });

    socket.on('price_update', (data) => {
        // console.log('Price update received:', data);
        const price = parseFloat(data.price);
        if (isNaN(price)) return;

        // 1. Update the Stock List Item
        const stockItem = document.querySelector(`#stock-list div[data-symbol="${data.symbol}"]`);
        if (stockItem) {
            const priceEl = stockItem.querySelector('.font-semibold');
            if (priceEl) {
                // Flash effect can be added here if needed
                priceEl.textContent = `$${formatPrice(price)}`;

                // Animate color based on movement (simple check against previous text content or similar)
            }
        }

        // 2. Update the Detail View if this is the current symbol
        if (currentSymbol && data.symbol === currentSymbol) {
            const sellEl = document.getElementById('detail-sell-price');
            const buyEl = document.getElementById('detail-buy-price');

            if (sellEl) sellEl.textContent = `$${formatPrice(price)}`;
            if (buyEl) buyEl.textContent = `$${formatPrice(price + 0.03)}`; // Simulated spread

            // 3. Update Chart
            if (tvCandleSeries) {
                const dataList = tvCandleSeries.data();
                if (dataList.length > 0) {
                    const lastBar = dataList[dataList.length - 1];
                    const updatedBar = {
                        ...lastBar,
                        close: price,
                        high: Math.max(lastBar.high, price),
                        low: Math.min(lastBar.low, price)
                    };
                    tvCandleSeries.update(updatedBar);
                }
            }
        }
    });

    // Implement missing updateChart function using Lightweight Charts
    window.updateChart = async function (symbol, days = 30) {
        console.log(`Updating chart for ${symbol} (${days} days)`);
        currentSymbol = symbol;

        const container = document.getElementById('stock-chart');
        if (!container) {
            console.error('Stock chart container not found');
            return;
        }

        // Check if chart already exists, if so remove it (or we could reuse it, but replacing is safer for switching types)
        // Actually, reusing is better for performance, but we need to handle resizing etc.
        // For now, let's clear and recreate to ensure clean state and remove any Plotly artifacts.
        container.innerHTML = '';
        tvChart = null;
        tvCandleSeries = null;

        // Create Chart
        const isDark = document.documentElement.classList.contains('dark');
        const chartOptions = {
            width: container.clientWidth,
            height: 400,
            layout: {
                background: { color: isDark ? '#1A232D' : '#ffffff' },
                textColor: isDark ? '#d1d4dc' : '#333',
            },
            grid: {
                vertLines: { color: isDark ? '#2B2B43' : '#F0F3FA' },
                horzLines: { color: isDark ? '#2B2B43' : '#F0F3FA' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        };

        tvChart = LightweightCharts.createChart(container, chartOptions);

        tvCandleSeries = tvChart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // Fetch Data
        // We reuse existing fetch functions but map data
        let chartData = [];
        try {
            if (days <= 1) {
                // Intraday
                const intradayData = await fetchIntradayData(symbol);
                chartData = intradayData.map(d => ({
                    time: d.x.getTime() / 1000, // Unix timestamp in seconds
                    open: d.o,
                    high: d.h,
                    low: d.l,
                    close: d.c
                }));
            } else {
                // Daily
                const dailyData = await fetchDailyData(symbol);
                chartData = dailyData.map(d => ({
                    time: d.x.getTime() / 1000, // Unix timestamp in seconds
                    open: d.o,
                    high: d.h,
                    low: d.l,
                    close: d.c
                }));

                // Filter roughly by days (assuming 1 candle per day for daily, but map might have gaps)
                // Just take the last N items
                if (chartData.length > days) {
                    chartData = chartData.slice(-days);
                }
            }

            // Sort by time (ascending)
            chartData.sort((a, b) => a.time - b.time);

            // Set data
            tvCandleSeries.setData(chartData);
            tvChart.timeScale().fitContent();

        } catch (e) {
            console.error('Error updating chart:', e);
            container.innerHTML = '<div class="text-red-500 p-4">Error loading chart data</div>';
        }

        // Handle specific window resize
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !entries[0].contentRect) return;
            const newRect = entries[0].contentRect;
            tvChart.applyOptions({ width: newRect.width, height: newRect.height });
        });
        resizeObserver.observe(container);
    };
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - initializing...');
    // We do not call initWatchlist() from here because dashboard.html handles it
    // initWatchlist(); 
});
