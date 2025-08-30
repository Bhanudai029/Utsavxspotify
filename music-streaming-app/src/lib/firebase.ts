import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyOgh68Cuqhxzm11VGVRcc2W4BYFXP4ZNOk",
  authDomain: "music-x-dfd87.firebaseapp.com",
  projectId: "music-x-dfd87",
  storageBucket: "music-x-dfd87.firebasestorage.app",
  messagingSenderId: "600929755806",
  appId: "1:600929755806:web:3e11645bd94118854618f",
  measurementId: "G-QNP4BFQ9ZM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;