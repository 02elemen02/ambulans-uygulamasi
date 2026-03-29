// Firebase Yapılandırması
// Kullanıcı bilgileri eklendi - Hazır!

const firebaseConfig = {
    apiKey: "AIzaSyB-LKrNViSC8G4MLesnCznx-LyL8CWXoN0",
    authDomain: "stka-a29d9.firebaseapp.com",
    projectId: "stka-a29d9",
    storageBucket: "stka-a29d9.firebasestorage.app",
    messagingSenderId: "980814506571",
    appId: "1:980814506571:web:0ed702f391032742633bce",
    measurementId: "G-NLF34S0015"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);

// Firebase servislerini dışa aktar
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Türkçe dil desteği
auth.languageCode = 'tr';
