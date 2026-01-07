

// Global State
let currentEditingWatchlistId = null;

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

                // Filter through stocks
                const stocksToSearch = window.allStocks || window.defaultStocks || [];
                const results = stocksToSearch.filter(stock => {
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
                        <img src="${stock.logo_url}" alt="${stock.name} logo" class="w-full h-full object-contain" onerror="this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0iI2NjYyI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iLjNlbSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIj4/PC90ZXh0Pjwvc3ZnPg=='">
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


// Watchlist Global State
window.userWatchlists = []; // [{id, name, items: ['AAPL']}]
window.activeWatchlistId = null; // null means 'all', or a specific UUID

// Call init on load
document.addEventListener('DOMContentLoaded', () => {
    // initWatchlist();
    fetchWatchlists();

    // Initialize real-time updates if available
    if (typeof initializeRealTimeUpdates === 'function') {
        initializeRealTimeUpdates();
    }
});

// ==========================================
// Dynamic Watchlist Logic
// ==========================================

async function fetchWatchlists() {
    try {
        const response = await fetch('/api/watchlists');
        const data = await response.json();

        if (data.success) {
            window.userWatchlists = data.watchlists;
            renderWatchlistNav();
            // If we have an active watchlist, reload items to reflect changes
            if (window.activeWatchlistId) {
                switchWatchlist(window.activeWatchlistId);
            }
        }
    } catch (error) {
        console.error('Error fetching watchlists:', error);
    }
}

function renderWatchlistNav() {
    const navContainer = document.getElementById('watchlist-nav');
    if (!navContainer) return;

    // Clear current list
    navContainer.innerHTML = '';

    // Add "Stocks" (All) tab
    const allTab = document.createElement('button');
    allTab.textContent = 'Stocks';
    allTab.className = `watchlist-button font-medium ${window.activeWatchlistId === null ? 'watchlist-active text-white' : ''} transition-all duration-200`;
    allTab.onclick = () => switchWatchlist(null);
    navContainer.appendChild(allTab);

    // Add user watchlists
    window.userWatchlists.forEach(wl => {
        const btn = document.createElement('button');
        btn.textContent = wl.name;
        btn.className = `watchlist-button font-medium whitespace-nowrap ${window.activeWatchlistId === wl.id ? 'watchlist-active text-white' : ''} transition-all duration-200`;
        btn.onclick = () => switchWatchlist(wl.id);
        navContainer.appendChild(btn);
    });
}

function openAddToWatchlistModal(symbol) {
    const modal = document.getElementById('add-to-watchlist-modal');
    const closeBtn = document.getElementById('close-add-modal-btn');
    const backdrop = document.getElementById('add-modal-backdrop');
    const listContainer = document.getElementById('add-watchlist-list');
    const createBtn = document.getElementById('open-create-from-add-btn');

    if (!modal) return;

    const closeModal = () => modal.classList.add('hidden');
    closeBtn.onclick = closeModal;
    backdrop.onclick = closeModal;

    // Setup Create New button
    if (createBtn) {
        createBtn.onclick = () => {
            closeModal();
            document.getElementById('create-watchlist-btn').click();
        };
    }

    modal.classList.remove('hidden');

    // Render list
    listContainer.innerHTML = '';

    if (window.userWatchlists.length === 0) {
        listContainer.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No watchlists found. Create one first.</div>';
    } else {
        window.userWatchlists.forEach(wl => {
            const hasItem = wl.items.includes(symbol);

            const row = document.createElement('div');
            row.className = 'flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors';

            row.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${wl.name}</div>
                    <div class="text-xs text-gray-400">${wl.items.length} items</div>
                </div>
                <div class="w-6 h-6 flex items-center justify-center">
                    ${hasItem ?
                    `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>` :
                    `<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`
                }
                </div>
            `;

            row.onclick = async () => {
                // Optimistic UI update
                if (hasItem) {
                    wl.items = wl.items.filter(s => s !== symbol);
                    row.querySelector('.w-6').innerHTML = `<svg class="w-5 h-5 animate-pulse text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`;
                    await toggleWatchlistItem('DELETE', wl.id, symbol);
                } else {
                    wl.items.push(symbol);
                    row.querySelector('.w-6').innerHTML = `<svg class="w-5 h-5 animate-pulse text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                    await toggleWatchlistItem('POST', wl.id, symbol);
                }
                openAddToWatchlistModal(symbol);
                if (window.activeWatchlistId === wl.id) {
                    switchWatchlist(wl.id);
                }
            };

            listContainer.appendChild(row);
        });
    }
}

async function toggleWatchlistItem(method, watchlistId, symbol) {
    try {
        await fetch('/api/watchlist/item', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watchlist_id: watchlistId, symbol: symbol })
        });
    } catch (e) {
        console.error('Error toggling item:', e);
        alert('Failed to update watchlist');
    }
}


// Watchlist buttons & Modal Elements
const createWatchlistBtn = document.getElementById('create-watchlist-btn');
const editWatchlistBtn = document.getElementById('edit-watchlist-btn');
const createWatchlistModal = document.getElementById('create-watchlist-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalBackdrop = document.getElementById('modal-backdrop');
const createWatchlistConfirmBtn = document.getElementById('create-watchlist-confirm-btn');
const watchlistNameInput = document.getElementById('watchlist-name-input');
const watchlistButton = document.querySelector('.watchlist-star');

// Star Button Listener
if (watchlistButton) {
    watchlistButton.addEventListener('click', async () => {
        const currentSymbol = document.getElementById('detail-symbol').textContent;
        openAddToWatchlistModal(currentSymbol);
    });
}

// Create Watchlist Button Listener (Nav Bar)
if (createWatchlistBtn) {
    createWatchlistBtn.addEventListener('click', () => {
        if (createWatchlistModal) {
            createWatchlistModal.classList.remove('hidden');
            if (watchlistNameInput) {
                watchlistNameInput.value = '';
                watchlistNameInput.focus();
            }
        }
    });
}

// Modal Close Listeners
const closeWatchlistModal = () => {
    if (createWatchlistModal) createWatchlistModal.classList.add('hidden');
};
if (closeModalBtn) closeModalBtn.addEventListener('click', closeWatchlistModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeWatchlistModal);

// Setup Create Action
if (createWatchlistConfirmBtn) {
    createWatchlistConfirmBtn.onclick = async () => {
        const name = watchlistNameInput.value.trim();
        if (!name) {
            watchlistNameInput.classList.add('border-red-500');
            return;
        }
        watchlistNameInput.classList.remove('border-red-500');

        // Loading state
        const originalText = createWatchlistConfirmBtn.textContent;
        createWatchlistConfirmBtn.disabled = true;
        createWatchlistConfirmBtn.innerHTML = '<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

        try {
            const response = await fetch('/api/create_watchlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ watchlist_name: name })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('Watchlist created:', data);
                closeWatchlistModal();

                // Show success message (simple toast)
                const toast = document.createElement('div');
                toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-500';
                toast.textContent = `Watchlist "${data.watchlist_name}" created!`;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.classList.add('opacity-0');
                    setTimeout(() => toast.remove(), 500);
                }, 3000);

                // Refresh UI
                await fetchWatchlists();
                if (typeof renderHomeSettingsList === 'function') {
                    renderHomeSettingsList();
                }
            } else {
                alert(data.error || 'Failed to create watchlist');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        } finally {
            createWatchlistConfirmBtn.disabled = false;
            createWatchlistConfirmBtn.textContent = originalText;
        }
    };
}

// Enter key specific for this instance
watchlistNameInput.onkeypress = (e) => {
    if (e.key === 'Enter' && createWatchlistConfirmBtn) {
        createWatchlistConfirmBtn.click();
    }
};


// Enter key specific for this instance
watchlistNameInput.onkeypress = (e) => {
    if (e.key === 'Enter' && createWatchlistConfirmBtn) {
        createWatchlistConfirmBtn.click();
    }
};

// ==========================================
// Home Settings / Reorder Modal Logic
// ==========================================
const homeSettingsModal = document.getElementById('home-settings-modal');
const closeHomeSettingsBtn = document.getElementById('close-home-settings-btn');
const homeSettingsBackdrop = document.getElementById('home-settings-backdrop');
const homeSettingsList = document.getElementById('home-settings-list');
const homeSettingsCreateBtn = document.getElementById('home-settings-create-btn');

function openHomeSettingsModal() {
    if (!homeSettingsModal) return;
    renderHomeSettingsList();
    homeSettingsModal.classList.remove('hidden');
}

const closeHomeSettings = () => {
    if (homeSettingsModal) homeSettingsModal.classList.add('hidden');
    // Refresh nav to show new order if changed
    fetchWatchlists();
};

if (closeHomeSettingsBtn) closeHomeSettingsBtn.addEventListener('click', closeHomeSettings);
if (homeSettingsBackdrop) homeSettingsBackdrop.addEventListener('click', closeHomeSettings);

if (editWatchlistBtn) {
    editWatchlistBtn.addEventListener('click', openHomeSettingsModal);
}

if (homeSettingsCreateBtn) {
    homeSettingsCreateBtn.addEventListener('click', () => {
        closeHomeSettings();
        if (createWatchlistBtn) createWatchlistBtn.click();
    });
}

// function renderHomeSettingsList removed (duplicate)

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('opacity-50');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    if (draggedItem !== this) {
        // Swap in DOM
        // Need to find positions
        const allItems = [...homeSettingsList.querySelectorAll('li')];
        const fromIndex = allItems.indexOf(draggedItem);
        const toIndex = allItems.indexOf(this);

        if (fromIndex < toIndex) {
            this.parentNode.insertBefore(draggedItem, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedItem, this);
        }

        // Save new order
        saveWatchlistOrder();
    }
    return false;
}

function handleDragEnd() {
    this.classList.remove('opacity-50');
    draggedItem = null;

    // Animate change
    const allItems = homeSettingsList.querySelectorAll('li');
    allItems.forEach(item => item.classList.add('transition-all', 'duration-300'));
}


async function saveWatchlistOrder() {
    const allItems = [...homeSettingsList.querySelectorAll('li')];
    const orderedIds = allItems.map(item => item.dataset.id);

    try {
        await fetch('/api/watchlist/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ordered_ids: orderedIds })
        });

        // Update local state order implicitly by re-fetching when modal closes
        // Or update it now:
        const newWatchlistsOrder = [];
        orderedIds.forEach(id => {
            const wl = window.userWatchlists.find(w => w.id === id);
            if (wl) newWatchlistsOrder.push(wl);
        });
        window.userWatchlists = newWatchlistsOrder;

    } catch (e) {
        console.error('Error saving order:', e);
    }
}


// Navigation handling
const stocksList = document.querySelector('#stock-list');






// Set initial active state
// stocksNav removed


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

                const safeName = stock.name || stock.symbol || 'Unknown';
                // DEBUG LOGS
                console.log('Rendering item:', stock.symbol);

                // Use ticker endpoint
                const logoUrl = `https://img.logo.dev/ticker/${stock.symbol}?token=${window.LOGO_API_KEY}&size=64&format=png&theme=dark&retina=true`;

                // Use robust fallback like renderStockList
                const fallbackImage = "this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0iI2NjYyI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iLjNlbSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIj4/PC90ZXh0Pjwvc3ZnPg=='";

                div.innerHTML = `
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-8 h-8 flex-shrink-0">
                                            <img src="${logoUrl}" alt="${stock.name} logo" class="w-full h-full object-contain" onerror="${fallbackImage}">
                                        </div>
                                        <div>
                                            <div class="font-medium text-left">${stock.name}</div>
                                            <div class="text-xs text-gray-400 text-left font-bold">${stock.symbol}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="font-semibold">$${(stock.price || 0).toFixed(2)}</div>
                                        <div class="text-xs ${stock.isPositive ? 'text-positive' : 'text-negative'}">
                                            ${stock.isPositive ? '+' : ''}${(stock.change || 0).toFixed(2)} (${stock.isPositive ? '+' : ''}${(stock.changePercent || 0).toFixed(2)}%)
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

            // Show the first stock as default - REMOVED per user request
            // if (data.items.length > 0) {
            //     showStockDetail(data.items[0]);
            // }
        } else {
            stockListEl.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full py-12 text-center">
                    <h3 class="text-lg font-bold mb-2">This watchlist is empty</h3>
                    <p class="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                        Add the instruments you're interested in to easily track their performance and price changes all in one place
                    </p>
                    <div class="flex items-center space-x-3 justify-center">
                        <button onclick="document.getElementById('stock-search').focus(); window.scrollTo(0,0);" class="flex items-center space-x-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            <span>Add instruments</span>
                        </button>
                        <button onclick="event.stopPropagation(); openListSettings('${watchlistId}')" class="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </button>
                    </div>
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
    window.activeWatchlistId = watchlistId;
    renderWatchlistNav(); // Re-render to update active class

    const watchlistNameEl = document.getElementById('watchlist-name');

    if (!watchlistId) {
        // "Stocks" (Default) View
        if (watchlistNameEl) watchlistNameEl.textContent = 'Stocks';

        // Render default stocks
        const stocks = window.defaultStocks || window.allStocks || [];
        if (typeof renderStockList === 'function') {
            renderStockList(stocks);
        } else {
            console.error('renderStockList is not defined');
        }
    } else {
        // Specific Watchlist View
        // Show loading state in the list
        await loadWatchlistItems(watchlistId);
    }
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


// ==========================================
// List Settings Modal Logic & Redefinitions
// ==========================================

// Redefine saveWatchlistOrder to be safe
async function saveWatchlistOrder() {
    // Check if homeSettingsList exists/is valid
    if (!document.getElementById('home-settings-list')) return;
    const allItems = [...document.getElementById('home-settings-list').querySelectorAll('li')];
    const orderedIds = allItems.map(item => item.dataset.id);

    try {
        await fetch('/api/watchlist/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ordered_ids: orderedIds })
        });

        fetchWatchlists();

    } catch (e) {
        console.error('Error saving order:', e);
    }
}

// Redefine handleDrop to support both lists
function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    // Check if we are reordering watchlists (Home Settings) or Items (List Settings)
    const container = this.parentNode; // UL

    // Check if draggedItem is valid and in same container
    if (draggedItem && draggedItem !== this && draggedItem.parentNode === container) {
        // Swap in DOM
        const allItems = [...container.querySelectorAll('li')];
        const fromIndex = allItems.indexOf(draggedItem);
        const toIndex = allItems.indexOf(this);

        if (fromIndex < toIndex) {
            this.parentNode.insertBefore(draggedItem, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedItem, this);
        }

        // Save new order based on container ID
        if (container.id === 'home-settings-list') {
            saveWatchlistOrder();
        } else if (container.id === 'list-settings-items') {
            if (typeof saveWatchlistItemsOrder === 'function') saveWatchlistItemsOrder();
        }
    }
    return false;
}

// Redefine renderHomeSettingsList to add listeners
function renderHomeSettingsList() {
    console.log('Rendering Home Settings List');
    const list = document.getElementById('home-settings-list');
    if (!list) {
        console.error('Home Settings List container not found');
        return;
    }
    list.innerHTML = '';

    window.userWatchlists.forEach((wl, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between p-3 bg-card-bg hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg group cursor-grab active:cursor-grabbing border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all';
        li.draggable = true;
        li.dataset.id = wl.id;
        li.dataset.index = index;

        li.innerHTML = `
            <div class="flex items-center space-x-3">
                <!-- Drag Handle -->
                <div class="text-gray-400 cursor-grab active:cursor-grabbing">
                    <svg class="w-5 h-5 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                </div>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">${wl.name}</span>
            </div>
            <!-- Cog Icon -->
            <button class="settings-cog-btn text-gray-400 hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" 
                    data-id="${wl.id}"
                    onclick="event.stopPropagation(); openListSettings('${wl.id}');"
                    onmousedown="event.stopPropagation()"
                    ondragstart="event.preventDefault(); event.stopPropagation()">
                <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
            </button>
        `;

        // Drag events
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragend', handleDragEnd);

        list.appendChild(li);
    });

    // Event Delegation for Cogs (safer than attaching to each)
    // Remove old listener if exists to prevent duplicates? 
    // Actually, renderHomeSettingsList is called multiple times, so we shouldn't add the listener HERE.
    // We should add the listener ONCE when the app inits, or check if it exists.
    // However, simplest fix for now is to just re-query or use delegation.

    // Better approach: Add the listener OUTSIDE this function, once.
    // But since this function is replacing the *middle* function, I'll stick to attaching here but beware of duplicates if I attached to the container.
    // Ah, wait. If I attach to `homeSettingsList` (the UL), and I clear `innerHTML` every time, the listener *on the UL* persists?
    // Yes. `homeSettingsList` is a const reference to an element that exists in DOM.
    // If I addEventListener every time render is called, I get multiple listeners. Bad.

    // So, I should attach the listener ONLY ONCE.
    // I can do that at the bottom of the file.
}

// Add the delegated listener ONCE
const _homeSettingsList = document.getElementById('home-settings-list');
if (_homeSettingsList) {
    _homeSettingsList.addEventListener('click', (e) => {
        const btn = e.target.closest('.settings-cog-btn');
        if (btn) {
            e.stopPropagation();
            const id = btn.dataset.id;
            console.log('Delegated click for watchlist:', id);
            if (typeof openListSettings === 'function') {
                openListSettings(id);
            }
        }
    });
}

// Variables for List Settings
const listSettingsModal = document.getElementById('list-settings-modal');
const listSettingsBackdrop = document.getElementById('list-settings-backdrop');
const backToHomeSettingsBtn = document.getElementById('back-to-home-settings-btn');
const closeListSettingsBtn = document.getElementById('close-list-settings-btn');
const listSettingsNameInput = document.getElementById('list-settings-name-input');
const listSettingsDeleteBtn = document.getElementById('list-settings-delete-btn');
const listSettingsAddBtn = document.getElementById('list-settings-add-btn');
const listSettingsItems = document.getElementById('list-settings-items');

async function openListSettings(watchlistId) {
    console.log('openListSettings called with ID:', watchlistId);

    // FETCH ELEMENTS DYNAMICALLY TO ENSURE THEY EXIST
    const modal = document.getElementById('list-settings-modal');
    const homeModal = document.getElementById('home-settings-modal');
    const nameInput = document.getElementById('list-settings-name-input');

    console.log('Modal elements found:', {
        listModal: modal,
        homeModal: homeModal,
        nameInput: nameInput
    });

    const watchlist = window.userWatchlists.find(w => w.id === watchlistId);
    if (!watchlist) {
        console.error('Watchlist not found for ID:', watchlistId);
        return;
    }

    currentEditingWatchlistId = watchlistId;

    // Hide Home Settings, Show List Settings
    if (homeModal) {
        homeModal.classList.add('hidden');
        console.log('Added hidden to homeModal');
    } else {
        console.warn('home-settings-modal not found');
    }

    if (modal) {
        modal.classList.remove('hidden');
        console.log('Removed hidden from listSettingsModal');
    } else {
        console.error('list-settings-modal not found in DOM');
    }

    // Populate Name Display
    const nameText = document.getElementById('list-settings-name-text');
    if (nameText) nameText.textContent = watchlist.name;

    // Show loading state
    const container = document.getElementById('list-settings-items');
    if (container) container.innerHTML = '<div class="p-4 text-center text-gray-500">Loading items...</div>';

    // Fetch Detailed Data
    try {
        const response = await fetch(`/api/watchlist/${watchlistId}`);
        const data = await response.json();

        if (data && data.items) {
            const detailedWatchlist = {
                id: watchlistId,
                name: data.watchlist_name,
                items: data.items
            };
            if (nameText) nameText.textContent = detailedWatchlist.name;
            renderListSettingsItems(detailedWatchlist);
        }
    } catch (e) {
        console.error('Error fetching details:', e);
        renderListSettingsItems(watchlist); // Fallback
    }

    // DYNAMIC EVENT HANDLERS (Same pattern as openAddToWatchlistModal)
    const backBtn = document.getElementById('back-to-home-settings-btn');
    const closeBtn = document.getElementById('close-list-settings-btn');
    const deleteBtn = document.getElementById('list-settings-delete-btn');
    const addBtn = document.getElementById('list-settings-add-btn');
    const editNameBtn = document.getElementById('list-settings-edit-name-btn');

    // Define helper close function using the LOCALLY FETCHED modal (safest)
    const closeThisModal = (returnToHome) => {
        const modal = document.getElementById('list-settings-modal');
        if (modal) modal.classList.add('hidden');
        currentEditingWatchlistId = null;

        const homeModal = document.getElementById('home-settings-modal');
        if (returnToHome && homeModal) {
            renderHomeSettingsList();
            homeModal.classList.remove('hidden');
        } else {
            fetchWatchlists();
        }
    };

    if (backBtn) backBtn.onclick = () => closeThisModal(true);
    if (closeBtn) closeBtn.onclick = () => closeThisModal(false);

    if (editNameBtn) editNameBtn.onclick = () => {
        openEditWatchlistModal(watchlistId, watchlist.name);
    };

    if (deleteBtn) deleteBtn.onclick = async () => {
        if (!confirm('Are you sure you want to delete this watchlist?')) return;
        try {
            await fetch(`/api/watchlist/${watchlistId}`, { method: 'DELETE' });
            window.userWatchlists = window.userWatchlists.filter(w => w.id !== watchlistId);
            closeThisModal(true);
        } catch (e) {
            console.error('Error deleting:', e);
        }
    };

    if (addBtn) addBtn.onclick = () => {
        closeThisModal(false);
        const searchInput = document.getElementById('stock-search');
        if (searchInput) {
            searchInput.focus();
            alert('Search for a stock and use the Star button to add it to this list.');
        }
    };
}

// Edit Watchlist Modal Functions
function openEditWatchlistModal(watchlistId, currentName) {
    const editModal = document.getElementById('edit-watchlist-modal');
    const nameInput = document.getElementById('edit-watchlist-name-input');
    const confirmBtn = document.getElementById('confirm-edit-watchlist-btn');
    const closeBtn = document.getElementById('close-edit-watchlist-btn');
    const backdrop = document.getElementById('edit-watchlist-backdrop');

    if (!editModal || !nameInput) return;

    nameInput.value = currentName;
    editModal.classList.remove('hidden');

    const closeEditModal = () => {
        editModal.classList.add('hidden');
    };

    if (closeBtn) closeBtn.onclick = closeEditModal;
    if (backdrop) backdrop.onclick = closeEditModal;

    if (confirmBtn) confirmBtn.onclick = async () => {
        const newName = nameInput.value.trim();
        if (!newName) return;

        try {
            await fetch(`/api/watchlist/${watchlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            // Update local cache
            const wl = window.userWatchlists.find(w => w.id === watchlistId);
            if (wl) wl.name = newName;

            // Update UI
            const titleDisplay = document.getElementById('list-settings-title-display');
            const nameText = document.getElementById('list-settings-name-text');
            if (nameText) nameText.textContent = newName;

            closeEditModal();
        } catch (e) {
            console.error('Error renaming:', e);
        }
    };
}

function closeListSettings(returnToHome = false) {
    const modal = document.getElementById('list-settings-modal');
    if (modal) modal.classList.add('hidden');

    currentEditingWatchlistId = null;

    const homeModal = document.getElementById('home-settings-modal');
    if (returnToHome && homeModal) {
        renderHomeSettingsList();
        homeModal.classList.remove('hidden');
    } else {
        fetchWatchlists();
    }
}

// Removed legacy listener blocks as they are handled dynamically now

function renderListSettingsItems(watchlist) {
    // FIX: Get element directly to avoid ReferenceError/TDZ issues with global variables
    const container = document.getElementById('list-settings-items');
    const emptyState = document.getElementById('list-settings-empty-state');

    if (!container) {
        console.error('List settings items container not found in DOM');
        return;
    }

    container.innerHTML = '';

    // Toggle Empty State
    if (!watchlist.items || watchlist.items.length === 0) {
        container.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    } else {
        container.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }

    watchlist.items.forEach((item, index) => {
        // Handle both string (sparse) and object (detailed) data
        const isObject = typeof item === 'object' && item !== null;
        const symbol = isObject ? item.symbol : item;
        const name = isObject ? item.name : (window.allStocks?.find(s => s.symbol === symbol)?.description || symbol);

        // Use ticker endpoint
        const logoUrl = `https://img.logo.dev/ticker/${symbol}?token=${window.LOGO_API_KEY}&size=64&format=png&theme=dark&retina=true`;

        const li = document.createElement('li');
        li.className = 'flex items-center justify-between p-2 bg-transparent hover:bg-gray-800 rounded-lg group cursor-grab active:cursor-grabbing border-b border-gray-800 last:border-0';
        li.draggable = true;
        li.dataset.symbol = symbol;
        li.dataset.index = index;

        li.innerHTML = `
            <div class="flex items-center space-x-3">
                 <!-- Image/Logo -->
                 <div class="w-8 h-8 flex-shrink-0 bg-gray-700/50 rounded-full overflow-hidden">
                     <img src="${logoUrl}" class="w-full h-full object-contain" alt="${symbol}" onerror="this.src='https://ui-avatars.com/api/?name=${symbol}&background=random&color=fff&size=32'">
                 </div>
                 
                 <div class="text-left">
                    <div class="text-sm font-semibold text-white">${name}</div>
                    <div class="text-xs text-gray-400 font-bold">${symbol}</div>
                 </div>
            </div>
            
            <div class="flex items-center space-x-2">
                <!-- Reorder Icon -->
                <div class="text-gray-500 cursor-grab active:cursor-grabbing">
                    <svg class="w-5 h-5 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg>
                </div>
                <!-- Delete Icon -->
                <button class="text-gray-500 hover:text-red-500 transition-colors delete-item-btn p-1">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        `;

        // Delete Handler
        const deleteBtn = li.querySelector('.delete-item-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // We need to define deleteWatchlistItem or ensure it exists globally
                if (typeof deleteWatchlistItem === 'function') {
                    deleteWatchlistItem(watchlist.id, symbol);
                } else {
                    console.error('deleteWatchlistItem not defined');
                }
            });
        }

        // Drag Events
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragend', handleDragEnd);

        container.appendChild(li);
    });
}

async function deleteWatchlistItem(watchlistId, symbol) {
    if (!confirm(`Remove ${symbol} from list ? `)) return;

    try {
        await fetch('/api/watchlist/item', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watchlist_id: watchlistId, symbol: symbol })
        });

        const wl = window.userWatchlists.find(w => w.id === watchlistId);
        if (wl) {
            wl.items = wl.items.filter(s => s !== symbol);
            renderListSettingsItems(wl);
        }
    } catch (e) {
        console.error('Error deleting item:', e);
    }
}

