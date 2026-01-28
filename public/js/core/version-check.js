// public/js/core/version-check.js
/**
 * Système de vérification de version
 * RÈGLE D'OR : Informe l'utilisateur si une mise à jour est disponible
 * et si sa version est compatible avec le serveur
 */

(function() {
  window.HOL = window.HOL || {};
  
  const CLIENT_VERSION = '1.0.1'; // Version du client (à synchroniser avec package.json)
  
  /**
   * Compare deux versions (format semver: x.y.z)
   * @returns {number} -1 si v1 < v2, 0 si égales, 1 si v1 > v2
   */
  function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
  }
  
  /**
   * Vérifie si deux versions sont compatibles
   * Compatible si même version majeure (x.y.z -> x doit être identique)
   */
  function isCompatible(clientVersion, serverVersion) {
    const clientMajor = clientVersion.split('.')[0];
    const serverMajor = serverVersion.split('.')[0];
    return clientMajor === serverMajor;
  }
  
  /**
   * Affiche une notification de mise à jour
   */
  function showUpdateNotification(serverVersion, isRequired = false) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay version-update-modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
    
    const severity = isRequired ? 'critique' : 'recommandée';
    const icon = isRequired ? '🚨' : '🆕';
    const title = isRequired ? 'Mise à jour requise' : 'Mise à jour disponible';
    const message = isRequired 
      ? `Votre version (${CLIENT_VERSION}) n'est plus compatible avec le serveur (${serverVersion}). Vous devez mettre à jour pour continuer à jouer.`
      : `Une nouvelle version (${serverVersion}) est disponible. Votre version actuelle (${CLIENT_VERSION}) fonctionne encore, mais nous recommandons la mise à jour.`;
    
    modal.innerHTML = `
      <div class="box panel version-update-panel">
        <div class="version-update-header">
          <span class="version-icon">${icon}</span>
          <h2>${title}</h2>
        </div>
        <div class="version-update-body">
          <p class="version-message">${message}</p>
          <div class="version-info">
            <div class="version-row">
              <span class="version-label">Version actuelle :</span>
              <code class="version-code">${CLIENT_VERSION}</code>
            </div>
            <div class="version-row">
              <span class="version-label">Version serveur :</span>
              <code class="version-code version-new">${serverVersion}</code>
            </div>
          </div>
          <div class="version-actions">
            ${isRequired ? `
              <a href="https://github.com/[votre-username]/hint-or-lie" 
                 class="btn btn-primary btn-update" 
                 target="_blank" 
                 rel="noopener">
                📥 Télécharger la mise à jour
              </a>
              <p class="version-instructions">
                1. Arrêtez le serveur (Ctrl+C)<br>
                2. Téléchargez depuis GitHub<br>
                3. Lancez : <code>npm run update</code>
              </p>
            ` : `
              <button class="btn btn-primary btn-update" onclick="window.updateApp()">
                🔄 Mettre à jour maintenant
              </button>
              <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                ⏳ Plus tard
              </button>
              <p class="version-note">
                Vous pourrez continuer à jouer avec la version actuelle, 
                mais certaines fonctionnalités peuvent être limitées.
              </p>
            `}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Bloquer les actions si mise à jour requise
    if (isRequired) {
      // Désactiver les boutons de création/rejoindre
      const btns = ['btn-create', 'btn-join'];
      btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.disabled = true;
          btn.title = 'Mise à jour requise';
        }
      });
    }
  }
  
  /**
   * Fonction globale pour mettre à jour l'app
   */
  window.updateApp = function() {
    const instructions = `
╔════════════════════════════════════════════╗
║     🔄 MISE À JOUR DE L'APPLICATION        ║
╚════════════════════════════════════════════╝

📝 Instructions dans le terminal :

1️⃣  Arrêtez le serveur actuel :
    Ctrl + C

2️⃣  Mettez à jour le code :
    npm run update
    
    OU manuellement :
    git pull origin main
    npm install

3️⃣  Redémarrez le serveur :
    npm start

⏱️  Durée estimée : 1-2 minutes

✅ Après le redémarrage, actualisez cette page (F5)
`;
    
    console.log(instructions);
    
    if (window.HOL.toast) {
      window.HOL.toast('📋 Instructions affichées dans la console (F12)', 5000);
    }
    
    // Ouvrir la console automatiquement (si possible)
    setTimeout(() => {
      alert('Instructions de mise à jour affichées dans la console.\n\nAppuyez sur F12 pour voir les détails.');
    }, 500);
  };
  
  /**
   * Vérifie la version auprès du serveur
   */
  function checkVersion() {
    const socket = window.HOL?.socket;
    if (!socket) {
      console.warn('[VersionCheck] Socket non disponible, vérification différée');
      return;
    }
    
    // Envoyer la version du client au serveur
    socket.emit('clientVersion', { version: CLIENT_VERSION });
    
    // Écouter la réponse du serveur
    socket.on('versionCheck', (data) => {
      const { serverVersion, minVersion, latestVersion } = data;
      
      console.log('[VersionCheck] Client:', CLIENT_VERSION);
      console.log('[VersionCheck] Serveur:', serverVersion);
      console.log('[VersionCheck] Min requise:', minVersion);
      console.log('[VersionCheck] Dernière:', latestVersion);
      
      // Vérifier la compatibilité
      const isOutdated = compareVersions(CLIENT_VERSION, minVersion) < 0;
      const updateAvailable = compareVersions(CLIENT_VERSION, latestVersion) < 0;
      
      if (isOutdated) {
        // Version trop ancienne, mise à jour REQUISE
        console.error('[VersionCheck] ❌ Version incompatible !');
        showUpdateNotification(latestVersion, true);
      } else if (updateAvailable) {
        // Nouvelle version disponible, mise à jour RECOMMANDÉE
        console.warn('[VersionCheck] ⚠️ Mise à jour disponible');
        showUpdateNotification(latestVersion, false);
      } else {
        // Version à jour
        console.log('[VersionCheck] ✅ Version à jour');
      }
    });
  }
  
  // Exporter
  window.HOL.versionCheck = {
    CLIENT_VERSION,
    compareVersions,
    isCompatible,
    checkVersion
  };
  
  // Lancer la vérification au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkVersion, 2000); // Délai pour laisser socket se connecter
    });
  } else {
    setTimeout(checkVersion, 2000);
  }
  
  console.log('[VersionCheck] Système de vérification initialisé - Version:', CLIENT_VERSION);
})();
