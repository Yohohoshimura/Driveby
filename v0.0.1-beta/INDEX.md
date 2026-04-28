# 📚 BackupDrive - Index complet des fichiers

Guide pour naviguer tous les fichiers du projet BackupDrive v0.0.1-beta.

---

## 🚀 Par où commencer?

### 1️⃣ **Nouveau dans le projet?**
   → Lire: **QUICK_START.md** (5 minutes)

### 2️⃣ **Rencontrez un problème?**
   → Lire: **TROUBLESHOOTING.md** (solutions aux erreurs courantes)

### 3️⃣ **Besoin de documentation complète?**
   → Lire: **README.md** (documentation exhaustive)

### 4️⃣ **Intéressé par les changements?**
   → Lire: **CHANGELOG.md** (historique des versions)

---

## 📁 Structure des fichiers

```
BackupDrive/
├── 📖 DOCUMENTATION
│   ├── README.md             ← Documentation complète (730 lignes)
│   ├── QUICK_START.md        ← Démarrage rapide 5 min
│   ├── TROUBLESHOOTING.md    ← Solutions aux problèmes
│   ├── CHANGELOG.md          ← Historique des versions
│   └── INDEX.md              ← Ce fichier
│
├── 🔧 INSTALLATION
│   ├── INSTALL.bat           ← Installateur Windows (double-cliquez)
│   ├── INSTALL.sh            ← Installateur Mac/Linux (chmod +x)
│   └── package.json          ← Dépendances npm (CORRIGÉ v0.0.1-beta)
│
├── 💻 CODE SOURCE
│   └── src/
│       ├── main.js           ← Processus Electron principal
│       ├── preload.js        ← Preload IPC sécurisé
│       ├── App.jsx           ← Interface React complète
│       └── index.jsx         ← Point d'entrée React
│
├── 🌐 WEB
│   └── public/
│       └── index.html        ← Template HTML
│
└── ⚙️ CONFIGURATION
    ├── electron-builder.json ← Config empaquetage Electron
    ├── .gitignore            ← Fichiers à ignorer Git
    └── .env                  ← Variables d'environnement
```

---

## 📖 Fichiers de documentation

### README.md (20 KB)
**Contenu principal - Documentation exhaustive**

Sections:
- Points forts et features complètes
- Design et UX
- Installation (3 méthodes)
- Structure du projet
- Architecture technique detaillée
- Utilisation pas-à-pas
- Sécurité (Context Isolation, IPC)
- Build & empaquetage
- Développement (ajouter features)
- Améliorations futures (Roadmap)
- Troubleshooting
- Commandes disponibles
- Checklist avant production
- Statistiques du projet

**Quand le lire:** Besoin de la vue d'ensemble complète

---

### QUICK_START.md (5.7 KB)
**Guide de démarrage rapide - 5 minutes**

Sections:
- Corrections apportées (v0.0.1-beta)
- Installation automatique (Windows/Mac/Linux)
- Installation manuelle
- Vérification de l'installation
- Commandes de lancement
- Erreurs courantes et solutions
- Première utilisation de l'app

**Quand le lire:** Première fois, veut démarrer vite

---

### TROUBLESHOOTING.md (4.6 KB)
**Solutions aux problèmes courants**

Sections:
- 10+ erreurs courantes avec solutions
- Processus d'installation étape-par-étape
- Vérification de l'installation
- Logs et débogage
- Problèmes avec git/clone
- Performance
- Support supplémentaire

**Quand le lire:** Rencontrez une erreur

---

### CHANGELOG.md (7.8 KB)
**Historique des versions et changements**

Sections:
- v0.0.1-beta - Corrections de bugs (CRITICAL)
- v0.0.1-beta - Initial Release
- Migration 1.0.0 → 1.0.1
- Roadmap (v0.1, v0.2, v1.0)
- Contributions (comment contribuer)
- License et support

**Quand le lire:** Intéressé par l'historique ou les futures versions

---

### INDEX.md (Ce fichier)
**Guide de navigation de tous les fichiers**

Vous le lisez maintenant! Utile pour:
- Comprendre la structure globale
- Savoir quel fichier lire pour chaque besoin
- Trouver rapidement une information

---

## 🔧 Fichiers d'installation

### INSTALL.bat (1.2 KB) - **Windows**
**Installateur automatique pour Windows**

À faire:
1. Naviguer vers le dossier Backup-drive
2. Double-cliquez sur `INSTALL.bat`
3. Attendez 2-3 minutes
4. Terminal se ferme automatiquement

