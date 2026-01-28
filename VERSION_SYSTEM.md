# 🔄 Système de Gestion des Versions

## ✅ Ce qui est maintenant implémenté

### RÈGLE D'OR : Notification automatique des mises à jour

Le système vérifie automatiquement la compatibilité des versions entre le client et le serveur.

---

## 🎯 Comment ça fonctionne

### 1. À la connexion

Quand un joueur se connecte :

```
Client (v1.0.0) 
    ↓
    Envoie sa version au serveur
    ↓
Serveur (v1.2.0)
    ↓
    Compare les versions
    ↓
    Renvoie les infos :
    - Version serveur actuelle
    - Version minimum requise
    - Dernière version disponible
    ↓
Client affiche une notification SI NÉCESSAIRE
```

### 2. Détection automatique

Le client vérifie :
- ✅ **Version compatible** → Aucune notification, jeu normal
- ⚠️ **Mise à jour disponible** → Notification recommandation
- 🚨 **Version trop ancienne** → Notification obligatoire + blocage des actions

---

## 📊 Types de notifications

### 🆕 Mise à jour RECOMMANDÉE (non bloquante)

**Critères** :
- Version client < Version serveur
- Mais version client ≥ Version minimum

**Affichage** :
```
┌─────────────────────────────────────┐
│ 🆕 Mise à jour disponible           │
├─────────────────────────────────────┤
│ Une nouvelle version (1.2.0) est    │
│ disponible. Votre version actuelle   │
│ (1.0.0) fonctionne encore.          │
│                                     │
│ Version actuelle : 1.0.0            │
│ Version serveur  : 1.2.0  [NOUVEAU]│
│                                     │
│ [🔄 Mettre à jour maintenant]       │
│ [⏳ Plus tard]                       │
└─────────────────────────────────────┘
```

**Actions possibles** :
- ✅ Continuer à jouer
- 🔄 Mettre à jour maintenant
- ⏳ Reporter

### 🚨 Mise à jour REQUISE (bloquante)

**Critères** :
- Version client < Version minimum requise

**Affichage** :
```
┌─────────────────────────────────────┐
│ 🚨 Mise à jour requise              │
├─────────────────────────────────────┤
│ Votre version (0.9.0) n'est plus    │
│ compatible avec le serveur (1.2.0). │
│ Vous DEVEZ mettre à jour.           │
│                                     │
│ Version actuelle : 0.9.0            │
│ Version serveur  : 1.2.0  [NOUVEAU]│
│                                     │
│ [📥 Télécharger la mise à jour]     │
│                                     │
│ Instructions :                       │
│ 1. Arrêtez le serveur (Ctrl+C)     │
│ 2. Téléchargez depuis GitHub        │
│ 3. Lancez : npm run update          │
└─────────────────────────────────────┘
```

**Effets** :
- ❌ Boutons "Créer" et "Rejoindre" désactivés
- ⚠️ Impossible de jouer tant que pas mis à jour

---

## 🔧 Configuration

### Fichier `package.json`

```json
{
  "version": "1.0.0"  ← Version actuelle
}
```

### Fichier `routes/sockets/version.js`

```javascript
const VERSION_CONFIG = {
  current: "1.0.0",    // Version actuelle du serveur
  minimum: "1.0.0",    // Version minimum pour se connecter
  latest: "1.0.0"      // Dernière version disponible
};
```

---

## 📝 Workflow de mise à jour de version

### Scénario : Vous publiez la version 1.1.0

#### Étape 1 : Mettre à jour le code

```bash
# 1. Modifier package.json
{
  "version": "1.1.0"  ← Nouvelle version
}

# 2. Modifier routes/sockets/version.js
const VERSION_CONFIG = {
  current: "1.1.0",   ← Nouvelle version
  minimum: "1.0.0",   ← Garde 1.0.0 si compatible
  latest: "1.1.0"     ← Nouvelle version
};

# 3. Modifier public/js/core/version-check.js
const CLIENT_VERSION = '1.1.0';  ← Nouvelle version

# 4. Modifier public/index.html
<span class="version-badge">v1.1.0</span>  ← Nouvelle version
```

