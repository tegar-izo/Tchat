import { db } from "./firebase-config.js";
import { 
    ref, set, get, push, onChildAdded, off, onValue 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// Global variable outside of Alpine proxy to avoid 'i.insert is not a function' error
let activeChatRef = null;

export const chatLogic = {
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

    // Chat Header Menu & Actions
    chatMenuOpen: false,
    searchActive: false,
    searchQuery: '',
    
    // Message Context Menu
    activeMsgId: null,
    msgMenuOpen: false,
    msgMenuX: 0,
    msgMenuY: 0,
    selectedMsg: null,
    
    // Reply State
    replyingTo: null,
    longPressTimer: null,

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

    stopChatListener() {
        if (activeChatRef) {
            console.log("Menghentikan listener chat...");
            off(activeChatRef);
            activeChatRef = null;
        }
    },

    bukaRoomChat(friendUid) {
        this.messages = [];
        this.loadingMessages = true;
        
        this.stopChatListener();

        const roomId = this.myUid < friendUid ? `${this.myUid}_${friendUid}` : `${friendUid}_${this.myUid}`;
        console.log("Membuka room:", roomId);
        activeChatRef = ref(db, `pesan_pribadi/${roomId}`);

        // Gunakan onValue untuk sinkronisasi seluruh list secara reaktif
        onValue(activeChatRef, (snapshot) => {
            console.log("Snapshot diterima dari Firebase:", snapshot.exists());
            this.loadingMessages = false;
            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log("Data pesan ditemukan:", Object.keys(data).length, "pesan");
                const temp = [];
                Object.keys(data).forEach(key => {
                    const msg = data[key];
                    msg.id = key || Math.random().toString(36).substr(2, 9);
                    temp.push(msg);
                });
                this.messages = temp;
            } else {
                console.log("Tidak ada pesan di room ini.");
                this.messages = [];
            }
            this.scrollToBottom();
        }, (error) => {
            console.error("Firebase error (Permission Denied?):", error);
            // Jangan tampilkan modal jika kita memang sedang proses logout
            if (this.currentPage !== 'auth') {
                this.showModal('Error Koneksi', 'Gagal memuat pesan: ' + error.message);
            }
            this.loadingMessages = false;
        });
    },

    scrollToBottom() {
        setTimeout(() => {
            const box = document.querySelector('.chat-messages');
            if (box) box.scrollTop = box.scrollHeight;
        }, 100);
    },

    sendMessage() {
        if (!this.chatInput.trim() || !activeChatRef) return;
        
        const msgData = {
            pengirimUid: this.myUid,
            teks: this.chatInput.trim(),
            waktu: new Date().toISOString()
        };

        if (this.replyingTo) {
            msgData.balasKe = this.replyingTo;
            this.replyingTo = null;
        }

        push(activeChatRef, msgData);
        this.chatInput = "";
    },

    async clearChat() {
        const roomId = this.getCurrentRoomId();
        if (!roomId) return;
        this.showModal('Hapus Chat', 'Apakah Anda yakin ingin menghapus semua pesan di obrolan ini?', 'confirm', async () => {
            try {
                await set(ref(db, `pesan_pribadi/${roomId}`), null);
                this.messages = [];
                this.chatMenuOpen = false;
            } catch (e) {
                this.showModal('Error', e.message);
            }
        });
    },

    toggleSearch() {
        this.searchActive = !this.searchActive;
        this.chatMenuOpen = false;
        if (!this.searchActive) this.searchQuery = '';
    },

    getFilteredMessages() {
        console.log("Menghitung filteredMessages. Total:", this.messages.length);
        if (!this.searchQuery || !this.searchQuery.trim()) return this.messages;
        const q = this.searchQuery.toLowerCase();
        const filtered = this.messages.filter(m => m.teks && m.teks.toLowerCase().includes(q));
        console.log("Hasil filter pencarian:", filtered.length);
        return filtered;
    },

    handleLongPress(event, msg) {
        if (event.cancelable) event.preventDefault();
        this.selectedMsg = msg;
        this.activeMsgId = msg.id;
        
        const touch = event.touches ? event.touches[0] : event;
        let x = touch.clientX;
        let y = touch.clientY;

        // Prevent menu from going off-screen
        const menuWidth = 220; 
        const menuHeight = 150; 
        
        if (x + (menuWidth / 2) > window.innerWidth) x = window.innerWidth - (menuWidth / 2) - 10;
        if (x - (menuWidth / 2) < 0) x = (menuWidth / 2) + 10;
        if (y - menuHeight < 0) y = menuHeight + 10;

        this.msgMenuX = x;
        this.msgMenuY = y;
        this.msgMenuOpen = true;
    },

    async deleteMessage() {
        const roomId = this.getCurrentRoomId();
        if (!this.selectedMsg || !roomId) return;
        
        // Proteksi: Hanya bisa hapus pesan sendiri
        if (this.selectedMsg.pengirimUid !== this.myUid) {
            this.showModal('Akses Ditolak', 'Anda hanya dapat menghapus pesan Anda sendiri.');
            this.msgMenuOpen = false;
            return;
        }

        const msgId = this.selectedMsg.id;
        try {
            await set(ref(db, `pesan_pribadi/${roomId}/${msgId}`), null);
            this.msgMenuOpen = false;
            this.messages = this.messages.filter(m => m.id !== msgId);
        } catch (e) {
            this.showModal('Error', 'Gagal menghapus pesan.');
        }
    },

    replyMessage() {
        if (!this.selectedMsg) return;
        console.log("Memicu reply untuk pesan:", this.selectedMsg.teks);
        this.replyingTo = {
            teks: this.selectedMsg.teks,
            pengirim: this.selectedMsg.pengirimUid === this.myUid ? 'Anda' : this.activeFriendName
        };
        console.log("State replyingTo sekarang:", JSON.stringify(this.replyingTo));
        this.msgMenuOpen = false;
    },

    async addReaction(emoji) {
        const roomId = this.getCurrentRoomId();
        if (!this.selectedMsg || !roomId) return;
        const msgId = this.selectedMsg.id;
        
        try {
            await set(ref(db, `pesan_pribadi/${roomId}/${msgId}/reaksi`), emoji);
            this.msgMenuOpen = false;
            // Gunakan map untuk memicu reaktivitas Alpine
            this.messages = this.messages.map(m => 
                m.id === msgId ? { ...m, reaksi: emoji } : m
            );
        } catch (e) {
            this.showModal('Error', 'Gagal menambah reaksi.');
        }
    },

    getCurrentRoomId() {
        if (!this.activeFriendUid) return null;
        return this.myUid < this.activeFriendUid 
            ? `${this.myUid}_${this.activeFriendUid}` 
            : `${this.activeFriendUid}_${this.myUid}`;
    }
};
