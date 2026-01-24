const fs = require('fs');
const path = require('path');

const dirsToScan = ['public', 'routes', 'config', 'utils'];
let output = "STRUCTURE DU PROJET HINT OR LIE\n\n";
let fileCount = 0;

function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') scan(fullPath);
        } else {
            console.log(`📖 Lecture de : ${fullPath}`); // Ça va s'afficher dans ton terminal
            const content = fs.readFileSync(fullPath, 'utf8');
            output += `--- FICHIER : ${fullPath} ---\n${content}\n\n`;
            fileCount++;
        }
    });
}

console.log("🚀 Lancement du scan des fichiers...");
dirsToScan.forEach(d => scan(d));

fs.writeFileSync('CONTEXTE_PROJET.txt', output);
console.log(`\n✅ Terminé ! ${fileCount} fichiers ont été regroupés.`);
console.log("👉 Regarde maintenant dans ta barre latérale VS Code : CONTEXTE_PROJET.txt est là !");