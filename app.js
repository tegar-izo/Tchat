import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { 
    ref, set, get, child, push, onChildAdded, off 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const dummyDomain = "@tchat.com";
let activeChatRef = null;

window.tchatApp = function() {
    return {
        // --- State ---
        currentPage: 'loading',
        authMode: 'login',
        
        // User Data
        myUid: '',
        myUsername: '',
        myFullName: '',
        
        // Auth Inputs
        loginUsername: '',
        loginPassword: '',
        regFullName: '',
        regUsername: '',
        regPassword: '',
        authLoading: false,
        showPassword: false,

        // Chat State
        mobview: 'sidebar',
        searchUsername: '',
        friends: [],
        messages: [],
        activeFriendUid: null,
        activeFriendName: '',
        chatInput: '',
        loadingFriends: false,
        loadingMessages: false,
        menuOpen: false,
        darkTheme: false,
        accentColor: 'blue',
        accentMenuOpen: false,

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
            if (localStorage.getItem('theme') === 'dark') {
                this.darkTheme = true;
            }
            this.updateTheme();

            if (localStorage.getItem('accent')) {
                this.accentColor = localStorage.getItem('accent');
            }
            this.updateAccent();

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

        // --- Auth Logic ---
        async handleRegister() {
            if (!this.regFullName || !this.regUsername || !this.regPassword) {
                this.showModal('Peringatan', 'Semua kolom wajib diisi!');
                return;
            }
            this.authLoading = true;
            const username = this.regUsername.trim().toLowerCase();
            const email = username + dummyDomain;

            try {
                const snapshot = await get(child(ref(db), `usernames/${username}`));
                if (snapshot.exists()) {
                    this.showModal('Gagal', 'Username sudah digunakan orang lain!');
                    this.authLoading = false;
                    return;
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, this.regPassword);
                const user = userCredential.user;

                await set(ref(db, 'users/' + user.uid), {
                    nama_lengkap: this.regFullName,
                    username: username,
                    uid: user.uid
                });
                await set(ref(db, 'usernames/' + username), { uid: user.uid });

                this.showModal('Berhasil', 'Akun berhasil dibuat! Silakan masuk.', 'alert', () => {
                    this.authMode = 'login';
                });
                this.regFullName = this.regUsername = this.regPassword = "";
            } catch (error) {
                this.showModal('Error', 'Gagal mendaftar: ' + error.message);
            } finally {
                this.authLoading = false;
            }
        },

        async handleLogin() {
            if (!this.loginUsername || !this.loginPassword) {
                this.showModal('Peringatan', 'Username dan password harus diisi!');
                return;
            }
            this.authLoading = true;
            const email = this.loginUsername.trim().toLowerCase() + dummyDomain;

            try {
                await signInWithEmailAndPassword(auth, email, this.loginPassword);
                this.showModal('Selamat Datang', 'Login berhasil!');
                this.loginUsername = this.loginPassword = "";
            } catch (error) {
                this.showModal('Gagal Masuk', 'Username atau password salah.');
            } finally {
                this.authLoading = false;
            }
        },

        logout() {
            this.showModal('Konfirmasi Keluar', 'Apakah Anda yakin ingin keluar?', 'confirm', () => {
                signOut(auth);
                this.currentPage = 'auth';
                this.friends = [];
                this.messages = [];
                this.activeFriendUid = null;
                this.menuOpen = false;
            });
        },

        // --- Chat Logic ---
        async loadFriendList() {
            this.loadingFriends = true;
            try {
                const snapshot = await get(ref(db, `users/${this.myUid}/daftar_teman`));
                if (!snapshot.exists()) {
                    this.friends = [];
                    return;
                }
                const friendsUids = Object.keys(snapshot.val());
                const tempFriends = [];
                for (let fUid of friendsUids) {
                    const userSnapshot = await get(ref(db, 'users/' + fUid));
                    if (userSnapshot.exists()) tempFriends.push(userSnapshot.val());
                }
                this.friends = tempFriends;
            } finally {
                this.loadingFriends = false;
            }
        },

        async addFriend() {
            const target = this.searchUsername.trim().toLowerCase();
            if (!target) return;
            if (target === this.myUsername) {
                this.showModal('Peringatan', 'Anda tidak bisa menambahkan diri sendiri.');
                return;
            }

            try {
                const snapshot = await get(ref(db, 'usernames/' + target));
                if (!snapshot.exists()) {
                    this.showModal('Tidak Ditemukan', 'Username tersebut tidak terdaftar.');
                    return;
                }
                const targetUid = snapshot.val().uid;
                await set(ref(db, `users/${this.myUid}/daftar_teman/${targetUid}`), true);
                await set(ref(db, `users/${targetUid}/daftar_teman/${this.myUid}`), true);
                
                this.searchUsername = "";
                await this.loadFriendList();
                this.showModal('Berhasil', 'Teman telah ditambahkan.');
            } catch (e) { 
                this.showModal('Error', e.message);
            }
        },

        selectFriend(friend) {
            this.activeFriendUid = friend.uid;
            this.activeFriendName = friend.nama_lengkap;
            if (this.mobview === 'sidebar') history.pushState({view: 'chat'}, '');
            this.mobview = 'chat';
            this.bukaRoomChat(friend.uid);
        },

        handleBack() {
            if (this.mobview === 'chat') history.back();
        },

        bukaRoomChat(friendUid) {
            this.messages = [];
            this.loadingMessages = true;
            if (activeChatRef) off(activeChatRef);

            const roomId = this.myUid < friendUid ? `${this.myUid}_${friendUid}` : `${friendUid}_${this.myUid}`;
            activeChatRef = ref(db, `pesan_pribadi/${roomId}`);

            get(activeChatRef).then(s => { if(!s.exists()) this.loadingMessages = false; });

            onChildAdded(activeChatRef, (snapshot) => {
                this.messages.push(snapshot.val());
                this.loadingMessages = false;
                this.$nextTick(() => {
                    const box = this.$refs.messageBox;
                    if (box) box.scrollTop = box.scrollHeight;
                });
            });
        },

        sendMessage() {
            if (!this.chatInput.trim() || !activeChatRef) return;
            push(activeChatRef, {
                pengirimUid: this.myUid,
                teks: this.chatInput.trim(),
                waktu: new Date().toISOString()
            });
            this.chatInput = "";
        },

        // --- Custom Modal Methods ---
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

        // --- Theme & Helpers ---
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
