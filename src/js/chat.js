import { db } from "./firebase-config.js";
import { 
    ref, set, get, push, off, onValue 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

let activeChatRef = null;

export function stopChatListener() {
    if (activeChatRef) {
        console.log("Menghentikan listener chat...");
        off(activeChatRef);
        activeChatRef = null;
    }
}

export async function loadFriendList(state, uiCallbacks) {
    state.loadingFriends = true;
    uiCallbacks.updateFriendsLoading(true);
    try {
        const snapshot = await get(ref(db, `users/${state.myUid}/daftar_teman`));
        if (!snapshot.exists()) {
            state.friends = [];
            uiCallbacks.renderFriendList();
            return;
        }
        const friendsUids = Object.keys(snapshot.val());
        const tempFriends = [];
        for (let fUid of friendsUids) {
            const userSnapshot = await get(ref(db, 'users/' + fUid));
            if (userSnapshot.exists()) tempFriends.push(userSnapshot.val());
        }
        state.friends = tempFriends;
        uiCallbacks.renderFriendList();
    } catch (e) {
        console.error("Gagal memuat teman:", e);
    } finally {
        state.loadingFriends = false;
        uiCallbacks.updateFriendsLoading(false);
    }
}

export async function addFriend(state, searchUsername, uiCallbacks) {
    const target = searchUsername.trim().toLowerCase();
    if (!target) return;
    if (target === state.myUsername) {
        uiCallbacks.showModal('Peringatan', 'Anda tidak bisa menambahkan diri sendiri.');
        return;
    }

    try {
        const snapshot = await get(ref(db, 'usernames/' + target));
        if (!snapshot.exists()) {
            uiCallbacks.showModal('Tidak Ditemukan', 'Username tersebut tidak terdaftar.');
            return;
        }
        const targetUid = snapshot.val().uid;
        await set(ref(db, `users/${state.myUid}/daftar_teman/${targetUid}`), true);
        await set(ref(db, `users/${targetUid}/daftar_teman/${state.myUid}`), true);
        
        uiCallbacks.clearAddFriendInput();
        await loadFriendList(state, uiCallbacks);
        uiCallbacks.showModal('Berhasil', 'Teman telah ditambahkan.');
    } catch (e) { 
        uiCallbacks.showModal('Error', e.message);
    }
}

export function selectFriend(state, friend, uiCallbacks) {
    state.activeFriendUid = friend.uid;
    state.activeFriendName = friend.nama_lengkap;
    
    if (state.mobview === 'sidebar') {
        history.pushState({view: 'chat'}, '');
        state.mobview = 'chat';
    }
    uiCallbacks.updateChatLayoutView();
    uiCallbacks.renderActiveFriendHeader();
    
    bukaRoomChat(state, friend.uid, uiCallbacks);
}

export function handleBack(state, uiCallbacks) {
    if (state.mobview === 'chat') {
        history.back();
    }
}

export function bukaRoomChat(state, friendUid, uiCallbacks) {
    state.messages = [];
    state.loadingMessages = true;
    uiCallbacks.renderMessages(); // rendering shows loading spinner
    
    stopChatListener();

    const roomId = state.myUid < friendUid ? `${state.myUid}_${friendUid}` : `${friendUid}_${state.myUid}`;
    console.log("Membuka room:", roomId);
    activeChatRef = ref(db, `pesan_pribadi/${roomId}`);

    onValue(activeChatRef, (snapshot) => {
        console.log("Snapshot diterima dari Firebase:", snapshot.exists());
        state.loadingMessages = false;
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log("Data pesan ditemukan:", Object.keys(data).length, "pesan");
            const temp = [];
            Object.keys(data).forEach(key => {
                const msg = data[key];
                msg.id = key || Math.random().toString(36).substr(2, 9);
                temp.push(msg);
            });
            state.messages = temp;
        } else {
            console.log("Tidak ada pesan di room ini.");
            state.messages = [];
        }
        uiCallbacks.renderMessages();
        uiCallbacks.scrollToBottom();
    }, (error) => {
        console.error("Firebase error:", error);
        if (state.currentPage !== 'auth') {
            uiCallbacks.showModal('Error Koneksi', 'Gagal memuat pesan: ' + error.message);
        }
        state.loadingMessages = false;
        uiCallbacks.renderMessages();
    });
}