async function saveWatchlistItemsOrder() {
    if (!currentEditingWatchlistId) return;
    const container = document.getElementById('list-settings-items');
    if (!container) return;

    const allItems = [...container.querySelectorAll('li')];
    const orderedSymbols = allItems.map(item => item.dataset.symbol);

    try {
        await fetch('/api/watchlist/item/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                watchlist_id: currentEditingWatchlistId,
                ordered_items: orderedSymbols
            })
        });

        const wl = window.userWatchlists.find(w => w.id === currentEditingWatchlistId);
        if (wl) wl.items = orderedSymbols;

    } catch (e) {
        console.error('Error reordering items:', e);
    }
}


// ==========================================
// TRADING COMPONENT LOGIC
// ==========================================

let tradeState = {
    symbol: null,
    side: 'buy', // 'buy' or 'sell'
    qty: 0,
    price: 0
};

// Expose to window for the HTML onclick handlers
window.openOrderModal = function (initialSide = 'buy') {
    // Try to get symbol from global or DOM
    let symbol = window.currentSymbol;
    if (!symbol) {
        const symbolEl = document.getElementById('detail-symbol');
        if (symbolEl) symbol = symbolEl.textContent.trim();
    }

    if (!symbol || symbol === '-' || symbol === 'Loading...') {
        alert("Please select a stock first.");
        return;
    }

    // Set global for consistency
    window.currentSymbol = symbol;

    // Get current stock data
    const stock = window.allStocks.find(s => s.symbol === symbol);
    if (!stock) {
        console.error("Stock data not found for", symbol);
        return;
    }

    tradeState.symbol = currentSymbol;
    tradeState.price = stock.price;
    tradeState.side = initialSide;

    // Update UI elements
    updateOrderModalUI();

    // Show Modal
    const modal = document.getElementById('place-order-modal');
    if (modal) modal.classList.remove('hidden');
};

