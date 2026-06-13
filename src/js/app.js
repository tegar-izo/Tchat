import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

import { 
    initTheme, 
    toggleTheme, 
    changeAccent 
} from "./theme.js";

import { 
    handleRegister, 
    handleLogin, 
    handleLogout, 
    saveProfile 
} from "./auth.js";

import { 
    loadFriendList, 
    addFriend, 
    selectFriend, 
    handleBack, 
    stopChatListener, 
    sendMessage, 
    clearChat, 
    deleteMessage, 
    replyMessage, 
    addReaction 
} from "./chat.js";

// --- Global State ---
const state = {
    currentPage: 'loading',
    mobview: 'sidebar',

    // Current User Data
    myUid: '',
    myUsername: '',
    myFullName: '',

    // Auth Flags
    authLoading: false,
    authMode: 'login',

    // Friend list
    friends: [],
    loadingFriends: false,
    activeFriendUid: null,
    activeFriendName: '',

    // Messages
    messages: [],
    loadingMessages: false,
    replyingTo: null,
    searchActive: false,
    searchQuery: '',

    // Theme Config
    darkTheme: false,
    accentColor: 'blue',

    // Dropdown / Menus UI States
    menuOpen: false,
    accentMenuOpen: false,
    chatMenuOpen: false,
    msgMenuOpen: false,
    selectedMsg: null,
    msgMenuX: 0,
    msgMenuY: 0,

    modal: {
        show: false,
        title: '',
        message: '',
        type: 'alert',
        onConfirm: null
    }
};

