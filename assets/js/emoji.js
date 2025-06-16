/**
 * Simple Emoji Picker for Quick Chat
 */
class EmojiPicker {
    constructor(options = {}) {
        this.container = options.container || null;
        this.onEmojiSelect = options.onEmojiSelect || function() {};
        this.categories = {
            recent: JSON.parse(localStorage.getItem('recentEmojis') || '[]'),
            smileys: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕'],
            people: ['👤','👥','👨','👩','👧','👦','👶','👵','👴','👮','👷','💂','🕵️','👩‍⚕️','👨‍⚕️','👩‍🎓','👨‍🎓','👩‍🏫','👨‍🏫','👩‍⚖️','👨‍⚖️','👩‍🌾','👨‍🌾','👩‍🍳','👨‍🍳','👩‍🔧','👨‍🔧'],
            nature: ['🌸','🌼','🌻','🌺','🌹','🌷','🌱','🌲','🌳','🌴','🌵','🌾','🌿','🍀','🍁','🍂','🍃','🐝','🐞','🐌','🐛','🐜','🦋','🐢','🐍','🦎','🐙','🦑','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆'],
            food: ['🍕','🍔','🍟','🌭','🍿','🥓','🍗','🍖','🥚','🍳','🧀','🥞','🥨','🥯','🥐','🍞','🥖','🥪','🥙','🌮','🌯','🥗','🍲','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍦','🍧','🍨','🍩','🍪','🎂','🍰','☕','🍵','🥤','🍶','🍺','🍷','🥂']
        };
        this.currentCategory = 'smileys';
        this.init();
    }
    