function closeOrderModal() {
    const modal = document.getElementById('place-order-modal');
    if (modal) modal.classList.add('hidden');
}

function updateOrderModalUI() {
    if (!tradeState.symbol) return;

    // Title
    const titleEl = document.getElementById('order-modal-title');
    if (titleEl) titleEl.textContent = tradeState.symbol;

    // Prices (simulated spread)
    const priceSell = document.getElementById('modal-price-sell');
    const priceBuy = document.getElementById('modal-price-buy');

    // In a real app we would have separate bid/ask, here using last price +/- tiny spread
    const displayPrice = tradeState.price;
    if (priceSell) priceSell.textContent = (displayPrice - 0.01).toFixed(2);
    if (priceBuy) priceBuy.textContent = (displayPrice + 0.01).toFixed(2);

    // Active Toggle Color
    const btnBuy = document.getElementById('modal-btn-buy');
    const btnSell = document.getElementById('modal-btn-sell');
    const confirmBtn = document.getElementById('confirm-order-btn');
    const confirmText = document.getElementById('confirm-order-text');

    if (tradeState.side === 'buy') {
        // Buy Active
        btnBuy.className = "flex-1 flex flex-col justify-center items-end px-4 transition-colors duration-300 group bg-[#00A4EF] text-white";

        btnSell.className = "flex-1 flex flex-col justify-center px-4 transition-colors duration-300 group cursor-pointer";
        // Reset sell styles requires removing specific classes if using pure atomic, 
        // but here we just ensure bg is default dark-ish or transparent. 
        // We defined structure in HTML, let's keep it simple.

        confirmBtn.className = "w-full bg-[#00A4EF] hover:bg-sky-500 text-white font-bold py-4 rounded-3xl shadow-lg shadow-[#00A4EF]/20 transition-all transform active:scale-95 flex items-center justify-center";
        confirmText.textContent = `Place Buy Order`;
    } else {
        // Sell Active
        btnSell.className = "flex-1 flex flex-col justify-center px-4 transition-colors duration-300 group bg-red-500 text-white";

        btnBuy.className = "flex-1 flex flex-col justify-center items-end px-4 transition-colors duration-300 group cursor-pointer opacity-50 hover:opacity-100";

        confirmBtn.className = "w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-3xl shadow-lg shadow-red-500/20 transition-all transform active:scale-95 flex items-center justify-center";
        confirmText.textContent = `Place Sell Order`;
    }

    // Recalculate Units
    calculateOrderUnits();
}

