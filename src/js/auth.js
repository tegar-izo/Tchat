import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { 
    ref, set, get, child 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const dummyDomain = "@tchat.com";

export async function handleRegister(state, regFullName, regUsername, regPassword, uiCallbacks) {
    if (!regFullName || !regUsername || !regPassword) {
        uiCallbacks.showModal('Peringatan', 'Semua kolom wajib diisi!');
        return;
    }
    state.authLoading = true;
    uiCallbacks.updateAuthLoading(true);
    const username = regUsername.trim().toLowerCase();
    const email = username + dummyDomain;

    try {
        const snapshot = await get(child(ref(db), `usernames/${username}`));
        if (snapshot.exists()) {
            uiCallbacks.showModal('Gagal', 'Username sudah digunakan orang lain!');
            state.authLoading = false;
            uiCallbacks.updateAuthLoading(false);
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, regPassword);
        const user = userCredential.user;

        await set(ref(db, 'users/' + user.uid), {
            nama_lengkap: regFullName,
            username: username,
            uid: user.uid
        });
        await set(ref(db, 'usernames/' + username), { uid: user.uid });

        uiCallbacks.showModal('Berhasil', 'Akun berhasil dibuat! Silakan masuk.', 'alert', () => {
            uiCallbacks.setAuthMode('login');
        });
        uiCallbacks.clearRegisterInputs();
    } catch (error) {
        uiCallbacks.showModal('Error', 'Gagal mendaftar: ' + error.message);
    } finally {
        state.authLoading = false;
        uiCallbacks.updateAuthLoading(false);
    }
}

export async function handleLogin(state, loginUsername, loginPassword, uiCallbacks) {
    if (!loginUsername || !loginPassword) {
        uiCallbacks.showModal('Peringatan', 'Username dan password harus diisi!');
        return;
    }
    state.authLoading = true;
    uiCallbacks.updateAuthLoading(true);
    const email = loginUsername.trim().toLowerCase() + dummyDomain;

    try {
        await signInWithEmailAndPassword(auth, email, loginPassword);
        uiCallbacks.showModal('Selamat Datang', 'Login berhasil!');
        uiCallbacks.clearLoginInputs();
    } catch (error) {
        uiCallbacks.showModal('Gagal Masuk', 'Username atau password salah.');
    } finally {
        state.authLoading = false;
        uiCallbacks.updateAuthLoading(false);
    }
}

export function handleLogout(state, uiCallbacks, chatCallbacks) {
    uiCallbacks.showModal('Konfirmasi Keluar', 'Apakah Anda yakin ingin keluar?', 'confirm', async () => {
        chatCallbacks.stopChatListener(); // Matikan listener sebelum logout
        await signOut(auth);
        
        // Reset state
        state.myUid = '';
        state.myUsername = '';
        state.myFullName = '';
        state.friends = [];
        state.messages = [];
        state.activeFriendUid = null;
        state.activeFriendName = '';
        state.menuOpen = false;
        state.searchActive = false;
        state.searchQuery = '';
        state.replyingTo = null;
        
        uiCallbacks.setCurrentPage('auth');
        uiCallbacks.renderFriendList();
        uiCallbacks.renderMessages();
        uiCallbacks.closeAllMenus();
    });
}

export async function saveProfile(state, tempFullName, uiCallbacks) {
    if (!tempFullName.trim()) {
        uiCallbacks.showModal('Peringatan', 'Nama lengkap tidak boleh kosong!');
        return;
    }
    
    state.authLoading = true;
    uiCallbacks.updateProfileModalLoading(true);
    try {
        await set(ref(db, `users/${state.myUid}/nama_lengkap`), tempFullName.trim());
        state.myFullName = tempFullName.trim();
        uiCallbacks.updateMyProfileUI();
        uiCallbacks.closeProfileModal();
        uiCallbacks.showModal('Berhasil', 'Profil berhasil diperbarui!');
        // Reload friends list for other users or local lists if needed
        await uiCallbacks.reloadFriendList();
    } catch (error) {
        uiCallbacks.showModal('Error', 'Gagal memperbarui profil: ' + error.message);
    } finally {
        state.authLoading = false;
        uiCallbacks.updateProfileModalLoading(false);
    }
}
