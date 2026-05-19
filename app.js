import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

import { themeLogic } from "./theme.js";
import { authLogic } from "./auth.js";
import { chatLogic } from "./chat.js";

window.tchatApp = function() {
    return {
        ...themeLogic,
        ...authLogic,
        ...chatLogic,

        // --- Global State ---
        currentPage: 'loading',
        myUid: '',
        myUsername: '',
        myFullName: '',

        // Custom Modal State
        modal: {
            show: false,
            title: '',
            message: '',
            type: 'alert',
            onConfirm: null
        },

        // --- Init ---
        init() {
            this.initTheme();

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    this.myUid = user.uid;
                    const snapshot = await get(ref(db, 'users/' + user.uid));
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        this.myUsername = data.username;
                        this.myFullName = data.nama_lengkap;
                        this.currentPage = 'chat';
                        await this.loadFriendList();
                    } else {
                        this.currentPage = 'auth';
                    }
                } else {
                    this.currentPage = 'auth';
                }
            });

            window.addEventListener('popstate', (event) => {
                if (this.currentPage === 'chat' && this.mobview === 'chat') {
                    this.mobview = 'sidebar';
                }
            });
        },

        // --- Global Helpers ---
        showModal(title, message, type = 'alert', onConfirm = null) {
            this.modal.title = title;
            this.modal.message = message;
            this.modal.type = type;
            this.modal.onConfirm = onConfirm;
            this.modal.show = true;
        },

        closeModal() {
            this.modal.show = false;
        },

        handleModalConfirm() {
            if (this.modal.onConfirm) this.modal.onConfirm();
            this.closeModal();
        },

        getInitials(name) {
            if (!name) return "?";
            return name.split(' ').map(n => n[0]).join('').slice(0, 2);
        },

        formatTime(iso) {
            if (!iso) return '';
            return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        },

        getAvatarColor(name) {
            if (!name) return '#6750A4';
            const colors = ['#a2b9bc', '#b2ad7f', '#878f99', '#6b5b95', '#feb236', '#d64161', '#ff7b25', '#92a8d1', '#f7cac9', '#dec2cb', '#b5e7a0', '#86af49'];
            let hash = 0;
            for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
            return colors[Math.abs(hash) % colors.length];
        }
    }
}
