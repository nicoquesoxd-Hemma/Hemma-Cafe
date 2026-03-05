import { initializeApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDJBkF3vodLd6emQyvSX4IGY-27Ji7G1z8",
    authDomain: "hemmacafe-b02f8.firebaseapp.com",
    projectId: "hemmacafe-b02f8",
    storageBucket: "hemmacafe-b02f8.firebasestorage.app",
    messagingSenderId: "241934891527",
    appId: "1:241934891527:web:c24b35358386ffceb9c8a2",
    measurementId: "G-GX1KENBGDM",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Habilitar persistencia Offline para la base de datos
enableMultiTabIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            // Múltiples pestañas abiertas, la persistencia solo se activa en la primera
            console.warn("Múltiples pestañas abiertas. La persistencia de datos solo está en la primera.");
        } else if (err.code == 'unimplemented') {
            // El navegador no soporta IndexedDB
            console.warn("El navegador no soporta persistencia de datos offline.");
        }
    });