Fait automatiquement:
- Vérifie Node.js et npm
- Nettoie les anciennes installations
- Installe les dépendances (npm install)
- Crée les dossiers nécessaires

**Si vous ne faites rien d'autre, double-cliquez ce fichier!**

---

### INSTALL.sh (1.1 KB) - **Mac/Linux**
**Installateur automatique pour Mac/Linux**

À faire:
```bash
chmod +x INSTALL.sh
./INSTALL.sh
```

Fait automatiquement:
- Vérifie Node.js et npm
- Nettoie les anciennes installations
- Installe les dépendances
- Crée les dossiers nécessaires

---

### package.json (1.2 KB) - **CORRIGÉ v0.0.1-beta**
**Configuration npm - Dépendances du projet**

Contient:
```json
{
  "name": "backup-drive",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "lucide-react": "^0.321.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "electron": "latest",           // ✅ CORRIGÉ
    "electron-is-dev": "^2.0.0",   // ✅ AJOUTÉ
    "react-scripts": "5.0.1"
  }
}
```

**Corrections v0.0.1-beta:**
- ❌ "electron": "^latest" → ✅ "electron": "latest"
- ✅ Ajouté electron-is-dev
- ✅ Retrait "type": "module" (CommonJS)

**À faire:** Remplacer ancien package.json par cette version, puis `npm install`

---

## 💻 Fichiers de code source

### src/main.js (5.5 KB) - **Processus Principal Electron**
**Gère:** Fenêtre, filesystem, IPC, dialogues

**Contient:**
- `createWindow()` - Crée fenêtre Electron
- `ipcMain.handle('select-directory')` - Dialogue dossier
- `ipcMain.handle('start-backup')` - Lancer sauvegarde
- `copyDirectory()` - Copie récursive avec progression
- `getDirectorySize()` - Calcul taille dossier
- `ipcMain.handle('cancel-backup')` - Annuler backup

**Langage:** JavaScript CommonJS (require/module.exports)
**Taille:** 5.5 KB
**Lignes:** ~220

**À savoir:**
- Runs in Node.js context (accès filesystem)
- IPC sécurisé via preload.js
- Gère la progression du backup

---

### src/preload.js (981 bytes) - **Preload IPC Sécurisé**
**Expose:** APIs sécurisées au processus rendu

**Expose:**
```javascript
window.electron = {
  selectDirectory(title),
  startBackup(task),
  cancelBackup(backupId),
  getDiskSpace(drivePath),
  onBackupProgress(callback),
  onBackupComplete(callback)
}
```

**Langage:** JavaScript CommonJS
**Taille:** 981 bytes
**Lignes:** ~35

**À savoir:**
- Seul fichier avec `contextBridge`
- Protection Context Isolation
- Aucun accès Node.js direct desde React

---

### src/App.jsx (18 KB) - **Interface React**
**L'application complète - UI, state, interactions**

**Sections:**
1. Header (sticky) avec logo et branding
2. Statistiques (3 cartes : total, dernière, count)
3. Formulaire pour créer tâche (modal)
4. Liste des tâches (cartes avec actions)
5. Historique (logs avec timestamps)

**State gérée:**
- `tasks` - Array des tâches
- `activeBackups` - Map des backups en cours
- `history` - Array de l'historique
- `newTask` - Form state (controlled inputs)
- `loading` - States de chargement
- `stats` - Statistiques globales

**Technologies:**
- React 18.2 avec Hooks
- Tailwind CSS (utility-first)
- Lucide React (icônes)
- Listeners Electron via useEffect

**Langage:** JSX (React components)
**Taille:** 18 KB
**Lignes:** ~550

**À savoir:**
- Utilise hooks (useState, useEffect)
- Listeners pour backup-progress/complete
- Responsive design (tailwind)
- Light mode minimaliste

---

### src/index.jsx (232 bytes) - **Point d'entrée React**
**Simple:** Monte App dans le DOM

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Langage:** JSX
**Taille:** 232 bytes
**Lignes:** 11

---

## 🌐 Fichiers web

### public/index.html (928 bytes) - **Template HTML**
**Structure basique du site**

Contient:
- `<!DOCTYPE html>` et meta tags
- `<title>BackupDrive</title>`
- `<meta charset="utf-8" />`
- `<meta viewport="width=device-width" />`
- `<div id="root"></div>` pour React
- Base styles CSS

**Langage:** HTML5
**Taille:** 928 bytes

---

## ⚙️ Fichiers de configuration

### electron-builder.json
**Configuration pour empaquetage Electron**

