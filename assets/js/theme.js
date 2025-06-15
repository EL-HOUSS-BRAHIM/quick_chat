// Function to load the theme setting from localStorage
function loadTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', currentTheme === 'dark');
    
    // Update theme toggle if it exists
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = currentTheme === 'dark';
    }
}

// Function to toggle between light and dark theme
function toggleTheme() {
    const isDarkTheme = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    
    // Show toast notification
    if (window.utils && typeof window.utils.showToast === 'function') {
        window.utils.showToast(`${isDarkTheme ? 'Dark' : 'Light'} theme activated`);
    }
}
