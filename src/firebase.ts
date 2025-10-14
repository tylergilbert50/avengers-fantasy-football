import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwetzPY0lTLFw-OquhFTKzGpnVk4NJDjw",
  authDomain: "avengers-fantasy-football.firebaseapp.com",
  projectId: "avengers-fantasy-football",
  storageBucket: "avengers-fantasy-football.firebasestorage.app",
  messagingSenderId: "886621122361",
  appId: "1:886621122361:web:89892956c1456277d402e8",
  measurementId: "G-FCNN1FNPW1",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export default app;