export function sendMessage(state, chatInputText, uiCallbacks) {
    const text = chatInputText.trim();
    if (!text || !activeChatRef) return;
    
    const msgData = {
        pengirimUid: state.myUid,
        teks: text,
        waktu: new Date().toISOString()
    };

    if (state.replyingTo) {
        msgData.balasKe = state.replyingTo;
        state.replyingTo = null;
        uiCallbacks.updateReplyPreview();
    }

    push(activeChatRef, msgData);
    uiCallbacks.clearChatInput();
}

export async function clearChat(state, uiCallbacks) {
    const roomId = getCurrentRoomId(state);
    if (!roomId) return;
    uiCallbacks.showModal('Hapus Chat', 'Apakah Anda yakin ingin menghapus semua pesan di obrolan ini?', 'confirm', async () => {
        try {
            await set(ref(db, `pesan_pribadi/${roomId}`), null);
            state.messages = [];
            uiCallbacks.renderMessages();
            uiCallbacks.closeHeaderMenu();
        } catch (e) {
            uiCallbacks.showModal('Error', e.message);
        }
    });
}

export function deleteMessage(state, uiCallbacks) {
    const roomId = getCurrentRoomId(state);
    if (!state.selectedMsg || !roomId) return;
    
    // Proteksi: Hanya bisa hapus pesan sendiri
    if (state.selectedMsg.pengirimUid !== state.myUid) {
        uiCallbacks.showModal('Akses Ditolak', 'Anda hanya dapat menghapus pesan Anda sendiri.');
        uiCallbacks.closeMsgContextMenu();
        return;
    }

    const msgId = state.selectedMsg.id;
    uiCallbacks.showModal('Hapus Pesan', 'Apakah Anda yakin ingin menghapus pesan ini?', 'confirm', async () => {
        try {
            await set(ref(db, `pesan_pribadi/${roomId}/${msgId}`), null);
            uiCallbacks.closeMsgContextMenu();
            // Firebase listener will automatically handle sync, but let's filter locally just in case
            state.messages = state.messages.filter(m => m.id !== msgId);
            uiCallbacks.renderMessages();
        } catch (e) {
            uiCallbacks.showModal('Error', 'Gagal menghapus pesan.');
        }
    });
}

export function replyMessage(state, uiCallbacks) {
    if (!state.selectedMsg) return;
    state.replyingTo = {
        teks: state.selectedMsg.teks,
        pengirim: state.selectedMsg.pengirimUid === state.myUid ? 'Anda' : state.activeFriendName
    };
    uiCallbacks.updateReplyPreview();
    uiCallbacks.closeMsgContextMenu();
}

export async function addReaction(state, emoji, uiCallbacks) {
    const roomId = getCurrentRoomId(state);
    if (!state.selectedMsg || !roomId) return;
    const msgId = state.selectedMsg.id;
    
    try {
        await set(ref(db, `pesan_pribadi/${roomId}/${msgId}/reaksi`), emoji);
        uiCallbacks.closeMsgContextMenu();
        // Firebase onValue listener will handle rendering reactively, but local update just in case:
        state.messages = state.messages.map(m => 
            m.id === msgId ? { ...m, reaksi: emoji } : m
        );
        uiCallbacks.renderMessages();
    } catch (e) {
        uiCallbacks.showModal('Error', 'Gagal menambah reaksi.');
    }
}

export function getCurrentRoomId(state) {
    if (!state.activeFriendUid) return null;
    return state.myUid < state.activeFriendUid 
        ? `${state.myUid}_${state.activeFriendUid}` 
        : `${state.activeFriendUid}_${state.myUid}`;
}
