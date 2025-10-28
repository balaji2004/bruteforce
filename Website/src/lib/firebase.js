import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, remove, query, limitToLast } from 'firebase/database';

// Firebase configuration
// Option 1: Use environment variables (RECOMMENDED)
// Create a .env.local file in the project root with your Firebase credentials
// See FIREBASE_SETUP_COMPLETE.md for detailed instructions

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtaSPifCnGB4FnBdcSbZvjabr8JoYySHU",
  authDomain: "cloudburst-detection-sih.firebaseapp.com",
  databaseURL: "https://cloudburst-detection-sih-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cloudburst-detection-sih",
  storageBucket: "cloudburst-detection-sih.firebasestorage.app",
  messagingSenderId: "461505966403",
  appId: "1:461505966403:web:02af47741e625463a13ff6",
  measurementId: "G-QQDSVTMY9B"
};

// Log configuration status for debugging
console.log('🔥 Firebase Configuration Status:');
console.log('- API Key:', firebaseConfig.apiKey !== "your-api-key" ? '✅ Set' : '❌ Using placeholder');
console.log('- Database URL:', firebaseConfig.databaseURL !== "https://your-project-default-rtdb.firebaseio.com" ? firebaseConfig.databaseURL : '❌ Using placeholder');
console.log('- Project ID:', firebaseConfig.projectId !== "your-project-id" ? firebaseConfig.projectId : '❌ Using placeholder');

if (firebaseConfig.apiKey === "your-api-key") {
  console.warn('⚠️ WARNING: Using placeholder Firebase credentials!');
  console.warn('📖 See FIREBASE_SETUP_COMPLETE.md for setup instructions');
}

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  if (error.message.includes('API key')) {
    console.error('💡 Tip: Check your API key in .env.local or firebase.js');
  }
  throw error;
}

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app);

// Export Firebase functions for use in components
export { ref, set, get, onValue, update, remove, query, limitToLast };
