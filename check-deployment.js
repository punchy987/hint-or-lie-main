#!/usr/bin/env node

/**
 * Script de vérification avant commit/déploiement
 * Vérifie que le projet est prêt pour GitHub et le déploiement
 * 
 * Usage : node check-deployment.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification du projet Hint or Lie...\n');

let errors = 0;
let warnings = 0;

// Vérifier que les fichiers critiques existent
const criticalFiles = [
    'server.js',
    'package.json',
    'public/index.html',
    'public/js/config/server-config.js',
    'README.md',
    'DEPLOYMENT.md',
    '.gitignore'
];

console.log('📁 Fichiers critiques :');
criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MANQUANT`);
        errors++;
    }
});

// Vérifier .gitignore
console.log('\n🔒 Sécurité (.gitignore) :');
const gitignorePath = '.gitignore';
if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    
    const requiredIgnores = [
        'node_modules',
        '.env',
        'firebase-service-account.json'
    ];
    
    requiredIgnores.forEach(pattern => {
        if (gitignore.includes(pattern)) {
            console.log(`  ✅ ${pattern} est ignoré`);
        } else {
            console.log(`  ⚠️  ${pattern} devrait être dans .gitignore`);
            warnings++;
        }
    });
}

// Vérifier node_modules
console.log('\n📦 Dépendances :');
if (fs.existsSync('node_modules')) {
    console.log('  ✅ node_modules présent (dépendances installées)');
} else {
    console.log('  ⚠️  node_modules absent - Lancez "npm install"');
    warnings++;
}

// Vérifier la configuration serveur
console.log('\n⚙️  Configuration serveur :');
const serverConfigPath = 'public/js/config/server-config.js';
if (fs.existsSync(serverConfigPath)) {
    const serverConfig = fs.readFileSync(serverConfigPath, 'utf8');
    
    if (serverConfig.includes('ton-nom-de-projet.onrender.com')) {
        console.log('  ⚠️  URL de production non configurée (placeholder détecté)');
        console.log('     → OK pour développement local');
        console.log('     → Configurez avant déploiement production');
    } else {
        console.log('  ✅ URL de production configurée');
    }
    
    if (serverConfig.includes('localhost:5500')) {
        console.log('  ✅ Port développement : 5500');
    } else {
        console.log('  ⚠️  Port développement modifié');
        warnings++;
    }
}

// Vérifier server.js
console.log('\n🖥️  Serveur :');
const serverPath = 'server.js';
if (fs.existsSync(serverPath)) {
    const server = fs.readFileSync(serverPath, 'utf8');
    const portMatch = server.match(/PORT\s*=\s*process\.env\.PORT\s*\|\|\s*(\d+)/);
    if (portMatch) {
        console.log(`  ✅ Port par défaut : ${portMatch[1]}`);
    }
}

// Vérifier Firebase (optionnel)
console.log('\n🔥 Firebase (optionnel) :');
const firebaseConfigPath = 'config/firebase-service-account.json';
if (fs.existsSync(firebaseConfigPath)) {
    console.log('  ✅ Clé Firebase présente');
    console.log('  ⚠️  ATTENTION : Ne commitez JAMAIS ce fichier !');
    
    // Vérifier qu'il est bien dans .gitignore
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (!gitignore.includes('firebase-service-account.json')) {
        console.log('  ❌ CRITIQUE : firebase-service-account.json doit être dans .gitignore !');
        errors++;
    }
} else {
    console.log('  ℹ️  Pas de clé Firebase configurée');
    console.log('     → OK pour tests sans persistance');
}

// Résumé
console.log('\n' + '='.repeat(60));
console.log('📊 RÉSUMÉ');
console.log('='.repeat(60));

if (errors === 0 && warnings === 0) {
    console.log('✅ TOUT EST BON !');
    console.log('\n✨ Le projet est prêt pour :');
    console.log('   • Commit sur GitHub');
    console.log('   • Téléchargement par d\'autres développeurs');
    console.log('   • Déploiement en production (après config de l\'URL)');
} else {
    if (errors > 0) {
        console.log(`❌ ${errors} erreur(s) critique(s)`);
    }
    if (warnings > 0) {
        console.log(`⚠️  ${warnings} avertissement(s)`);
    }
    
    console.log('\n📝 Actions recommandées :');
    if (warnings > 0 && !fs.existsSync('node_modules')) {
        console.log('   • Lancez "npm install" pour installer les dépendances');
    }
    if (errors > 0) {
        console.log('   • Corrigez les erreurs critiques avant de continuer');
    }
}

console.log('\n📚 Documentation :');
console.log('   • Installation : README.md');
console.log('   • Déploiement : DEPLOYMENT.md');
console.log('   • Mobile : CAPACITOR_SETUP.md');

console.log('\n🚀 Pour tester localement :');
console.log('   npm start');
console.log('   → http://localhost:5500');
console.log('   → http://localhost:5500/test-config.html (page de diagnostic)');

process.exit(errors > 0 ? 1 : 0);
