# 🎮 Hint or Lie

Jeu multijoueur de déduction sociale - trouvez l'imposteur parmi vous !

## 🚀 Démarrage rapide

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
3. Actualisez la page du navigateur
4. Ouvrez la console du navigateur (F12) pour voir les logs de connexion

### Connexion WebSocket échoue

**Problème** : `WebSocket connection to 'ws://ton-nom-de-projet.onrender.com/socket.io' failed`

**Solution** :
- Le fichier `public/js/config/server-config.js` a été corrigé pour utiliser `localhost:5500`
- Actualisez la page avec **Ctrl + F5** (vider le cache)

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
Voir `CAPACITOR_SETUP.md` pour les instructions.

---

**Développé avec ❤️ par Mits**
