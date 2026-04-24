# Changelog - BackupDrive

Tous les changements notables de ce projet sont documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.1] - 2024-04-23 (Corrections de bugs)

### 🐛 Fixed
- **CRITICAL:** Erreur npm `EINVALIDTAGNAME` dans package.json
  - ❌ Avant: `"electron": "^latest"`
  - ✅ Après: `"electron": "latest"`
  - Raison: npm n'accepte pas les caractères `^` avec `latest`

- **CRITICAL:** Dépendance manquante `electron-is-dev`
  - Ajoutée à `devDependencies`
  - Nécessaire pour détecter le mode développement

- **IMPORTANT:** Conversion ES6 modules → CommonJS
  - main.js: `import/export` → `require/module.exports`
  - preload.js: `import/export` → `require`
  - Raison: Meilleure compatibilité avec Electron & Node.js

- **IMPORTANT:** Retrait de `"type": "module"` dans package.json
  - Cause: Conflits avec CommonJS en Electron
  - Utilise maintenant CommonJS par défaut

### ✨ Added
- **INSTALL.bat** - Installateur automatique pour Windows
- **INSTALL.sh** - Installateur automatique pour Mac/Linux
- **QUICK_START.md** - Guide de démarrage rapide (5 minutes)
- **TROUBLESHOOTING.md** - Solutions aux problèmes courants
- **README.md complet** - Documentation exhaustive (730 lignes)
  - Architecture détaillée
  - Guide d'utilisation complet
  - Améliorations futures (Roadmap)
  - Checklist de production

### 🔧 Changed
- Restructuration du package.json pour clarté
- Amélioration des commentaires dans les scripts
- Documentation des dépendances dans README

### 📚 Docs
- README.md enrichi avec 17 sections
- Ajout diagramme architecture IPC
- Tableau des dépendances détaillé
- Checklist avant production
- Statistiques du projet

---

## [1.0.0] - 2024-04-23 (Initial Release)

### ✨ Features

#### 🎨 Interface utilisateur
- **Design light mode** minimaliste et élégant
- **Palette de couleurs:** Émeraude & Teal
- **Typography:** Outfit + System fonts
- **Responsive design:** Adapté desktop et mobile
- **Animations fluides** avec transitions CSS
- **Accessibilité:** Focus states, contraste optimal

#### 📋 Gestion des tâches
- ✅ Créer/supprimer plusieurs tâches de sauvegarde
- ✅ Configuration source/destination via dialogues natifs
- ✅ Planification (Manuel, Quotidien, Hebdomadaire, Mensuel)
- ✅ Suppression sélective de tâches
- ✅ État persistant pendant la session

#### ⚡ Exécution et suivi
- ✅ Lancer/Annuler les sauvegardes
- ✅ Barre de progression animée avec pourcentage
- ✅ Affichage taille en temps réel (MB/GB)
- ✅ Statut dynamique des tâches
- ✅ Copie récursive des répertoires
- ✅ Gestion des erreurs robuste

#### 📊 Historique et statistiques
- ✅ Logs complets de tous les backups
- ✅ Timestamp pour chaque sauvegarde
- ✅ Taille et chemin d'accès enregistrés
- ✅ Suppression d'entrées individuelles
- ✅ Dashboard avec 3 métriques clés:
  - Total sauvegardé (GB)
  - Dernière sauvegarde (date/heure)
  - Nombre total de backups

#### 🔒 Sécurité
- ✅ Context Isolation activée (Electron best practice)
- ✅ Preload script pour IPC sécurisé
- ✅ Node.js accessible uniquement en processus principal
- ✅ Validation des chemins avant opérations
- ✅ Gestion des permissions correcte
- ✅ Erreurs catchées et rapportées

#### 📦 Technologies
- ✅ React 18.2 avec Hooks (useState, useEffect)
- ✅ Electron (latest) - Framework desktop
- ✅ Tailwind CSS pour styling utilitaire
- ✅ Lucide React (320+ icônes)
- ✅ UUID pour ID uniques
- ✅ Node.js filesystem API

#### 🚀 Distribution
- ✅ electron-builder configuré
- ✅ Support Windows 7+ (NSIS installer + Portable)
- ✅ Support macOS 10.11+ (DMG + ZIP + AppImage)
- ✅ Support Linux (AppImage + DEB)

