/**
 * ============================================================
 *  CONFIGURATION — À REMPLIR AVANT UTILISATION
 * ============================================================
 *  1. Configuration Firebase (voir GUIDE_INSTALLATION.md §1)
 *  2. Clé API Finnhub (gratuite, voir GUIDE_INSTALLATION.md §2)
 *  3. Code PIN par défaut (modifiable ensuite dans l'app)
 * ============================================================
 */

// --- 1. FIREBASE ---
// Récupère cet objet depuis la console Firebase :
// Paramètres du projet > Vos applications > SDK (config)
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCXq5-SJ61VqwfQ4LoqpPyPSNqEtnjTV_I",
  authDomain: "mon-patrimoine-c7fcd.firebaseapp.com",
  projectId: "mon-patrimoine-c7fcd",
  storageBucket: "mon-patrimoine-c7fcd.firebasestorage.app",
  messagingSenderId: "699368084003",
  appId: "1:699368084003:web:bc5850b1032b3ac2601796",
  measurementId: "G-0RG0RN7N0K"
};

// --- 2. API BOURSE (Finnhub) ---
// Clé gratuite sur https://finnhub.io/register
const FINNHUB_API_KEY = "d8s5pnpr01qlj6fgqo7gd8s5pnpr01qlj6fgqo80";

// --- 3. PIN PAR DÉFAUT ---
// Utilisé uniquement à la toute première ouverture de l'app.
// Tu pourras le changer ensuite dans Réglages > Sécurité.
const DEFAULT_PIN = "1234";

// --- 4. TAUX DE CHANGE DE SECOURS (fallback) ---
// Utilisé uniquement si l'API de taux de change est inaccessible.
const FALLBACK_USD_EUR_RATE = 0.92;

// --- 5. INTERVALLE DE RAFRAÎCHISSEMENT DES COURS (ms) ---
// 5 minutes par défaut. Ne descends pas trop bas pour respecter
// les quotas gratuits des API (Finnhub: 60/min, CoinGecko: 10-30/min).
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
