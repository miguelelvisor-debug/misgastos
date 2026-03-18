import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2u5vBn9m-9B5mWxjXAGj3M34Yyr4pUww",
  authDomain: "mis-gastos-6dc56.firebaseapp.com",
  projectId: "mis-gastos-6dc56",
  storageBucket: "mis-gastos-6dc56.firebasestorage.app",
  messagingSenderId: "233680876846",
  appId: "1:233680876846:web:fa907931e50176486ef6bf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
