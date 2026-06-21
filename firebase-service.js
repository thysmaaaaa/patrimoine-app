/**
 * ============================================================
 *  FIREBASE SERVICE
 *  Centralise toute la communication avec Firestore.
 *  Structure des données (collection unique "patrimoine",
 *  document unique "data" — suffisant pour un usage perso) :
 *
 *  patrimoine/data = {
 *    lignes: [
 *      {
 *        id, enveloppe: 'epargne'|'av'|'pea'|'crypto',
 *        nom, ticker (pea/crypto), montantInvesti (PRU total),
 *        quantite (pea/crypto), solde (epargne/av direct)
 *      }
 *    ],
 *    credits: [
 *      { id, nom, montant, taux, dureeMois, dateDebut }
 *    ],
 *    pin: "1234"
 *  }
 * ============================================================
 */

const FirebaseService = (() => {
  let db = null;
  let unsubscribe = null;
  let ready = false;

  function init() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.firestore();
      // Persistance offline : permet de continuer à utiliser l'app
      // sans réseau (PEA/crypto resteront aux dernières valeurs connues).
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      ready = true;
      return true;
    } catch (e) {
      console.error("Erreur initialisation Firebase :", e);
      ready = false;
      return false;
    }
  }

  function isReady() {
    return ready;
  }

  function docRef() {
    return db.collection("patrimoine").doc("data");
  }

  /**
   * Écoute en temps réel le document principal.
   * callback(data) est appelé à chaque changement (local ou distant).
   */
  function listen(callback, onError) {
    if (!ready) return;
    if (unsubscribe) unsubscribe();
    unsubscribe = docRef().onSnapshot(
      (snap) => {
        if (snap.exists) {
          callback(snap.data());
        } else {
          // Première utilisation : on crée le document avec une structure vide
          const initial = { lignes: [], credits: [], pin: DEFAULT_PIN };
          docRef().set(initial).then(() => callback(initial));
        }
      },
      (err) => {
        console.error("Erreur Firestore (listen) :", err);
        if (onError) onError(err);
      }
    );
  }

  async function saveFullState(state) {
    if (!ready) throw new Error("Firebase non initialisé");
    await docRef().set(state, { merge: true });
  }

  async function updateField(field, value) {
    if (!ready) throw new Error("Firebase non initialisé");
    await docRef().update({ [field]: value });
  }

  function stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return { init, isReady, listen, saveFullState, updateField, stop };
})();