#### Étape 2 : Commit et push

```bash
git add .
git commit -m "Release v1.1.0 - Nouvelles fonctionnalités"
git push origin main
```

#### Étape 3 : Déployer en production

Sur Render :
1. Cliquez sur "Manual Deploy" (auto-deploy désactivé)
2. Attendez le déploiement (2-3 min)
3. Le serveur redémarre avec v1.1.0

#### Étape 4 : Ce qui se passe pour les joueurs

**Joueurs en production (navigateur web)** :
- ✅ Utilisent automatiquement la v1.1.0 (votre serveur)
- ✅ Pas d'action nécessaire

**Développeurs locaux (serveur local)** :
- Se connectent à leur serveur local v1.0.0
- 🔔 **Reçoivent une notification** : "Mise à jour disponible v1.1.0"
- Peuvent choisir :
  - 🔄 Mettre à jour maintenant (`npm run update`)
  - ⏳ Plus tard (continuent sur v1.0.0)

---

## 🎮 Compatibilité multi-version

### Version majeure (x.y.z)

**Exemple** :
- v1.x.x → Compatible entre elles
- v2.x.x → NON compatible avec v1.x.x

**Configuration** :
```javascript
// Si vous passez à v2.0.0 (incompatible)
const VERSION_CONFIG = {
  current: "2.0.0",
  minimum: "2.0.0",  ← Force la v2.0.0 minimum
  latest: "2.0.0"
};
```

Résultat : Les clients v1.x.x verront une notification REQUISE.

### Version mineure/patch (x.y.z)

**Exemple** :
- v1.0.0 → v1.1.0 → Compatible (fonctionnalités ajoutées)
- v1.1.0 → v1.1.1 → Compatible (corrections bugs)

**Configuration** :
```javascript
// Version 1.1.0 avec support v1.0.0
const VERSION_CONFIG = {
  current: "1.1.0",
  minimum: "1.0.0",  ← Accepte encore v1.0.0
  latest: "1.1.0"
};
```

Résultat : Les clients v1.0.0 verront une notification RECOMMANDÉE (non bloquante).

---

## 💡 Scripts npm utiles

```bash
# Pour les développeurs locaux

# Vérifier si des mises à jour sont disponibles
npm run version:check

# Mettre à jour vers la dernière version
npm run update

# Vérifier la version actuelle
npm version
```

---

## 🔔 Notifications aux utilisateurs

### Option 1 : Automatique (implémenté)
- ✅ Notification au lancement du jeu
- ✅ Vérification à chaque connexion
- ✅ Instructions claires de mise à jour

### Option 2 : GitHub Releases
Créez une release sur GitHub :

```bash
git tag v1.1.0
git push origin v1.1.0
```

Les utilisateurs qui "watchent" votre repo reçoivent un email.

### Option 3 : Communication externe
- Discord/Twitter : "v1.1.0 disponible !"
- README.md : Section "Dernières mises à jour"
- CHANGELOG.md : Détails des changements

---

## ✅ Récapitulatif final

| Situation | Notification | Peut jouer ? | Action |
|-----------|-------------|--------------|--------|
| **Version à jour** | ❌ Aucune | ✅ Oui | Aucune |
| **Nouvelle version mineure** | 🆕 Recommandée | ✅ Oui | `npm run update` (facultatif) |
| **Version obsolète** | 🚨 Requise | ❌ Non | `npm run update` (obligatoire) |

---

## 🎯 Avantages du système

✅ **Notification automatique** : Les utilisateurs savent qu'une mise à jour existe  
✅ **Compatibilité vérifiée** : Évite les bugs entre versions  
✅ **Flexibilité** : Mise à jour recommandée vs requise  
✅ **Instructions claires** : Commande `npm run update` facile  
✅ **Contrôle** : Vous décidez quand une version devient incompatible  

---

**En résumé** : Quand vous publiez une nouvelle version, les utilisateurs locaux sont **automatiquement notifiés** avec un lien pour mettre à jour leur app. Pour jouer ensemble, ils devront être sur des versions compatibles ! 🎮✨
