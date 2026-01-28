# Configuration Mobile - Capacitor

## Structure Ajoutée

### Fichiers de configuration
- `capacitor.config.json` - Configuration Capacitor principale
- `public/js/config/server-config.js` - Configuration URL serveur

### Dossiers natifs
- `android/` - Projet Android natif
- `ios/` - Projet iOS natif (Xcode)

## Modifications Apportées

### 1. index.html
- Ajout de la référence au fichier de configuration serveur

### 2. socket.js
- Configuration dynamique de l'URL du serveur
- Support pour les applications mobiles via Capacitor

## Configuration du Serveur

Éditez `public/js/config/server-config.js` :

```javascript
const SERVER_CONFIG = {
  development: 'http://localhost:5500',
  production: 'https://votre-serveur.com', // ⚠️ À modifier
  environment: 'development' // Changez à 'production' lors du déploiement
};
```

## Prochaines Étapes

### Pour Android
```bash
npx cap sync android
npx cap open android
```

### Pour iOS (nécessite macOS)
```bash
npx cap sync ios
npx cap open ios
```

### Synchroniser après modifications web
```bash
npx cap sync
```

## Notes Importantes

1. **Design Préservé** : Aucun fichier CSS/JS existant n'a été modifié (design Tactile Arcade Premium intact)
2. **Configuration Flexible** : L'URL du serveur est externalisée et facilement modifiable
3. **Auto-détection** : L'app détecte automatiquement si elle tourne sur mobile ou web
4. **Compatibilité** : Socket.io fonctionne en websocket avec fallback sur polling

## CI/CD - GitHub Actions

Un workflow automatique a été configuré dans [.github/workflows/android-build.yml](.github/workflows/android-build.yml)

### Déclenchement du build
- Push sur branches `main` ou `master`
- Pull requests
- Manuellement via l'onglet "Actions" sur GitHub

### Récupération de l'APK
Après chaque build réussi, téléchargez l'APK depuis les **Artifacts** de la run GitHub (conservé 30 jours).

## Déploiement Production

Avant de builder pour production :

1. Changez `environment: 'production'` dans `server-config.js`
2. Mettez à jour l'URL de production avec votre serveur déployé
3. Lancez `npx cap sync` pour copier les assets
4. Buildez depuis Android Studio ou Xcode
