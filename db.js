// Conexión con Firebase (Auth + Firestore). Lo usan la carta y el panel.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc,
  writeBatch, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured =
  !!firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PEGA");

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// La caché local hace que los visitantes que vuelven casi no gasten lecturas.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc,
  writeBatch, arrayRemove
};