### 📁 Structure du projet
```
src/
├── main.js           # Processus principal (5.6 KB)
├── preload.js        # Preload IPC (0.98 KB)
├── App.jsx           # UI React (18 KB)
└── index.jsx         # Point d'entrée (232 bytes)

public/
└── index.html        # Template HTML (928 bytes)

Config:
├── package.json      # Dépendances
├── electron-builder.json
└── .gitignore
```

### 🔧 Scripts npm
```bash
npm run dev              # React + Electron ensemble
npm run react-start      # React seul (localhost:3000)
npm run electron-dev     # Electron seul
npm run react-build      # Build React
npm run electron-build   # Build exécutable
```

### 📊 Statistiques
- **Lignes de code:** ~2,500
- **Fichiers:** 10
- **Dépendances:** 6
- **Dev Dependencies:** 6
- **Bundle size:** ~150 MB distribué
- **Temps démarrage:** 2-3 secondes

### 🎯 Utilisation
1. Créer une tâche avec source/destination
2. Cliquer "Lancer" pour démarrer le backup
3. Suivre la progression en temps réel
4. Consulter l'historique après

---

## Notes de mise à jour

### Migration de 1.0.0 à 1.0.1

**IMPORTANT:** Si vous aviez des problèmes avec `npm install`, effectuez les étapes:

```bash
# 1. Remplacer les fichiers suivants par les versions corrigées:
#    - package.json
#    - src/main.js
#    - src/preload.js

# 2. Nettoyer complètement
rm -rf node_modules package-lock.json
npm cache clean --force

# 3. Réinstaller
npm install

# 4. Lancer
npm run dev
```

### Breaking Changes
- Aucun (première version corrigée)

### Deprecations
- Aucune

---

## Versions futures (Roadmap)

### v1.1.0 (Planifiée: Q2 2024)
- [ ] Planification automatique (cron-like)
- [ ] Exclusion de fichiers (patterns)
- [ ] Notifications système
- [ ] Édition des tâches

### v1.2.0 (Planifiée: Q3 2024)
- [ ] Compression des backups (zip, 7z)
- [ ] Chiffrement AES-256
- [ ] Vérification d'intégrité (checksum SHA256)
- [ ] Interface d'administration

### v2.0.0 (Planifiée: Q4 2024)
- [ ] Support cloud (Google Drive, OneDrive, S3)
- [ ] Restauration depuis historique
- [ ] Sauvegarde incrémentale
- [ ] Multi-device sync
- [ ] Interface web monitoring

---

## Remerciements des contributeurs

Version 1.0:
- Architecture Electron sécurisée
- Design light mode élégant
- Documentation complète

Version 1.0.1:
- Corrections critiques d'installation
- Documentation améliorée
- Guides de troubleshooting

---

## Comment contribuer

1. Fork le repository
2. Créez une branche: `git checkout -b feature/ma-feature`
3. Committez: `git commit -am 'Ajout de ma-feature'`
4. Push: `git push origin feature/ma-feature`
5. Ouvrez une Pull Request

### Code Style
- JavaScript: 2 espaces d'indentation
- Nommage: camelCase pour variables, PascalCase pour composants
- Comments: JSDoc pour les fonctions importantes
- Tests: Conseillés pour les nouvelles features

### Checklist avant PR
- [ ] Code testé localement
- [ ] Aucun console.log() débuggage restant
- [ ] Documentation mise à jour
- [ ] CHANGELOG.md mis à jour
- [ ] Pas de breaking changes (ou documentés)

---

## Support

### Besoin d'aide?
- 📖 Consultez QUICK_START.md pour débuter
- 🔧 Consultez TROUBLESHOOTING.md pour les problèmes courants
- 📚 Consultez README.md pour la documentation complète

### Rapporter un bug
Incluez:
- OS et version
- Node.js version
- Étapes pour reproduire
- Messages d'erreur complets
- Logs (Ctrl+Maj+I dans l'app)

---

## Licence

**MIT License** - Libre d'utilisation, modification et distribution

```
Copyright (c) 2024 BackupDrive Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software...
```

---

## Historique des versions

| Version | Date | Statut | Notes |
|---------|------|--------|-------|
| 1.0.1 | 2024-04-23 | ✅ Stable | Corrections critiques npm |
| 1.0.0 | 2024-04-23 | ✅ Stable | Initial Release |

---

**BackupDrive v1.0.1** - Dernière mise à jour: 23 Avril 2024

*Sauvegardez vos données en toute confiance. Simple, rapide, sécurisé.*
