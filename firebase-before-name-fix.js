import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWlf-S_TerlLcJEUEVwSiRwmHCyUgJF2o",
  authDomain: "mychat-5003a.firebaseapp.com",
  projectId: "mychat-5003a",
  storageBucket: "mychat-5003a.firebasestorage.app",
  messagingSenderId: "489523861523",
  appId: "1:489523861523:web:3944ec1e24ae98b99c07e6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
};
