# 🚀 Guide de Déploiement

Ce guide explique comment déployer Hint or Lie en production (Render, Heroku, etc.).

## 📋 Checklist avant déploiement

- [ ] Node.js 16+ installé
- [ ] Compte Render/Heroku créé
- [ ] Repository GitHub configuré
- [ ] Firebase configuré (optionnel pour la persistance)

## 🌐 Déploiement sur Render

### 1. Créer un compte Render
Allez sur [render.com](https://render.com) et créez un compte gratuit.

### 2. Créer un nouveau Web Service

1. Cliquez sur "New +" → "Web Service"
2. Connectez votre repository GitHub
3. Configurez :
   - **Name** : `hint-or-lie` (ou votre nom)
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : Free (gratuit)

### 3. Variables d'environnement

Dans l'onglet "Environment" de Render, ajoutez :

```
PORT=5500
NODE_ENV=production
```

### 4. Configurer l'URL de production

Une fois déployé, Render vous donnera une URL comme :
`https://hint-or-lie-xxxx.onrender.com`

**RÈGLE D'OR** : Mettez à jour cette URL dans votre code :

1. Ouvrez `public/js/config/server-config.js`
2. Remplacez :
   ```javascript
   production: 'https://ton-nom-de-projet.onrender.com'
   ```
   Par votre vraie URL :
   ```javascript
   production: 'https://hint-or-lie-xxxx.onrender.com'
   ```
3. Commitez et poussez sur GitHub
4. Render redéploiera automatiquement

## 🔥 Configuration Firebase (Optionnel)

La persistance des scores nécessite Firebase Admin SDK.

### 1. Créer un projet Firebase

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com)
2. Créez un nouveau projet
3. Activez Firestore Database

### 2. Générer la clé de service

1. Project Settings → Service Accounts
2. Cliquez "Generate new private key"
3. Téléchargez le fichier JSON

### 3. Configuration locale

Renommez le fichier téléchargé en `firebase-service-account.json` et placez-le dans le dossier `config/`.

⚠️ **Ce fichier ne doit JAMAIS être commité sur GitHub !** (déjà dans `.gitignore`)

### 4. Configuration sur Render

Dans l'onglet "Environment" de Render, ajoutez le contenu du fichier JSON comme variable :

```
FIREBASE_CONFIG={"type":"service_account","project_id":"...tout le contenu du JSON...}
```

Puis modifiez `config/firebase.js` pour lire depuis la variable d'environnement en production.

## 🧪 Tester le déploiement

1. Ouvrez votre URL Render : `https://hint-or-lie-xxxx.onrender.com`
2. Vérifiez que la page se charge
3. Ouvrez la console (F12) → vérifiez les logs
4. Créez un salon de test
5. Ouvrez un onglet en navigation privée et rejoignez le salon

## 🐛 Dépannage Production

### Le serveur ne démarre pas

**Vérifiez les logs** dans le dashboard Render :
- Erreur de port ? → Vérifiez que `PORT` est bien configuré
- Erreur de dépendances ? → Relancez le build

### Les clients ne peuvent pas se connecter

**Vérifiez** :
1. L'URL dans `server-config.js` correspond à votre URL Render
2. Le protocole HTTPS est bien utilisé (pas HTTP)
3. Les WebSocket fonctionnent (Render les supporte par défaut)

### Firebase ne fonctionne pas

**Vérifiez** :
1. La variable `FIREBASE_CONFIG` est bien configurée
2. Les règles Firestore permettent les écritures
3. Les logs serveur pour voir les erreurs Firebase

## 💰 Plan gratuit Render

⚠️ **Limitations du plan gratuit** :
- Le serveur s'endort après 15 minutes d'inactivité
- Le premier joueur attendra ~30 secondes (réveil du serveur)
- 750 heures gratuites par mois

**Solution** : Utilisez un service comme [UptimeRobot](https://uptimerobot.com) pour ping votre serveur toutes les 5 minutes.

## 📱 Déploiement mobile (Capacitor)

Voir le fichier `CAPACITOR_SETUP.md` pour les instructions de build Android/iOS.

## 🔄 Mise à jour et Gestion des Parties en Cours

### ⚠️ RÈGLE D'OR : Comprendre l'impact des mises à jour

Quand vous poussez du code sur GitHub avec Render configuré en **auto-deploy** :

1. **Render détecte le push** → Lance un nouveau build
2. **Le serveur redémarre** → **TOUTES les parties en cours sont interrompues** ❌
3. **Les joueurs sont déconnectés** → Doivent se reconnecter

### 🎯 Stratégies selon le contexte

#### Développement / Tests (peu de joueurs)
```bash
git add .
git commit -m "Mise à jour du jeu"
git push origin main
```
Render redéploiera automatiquement (délai ~2-3 min).

#### Production (beaucoup de joueurs actifs)

**Option 1 : Désactiver l'auto-deploy** (recommandé)
1. Dans le dashboard Render → Settings
2. Désactivez "Auto-Deploy"
3. Poussez vos modifications sur GitHub
4. Déployez manuellement quand c'est calme (nuit, maintenance programmée)

**Option 2 : Utiliser les branches**
```bash
# Développement sur branche dev
git checkout -b dev
git add .
git commit -m "Nouvelles fonctionnalités"
git push origin dev

# Merge vers main uniquement pendant les heures creuses
git checkout main
git merge dev
git push origin main  # ← Redéploiement ici
```

**Option 3 : Message de maintenance**
Avant de push, ajoutez un système d'alerte :
```javascript
// Dans server.js, avant le redémarrage
io.emit('serverMaintenance', { 
  message: 'Mise à jour dans 2 minutes. Terminez vos parties !',
  countdown: 120 
});
```

### 📊 Impact sur les joueurs

| Scénario | Impact |
|----------|--------|
| **Push GitHub (auto-deploy ON)** | ❌ Parties coupées, déconnexion immédiate |
| **Push GitHub (auto-deploy OFF)** | ✅ Aucun impact, joueurs continuent |
| **Deploy manuel Render** | ❌ Parties coupées lors du déploiement |
| **Serveur en veille (15 min inactivité)** | ⚠️ Premier joueur attend 30s le réveil |

### 🛡️ Protection des parties en cours

**Ce qui est préservé** :
- ❌ État du jeu (perdu au redémarrage)
- ❌ Parties en cours (interrompues)
- ✅ Scores persistés dans Firebase (si configuré)
- ✅ Statistiques joueurs dans Firebase

**Solution recommandée** : 
- Utilisez Firebase pour la persistance des scores
- Déployez pendant les heures creuses (2h-6h du matin)
- Prévenez les joueurs réguliers (Discord, Twitter, etc.)

### 🔔 Bonne pratique de mise à jour

```bash
# 1. Testez localement
npm start  # Vérifiez que tout fonctionne

# 2. Créez une branche
git checkout -b hotfix-v1.2

# 3. Commitez
git add .
git commit -m "Fix: Correction bug scoreboard"

# 4. Poussez sur la branche
git push origin hotfix-v1.2

# 5. Testez sur un environnement de staging (optionnel)

# 6. Merge vers main pendant heures creuses
git checkout main
git merge hotfix-v1.2
git push origin main  # ← Redéploiement production ici
```

---

**Questions ?** Ouvrez une issue sur GitHub ou consultez la [documentation Render](https://render.com/docs).
