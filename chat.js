import { db } from "./firebase-config.js";
import { 
    ref, set, get, push, onChildAdded, off 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

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
    }
};
