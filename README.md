# Patrimoine — App de suivi financier personnel (PWA)

## Démarrage rapide

1. **Avant toute chose**, suis `GUIDE_INSTALLATION.md` pour :
   - créer ton projet Firebase et configurer `config.js`,
   - obtenir une clé API Finnhub (gratuite),
   - déployer l'app en HTTPS,
   - l'installer sur ton iPhone.

2. Sans cette configuration, l'app s'ouvre mais reste en mode "vide / hors-ligne"
   (aucune sauvegarde persistante, pas de cours de marché).

## Structure du projet

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de l'app (lock screen, dashboard, formulaires) |
| `style.css` | Design complet, style iOS, responsive mobile-first |
| `config.js` | **À éditer** : clés Firebase + Finnhub + PIN par défaut |
| `firebase-service.js` | Lecture/écriture Firestore en temps réel |
| `market-api.js` | Appels Finnhub (actions/ETF) + CoinGecko (crypto) + conversion EUR |
| `finance-utils.js` | Calculs : amortissement crédit, PRU, performance, formatage |
| `chart.js` | Pie chart (donut) en Canvas natif, sans dépendance |
| `app.js` | Logique applicative : état, rendu, navigation, opérations |
| `manifest.json` + `icons/` | Configuration PWA pour installation iOS |
| `service-worker.js` | Cache offline des fichiers statiques |

## Fonctionnalités couvertes

- Écran de verrouillage par code PIN à 4 chiffres (style iOS fidèle)
- Dashboard avec Patrimoine Brut / Net, répartition en donut chart
- 4 enveloppes d'actifs : Épargne sécurisée, Assurance vie, PEA, Crypto (BTC/SOL/ETH)
- Gestion des crédits avec calcul automatique du capital restant dû (amortissement)
- Module de saisie de versements/retraits, avec recalcul automatique du PRU
- Synchronisation temps réel PC ↔️ iPhone via Firestore
- Cours de marché actualisés automatiquement, convertis en euros

## Limites connues (voir aussi le guide d'installation)

- Le code PIN protège d'un regard furtif, pas d'un accès déterminé à l'appareil.
- Dépendant de la disponibilité des API gratuites (Finnhub, CoinGecko).
- Hypothèse de mensualités constantes pour le calcul des crédits (pas de remboursement anticipé).