// --- Global Helpers ---
export function getInitials(name) {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function getAvatarColor(name) {
    if (!name) return '#6750A4';
    const colors = ['#a2b9bc', '#b2ad7f', '#878f99', '#6b5b95', '#feb236', '#d64161', '#ff7b25', '#92a8d1', '#f7cac9', '#dec2cb', '#b5e7a0', '#86af49'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getFilteredMessages() {
    if (!state.searchQuery || !state.searchQuery.trim()) {
        return state.messages;
    }
    const q = state.searchQuery.toLowerCase();
    return state.messages.filter(m => m.teks && m.teks.toLowerCase().includes(q));
}

// --- UI Rendering Callbacks (MVP View implementation) ---
const uiCallbacks = {
    showModal(title, message, type = 'alert', onConfirm = null) {
        state.modal.title = title;
        state.modal.message = message;
        state.modal.type = type;
        state.modal.onConfirm = onConfirm;
        state.modal.show = true;
        
        document.getElementById('dialog-title').textContent = title;
        document.getElementById('dialog-message').textContent = message;
        
        const cancelBtn = document.getElementById('btn-dialog-cancel');
        if (type === 'confirm') {
            cancelBtn.classList.remove('d-none');
        } else {
            cancelBtn.classList.add('d-none');
        }
        
        document.getElementById('dialog-modal').classList.remove('d-none');
    },

    closeModal() {
        state.modal.show = false;
        document.getElementById('dialog-modal').classList.add('d-none');
    },

    setCurrentPage(page) {
        state.currentPage = page;
        document.querySelectorAll('.app-screen').forEach(el => el.classList.add('d-none'));
        const screenEl = document.getElementById(`screen-${page}`);
        if (screenEl) screenEl.classList.remove('d-none');
    },

    setAuthMode(mode) {
        state.authMode = mode;
        if (mode === 'login') {
            document.getElementById('auth-login-container').classList.remove('d-none');
            document.getElementById('auth-register-container').classList.add('d-none');
        } else {
            document.getElementById('auth-login-container').classList.add('d-none');
            document.getElementById('auth-register-container').classList.remove('d-none');
        }
    },

    updateAuthLoading(loading) {
        const loginBtn = document.getElementById('btn-login');
        const regBtn = document.getElementById('btn-register');
        
        if (loading) {
            loginBtn.disabled = true;
            regBtn.disabled = true;
            loginBtn.querySelector('.btn-text').classList.add('d-none');
            loginBtn.querySelector('.spinner').classList.remove('d-none');
            regBtn.querySelector('.btn-text').classList.add('d-none');
            regBtn.querySelector('.spinner').classList.remove('d-none');
        } else {
            loginBtn.disabled = false;
            regBtn.disabled = false;
            loginBtn.querySelector('.btn-text').classList.remove('d-none');
            loginBtn.querySelector('.spinner').classList.add('d-none');
            regBtn.querySelector('.btn-text').classList.remove('d-none');
            regBtn.querySelector('.spinner').classList.add('d-none');
        }
    },

    clearRegisterInputs() {
        document.getElementById('reg-fullname').value = '';
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-password').value = '';
    },

    clearLoginInputs() {
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
    },

    clearAddFriendInput() {
        document.getElementById('search-friend-input').value = '';
    },

    clearChatInput() {
        document.getElementById('chat-input-text').value = '';
    },

    updateFriendsLoading(loading) {
        const spinner = document.getElementById('friends-loading-spinner');
        if (loading) {
            spinner.classList.remove('d-none');
        } else {
            spinner.classList.add('d-none');
        }
    },

    updateMyProfileUI() {
        document.getElementById('my-fullname').textContent = state.myFullName;
        document.getElementById('my-username').textContent = `@${state.myUsername}`;
        document.getElementById('my-avatar').textContent = getInitials(state.myFullName);
    },

    renderFriendList() {
        const container = document.getElementById('friends-list-items');
        container.innerHTML = '';
        
        const emptyState = document.getElementById('friends-empty-state');
        if (!state.loadingFriends && state.friends.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        } else {
            emptyState.classList.add('d-none');
        }

        state.friends.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'friend-item';
            if (state.activeFriendUid === friend.uid) {
                item.classList.add('active');
            }

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.backgroundColor = getAvatarColor(friend.nama_lengkap);
            avatar.textContent = getInitials(friend.nama_lengkap);

            const info = document.createElement('div');
            info.className = 'friend-info';

            const name = document.createElement('span');
            name.className = 'friend-name';
            name.textContent = friend.nama_lengkap;

            const username = document.createElement('span');
            username.className = 'friend-username';
            username.textContent = `@${friend.username}`;

            info.appendChild(name);
            info.appendChild(username);

            item.appendChild(avatar);
            item.appendChild(info);

            item.addEventListener('click', () => {
                selectFriend(state, friend, uiCallbacks);
            });

            container.appendChild(item);
        });
    },

    async reloadFriendList() {
        await loadFriendList(state, uiCallbacks);
    },

    renderActiveFriendHeader() {
        const placeholder = document.getElementById('no-active-friend-placeholder');
        const details = document.getElementById('active-friend-header-details');
        const actions = document.getElementById('chat-header-actions');
        const inputArea = document.getElementById('chat-input-area');

        if (state.activeFriendUid) {
            placeholder.classList.add('d-none');
            details.classList.remove('d-none');
            actions.classList.remove('d-none');
            inputArea.classList.remove('d-none');

            document.getElementById('active-friend-name').textContent = state.activeFriendName;
            
            const avatar = document.getElementById('active-friend-avatar');
            avatar.style.backgroundColor = getAvatarColor(state.activeFriendName);
            avatar.textContent = getInitials(state.activeFriendName);
        } else {
            placeholder.classList.remove('d-none');
            details.classList.add('d-none');
            actions.classList.add('d-none');
            inputArea.classList.add('d-none');
        }
    },

    updateChatLayoutView() {
        const sidebar = document.getElementById('chat-sidebar');
        const chatArea = document.getElementById('chat-area');
        
        if (state.mobview === 'chat') {
            sidebar.classList.remove('show-mobile');
            chatArea.classList.add('show-mobile');
        } else {
            sidebar.classList.add('show-mobile');
            chatArea.classList.remove('show-mobile');
        }
    },

    renderMessages() {
        const container = document.getElementById('messages-list-items');
        container.innerHTML = '';

        const emptyState = document.getElementById('chat-empty-state');
        const spinner = document.getElementById('messages-loading-spinner');

        if (!state.activeFriendUid) {
            emptyState.classList.remove('d-none');
            spinner.classList.add('d-none');
            return;
        } else {
            emptyState.classList.add('d-none');
        }

        if (state.loadingMessages) {
            spinner.classList.remove('d-none');
            return;
        } else {
            spinner.classList.add('d-none');
        }

        const filteredMessages = getFilteredMessages();

        filteredMessages.forEach(msg => {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper';

            const message = document.createElement('div');
            message.className = 'message';
            message.dataset.id = msg.id;
            
            if (msg.pengirimUid === state.myUid) {
                message.classList.add('sent');
            } else {
                message.classList.add('received');
            }

            // Highlight matches
            if (state.searchQuery && msg.teks && msg.teks.toLowerCase().includes(state.searchQuery.toLowerCase())) {
                message.classList.add('highlight');
            }

            // Reply Preview inside message
            if (msg.balasKe) {
                const replyPreview = document.createElement('div');
                replyPreview.className = 'reply-preview-in-msg';

                const replySender = document.createElement('span');
                replySender.style.fontSize = '0.7rem';
                replySender.style.fontWeight = '800';
                replySender.style.opacity = '0.7';
                replySender.textContent = msg.balasKe.pengirim;

                const replyText = document.createElement('p');
                replyText.style.fontSize = '0.8rem';
                replyText.style.margin = '0';
                replyText.textContent = msg.balasKe.teks;

                replyPreview.appendChild(replySender);
                replyPreview.appendChild(replyText);
                message.appendChild(replyPreview);
            }

            // Text content
            const textSpan = document.createElement('span');
            textSpan.textContent = msg.teks || '';
            message.appendChild(textSpan);

            // Footer (reaction & time)
            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.justifyContent = 'space-between';
            footer.style.alignItems = 'center';
            footer.style.marginTop = '4px';

            if (msg.reaksi) {
                const reactionTag = document.createElement('div');
                reactionTag.className = 'reaction-tag';
                reactionTag.textContent = msg.reaksi;
                footer.appendChild(reactionTag);
            }

            const timeSpan = document.createElement('span');
            timeSpan.className = 'msg-time';
            timeSpan.textContent = formatTime(msg.waktu);
            footer.appendChild(timeSpan);

            message.appendChild(footer);
            wrapper.appendChild(message);
            container.appendChild(wrapper);
        });
    },

    updateReplyPreview() {
        const replyBar = document.getElementById('reply-preview-bar');
        const replySender = document.getElementById('reply-preview-sender');
        const replyText = document.getElementById('reply-preview-text');

        if (state.replyingTo) {
            replySender.textContent = `Membalas ${state.replyingTo.pengirim}`;
            replyText.textContent = state.replyingTo.teks;
            replyBar.style.display = 'flex';
        } else {
            replyBar.style.display = 'none';
        }
    },

    closeAllMenus() {
        state.menuOpen = false;
        state.accentMenuOpen = false;
        state.chatMenuOpen = false;
        state.msgMenuOpen = false;

        document.getElementById('sidebar-menu').classList.remove('active');
        document.getElementById('accent-dropdown-list').classList.remove('active');
        document.getElementById('chat-header-menu').classList.remove('active');
        document.getElementById('msg-menu-overlay').classList.add('d-none');
    },

    closeHeaderMenu() {
        state.chatMenuOpen = false;
        document.getElementById('chat-header-menu').classList.remove('active');
    },

    closeMsgContextMenu() {
        state.msgMenuOpen = false;
        document.getElementById('msg-menu-overlay').classList.add('d-none');
    },

    openProfileModal() {
        state.tempFullName = state.myFullName;
        document.getElementById('edit-profile-fullname-input').value = state.tempFullName;
        document.getElementById('profile-modal').classList.remove('d-none');
    },

    closeProfileModal() {
        document.getElementById('profile-modal').classList.add('d-none');
    },

    updateProfileModalLoading(loading) {
        const btn = document.getElementById('btn-save-profile');
        if (loading) {
            btn.disabled = true;
            btn.querySelector('.btn-text').classList.add('d-none');
            btn.querySelector('.spinner').classList.remove('d-none');
        } else {
            btn.disabled = false;
            btn.querySelector('.btn-text').classList.remove('d-none');
            btn.querySelector('.spinner').classList.add('d-none');
        }
    },

    scrollToBottom() {
        setTimeout(() => {
            const box = document.getElementById('chat-messages-container');
            if (box) box.scrollTop = box.scrollHeight;
        }, 100);
    }
};

// --- Theme controls UI synchronization ---
function updateThemeControlsUI() {
    const themeIcon = document.getElementById('theme-menu-icon');
    const themeText = document.getElementById('theme-menu-text');
    if (state.darkTheme) {
        themeIcon.textContent = 'light_mode';
        themeText.textContent = 'Tema Terang';
    } else {
        themeIcon.textContent = 'dark_mode';
        themeText.textContent = 'Tema Gelap';
    }

    const labels = {
        'blue': 'Biru',
        'green': 'Hijau',
        'red': 'Merah'
    };
    const accentLabel = document.getElementById('accent-dropdown-label');
    if (accentLabel) {
        accentLabel.textContent = labels[state.accentColor] || 'Pilih Warna';
    }

    document.querySelectorAll('#accent-dropdown-list .dropdown-item').forEach(el => {
        if (el.dataset.accent === state.accentColor) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

// --- Context Menu Handler ---
function handleLongPress(event, msg) {
    state.selectedMsg = msg;
    
    const touch = event.touches ? event.touches[0] : event;
    let x = touch.clientX;
    let y = touch.clientY;

    const menuWidth = 220; 
    const menuHeight = 150; 
    
    if (x + (menuWidth / 2) > window.innerWidth) x = window.innerWidth - (menuWidth / 2) - 10;
    if (x - (menuWidth / 2) < 0) x = (menuWidth / 2) + 10;
    if (y - menuHeight < 0) y = menuHeight + 10;

    state.msgMenuX = x;
    state.msgMenuY = y;
    state.msgMenuOpen = true;

    const overlay = document.getElementById('msg-menu-overlay');
    const menuBox = document.getElementById('msg-menu-box');
    
    menuBox.style.left = `${x}px`;
    menuBox.style.top = `${y}px`;
    
    const deleteBtn = document.getElementById('menu-delete-msg');
    if (msg.pengirimUid === state.myUid) {
        deleteBtn.classList.remove('d-none');
    } else {
        deleteBtn.classList.add('d-none');
    }

    overlay.classList.remove('d-none');
}

// --- Event Listeners Setup ---
function initEventListeners() {
    // 1. Modals & Dialog
    document.getElementById('btn-dialog-cancel').addEventListener('click', () => {
        uiCallbacks.closeModal();
    });
    
    document.getElementById('btn-dialog-confirm').addEventListener('click', () => {
        if (state.modal.onConfirm) state.modal.onConfirm();
        uiCallbacks.closeModal();
    });

    // 2. Auth Page Toggles & Navigation
    document.getElementById('link-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        uiCallbacks.setAuthMode('register');
    });

    document.getElementById('link-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        uiCallbacks.setAuthMode('login');
    });

    // 3. Password Visibilities
    document.getElementById('btn-toggle-login-password').addEventListener('click', function() {
        const input = document.getElementById('login-password');
        if (input.type === 'password') {
            input.type = 'text';
            this.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            this.textContent = 'visibility';
        }
    });

    document.getElementById('btn-toggle-reg-password').addEventListener('click', function() {
        const input = document.getElementById('reg-password');
        if (input.type === 'password') {
            input.type = 'text';
            this.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            this.textContent = 'visibility';
        }
    });

    // 4. Authentications Action buttons
    const triggerLogin = () => {
        const username = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        handleLogin(state, username, pass, uiCallbacks);
    };

    document.getElementById('btn-login').addEventListener('click', triggerLogin);
    
    document.getElementById('login-username').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerLogin();
    });
    document.getElementById('login-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerLogin();
    });

    const triggerRegister = () => {
        const fullName = document.getElementById('reg-fullname').value;
        const username = document.getElementById('reg-username').value;
        const pass = document.getElementById('reg-password').value;
        handleRegister(state, fullName, username, pass, uiCallbacks);
    };

    document.getElementById('btn-register').addEventListener('click', triggerRegister);
    
    document.getElementById('reg-fullname').addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerRegister(); });
    document.getElementById('reg-username').addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerRegister(); });
    document.getElementById('reg-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerRegister(); });

    // 5. Chat Page: Add Friend
    const triggerAddFriend = () => {
        const searchInput = document.getElementById('search-friend-input');
        addFriend(state, searchInput.value, uiCallbacks);
    };
    
    document.getElementById('btn-add-friend').addEventListener('click', triggerAddFriend);
    document.getElementById('search-friend-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerAddFriend();
    });

    // 6. Chat Page: Menus & Popups
    document.getElementById('btn-sidebar-menu').addEventListener('click', (e) => {
        e.stopPropagation();
        state.menuOpen = !state.menuOpen;
        const sidebarMenu = document.getElementById('sidebar-menu');
        if (state.menuOpen) {
            sidebarMenu.classList.add('active');
        } else {
            sidebarMenu.classList.remove('active');
        }
    });

    document.getElementById('menu-edit-profile').addEventListener('click', () => {
        uiCallbacks.openProfileModal();
        uiCallbacks.closeAllMenus();
    });

    document.getElementById('menu-toggle-theme').addEventListener('click', () => {
        toggleTheme(state);
        updateThemeControlsUI();
        
        // Close menu directly with its transition
        state.menuOpen = false;
        document.getElementById('sidebar-menu').classList.remove('active');
    });

    document.getElementById('btn-accent-dropdown').addEventListener('click', (e) => {
        e.stopPropagation();
        state.accentMenuOpen = !state.accentMenuOpen;
        const accentList = document.getElementById('accent-dropdown-list');
        if (state.accentMenuOpen) {
            accentList.classList.add('active');
        } else {
            accentList.classList.remove('active');
        }
    });

    document.querySelectorAll('#accent-dropdown-list .dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const color = this.dataset.accent;
            changeAccent(state, color);
            updateThemeControlsUI();
            uiCallbacks.closeAllMenus();
        });
    });

    document.getElementById('menu-logout').addEventListener('click', () => {
        handleLogout(state, uiCallbacks, { stopChatListener });
    });

    // 7. Chat Header Actions
    document.getElementById('btn-back-to-sidebar').addEventListener('click', () => {
        handleBack(state, uiCallbacks);
    });

    document.getElementById('btn-chat-header-menu').addEventListener('click', (e) => {
        e.stopPropagation();
        state.chatMenuOpen = !state.chatMenuOpen;
        const headerMenu = document.getElementById('chat-header-menu');
        if (state.chatMenuOpen) {
            headerMenu.classList.add('active');
        } else {
            headerMenu.classList.remove('active');
        }
    });

    document.getElementById('menu-clear-chat').addEventListener('click', () => {
        clearChat(state, uiCallbacks);
    });

    document.getElementById('menu-toggle-search').addEventListener('click', () => {
        state.searchActive = !state.searchActive;
        const searchBar = document.getElementById('chat-search-bar-header');
        const icon = document.getElementById('search-menu-icon');
        const text = document.getElementById('search-menu-text');
        const status = document.getElementById('active-friend-search-status');

        if (state.searchActive) {
            searchBar.classList.remove('d-none');
            status.classList.remove('d-none');
            icon.textContent = 'search_off';
            text.textContent = 'Batal Cari';
            document.getElementById('chat-search-query-input').focus();
        } else {
            searchBar.classList.add('d-none');
            status.classList.add('d-none');
            icon.textContent = 'search';
            text.textContent = 'Cari Pesan';
            document.getElementById('chat-search-query-input').value = '';
            state.searchQuery = '';
            uiCallbacks.renderMessages();
        }
        uiCallbacks.closeHeaderMenu();
    });

    document.querySelectorAll('.btn-change-accent').forEach(dot => {
        dot.addEventListener('click', function() {
            const color = this.dataset.accent;
            changeAccent(state, color);
            updateThemeControlsUI();
            uiCallbacks.closeHeaderMenu();
        });
    });

    // Search Query input handler
    document.getElementById('chat-search-query-input').addEventListener('input', function() {
        state.searchQuery = this.value;
        uiCallbacks.renderMessages();
    });

    // 8. Message Context Menu Reactions and Actions
    document.getElementById('msg-menu-overlay').addEventListener('click', () => {
        uiCallbacks.closeMsgContextMenu();
    });

    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            addReaction(state, this.dataset.emoji, uiCallbacks);
        });
    });

    document.getElementById('menu-reply-msg').addEventListener('click', () => {
        replyMessage(state, uiCallbacks);
    });

    document.getElementById('menu-delete-msg').addEventListener('click', () => {
        deleteMessage(state, uiCallbacks);
    });

    // Event delegation on message list container for long press/right click context menu
    const messageListContainer = document.getElementById('messages-list-items');
    
    // Right click
    messageListContainer.addEventListener('contextmenu', (e) => {
        const msgEl = e.target.closest('.message');
        if (!msgEl) return;
        e.preventDefault();
        const msgId = msgEl.dataset.id;
        const msg = state.messages.find(m => m.id === msgId);
        if (msg) {
            handleLongPress(e, msg);
        }
    });

    // Touch events for mobile long press
    let touchTimer = null;
    messageListContainer.addEventListener('touchstart', (e) => {
        const msgEl = e.target.closest('.message');
        if (!msgEl) return;
        
        if (touchTimer) clearTimeout(touchTimer);
        
        touchTimer = setTimeout(() => {
            const msgId = msgEl.dataset.id;
            const msg = state.messages.find(m => m.id === msgId);
            if (msg) {
                handleLongPress(e, msg);
            }
        }, 600);
    }, { passive: true });

    messageListContainer.addEventListener('touchend', () => {
        if (touchTimer) clearTimeout(touchTimer);
    });

    messageListContainer.addEventListener('touchmove', () => {
        if (touchTimer) clearTimeout(touchTimer);
    });

    // 9. Input and Send Message Row
    const triggerSendMessage = () => {
        const input = document.getElementById('chat-input-text');
        sendMessage(state, input.value, uiCallbacks);
    };

    document.getElementById('btn-send-message').addEventListener('click', triggerSendMessage);
    document.getElementById('chat-input-text').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerSendMessage();
    });

    document.getElementById('btn-cancel-reply').addEventListener('click', () => {
        state.replyingTo = null;
        uiCallbacks.updateReplyPreview();
    });

    // 10. Profile Modals
    document.getElementById('btn-cancel-profile').addEventListener('click', () => {
        uiCallbacks.closeProfileModal();
    });

    document.getElementById('btn-save-profile').addEventListener('click', () => {
        const val = document.getElementById('edit-profile-fullname-input').value;
        saveProfile(state, val, uiCallbacks);
    });

    // 11. Click outside helper to close menus
    window.addEventListener('click', (e) => {
        const btnSidebarMenu = document.getElementById('btn-sidebar-menu');
        const sidebarMenu = document.getElementById('sidebar-menu');
        if (state.menuOpen && !btnSidebarMenu.contains(e.target) && !sidebarMenu.contains(e.target)) {
            state.menuOpen = false;
            sidebarMenu.classList.remove('active');
        }

        const btnAccentDropdown = document.getElementById('btn-accent-dropdown');
        const accentDropdownList = document.getElementById('accent-dropdown-list');
        if (state.accentMenuOpen && !btnAccentDropdown.contains(e.target) && !accentDropdownList.contains(e.target)) {
            state.accentMenuOpen = false;
            accentDropdownList.classList.remove('active');
        }

        const btnChatHeaderMenu = document.getElementById('btn-chat-header-menu');
        const chatHeaderMenu = document.getElementById('chat-header-menu');
        if (state.chatMenuOpen && !btnChatHeaderMenu.contains(e.target) && !chatHeaderMenu.contains(e.target)) {
            uiCallbacks.closeHeaderMenu();
        }
    });
}

// --- App Initialization ---
function init() {
    // Load local config
    initTheme(state);
    updateThemeControlsUI();
    
    // Bind listeners
    initEventListeners();
    
    // Listen to Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.myUid = user.uid;
            try {
                const snapshot = await get(ref(db, 'users/' + user.uid));
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    state.myUsername = data.username;
                    state.myFullName = data.nama_lengkap;
                    
                    uiCallbacks.updateMyProfileUI();
                    uiCallbacks.setCurrentPage('chat');
                    uiCallbacks.renderActiveFriendHeader();
                    uiCallbacks.updateChatLayoutView();
                    await loadFriendList(state, uiCallbacks);
                } else {
                    uiCallbacks.setCurrentPage('auth');
                }
            } catch (err) {
                console.error("Gagal inisialisasi user data:", err);
                uiCallbacks.setCurrentPage('auth');
            }
        } else {
            uiCallbacks.setCurrentPage('auth');
        }
    });

    // Mobile popstate responsive handling
    window.addEventListener('popstate', () => {
        if (state.currentPage === 'chat' && state.mobview === 'chat') {
            state.mobview = 'sidebar';
            uiCallbacks.updateChatLayoutView();
        }
    });
}

// Run app init
init();
