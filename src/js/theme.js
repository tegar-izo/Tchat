export function initTheme(state) {
    state.darkTheme = localStorage.getItem('theme') === 'dark';
    state.accentColor = localStorage.getItem('accent') || 'blue';
    updateTheme(state);
    updateAccent(state);
}

export function toggleTheme(state) {
    state.darkTheme = !state.darkTheme;
    localStorage.setItem('theme', state.darkTheme ? 'dark' : 'light');
    updateTheme(state);
    updateAccent(state);
}

export function changeAccent(state, color) {
    state.accentColor = color;
    localStorage.setItem('accent', color);
    updateAccent(state);
}

export function updateTheme(state) {
    if (state.darkTheme) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
    }
}

export function updateAccent(state) {
    const root = document.documentElement;
    
    // Light Mode Pastel Themes
    const lightThemes = {
        'blue':    { pc: '#5B92E5', ph: '#4A7BCF', pl: '#E8F1FF', bg: '#F2F6FF', w: '#F9FBFF', text: '#FFFFFF' },
        'green':   { pc: '#66BB6A', ph: '#57A65B', pl: '#E8F5E9', bg: '#F1F8F1', w: '#F8FBF8', text: '#FFFFFF' },
        'red':     { pc: '#EF5350', ph: '#D32F2F', pl: '#FFEBEE', bg: '#FFF1F1', w: '#FFFBFA', text: '#FFFFFF' }
    };

    // Dark Mode Deep Tinted Themes
    const darkThemes = {
        'blue':    { pc: '#9ECAFF', ph: '#82B1E6', pl: '#1E2A3A', bg: '#0D141F', w: '#151D29', text: '#003258' },
        'green':   { pc: '#A5D6A7', ph: '#81C784', pl: '#1E2D1F', bg: '#0D180E', w: '#142015', text: '#1B3320' },
        'red':     { pc: '#EF9A9A', ph: '#E57373', pl: '#3D1F1F', bg: '#1A0F0F', w: '#241515', text: '#4A0E0E' }
    };

    const theme = state.darkTheme ? darkThemes[state.accentColor] : lightThemes[state.accentColor];
    const colors = theme || (state.darkTheme ? darkThemes['blue'] : lightThemes['blue']);
    
    root.style.setProperty('--pc', colors.pc);
    root.style.setProperty('--ph', colors.ph);
    root.style.setProperty('--pl', colors.pl);
    root.style.setProperty('--bg', colors.bg);
    root.style.setProperty('--w', colors.w);
    root.style.setProperty('--sent-text', colors.text);
}
