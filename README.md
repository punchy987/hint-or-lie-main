# 🎮 Hint or Lie

Jeu multijoueur de déduction sociale - trouvez l'imposteur parmi vous !

## � Installation depuis GitHub

### RÈGLE D'OR : 3 commandes suffisent pour jouer !

```bash
# 1. Cloner le dépôt
git clone https://github.com/[votre-username]/hint-or-lie.git
cd hint-or-lie

# 2. Installer les dépendances
npm install

# 3. Démarrer le serveur
npm start
```

Puis ouvrez votre navigateur à : **http://localhost:5500**

### Prérequis

- **Node.js** version 16 ou supérieure ([Télécharger Node.js](https://nodejs.org/))
- Un navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Port 5500 disponible (ou modifiable dans `server.js`)

## 🚀 Démarrage rapide (si déjà installé)

### RÈGLE D'OR : Le serveur doit être démarré AVANT d'accéder au jeu

### 1. Démarrer le serveur

```bash
node server.js
```

Le serveur démarre sur **http://localhost:5500**

### 2. Accéder au jeu

Ouvrez votre navigateur à l'adresse : **http://localhost:5500**

### 3. Créer ou rejoindre une partie

- **Créer un salon** : Entrez votre pseudo et cliquez sur "Créer"
- **Rejoindre un salon** : Entrez votre pseudo + le code à 4 chiffres

## ⚙️ Configuration

### Port du serveur
- Par défaut : **5500**
- Configuration : `server.js` (ligne 29)
- Doit correspondre à : `public/js/config/server-config.js`

### Firebase (optionnel)
Les warnings Firebase en développement local sont **normaux** :
```
⚠️ Firebase non configuré — tests sans persistence.
```

## 📝 Règles du jeu

1. **🎯 OBJECTIF** : Un imposteur se cache parmi vous. Trouvez-le.
2. **✍️ INDICES** : Donnez un mot-clé subtil pour prouver votre identité.
3. **🗳️ VOTE** : Inspectez les cartes et éliminez le menteur.

## 🐛 Dépannage

### Impossible de créer un salon

**Problème** : Erreurs WebSocket ou "Impossible de se connecter au serveur"

**Solution** :
1. Vérifiez que le serveur est démarré (`node server.js`)
2. Vérifiez le port dans la console (doit afficher "port 5500")
3. **Videz le cache du navigateur : Ctrl + F5** (Windows/Linux) ou **Cmd + Shift + R** (Mac)
4. Ouvrez la console du navigateur (F12) pour voir les logs de connexion

### Connexion WebSocket échoue

**Problème** : `WebSocket connection to 'ws://ton-nom-de-projet.onrender.com/socket.io' failed`

**Solution** :
- Le fichier `public/js/config/server-config.js` a été corrigé pour utiliser `localhost:5500`
- **Videz OBLIGATOIREMENT le cache : Ctrl + F5**
- Le navigateur garde l'ancien fichier en cache
- **Page de test disponible** : http://localhost:5500/test-config.html

### Page de test de configuration

Accédez à **http://localhost:5500/test-config.html** pour :
- ✅ Vérifier que la configuration est correcte
- 🗑️ Vider le cache facilement
- 🔍 Diagnostiquer les problèmes de connexion

### Cache du navigateur

**RÈGLE D'OR** : Après toute modification de `server-config.js`, videz le cache :
- Windows/Linux : **Ctrl + F5** ou **Ctrl + Shift + R**
- Mac : **Cmd + Shift + R**
- Ou ouvrez les DevTools (F12) → Network → Cochez "Disable cache"

## 🏗️ Architecture

```
hint-or-lie-main/
├── server.js                 # Serveur Node.js (port 5500)
├── public/                   # Frontend
│   ├── index.html
│   ├── js/
│   │   ├── config/
│   │   │   └── server-config.js  # Configuration URL serveur
│   │   ├── core/            # Modules principaux
│   │   ├── features/        # Fonctionnalités du jeu
│   │   └── dev/             # Outils de développement
│   └── css/                 # Styles
├── routes/                  # Routes et logique serveur
│   └── sockets/            # Gestion Socket.io
└── config/                 # Configuration Firebase (optionnel)
```

## 📱 Version mobile

Le projet supporte Capacitor pour Android/iOS.
Voir [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md) pour les instructions.

## 🚀 Déploiement en production

Pour déployer sur Render, Heroku ou autre plateforme :
Voir [DEPLOYMENT.md](DEPLOYMENT.md) pour le guide complet.

**Résumé rapide** :
1. Déployez sur Render (gratuit)
2. Render vous donnera une URL : `https://hint-or-lie-xxxx.onrender.com`
3. Mettez à jour cette URL dans `public/js/config/server-config.js`
4. Commitez et poussez → Render redéploie automatiquement ✅

⚠️ **Important** : Les pushs sur `main` redémarrent le serveur et déconnectent les joueurs.  
Voir [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) pour gérer les mises à jour sans interrompre les parties.

## 🔄 Gestion des versions

**Question importante** : "Si je push du code, est-ce que ça coupe les parties en cours ?"

Réponse détaillée dans [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) :
- ✅ Serveurs locaux : Jamais affectés par vos pushs
- ⚠️ Production (auto-deploy ON) : Redémarrage à chaque push sur `main`
- ✅ Production (auto-deploy OFF) : Push sans impact, déploiement manuel

**Recommandation** : Utilisez une branche `dev` pour le développement, mergez vers `main` pendant les heures creuses.

### 📦 Mises à jour pour développeurs locaux

Les installations locales **ne se mettent PAS à jour automatiquement**. Voir [LOCAL_UPDATES.md](LOCAL_UPDATES.md).

**🔔 NOUVEAU : Système de notification automatique**
- Les utilisateurs locaux sont **automatiquement notifiés** quand une nouvelle version est disponible
- Notification avec bouton de mise à jour en un clic
- Vérification de compatibilité automatique
- Voir [VERSION_SYSTEM.md](VERSION_SYSTEM.md) pour les détails

**Pour mettre à jour votre installation locale** :
```bash
npm run update
# Ou manuellement :
# git pull origin main && npm install && npm start
```

**Vérifier si des mises à jour sont disponibles** :
```bash
npm run version:check
```

**Historique des versions** : Voir [CHANGELOG.md](CHANGELOG.md)

## 🔒 Sécurité et Configuration

- ✅ Les clés Firebase sont dans `.gitignore` (ne seront jamais sur GitHub)
- ✅ Le mode développement est automatique sur `localhost`
- ✅ Le mode production nécessite de configurer l'URL dans `server-config.js`
- ✅ Variables d'environnement documentées dans `.env.example`

---

**Développé avec ❤️ par Mits**
