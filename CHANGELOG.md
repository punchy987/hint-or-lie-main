# 📝 Changelog - Hint or Lie

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

## [Non publié]

### Ajouté
- Rien pour le moment

---

## [1.0.1] - 2026-01-27

### 🔧 Correctifs

#### Configuration production
- ✅ **Fix critique** : URL de production Render configurée (`hint-or-lie.onrender.com`)
- ✅ Port 5500 unifié dans tous les fichiers de configuration
- ✅ Correction détection environnement pour déploiement Render

**Impact** : Ce correctif permet la connexion WebSocket sur le serveur de production. Les utilisateurs en v1.0.0 recevront une notification de mise à jour recommandée.

---

## [1.0.0] - 2026-01-27

### 🎉 Version initiale complète

#### ✨ Fonctionnalités principales
- Jeu multijoueur de déduction sociale
- Système de salons avec codes à 4 chiffres
- 3 phases de jeu : Indices → Vote → Résultats
- Rôles : Équipage vs Imposteur
- Scoreboard en temps réel avec animations
- Système de réactions emoji en direct
- Support multi-plateformes (Web + Mobile via Capacitor)

#### 🎨 Interface utilisateur
- Design arcade moderne avec effets néon
- Animations fluides et transitions
- Scoreboard coulissant avec poignée interactive
- Panneau de réactions latéral
- LEDs de statut pour les joueurs
- Responsive mobile et desktop

#### ⚙️ Technique
- Socket.io pour la communication temps réel
- Firebase Admin SDK pour la persistance (optionnel)
- Express.js pour le serveur
- Configuration serveur externalisée pour mobile
- Support du cache busting
- Page de diagnostic de configuration
- Script de vérification du déploiement

#### 📚 Documentation
- README.md complet avec installation
- DEPLOYMENT.md pour le déploiement production
- VERSION_MANAGEMENT.md pour gérer les mises à jour
- LOCAL_UPDATES.md pour les développeurs locaux
- CAPACITOR_SETUP.md pour le mobile
- .env.example pour les variables d'environnement

#### 🔧 Outils développeur
- check-deployment.js : Script de vérification
- test-config.html : Page de diagnostic
- guard.js : Système de logging pour debug
- maintenance.js : Script de notification

#### 🔒 Sécurité
- Clés Firebase dans .gitignore
- Validation des entrées utilisateur
- Gestion des déconnexions
- Protection contre les salons vides

---

## Format du Changelog

Ce changelog suit le format [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

### Types de changements
- **Ajouté** : pour les nouvelles fonctionnalités
- **Modifié** : pour les changements aux fonctionnalités existantes
- **Déprécié** : pour les fonctionnalités bientôt supprimées
- **Supprimé** : pour les fonctionnalités supprimées
- **Corrigé** : pour les corrections de bugs
- **Sécurité** : en cas de vulnérabilités

---

## Guide de mise à jour

Pour mettre à jour votre installation locale vers la dernière version :

```bash
# 1. Sauvegarder vos modifications locales (si nécessaire)
git stash

# 2. Récupérer la dernière version
git pull origin main

# 3. Installer les nouvelles dépendances
npm install

# 4. Restaurer vos modifications (si nécessaire)
git stash pop

# 5. Redémarrer le serveur
npm start
```

---

**Prochaines versions prévues** :

- [ ] v1.1.0 : Système de badges et achievements
- [ ] v1.2.0 : Mode tournoi avec classements
- [ ] v1.3.0 : Thèmes personnalisables
- [ ] v2.0.0 : Mode spectateur amélioré
