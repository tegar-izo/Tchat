export const themeLogic = {
    darkTheme: false,
    accentColor: 'blue',
    accentMenuOpen: false,

    initTheme() {
        if (localStorage.getItem('theme') === 'dark') {
            this.darkTheme = true;
        }
        this.updateTheme();

        if (localStorage.getItem('accent')) {
            this.accentColor = localStorage.getItem('accent');
        }
        this.updateAccent();
    },

    toggleTheme() {
        this.darkTheme = !this.darkTheme;
        localStorage.setItem('theme', this.darkTheme ? 'dark' : 'light');
        this.updateTheme();
        this.updateAccent();
    },

    updateTheme() {
        if (this.darkTheme) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },

    updateAccent() {
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

        const theme = this.darkTheme ? darkThemes[this.accentColor] : lightThemes[this.accentColor];
        const colors = theme || (this.darkTheme ? darkThemes['blue'] : lightThemes['blue']);
        
        root.style.setProperty('--pc', colors.pc);
        root.style.setProperty('--ph', colors.ph);
        root.style.setProperty('--pl', colors.pl);
        root.style.setProperty('--bg', colors.bg);
        root.style.setProperty('--w', colors.w);
        root.style.setProperty('--sent-text', colors.text);
        
        localStorage.setItem('accent', this.accentColor);
    },

    changeAccent(color) {
        this.accentColor = color;
        this.updateAccent();
    }
};
