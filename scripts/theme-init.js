(function () {
    const savedThemeColor = localStorage.getItem('cf_theme_color') || 'greentea';
    const savedThemeMode = localStorage.getItem('cf_theme_mode') || 'dark';
    const root = document.documentElement;

    root.setAttribute('data-theme', savedThemeColor);

    if (savedThemeMode === 'light') {
        root.classList.remove('dark-theme');
        root.classList.add('light-theme');
    } else {
        root.classList.remove('light-theme');
        root.classList.add('dark-theme');
    }
})();