function calculateOrderUnits() {
    const inputEl = document.getElementById('order-value-input');
    const unitsDisplay = document.getElementById('order-units-display');

    if (!inputEl || !unitsDisplay) return;

    const value = parseFloat(inputEl.value) || 0;
    const price = tradeState.price || 1; // avoid div by zero

    const units = value / price;
    tradeState.qty = units; // store exact calc

    unitsDisplay.textContent = units.toFixed(4);

    // Update Detail Modal Estimates too if open
    const detailEstPrice = document.getElementById('detail-est-price');
    const detailEstUnits = document.getElementById('detail-est-units');
    const detailTotal = document.getElementById('detail-total-value');

    if (detailEstPrice) detailEstPrice.textContent = `$${price.toFixed(2)}`;
    if (detailEstUnits) detailEstUnits.textContent = units.toFixed(4);
    if (detailTotal) detailTotal.textContent = `$${value.toFixed(2)}`;
}

// SETUP LISTENERS FOR TRADING
document.addEventListener('DOMContentLoaded', () => {

    // Close buttons
    const closeOrderBtn = document.getElementById('close-place-order-btn');
    const orderBackdrop = document.getElementById('place-order-backdrop');
    if (closeOrderBtn) closeOrderBtn.onclick = closeOrderModal;
    if (orderBackdrop) orderBackdrop.onclick = closeOrderModal;

    // Toggle Side
    const btnBuy = document.getElementById('modal-btn-buy');
    const btnSell = document.getElementById('modal-btn-sell');
    if (btnBuy) btnBuy.onclick = () => { tradeState.side = 'buy'; updateOrderModalUI(); };
    if (btnSell) btnSell.onclick = () => { tradeState.side = 'sell'; updateOrderModalUI(); };

    // Input Change
    const inputEl = document.getElementById('order-value-input');
    if (inputEl) inputEl.oninput = calculateOrderUnits;

    // Percentage Buttons
    document.querySelectorAll('.pct-btn').forEach(btn => {
        btn.onclick = () => {
            const pct = parseFloat(btn.dataset.pct);
            // In a real app we'd need account buying power. Mocking $10k for now.
            const buyingPower = 10000;
            inputEl.value = (buyingPower * pct).toFixed(2);
            calculateOrderUnits();
        };
    });

    // Confirm Order
    const confirmBtn = document.getElementById('confirm-order-btn');
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const spinner = document.getElementById('confirm-order-spinner');
            const text = document.getElementById('confirm-order-text');

            // Loading
            confirmBtn.disabled = true;
            if (spinner) spinner.classList.remove('hidden');
            if (text) text.textContent = "Processing...";

            try {
                const payload = {
                    symbol: tradeState.symbol,
                    qty: tradeState.qty, // Alpaca allows fractional
                    side: tradeState.side,
                    type: 'market',
                    time_in_force: 'day'
                };

                const res = await fetch('/api/order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (res.ok) {
                    alert(`Order Submitted!\nID: ${data.id}\nStatus: ${data.status}`);
                    closeOrderModal();
                    // Refresh balance immediately after trade
                    updateDashboardBalance();
                } else {
                    alert(`Order Failed: ${data.details?.message || data.error}`);
                }
            } catch (err) {
                console.error(err);
                alert("Network error submitting order.");
            } finally {
                confirmBtn.disabled = false;
                if (spinner) spinner.classList.add('hidden');
                updateOrderModalUI(); // resets text
            }
        };
    }

    // Order Details Modal
    const detailsBtn = document.getElementById('open-order-details-btn');
    const detailsModal = document.getElementById('order-details-modal');
    const detailsBackdrop = document.getElementById('order-details-backdrop');
    const closeDetailsBtn = document.getElementById('close-order-details-btn');
    const closeDetailsMainBtn = document.getElementById('close-order-details-main-btn');

    const toggleDetails = (show) => {
        if (show) detailsModal.classList.remove('hidden');
        else detailsModal.classList.add('hidden');
    };

    if (detailsBtn) detailsBtn.onclick = () => toggleDetails(true);
    if (detailsBackdrop) detailsBackdrop.onclick = () => toggleDetails(false);
    if (closeDetailsBtn) closeDetailsBtn.onclick = () => toggleDetails(false);
    if (closeDetailsMainBtn) closeDetailsMainBtn.onclick = () => toggleDetails(false);

    // Initial Balance Load
    updateDashboardBalance();
});

// ==========================================
// BALANCE UPDATER
// ==========================================
async function updateDashboardBalance() {
    const balanceEl = document.getElementById('balance');
    const orderBalanceDetail = document.getElementById('order-balance-display'); // Also update in modal if exists

    if (!balanceEl) return;

    try {
        const res = await fetch('/api/account_info');
        if (res.ok) {
            const data = await res.json();
            const equity = parseFloat(data.equity || 0);

            // Update Header Balance
            balanceEl.textContent = equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Update Order Modal Balance display if it exists
            if (orderBalanceDetail) {
                // Assuming modal shows full currency string e.g. "$50,000.00"
                orderBalanceDetail.textContent = `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
        }
    } catch (e) {
        console.error("Failed to fetch balance:", e);
    }
}
