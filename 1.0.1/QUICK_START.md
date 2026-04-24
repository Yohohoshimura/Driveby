# 🚀 BackupDrive - Guide de Démarrage Rapide

## ✅ Corrections apportées

L'erreur `npm error code EINVALIDTAGNAME` était due à une mauvaise syntaxe dans `package.json`.

**Corrigé:**
- ❌ `"electron": "^latest"` → ✅ `"electron": "latest"`
- ❌ `"type": "module"` supprimé (CommonJS)
- ✅ `electron-is-dev` ajouté à devDependencies

---

## 📥 Installation (Windows)

### Méthode 1: Automatique (Recommandé)
1. Naviguez vers votre dossier Backup-drive
2. **Double-cliquez sur `INSTALL.bat`**
3. Attendez la fin (2-3 minutes)
4. Le terminal se fermera automatiquement

### Méthode 2: Manuel avec CMD/PowerShell

**Ouvrir CMD/PowerShell en tant qu'administrateur:**

```powershell
# Naviguer vers le dossier
cd C:\Users\Yoshimura\Documents\Backup-drive\1.0

# Nettoyer les anciennes installations
rmdir /s /q node_modules
del package-lock.json

# Installer les dépendances (CORRIGER avec les fichiers fournis)
npm install
```

---

## 📥 Installation (Mac/Linux)

```bash
# Naviguer vers le dossier
cd ~/path/to/Backup-drive

# Rendre exécutable
chmod +x INSTALL.sh

# Lancer l'installation
./INSTALL.sh
```

---

## ⚡ Lancer l'application

### Simplest (Une seule commande)
```bash
npm run dev
```
Cela lance React ET Electron ensemble. Attendez ~20 secondes.

### Avancé (Deux terminaux - Plus de contrôle)

**Terminal 1:**
```bash
npm run react-start
```
Attendez jusqu'à voir: `webpack compiled successfully`

**Terminal 2 (après que Terminal 1 soit prêt):**
```bash
npm run electron-dev
```

---

## 📁 Structure finale du projet

Après installation, vous devez avoir:

```
Backup-drive/
├── node_modules/          ← Créé par npm install
├── public/
│   └── index.html
├── src/
│   ├── main.js            ← Processus Electron
│   ├── preload.js         ← IPC sécurisé
│   ├── App.jsx            ← Interface React
│   └── index.jsx          ← Point d'entrée React
├── package.json           ← CORRIGÉ
├── electron-builder.json
├── INSTALL.bat           ← Double-cliquez pour installer
├── INSTALL.sh
├── TROUBLESHOOTING.md
└── README.md
```

---

## 🔍 Vérifier l'installation

Après `npm install`, vérifiez que tout est OK:

```bash
# Windows
npm list electron
npm list react
npm list lucide-react

# Mac/Linux
npm list electron
npm list react
npm list lucide-react
```

Vous devez voir les versions des packages.

---

## ⚠️ Erreurs communes et solutions

### "npm ERR! code EINVALIDTAGNAME"
**Cause:** Vous utilisez l'ancien package.json
**Solution:** ✅ Remplacez-le par le nouveau `package.json` fourni, puis:
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Cannot find module 'electron'"
```bash
npm install electron --save-dev
```

### "Cannot find module 'react-scripts'"
```bash
npm install react-scripts
npm install
```

### "Port 3000 already in use"
**Windows:**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
lsof -i :3000
kill -9 <PID>
```

Puis relancez `npm run dev`

### "Fenêtre Electron vide"
- Assurez-vous que React tourne sur localhost:3000
- Attendez 20 secondes au premier lancement
- Appuyez sur Ctrl+Maj+I pour voir les erreurs (DevTools)

---

## 📦 Fichiers à Remplacer/Mettre à Jour

Vous avez reçu ces fichiers CORRIGÉS. Remplacez les anciens par ceux-ci:

1. **package.json** ← IMPORTANT (sans `^latest`)
2. **src/main.js** ← En CommonJS
3. **src/preload.js** ← En CommonJS
4. **electron-builder.json** ← Inchangé

Puis relancez `npm install`

---

## 🎯 Workflow recommandé

### Première utilisation:
```bash
# 1. Copier les fichiers CORRIGÉS
# 2. Ouvrir le terminal dans le dossier
# 3. Installer
npm install

# 4. Lancer
npm run dev

# 5. Attendre la fenêtre Electron (~20 sec)
```

### Développement:
```bash
npm run dev
# Modifiez les fichiers, l'app recharge automatiquement
```

### Build final:
```bash
npm run electron-build
# Crée un exécutable dans le dossier dist/
```

---

## 📝 Dépendances installées

Après `npm install`, vous aurez:

**Runtime:**
- react 18.2.0
- react-dom 18.2.0
- lucide-react 0.321.0
- uuid 9.0.0

**Dev (Electron):**
- electron (latest)
- electron-builder (latest)
- electron-is-dev 2.0.0
- react-scripts 5.0.1
- concurrently 8.0.0
- wait-on 7.0.0

---

## 🚨 Si ça ne fonctionne pas encore

1. **Vérifiez Node.js:**
   ```bash
   node --version  # Doit être 16 ou plus
   npm --version   # Doit être 8 ou plus
   ```

2. **Nettoyez complètement:**
   ```bash
   rmdir /s /q node_modules
   del package-lock.json
   npm cache clean --force
   npm install
   ```

3. **Redémarrez votre ordinateur**

4. **Consultez TROUBLESHOOTING.md** pour d'autres solutions

---

## ✅ Checklist avant de demander de l'aide

- [ ] Node.js 16+ installé (`node --version`)
- [ ] npm 8+ installé (`npm --version`)
- [ ] package.json CORRIGÉ (sans `^latest`)
- [ ] Dossier ancien `node_modules` supprimé
- [ ] `npm install` complété sans erreurs
- [ ] Attendu 20 secondes après `npm run dev`
- [ ] Vérifiez les logs DevTools (Ctrl+Maj+I)

---

## 🎨 Première utilisation de l'app

Une fois lancée:

1. **Cliquez "Nouvelle tâche"**
2. **Remplissez le formulaire:**
   - Nom: Ex "Mes Documents"
   - Source: Cliquez "Parcourir" → Sélectionnez un dossier
   - Destination: Cliquez "Parcourir" → Sélectionnez un drive/dossier
3. **Cliquez "Ajouter"**
4. **Cliquez "Lancer"**
5. **Suivez la progression!** ✨

---

## 📞 Besoin d'aide?

1. Vérifiez TROUBLESHOOTING.md
2. Vérifiez les logs (DevTools: Ctrl+Maj+I)
3. Essayez avec un petit dossier de test
4. Assurez-vous que les chemins existent et sont accessibles

---

**Bonne chance! L'app devrait fonctionner maintenant! 🚀**