    init() {
        this.loadRecentEmojis();
        if (this.container) {
            this.render();
        }
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="emoji-picker-header">
                ${Object.keys(this.categories).map(cat => 
                    `<button class="emoji-category-btn ${cat === this.currentCategory ? 'active' : ''}" 
                             data-category="${cat}">${this.getCategoryIcon(cat)}</button>`
                ).join('')}
            </div>
            <div class="emoji-picker-search">
                <input type="text" placeholder="Search emojis..." class="emoji-search-input">
            </div>
            <div class="emoji-picker-body">
                ${this.renderEmojis()}
            </div>
        `;
        
        this.bindEvents();
    }
    
    renderEmojis() {
        const emojis = this.categories[this.currentCategory] || [];
        return emojis.map(emoji => 
            `<button class="emoji-btn" data-emoji="${emoji}" title="${emoji}">${emoji}</button>`
        ).join('');
    }
    
    getCategoryIcon(category) {
        const icons = {
            recent: '🕒',
            smileys: '😀',
            people: '👤',
            nature: '🌱',
            food: '🍕'
        };
        return icons[category] || '📝';
    }
    
    bindEvents() {
        if (!this.container) return;
        
        // Category buttons
        this.container.querySelectorAll('.emoji-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentCategory = e.target.dataset.category;
                this.updateActiveCategory();
                this.updateEmojiGrid();
            });
        });
        
        // Emoji buttons
        this.container.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const emoji = e.target.dataset.emoji;
                this.selectEmoji(emoji);
            });
        });
        
        // Search input
        const searchInput = this.container.querySelector('.emoji-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchEmojis(e.target.value);
            });
        }
    }
    
    updateActiveCategory() {
        this.container.querySelectorAll('.emoji-category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === this.currentCategory);
        });
    }
    
    updateEmojiGrid() {
        const body = this.container.querySelector('.emoji-picker-body');
        if (body) {
            body.innerHTML = this.renderEmojis();
            this.bindEmojiEvents();
        }
    }
    
    bindEmojiEvents() {
        this.container.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const emoji = e.target.dataset.emoji;
                this.selectEmoji(emoji);
            });
        });
    }
    
    selectEmoji(emoji) {
        this.addToRecent(emoji);
        this.onEmojiSelect(emoji);
    }
    
    addToRecent(emoji) {
        const recent = this.categories.recent;
        const index = recent.indexOf(emoji);
        
        if (index > -1) {
            recent.splice(index, 1);
        }
        
        recent.unshift(emoji);
        recent.splice(10); // Keep only 10 recent emojis
        
        this.saveRecentEmojis();
    }
    
    loadRecentEmojis() {
        try {
            const saved = localStorage.getItem('quickchat_recent_emojis');
            if (saved) {
                this.categories.recent = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load recent emojis:', e);
        }
    }
    
    saveRecentEmojis() {
        try {
            localStorage.setItem('quickchat_recent_emojis', JSON.stringify(this.categories.recent));
        } catch (e) {
            console.warn('Failed to save recent emojis:', e);
        }
    }
    
    searchEmojis(query) {
        if (!query.trim()) {
            this.currentCategory = this.currentCategory === 'search' ? 'smileys' : this.currentCategory;
            this.updateActiveCategory();
            this.updateEmojiGrid();
            return;
        }
        
        const allEmojis = Object.values(this.categories).flat();
        const filtered = allEmojis.filter(emoji => 
            emoji.includes(query.toLowerCase()) || 
            this.getEmojiName(emoji).includes(query.toLowerCase())
        );
        
        // Temporarily show search results
        this.currentCategory = 'search';
        this.categories.search = filtered;
        this.updateEmojiGrid();
    }
    
    getEmojiName(emoji) {
        // Basic emoji name mapping - in a real app you'd have a comprehensive database
        const names = {
            '😀': 'grinning face',
            '😂': 'face with tears of joy',
            '❤️': 'red heart',
            '👍': 'thumbs up',
            '🎉': 'party popper'
        };
        return names[emoji] || '';
    }
    
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Global emoji picker functions for backward compatibility
window.EmojiPicker = EmojiPicker;

/**
 * Get recent emojis from localStorage
 * @returns {Array} Array of recently used emojis
 */
function getRecentEmojis() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.RECENT_EMOJIS);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading recent emojis:', error);
        return [];
    }
}

/**
 * Get last used emoji category from localStorage
 * @returns {string|null} Last used category name
 */
function getLastUsedCategory() {
    try {
        return localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_CATEGORY);
    } catch (error) {
        console.error('Error loading last emoji category:', error);
        return null;
    }
}

/**
 * Get selected skin tone from localStorage
 * @returns {string} Selected skin tone
 */
function getSelectedSkinTone() {
    try {
        return localStorage.getItem(LOCAL_STORAGE_KEYS.EMOJI_SKIN_TONE);
    } catch (error) {
        console.error('Error loading skin tone preference:', error);
        return 'default';
    }
}

/**
 * Save recent emoji to localStorage
 * @param {string} emoji The emoji to save
 */
function saveRecentEmoji(emoji) {
    try {
        // Remove if already exists
        const index = emojiState.recentEmojis.indexOf(emoji);
        if (index > -1) {
            emojiState.recentEmojis.splice(index, 1);
        }
        
        // Add to the beginning
        emojiState.recentEmojis.unshift(emoji);
        
        // Keep only the most recent ones
        if (emojiState.recentEmojis.length > MAX_RECENT_EMOJIS) {
            emojiState.recentEmojis = emojiState.recentEmojis.slice(0, MAX_RECENT_EMOJIS);
        }
        
        // Save to localStorage
        localStorage.setItem(
            LOCAL_STORAGE_KEYS.RECENT_EMOJIS, 
            JSON.stringify(emojiState.recentEmojis)
        );
    } catch (error) {
        console.error('Error saving recent emoji:', error);
    }
}

/**
 * Save last used category to localStorage
 * @param {string} category The category name
 */
function saveLastUsedCategory(category) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_CATEGORY, category);
        emojiState.currentCategory = category;
    } catch (error) {
        console.error('Error saving last used category:', error);
    }
}

/**
 * Save selected skin tone to localStorage
 * @param {string} skinTone The skin tone key
 */
function saveSelectedSkinTone(skinTone) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.EMOJI_SKIN_TONE, skinTone);
        emojiState.selectedSkinTone = skinTone;
    } catch (error) {
        console.error('Error saving skin tone preference:', error);
    }
}

/**
 * Apply skin tone to an emoji if applicable
 * @param {string} emoji The emoji character
 * @returns {string} Emoji with skin tone if applicable
 */
function applySkinTone(emoji) {
    // Only apply to emojis that support skin tones
    const supportsSkinTone = /^(👋|✌️|🤞|🤟|🤘|🤙|👈|👉|👆|🖕|👇|☝️|👍|👎|✊|👊|🤛|🤜|👏|🙌|👐|🤲|🙏|✍️|💅|🤳|💪|🦵|🦶|👂|👃|👶|🧒|👦|👧|🧑|👱|👨|👩|🧓|👴|👵|🙍|🙎|🙅|🙆|💁|🙋|🧏|🙇|🤦|🤷|💆|💇|🚶|🧍|🧎|🏃|💃|🕺)$/.test(emoji);
    
    if (supportsSkinTone && emojiState.selectedSkinTone !== 'default') {
        return emoji + skinTones[emojiState.selectedSkinTone];
    }
    
    return emoji;
}

/**
 * Initialize the emoji picker UI
 * @param {HTMLElement} container The container element for the emoji picker
 * @param {Function} onSelect Callback function when emoji is selected
 */
function initEmojiPicker(container, onSelect) {
    if (!container) return;
    
    // Create the emoji picker structure
    container.innerHTML = `
        <div class="emoji-picker-header">
            <div class="emoji-search-container">
                <input type="text" class="emoji-search" placeholder="Search emojis..." aria-label="Search emojis">
                <button class="emoji-search-clear" aria-label="Clear search">×</button>
            </div>
            <div class="emoji-skin-tone-selector">
                <button class="emoji-skin-tone-btn ${emojiState.selectedSkinTone === 'default' ? 'active' : ''}" data-skin-tone="default">👋</button>
                <button class="emoji-skin-tone-btn ${emojiState.selectedSkinTone === 'light' ? 'active' : ''}" data-skin-tone="light">👋🏻</button>
                <button class="emoji-skin-tone-btn ${emojiState.selectedSkinTone === 'mediumLight' ? 'active' : ''}" data-skin-tone="mediumLight">👋🏼</button>
                <button class="emoji-skin-tone-btn ${emojiState.selectedSkinTone === 'medium' ? 'active' : ''}" data-skin-tone="medium">👋🏽</button>
                <button class="emoji-skin-tone-btn ${emojiState.selectedSkinTone === 'mediumDark' ? 'active' : ''}" data-skin-tone="mediumDark">👋🏾</button>
                <button class="emoji-skin-tone-btn ${emojiState.selectedSkinTone === 'dark' ? 'active' : ''}" data-skin-tone="dark">👋🏿</button>
            </div>
        </div>
        <div class="emoji-categories">
            <button class="emoji-category-btn ${emojiState.currentCategory === 'recent' ? 'active' : ''}" data-category="recent" aria-label="Recent emojis">
                <span class="emoji-icon">🕒</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'smileys' ? 'active' : ''}" data-category="smileys" aria-label="Smileys & Emotions">
                <span class="emoji-icon">😀</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'people' ? 'active' : ''}" data-category="people" aria-label="People">
                <span class="emoji-icon">👨</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'nature' ? 'active' : ''}" data-category="nature" aria-label="Animals & Nature">
                <span class="emoji-icon">🦋</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'food' ? 'active' : ''}" data-category="food" aria-label="Food & Drink">
                <span class="emoji-icon">🍔</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'activities' ? 'active' : ''}" data-category="activities" aria-label="Activities">
                <span class="emoji-icon">⚽</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'travel' ? 'active' : ''}" data-category="travel" aria-label="Travel & Places">
                <span class="emoji-icon">✈️</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'objects' ? 'active' : ''}" data-category="objects" aria-label="Objects">
                <span class="emoji-icon">💡</span>
            </button>
            <button class="emoji-category-btn ${emojiState.currentCategory === 'symbols' ? 'active' : ''}" data-category="symbols" aria-label="Symbols">
                <span class="emoji-icon">❤️</span>
            </button>
        </div>
        <div class="emoji-container" tabindex="0" aria-label="Emoji list"></div>
    `;
    
    // Get elements
    const searchInput = container.querySelector('.emoji-search');
    const searchClearBtn = container.querySelector('.emoji-search-clear');
    const categoryButtons = container.querySelectorAll('.emoji-category-btn');
    const skinToneButtons = container.querySelectorAll('.emoji-skin-tone-btn');
    const emojiContainer = container.querySelector('.emoji-container');
    
    // Load initial emojis
    loadEmojisForCategory(emojiState.currentCategory, emojiContainer);
    
    // Add event listeners
    searchInput.addEventListener('input', () => {
        emojiState.searchQuery = searchInput.value.trim().toLowerCase();
        if (emojiState.searchQuery) {
            searchClearBtn.style.display = 'block';
            searchEmojis(emojiState.searchQuery, emojiContainer);
        } else {
            searchClearBtn.style.display = 'none';
            loadEmojisForCategory(emojiState.currentCategory, emojiContainer);
        }
    });
    
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        emojiState.searchQuery = '';
        searchClearBtn.style.display = 'none';
        loadEmojisForCategory(emojiState.currentCategory, emojiContainer);
        searchInput.focus();
    });
    
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            
            // Update active state
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Save last used category
            saveLastUsedCategory(category);
            
            // Load emojis for the selected category
            loadEmojisForCategory(category, emojiContainer);
            
            // Clear search
            searchInput.value = '';
            emojiState.searchQuery = '';
            searchClearBtn.style.display = 'none';
        });
    });
    
    skinToneButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const skinTone = btn.getAttribute('data-skin-tone');
            
            // Update active state
            skinToneButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Save selected skin tone
            saveSelectedSkinTone(skinTone);
            
            // Reload current view to apply skin tone
            if (emojiState.searchQuery) {
                searchEmojis(emojiState.searchQuery, emojiContainer);
            } else {
                loadEmojisForCategory(emojiState.currentCategory, emojiContainer);
            }
        });
    });
    
    // Keyboard navigation for emoji container
    emojiContainer.addEventListener('keydown', (e) => {
        const emojiButtons = emojiContainer.querySelectorAll('.emoji-btn');
        if (!emojiButtons.length) return;
        
        // Set initial focus if none
        if (emojiState.focusedEmojiIndex === -1) {
            emojiState.focusedEmojiIndex = 0;
        }
        
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                emojiState.focusedEmojiIndex = (emojiState.focusedEmojiIndex + 1) % emojiButtons.length;
                emojiButtons[emojiState.focusedEmojiIndex].focus();
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                emojiState.focusedEmojiIndex = (emojiState.focusedEmojiIndex - 1 + emojiButtons.length) % emojiButtons.length;
                emojiButtons[emojiState.focusedEmojiIndex].focus();
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                // Approximate number of emojis per row based on container width
                const emojisPerRow = Math.floor(emojiContainer.offsetWidth / 36);
                const nextRowIndex = (emojiState.focusedEmojiIndex + emojisPerRow) % emojiButtons.length;
                emojiState.focusedEmojiIndex = nextRowIndex;
                emojiButtons[nextRowIndex].focus();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                const emojisPerRowUp = Math.floor(emojiContainer.offsetWidth / 36);
                let prevRowIndex = (emojiState.focusedEmojiIndex - emojisPerRowUp);
                if (prevRowIndex < 0) {
                    prevRowIndex = emojiButtons.length + prevRowIndex;
                }
                emojiState.focusedEmojiIndex = prevRowIndex;
                emojiButtons[prevRowIndex].focus();
                break;
        }
    });
    
    // Handle emoji selection
    function handleEmojiSelect(emoji) {
        // Apply skin tone if applicable
        const finalEmoji = applySkinTone(emoji);
        
        // Save to recent emojis
        saveRecentEmoji(finalEmoji);
        
        // Call the onSelect callback
        if (typeof onSelect === 'function') {
            onSelect(finalEmoji);
        }
    }
    
    // Load emojis for a specific category
    function loadEmojisForCategory(category, container) {
        container.innerHTML = '';
        
        let emojisToShow = [];
        
        if (category === 'recent') {
            emojisToShow = emojiState.recentEmojis;
        } else {
            emojisToShow = emojiCategories[category] || [];
        }
        
        if (emojisToShow.length === 0) {
            container.innerHTML = `<p class="emoji-empty-message">${
                category === 'recent' ? 'No recent emojis' : 'No emojis found'
            }</p>`;
            return;
        }
        
        // Create emoji buttons
        emojisToShow.forEach(emoji => {
            const button = document.createElement('button');
            button.className = 'emoji-btn';
            button.setAttribute('aria-label', `Emoji ${emoji}`);
            button.textContent = applySkinTone(emoji);
            
            button.addEventListener('click', () => {
                handleEmojiSelect(emoji);
            });
            
            container.appendChild(button);
        });
    }
    
    // Search emojis
    function searchEmojis(query, container) {
        container.innerHTML = '';
        
        if (!query) {
            loadEmojisForCategory(emojiState.currentCategory, container);
            return;
        }
        
        const results = [];
        
        // Search in all categories
        Object.keys(emojiCategories).forEach(category => {
            emojiCategories[category].forEach(emoji => {
                // Simple matching - in a real app, you would also match against emoji names/keywords
                if (results.indexOf(emoji) === -1) {
                    results.push(emoji);
                }
            });
        });
        
        // Filter results
        const filteredResults = results.filter(emoji => {
            // This is a simplified search; in a real app, you would search emoji names
            return emoji.indexOf(query) !== -1;
        });
        
        if (filteredResults.length === 0) {
            container.innerHTML = `<p class="emoji-empty-message">No emojis found for "${query}"</p>`;
            return;
        }
        
        // Create emoji buttons for search results
        filteredResults.forEach(emoji => {
            const button = document.createElement('button');
            button.className = 'emoji-btn';
            button.setAttribute('aria-label', `Emoji ${emoji}`);
            button.textContent = applySkinTone(emoji);
            
            button.addEventListener('click', () => {
                handleEmojiSelect(emoji);
            });
            
            container.appendChild(button);
        });
    }
}

// Export emoji functionality
window.EmojiPicker = {
    initEmojiPicker,
    getRecentEmojis,
    applySkinTone
};

function saveLastUsedCategory(category) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_CATEGORY, category);
    } catch (error) {
        console.error('Error saving last emoji category:', error);
    }
}

/**
 * Render the emoji grid based on category or search
 * @param {string} category The category to render
 */
function renderEmojiGrid(category) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) {
        console.error('Emoji grid element not found');
        return;
    }
    
    grid.innerHTML = '';
    emojiState.currentCategory = category;
    saveLastUsedCategory(category);
    
    // If we're showing recents and there are none, show a message
    if (category === 'recent' && emojiState.recentEmojis.length === 0) {
        const message = document.createElement('div');
        message.className = 'emoji-message';
        message.textContent = 'No recent emojis';
        grid.appendChild(message);
        return;
    }
    
    // Get the emoji list based on category or search
    let emojisToShow = [];
    
    if (emojiState.searchQuery) {
        // If there's a search query, search across all categories
        emojisToShow = searchEmojis(emojiState.searchQuery);
    } else if (category === 'recent') {
        // Show recent emojis
        emojisToShow = emojiState.recentEmojis;
    } else {
        // Show category emojis
        emojisToShow = emojiCategories[category] || [];
    }
    
    // Create emoji buttons
    emojisToShow.forEach((emoji, index) => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.type = 'button';
        btn.textContent = emoji;
        btn.setAttribute('aria-label', `Emoji ${emoji}`);
        btn.setAttribute('data-index', index);
        btn.onclick = () => insertEmoji(emoji);
        
        // For keyboard navigation
        btn.addEventListener('keydown', handleEmojiKeyDown);
        
        grid.appendChild(btn);
    });
    
    // Reset focused index
    emojiState.focusedEmojiIndex = -1;
}

/**
 * Handle keyboard navigation in the emoji grid
 * @param {KeyboardEvent} e The keyboard event
 */
function handleEmojiKeyDown(e) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;
    
    const buttons = Array.from(grid.querySelectorAll('.emoji-btn'));
    if (!buttons.length) return;
    
    const currentIndex = parseInt(e.target.getAttribute('data-index'));
    let nextIndex = currentIndex;
    
    // Number of emojis per row (approximate based on container width)
    const containerWidth = grid.offsetWidth;
    const buttonWidth = buttons[0].offsetWidth;
    const emojisPerRow = Math.floor(containerWidth / buttonWidth) || 8; // Default to 8 if calculation fails
    
    switch (e.key) {
        case 'ArrowRight':
            nextIndex = (currentIndex + 1) % buttons.length;
            break;
        case 'ArrowLeft':
            nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
            break;
        case 'ArrowDown':
            nextIndex = (currentIndex + emojisPerRow) % buttons.length;
            break;
        case 'ArrowUp':
            nextIndex = (currentIndex - emojisPerRow + buttons.length) % buttons.length;
            break;
        case 'Enter':
        case ' ':
            e.preventDefault();
            e.target.click();
            return;
        default:
            return;
    }
    
    e.preventDefault();
    buttons[nextIndex].focus();
    emojiState.focusedEmojiIndex = nextIndex;
}

/**
 * Search for emojis across all categories
 * @param {string} query The search query
 * @returns {Array} Matching emojis
 */
function searchEmojis(query) {
    if (!query) return [];
    
    // Simple search for now - future enhancement could include emoji names/descriptions
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // Search all categories
    Object.values(emojiCategories).forEach(categoryEmojis => {
        categoryEmojis.forEach(emoji => {
            // For now, just check if emoji contains the query visually
            // In a real app, you'd want to search emoji keywords/names
            if (results.indexOf(emoji) === -1) {
                results.push(emoji);
            }
        });
    });
    
    return results;
}

/**
 * Handle emoji search input
 * @param {Event} e The input event
 */
function handleEmojiSearch(e) {
    const query = e.target.value.trim();
    emojiState.searchQuery = query;
    
    // Show search results or default category
    if (query) {
        renderEmojiGrid('search');
        
        // Update UI to indicate search mode
        document.querySelectorAll('.emoji-category').forEach(btn => {
            btn.classList.remove('active');
        });
    } else {
        // When clearing search, return to the current category
        const categoryBtn = document.querySelector(`.emoji-category[data-category="${emojiState.currentCategory}"]`);
        if (categoryBtn) {
            categoryBtn.click();
        } else {
            renderEmojiGrid(emojiState.currentCategory);
        }
    }
}

/**
 * Insert emoji into message input
 * @param {string} emoji The emoji to insert
 */
function insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    if (!input) {
        console.error('Message input element not found');
        return;
    }
    
    // Get cursor position
    const start = input.selectionStart;
    const end = input.selectionEnd;
    
    // Insert emoji at cursor position
    const value = input.value;
    input.value = value.substring(0, start) + emoji + value.substring(end);
    
    // Move cursor after the inserted emoji
    const newCursorPos = start + emoji.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    // Focus back on input
    input.focus();
    
    // Trigger input event for character counter
    input.dispatchEvent(new Event('input'));
    
    // Save to recent emojis
    saveRecentEmoji(emoji);
    
    // Close emoji picker (optional, can be controlled by a setting)
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiPicker) {
        // Uncomment to auto-close after selection
        // emojiPicker.style.display = 'none';
    }
}

/**
 * Initialize emoji picker
 */
function initEmojiPicker() {
    // Wait for DOM to be fully loaded and try multiple times if needed
    const initAttempt = () => {
        const emojiCategoryBtns = document.querySelectorAll('.emoji-category');
        if (emojiCategoryBtns.length === 0) {
            console.warn('No emoji category buttons found, retrying...');
            return false;
        }
        
        console.log('Found', emojiCategoryBtns.length, 'emoji category buttons');
        initializeCategoryButtons(emojiCategoryBtns);
        return true;
    };
    
    // Try immediate initialization
    if (initAttempt()) {
        return;
    }
    
    // If not found, wait and try again
    setTimeout(() => {
        if (!initAttempt()) {
            // Try one more time after a longer delay
            setTimeout(() => {
                if (!initAttempt()) {
                    console.error('Failed to initialize emoji picker: no category buttons found');
                }
            }, 1000);
        }
    }, 100);
}

/**
 * Initialize category buttons with event listeners
 */
function initializeCategoryButtons(emojiCategoryBtns) {
/**
 * Initialize category buttons with event listeners
 */
function initializeCategoryButtons(emojiCategoryBtns) {
    // Add Recent Emojis category if not already present
    const hasRecent = Array.from(emojiCategoryBtns).some(btn => 
        btn.dataset.category === 'recent'
    );
    
    if (!hasRecent) {
        const categoriesContainer = emojiCategoryBtns[0].parentElement;
        if (categoriesContainer) {
            const recentBtn = document.createElement('button');
            recentBtn.className = 'emoji-category';
            recentBtn.setAttribute('data-category', 'recent');
            recentBtn.setAttribute('aria-label', 'Recent emojis');
            recentBtn.innerHTML = '🕒'; // Clock emoji for recents
            
            // Insert at the beginning
            categoriesContainer.insertBefore(recentBtn, categoriesContainer.firstChild);
            
            // Update our node list by re-querying
            emojiCategoryBtns = document.querySelectorAll('.emoji-category');
        }
    }
    
    // Add event listeners to category buttons
    emojiCategoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            emojiCategoryBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Clear search when changing category
            const searchInput = document.getElementById('emojiSearch');
            if (searchInput) {
                searchInput.value = '';
                emojiState.searchQuery = '';
            }
            
            renderEmojiGrid(this.dataset.category);
        });
    });
    
    // Add search functionality
    const searchInput = document.getElementById('emojiSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleEmojiSearch);
    }
    
    // Initialize with last used category or default to smileys
    const lastCategory = getLastUsedCategory();
    const categoryToShow = lastCategory || 'smileys';
    
    // Activate the corresponding category button
    const categoryBtn = document.querySelector(`.emoji-category[data-category="${categoryToShow}"]`);
    if (categoryBtn) {
        categoryBtn.click();
    } else {
        // Fallback
        renderEmojiGrid(categoryToShow);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initEmojiPicker);

// Export for use in other scripts
window.emojiPicker = {
    renderEmojiGrid,
    insertEmoji,
    searchEmojis,
    getRecentEmojis,
    // Expose a reinitialize method for dynamic content
    init: initEmojiPicker
    }
}

// Make EmojiPicker available globally
if (typeof window !== 'undefined') {
    window.EmojiPicker = EmojiPicker;
}
