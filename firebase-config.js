import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7bi_YlW0_HAqzkTlEZS-phoQpak1iB_w",
  authDomain: "pitch-stats.firebaseapp.com",
  projectId: "pitch-stats",
  storageBucket: "pitch-stats.firebasestorage.app",
  messagingSenderId: "753464692599",
  appId: "1:753464692599:web:9cb74150c94c46231ddb72",
  measurementId: "G-B36RWJRVJ9"
};
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
