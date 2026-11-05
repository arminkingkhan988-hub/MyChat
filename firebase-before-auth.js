import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";

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
export const db = getFirestore(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
};
