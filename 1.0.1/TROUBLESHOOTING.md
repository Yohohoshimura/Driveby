# Troubleshooting - BackupDrive

## Erreurs courantes et solutions

### 1. "npm error Invalid tag name"
**Cause:** Syntaxe invalide dans package.json
**Solution:** Utilisez la version corrigée du package.json (sans `^latest`)

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 2. "electron-is-dev not found"
**Cause:** Module manquant
**Solution:** 
```bash
npm install electron-is-dev --save-dev
```

### 3. "Module not found: 'electron'"
**Cause:** Electron pas installé
**Solution:**
```bash
npm install electron --save-dev
```

### 4. "React error: Module parse failed"
**Cause:** Problème de configuration React
**Solution:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 5. "Port 3000 déjà utilisé"
**Cause:** Autre processus utilise le port
**Solution (Windows):**
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Solution (Mac/Linux):**
```bash
lsof -i :3000
kill -9 <PID>
```

### 6. "Cannot find module 'react-scripts'"
**Cause:** Installation incomplète
**Solution:**
```bash
npm install react-scripts --save
npm install
```

### 7. Erreur lors du build Electron
**Cause:** Configuration electron-builder
**Solution:** Vérifiez que electron-builder.json est dans le dossier racine

### 8. "Fenêtre Electron ne s'affiche pas"
**Cause:** URL incorrecte ou React pas démarré
**Solution:**
- Assurez-vous que React tourne sur localhost:3000
- Attendez quelques secondes après npm run dev
- Vérifiez la console Electron (F12)

### 9. "Failed to load resource" au démarrage
**Cause:** React pas démarré ou port incorrect
**Solution:**
```bash
npm run react-start  # Terminal 1
# Attendez "webpack compiled"
npm run electron-dev # Terminal 2
```

### 10. Erreur de sauvegarde "Access Denied"
**Cause:** Permissions insuffisantes
**Solution:**
- Vérifiez que vous avez accès en lecture au dossier source
- Vérifiez que vous avez accès en écriture au drive destination
- Essayez avec un dossier de test d'abord

## Processus d'installation étape par étape

### Sur Windows:
1. Ouvrir CMD/PowerShell en tant qu'administrateur
2. Naviguer vers le dossier du projet:
   ```cmd
   cd C:\chemin\vers\Backup-drive
   ```
3. Exécuter l'installateur:
   ```cmd
   INSTALL.bat
   ```
4. Attendre la fin de l'installation (2-3 minutes)

### Sur Mac/Linux:
1. Ouvrir Terminal
2. Naviguer vers le dossier:
   ```bash
   cd ~/path/to/Backup-drive
   ```
3. Exécuter l'installateur:
   ```bash
   bash INSTALL.sh
   ```
4. Attendre la fin (2-3 minutes)

## Vérification de l'installation

Après `npm install`, vérifiez:

```bash
# Vérifier les dossiers
ls -la node_modules/ | grep electron
ls -la node_modules/ | grep react

# Ou sur Windows
dir node_modules | findstr electron
dir node_modules | findstr react
```

Vous devez voir:
- electron
- electron-builder
- electron-is-dev
- react
- react-dom
- react-scripts

## Démarrage du développement

### Option 1: Tout d'un coup
```bash
npm run dev
```
Cela lance React et Electron ensemble (plus simple)

### Option 2: Deux terminaux (plus de contrôle)
**Terminal 1:**
```bash
npm run react-start
```
Attendez jusqu'à voir `webpack compiled successfully`

**Terminal 2:**
```bash
npm run electron-dev
```

## Logs et débogage

### Voir les logs Electron:
- Dans l'app: `Ctrl+Maj+I` pour DevTools
- Console: Vérifiez les erreurs rouges

### Voir les logs Node.js (main.js):
- Ajoutez `console.log()` dans main.js
- Relancez l'app

### Logs npm:
```bash
npm install --verbose
```

## Problèmes avec git/clone

Si vous clonez depuis Git:
```bash
# Supprimer les anciens modules
rm -rf node_modules
rm package-lock.json

# Réinstaller
npm install

# Relancer
npm run dev
```

## Performance

Si l'app est lente:

1. **Dossier source trop volumineux?**
   - Testez avec un petit dossier d'abord
   - Le backup va à la vitesse de votre disque

2. **RAM insuffisante?**
   - Augmentez la mémoire Node:
   ```bash
   npm run dev -- --max-old-space-size=4096
   ```

3. **Disque lent?**
   - Les disques durs USB/externes peuvent être lents
   - Backup progressif = progression lente = normal

## Support supplémentaire

1. Vérifiez le fichier README.md
2. Consultez les logs complets
3. Testez avec un dossier de test plus petit
4. Assurez-vous que Node.js est à jour:
   ```bash
   node --version  # Doit être 16+
   npm --version   # Doit être 8+
   ```

---

**Besoin d'aide?**
- Vérifiez que toutes les dépendances sont installées
- Essayez `npm cache clean --force` puis `npm install`
- Redémarrez votre terminal/ordinateur
- Vérifiez l'antivirus (peut bloquer npm)
