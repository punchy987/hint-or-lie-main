# 🎯 HIÉRARCHIE Z-INDEX - Hint or Lie

## 📊 VUE D'ENSEMBLE

Voici la hiérarchie complète des z-index pour éviter les conflits d'affichage :

```
COUCHE 0 - Arrière-plan
├─ -1    : Éléments décoratifs (background, spectator hints)

COUCHE 1 - Contenu principal
├─ 50    : Bouton confirmation vote (phase vote)
├─ 100   : Cartes de vote en preview, bouton quit-to-lobby
├─ 200   : Bouton confirmation vote (actif)

COUCHE 2 - HUD (Heads-Up Display)
├─ 1000  : HUD bottom
├─ 1200  : HUD top, Scoreboard panel, Phase indicator
├─ 1300  : HUD toast (notifications temporaires)
├─ 1400  : Messages spectateur

COUCHE 3 - Modals et overlays
├─ 1500  : Spectator modal/overlay

COUCHE 4 - Notifications système
├─ 8888  : Lobby header (code salon)
├─ 9999  : Update banner (PWA)
├─ 10000 : Toast global (système de notifications)

COUCHE 5 - Réactions et interactions
├─ 20000 : Réactions (triggers + display area)
```

---

## 🔍 DÉTAILS PAR ÉLÉMENT

### 🎮 ÉLÉMENTS DE JEU
| Élément | Z-Index | Fichier | Position |
|---------|---------|---------|----------|
| Background decorative | -1 | 02-base.css | Arrière-plan |
| Spectator hints background | -1 | 09-spectator.css | Arrière-plan |
| Vote confirmation button | 50 → 200 | 06-vote.css | Avant-plan jeu |
| Vote card preview | 100 | 06-vote.css | Avant-plan jeu |
| Quit to lobby button | 100 | 03-components.css | Coin supérieur |

### 📊 HUD (Interface permanente)
| Élément | Z-Index | Fichier | Position |
|---------|---------|---------|----------|
| HUD bottom | 1000 | hud.css | Bas d'écran |
| HUD top | 1200 | hud.css | Haut d'écran |
| Scoreboard panel | 1200 | 07-scoreboard.css | Bas (coulissant) |
| Phase indicator | 1200 | 04-phase.css | Haut centre |
| HUD toast | 1300 | hud.css | Temporaire |
| Spectator message | 1400 | 09-spectator.css | Centre |

### 🔔 NOTIFICATIONS
| Élément | Z-Index | Fichier | Position |
|---------|---------|---------|----------|
| Spectator overlay | 1500 | 09-spectator.css | Full screen |
| Lobby header | 8888 | 08-lobby-header.css | Haut |
| Update banner (PWA) | 9999 | hud.css | Haut |
| Toast global | 10000 | hud.css | Haut centre |

### 😀 RÉACTIONS
| Élément | Z-Index | Fichier | Position |
|---------|---------|---------|----------|
| #reaction-triggers | 20000 | hud.css | Droite (tiroir) |
| #reaction-display-area | 20000 | hud.css | Gauche (bulles) |

---

## ⚠️ PROBLÈMES IDENTIFIÉS

### ❌ CONFLIT POTENTIEL : Scoreboard vs Bulles

**Problème :**
- Scoreboard : `z-index: 1200` (bas d'écran)
- Bulles : `z-index: 20000` (gauche, animation montante)
- **Les bulles partent du bas (bottom: 50px) et montent**
- **Elles peuvent commencer SOUS le scoreboard !**

**Solution :**
```css
/* Les bulles doivent partir PLUS HAUT que le scoreboard */
.reaction-bubble {
    bottom: 200px !important; /* Au lieu de 50px */
}
```

### ❌ CONFLIT POTENTIEL : Display Area cachée

**Problème :**
- `#reaction-display-area` a `display: none` par défaut
- Le JS le met à `display: block` uniquement dans certains états
- Si le JS ne s'exécute pas correctement, les bulles ne s'affichent pas

**Vérification :**
```javascript
// Dans main.js ligne 40-42
if (reactionDisplayArea) reactionDisplayArea.style.display = 'block';
```

---

## ✅ RÈGLES D'OR

### 1. **Pas de z-index entre 2000 et 19999**
Réservé pour les futurs éléments intermédiaires.

### 2. **Scoreboard toujours en-dessous des réactions**
- Scoreboard : 1200
- Réactions : 20000
- **Garantit que les bulles passent au-dessus**

### 3. **Toast global prioritaire**
- Toast : 10000
- Permet d'afficher les erreurs critiques au-dessus de tout

### 4. **Éléments de jeu sous le HUD**
- Cartes/boutons de jeu : 50-200
- HUD : 1000+
- **Garantit que le HUD reste accessible**

---

## 🐛 DEBUG : Comment tester les bulles

### Console Browser (F12)

```javascript
// 1. Vérifier que le container existe
const displayArea = document.getElementById('reaction-display-area');
console.log('Display area:', displayArea);
console.log('Display:', window.getComputedStyle(displayArea).display);
console.log('Z-index:', window.getComputedStyle(displayArea).zIndex);

// 2. Tester manuellement une bulle
function testBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'reaction-bubble';
    bubble.style.left = '50px';
    bubble.innerHTML = '<div class="reaction-bubble-emoji">😂</div><div class="reaction-bubble-name">Test</div>';
    displayArea.appendChild(bubble);
    console.log('Bulle créée:', bubble);
}
testBubble();

// 3. Vérifier l'animation
const bubble = document.querySelector('.reaction-bubble');
console.log('Animation:', window.getComputedStyle(bubble).animation);
```

### Checklist visuelle

- [ ] `#reaction-display-area` est visible (`display: block`)
- [ ] `z-index: 20000` est appliqué
- [ ] Les bulles sont créées dans le DOM (inspecter l'élément)
- [ ] L'animation `arcade-float-up` est définie
- [ ] Les bulles commencent au-dessus du scoreboard (bottom > hauteur scoreboard)

---

## 🔧 CORRECTIONS À APPLIQUER

### 1. Augmenter le point de départ des bulles

```css
/* public/css/hud.css */
.reaction-bubble {
    bottom: 200px !important; /* Au lieu de 50px */
}
```

### 2. Ajouter un debug visuel temporaire

```css
/* Pour voir la zone de display */
#reaction-display-area {
    /* Temporaire pour debug */
    background: rgba(255, 0, 0, 0.1) !important;
    border: 2px dashed red !important;
}
```

---

*Dernière analyse : 28 janvier 2026*
