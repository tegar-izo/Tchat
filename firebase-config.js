import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA1RdjHjnevKnJ0TlNRpQ2ndl53_KYPCRo",
    authDomain: "t-chat-db.firebaseapp.com",
    databaseURL: "https://t-chat-db-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "t-chat-db",
    storageBucket: "t-chat-db.firebasestorage.app",
    messagingSenderId: "656960746695",
    appId: "1:656960746695:web:7b06a7784149d3e7747ae2",
    measurementId: "G-SBWNHZYFZ9"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const analytics = getAnalytics(app);
