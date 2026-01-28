# 🎮 Guide : Gestion des Versions et Mises à Jour

## 📌 Réponse à la question : "Les joueurs peuvent-ils continuer à jouer si je ne push pas ?"

### Résumé rapide : **OUI, mais ça dépend du scénario** ✅

---

## 🌍 Les 3 types d'instances

### 1. **Serveur Local (Développement)**
👤 **Qui** : Vous sur votre ordinateur  
🔌 **Connexion** : `http://localhost:5500`  
💡 **Impact de vos pushs GitHub** : **AUCUN**

**Exemple** :
- Vous lancez `npm start` sur votre PC
- Vos amis se connectent à votre IP locale
- Vous poussez du code sur GitHub
- ❌ → Aucun effet sur votre serveur local
- ✅ → Les parties continuent normalement

---

### 2. **Serveur Local d'un autre développeur**
👤 **Qui** : Quelqu'un qui a téléchargé votre projet depuis GitHub  
🔌 **Connexion** : Son propre `localhost:5500`  
💡 **Impact de vos pushs GitHub** : **AUCUN (jusqu'à ce qu'il pull)**

**Exemple** :
- Marie télécharge votre jeu depuis GitHub
- Elle lance `npm start` sur son PC
- Ses amis jouent sur son serveur local
- Vous poussez 10 patchs sur GitHub
- ❌ → Aucun effet sur le serveur de Marie
- ✅ → Elle continue à jouer sur sa version actuelle
- ⚠️ → Elle devra faire `git pull` pour avoir vos nouveautés

**Instances indépendantes** : Chaque `npm start` = nouveau serveur isolé

---

### 3. **Serveur Production (Render/Heroku)** ⚠️
👤 **Qui** : Tout le monde via Internet  
🔌 **Connexion** : `https://hint-or-lie-xxxx.onrender.com`  
💡 **Impact de vos pushs GitHub** : **REDÉMARRAGE SI AUTO-DEPLOY ACTIVÉ**

**Scénario A : Auto-Deploy ACTIVÉ (par défaut)** 🔴
```
1. Des joueurs sont en partie sur https://hint-or-lie-xxxx.onrender.com
2. Vous poussez du code : git push origin main
3. Render détecte le push → lance un nouveau build
4. ❌ Le serveur redémarre (2-3 minutes)
5. 🔌 TOUS les joueurs sont déconnectés
6. ⚠️ Les parties en cours sont perdues
7. ✅ Une fois le redéploiement terminé, les joueurs peuvent se reconnecter
```

**Scénario B : Auto-Deploy DÉSACTIVÉ** 🟢
```
1. Des joueurs sont en partie sur https://hint-or-lie-xxxx.onrender.com
2. Vous poussez du code : git push origin main
3. ✅ Le serveur continue de tourner
4. ✅ Les parties continuent normalement
5. ✅ Les joueurs ne sont PAS affectés
6. ℹ️ Pour déployer, vous devez cliquer manuellement sur "Deploy" dans Render
```

---

## 🎯 Réponse à votre question

### Version actuelle et patchs

| Type de serveur | Tant que vous ne push pas | Quand vous push |
|----------------|---------------------------|-----------------|
| **Votre serveur local** | ✅ Stable | ✅ Pas d'impact (il faut redémarrer manuellement) |
| **Serveur local d'autres dev** | ✅ Stable | ✅ Pas d'impact (ils doivent `git pull` + redémarrer) |
| **Production (auto-deploy ON)** | ✅ Stable | ❌ **REDÉMARRE** → Joueurs déconnectés |
| **Production (auto-deploy OFF)** | ✅ Stable | ✅ Pas d'impact tant que vous ne cliquez pas "Deploy" |

### En pratique

**Si vous déployez en production avec auto-deploy** :
- ✅ Les joueurs jouent sur la version stable
- ✅ Vous pouvez push sur une branche `dev` sans impact
- ⚠️ Si vous push sur `main` → redémarrage automatique
- ❌ Les parties en cours sont interrompues

**Recommandation** : Désactivez l'auto-deploy et déployez manuellement pendant les heures creuses

---

## 🛡️ Stratégie recommandée

### Pour le développement continu

```bash
# Créez une branche de développement
git checkout -b dev

# Travaillez sur vos fonctionnalités
git add .
git commit -m "Nouvelle fonctionnalité"
git push origin dev

# Les joueurs en production ne sont PAS affectés ✅

# Quand vous êtes prêt à déployer (heures creuses)
git checkout main
git merge dev
git push origin main  # ← Déploiement ici (si auto-deploy ON)
```

### Pour les hotfix urgents

```bash
# 1. Prévenez les joueurs (si possible)
node utils/maintenance.js "Maintenance dans 5 minutes"

# 2. Attendez 5 minutes que les parties se terminent

# 3. Déployez
git add .
git commit -m "Hotfix: Correction bug critique"
git push origin main
```

---

## 📊 Ce qui est perdu au redémarrage

| Donnée | État | Solution |
|--------|------|----------|
| Parties en cours | ❌ Perdues | Prévoir maintenance programmée |
| Joueurs connectés | ❌ Déconnectés | Se reconnectent automatiquement |
| Scores de la session | ❌ Perdus | ✅ Utiliser Firebase pour persistance |
| Historique total | ✅ Conservé | Si Firebase configuré |
| Configuration | ✅ Conservée | Dans le code/variables d'env |

---

## ✅ Conclusion

**Réponse directe** : 

> **OUI**, tant que vous ne push pas sur la branche principale (`main`) avec l'auto-deploy activé, les joueurs en production continueront à jouer sur la version actuelle sans interruption.

**Mais attention** :
- Chaque `git push origin main` (auto-deploy ON) = redémarrage
- Les serveurs locaux sont totalement isolés et jamais affectés
- Pour le développement, utilisez une branche `dev`
- Pour la production, désactivez l'auto-deploy et déployez manuellement

**Meilleure pratique** :
```bash
# Développement → branche dev
git push origin dev  # ← Pas d'impact production ✅

# Production → merge pendant heures creuses
git push origin main  # ← Impact production ⚠️
```

---

**Questions ?** Voir [DEPLOYMENT.md](DEPLOYMENT.md) pour plus de détails.
