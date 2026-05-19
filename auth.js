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

export const authLogic = {
    authMode: 'login',
    loginUsername: '',
    loginPassword: '',
    regFullName: '',
    regUsername: '',
    regPassword: '',
    authLoading: false,
    showPassword: false,
    profileModal: false,
    tempFullName: '',

    openProfileEdit() {
        this.tempFullName = this.myFullName;
        this.profileModal = true;
        this.menuOpen = false;
    },

    async saveProfile() {
        if (!this.tempFullName.trim()) {
            this.showModal('Peringatan', 'Nama lengkap tidak boleh kosong!');
            return;
        }
        
        this.authLoading = true;
        try {
            await set(ref(db, `users/${this.myUid}/nama_lengkap`), this.tempFullName.trim());
            this.myFullName = this.tempFullName.trim();
            this.profileModal = false;
            this.showModal('Berhasil', 'Profil berhasil diperbarui!');
        } catch (error) {
            this.showModal('Error', 'Gagal memperbarui profil: ' + error.message);
        } finally {
            this.authLoading = false;
        }
    },

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
    }
};
