# Guide d'installation — Application Patrimoine

Ce guide t'accompagne pas à pas pour faire fonctionner l'application,
de zéro jusqu'à l'icône installée sur ton iPhone.

Temps estimé : 20-30 minutes, à faire une seule fois.

---

## 1. Créer ton projet Firebase (gratuit)

1. Va sur https://console.firebase.google.com/ et connecte-toi avec un compte Google.
2. Clique sur **"Ajouter un projet"**.
   - Donne-lui un nom, par exemple `mon-patrimoine`.
   - Tu peux désactiver Google Analytics (pas nécessaire ici).
   - Clique sur **"Créer le projet"**.
3. Une fois le projet créé, dans le menu de gauche, clique sur **"Firestore Database"**.
4. Clique sur **"Créer une base de données"**.
   - Choisis le mode **Production**.
   - Choisis une région proche de toi (ex : `eur3 (europe-west)`).
5. Une fois la base créée, va dans l'onglet **"Règles"** et remplace le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /patrimoine/{document} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ **Important sur la sécurité** : cette règle autorise quiconque connaît
> l'URL de ton projet Firebase à lire/écrire tes données. C'est acceptable
> pour un usage strictement personnel et si tu ne partages jamais ta config,
> mais ce n'est **pas** une vraie authentification. Si tu veux davantage de
> sécurité plus tard, active **Firebase Authentication** (mode "anonyme" ou
> "email/mot de passe") et adapte la règle à `if request.auth != null;`.

6. Clique sur **"Publier"**.

### Récupérer ta configuration

1. Dans le menu de gauche, clique sur l'icône ⚙️ (Paramètres du projet).
2. Descends jusqu'à **"Vos applications"** et clique sur l'icône **Web `</>`**.
3. Donne un nom à l'application (ex : `patrimoine-web`), puis **"Enregistrer l'application"**.
4. Firebase t'affiche un objet `firebaseConfig` qui ressemble à ceci :

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "mon-patrimoine.firebaseapp.com",
  projectId: "mon-patrimoine",
  storageBucket: "mon-patrimoine.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcd1234"
};
```

5. **Copie ces valeurs** dans le fichier `config.js` du projet, à l'intérieur de `FIREBASE_CONFIG`.

---

## 2. Obtenir une clé API Finnhub (gratuite)

1. Va sur https://finnhub.io/register et crée un compte gratuit.
2. Une fois connecté, ton **API Key** est affichée sur le tableau de bord
   (https://finnhub.io/dashboard).
3. Copie cette clé dans `config.js`, dans la variable `FINNHUB_API_KEY`.

> ℹ️ Le plan gratuit Finnhub autorise 60 appels/minute, ce qui est largement
> suffisant pour un usage personnel avec quelques lignes PEA.

> ℹ️ **Tickers européens** : pour les actions/ETF cotés sur Euronext Paris,
> utilise le suffixe `.PA` (ex : `CW8.PA` pour l'ETF Amundi MSCI World).
> Vérifie la disponibilité du symbole sur https://finnhub.io/ avant de
> l'ajouter dans l'app — certains ETF européens peu liquides ne sont pas
> toujours couverts par l'offre gratuite.

L'API **CoinGecko** utilisée pour les cryptos ne nécessite aucune clé pour
les usages de cette ampleur (endpoint public `/simple/price`).

---

## 3. Tester en local

1. Ouvre un terminal dans le dossier du projet.
2. Lance un petit serveur local (nécessaire car les PWA et Firebase
   exigent `http://` ou `https://`, pas `file://`) :

```bash
# Avec Python (déjà installé sur Mac) :
python3 -m http.server 8080

# Ou avec Node.js :
npx serve .
```

3. Ouvre `http://localhost:8080` dans ton navigateur.
4. Le code PIN par défaut est **1234** (modifiable ensuite dans Réglages).

---

## 4. Déployer en ligne (pour un accès iPhone + PC)

Pour installer l'app sur ton iPhone, elle doit être servie en **HTTPS** par
une vraie URL (Safari ne permet pas l'installation depuis `file://` ou même
souvent depuis du HTTP simple en local réseau).

### Option recommandée : Firebase Hosting (gratuit, et déjà dans l'écosystème)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Choisis ton projet existant, dossier public = "." , SPA = non

firebase deploy
```

Firebase te donnera une URL du type `https://mon-patrimoine.web.app`.

### Alternative : GitHub Pages (gratuit aussi)

1. Crée un repository GitHub et pousse tous les fichiers du projet.
2. Dans les **Settings > Pages** du repo, active GitHub Pages sur la branche `main`.
3. Ton app sera accessible sur `https://ton-pseudo.github.io/ton-repo/`.

---

## 5. Installer l'app sur ton iPhone

1. Ouvre **Safari** (obligatoire, Chrome iOS ne permet pas l'installation PWA)
   et va sur l'URL de ton app déployée.
2. Appuie sur l'icône de partage (carré avec flèche vers le haut).
3. Fais défiler et choisis **"Sur l'écran d'accueil"**.
4. Donne un nom (ex : "Patrimoine") et valide.

L'icône apparaît alors sur ton écran d'accueil et s'ouvre en plein écran,
sans barre d'adresse, comme une vraie application.

---

## 6. Premier lancement

1. Ouvre l'app — tu arrives sur l'écran de verrouillage.
2. Code PIN par défaut : **1234**.
3. Va dans **Réglages > Changer le code PIN** pour le personnaliser immédiatement.
4. Ajoute tes premières lignes via l'onglet **Ajouter** (un nouveau support
   ou actif se crée automatiquement à la première saisie).
5. Ajoute tes crédits via l'onglet **Crédits**.

---

## Limites à connaître

- Le code PIN est stocké dans Firestore mais vérifié uniquement côté client :
  cela protège d'un regard furtif, pas d'un accès déterminé à ton appareil
  ou ta base Firebase.
- Les cours boursiers/crypto dépendent de la disponibilité des API tierces
  (Finnhub, CoinGecko, exchangerate.host) ; en cas d'indisponibilité,
  l'app affiche les dernières valeurs connues.
- Le calcul du capital restant dû des crédits suppose des mensualités
  constantes (amortissement classique) ; il ne reflète pas d'éventuels
  remboursements anticipés ou modulations non renseignés dans l'app.
