import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBP5pqm0czmLBNdC81gMcY50BL86ZN5hGY",
  authDomain: "hiresense-app-97d54.firebaseapp.com",
  databaseURL: "https://hiresense-app-97d54-default-rtdb.firebaseio.com",
  projectId: "hiresense-app-97d54",
  storageBucket: "hiresense-app-97d54.firebasestorage.app",
  messagingSenderId: "634865522339",
  appId: "1:634865522339:web:0a580dad2ee7af44b31116"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const rtdb = getDatabase(app);