Contient:
- `appId` - Identifiant unique
- `productName` - Nom de l'app
- `files` - Fichiers à inclure
- `win`, `mac`, `linux` - Config par plateforme
- `nsis` - Config installateur Windows

**Format:** JSON

---

### .gitignore
**Fichiers à ignorer pour Git**

Contient:
- `node_modules/` - Dépendances npm
- `build/`, `dist/` - Build outputs
- `.DS_Store` - Fichiers macOS
- `*.log` - Logs npm
- `.env`, `.env.local` - Variables sensibles

---

### .env
**Variables d'environnement**

Contient:
```
homepage=./
proxy=http://localhost:3000
```

---

## 🎯 Utilisation rapide des fichiers

### Je veux **installer l'app:**
1. Lisez: **QUICK_START.md**
2. Exécutez: **INSTALL.bat** (Windows) ou **INSTALL.sh** (Mac/Linux)
3. Lancez: `npm run dev`

### Je veux **apprendre comment ça marche:**
1. Lisez: **README.md** (architecture & design)
2. Explorez: **src/main.js** (backend Electron)
3. Explorez: **src/App.jsx** (frontend React)

### J'ai une **erreur:**
1. Consultez: **TROUBLESHOOTING.md**
2. Vérifiez: Node.js version (`node --version`)
3. Essayez: `npm cache clean --force && npm install`

### Je veux **contribuer:**
1. Lisez: **README.md** (section Development)
2. Lisez: **CHANGELOG.md** (contribution guidelines)
3. Fork sur GitHub et créez une PR

### Je veux **déployer:**
1. Lisez: **README.md** (section Empaquetage)
2. Lancez: `npm run electron-build`
3. Testez les exécutables dans `dist/`

---

## 📊 Statistiques

| Type | Fichier | Taille | Lignes |
|------|---------|--------|--------|
| **Code** | src/App.jsx | 18 KB | ~550 |
| **Code** | src/main.js | 5.5 KB | ~220 |
| **Code** | src/preload.js | 981 B | ~35 |
| **Docs** | README.md | 20 KB | 730 |
| **Docs** | CHANGELOG.md | 7.8 KB | 320 |
| **Docs** | QUICK_START.md | 5.7 KB | 220 |
| **Docs** | TROUBLESHOOTING.md | 4.6 KB | 180 |
| **Config** | package.json | 1.2 KB | 40 |
| **Total** | Tout | ~69 KB | ~2,500 |

---

## 🔍 Guide de lecture recommandé

### Pour quelqu'un qui **n'a pas le temps:**
1. QUICK_START.md (5 min)
2. `npm run dev` et test l'app
3. Terminé! 🎉

### Pour quelqu'un qui **veut comprendre:**
1. README.md - Vue d'ensemble (15 min)
2. QUICK_START.md - Installation (5 min)
3. src/App.jsx - Explorer l'UI (10 min)
4. src/main.js - Explorer backend (15 min)
5. TROUBLESHOOTING.md - Solutions (10 min)

### Pour quelqu'un qui **veut développer:**
1. README.md - Sections: Architecture, Development
2. src/main.js - Étudier les IPC handlers
3. src/App.jsx - Étudier les hooks et state
4. Ajouter votre feature
5. CHANGELOG.md - Documenter le changement

---

## ✅ Checklist de lecture

- [ ] QUICK_START.md - J'ai installé l'app
- [ ] README.md - Je comprends l'architecture
- [ ] src/App.jsx - Je vois comment l'UI marche
- [ ] src/main.js - Je vois comment le backend marche
- [ ] TROUBLESHOOTING.md - Je sais résoudre les problèmes
- [ ] CHANGELOG.md - Je sais ce qui a changé

---

## 🔗 Liens rapides

- **Accueil:** README.md
- **Installation:** QUICK_START.md
- **Problèmes:** TROUBLESHOOTING.md
- **Changements:** CHANGELOG.md
- **Code frontend:** src/App.jsx
- **Code backend:** src/main.js
- **IPC sécurisé:** src/preload.js
- **Dépendances:** package.json
- **Configuration:** electron-builder.json

---

## 💬 Support

### Vous ne trouvez pas l'info?
1. Utilisez Ctrl+F pour chercher dans les fichiers
2. Consultez README.md (table of contents complète)
3. Vérifiez TROUBLESHOOTING.md

### Vous avez une question?
1. Consultez d'abord les docs
2. Puis consultez les logs (Ctrl+Maj+I)
3. Puis demandez de l'aide

---

**BackupDrive v0.0.1-beta** - Guide de fichiers complet

*Naviguez facilement dans le projet - Chaque fichier a sa place et son rôle!*
