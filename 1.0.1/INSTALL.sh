#!/bin/bash

# BackupDrive - Installation & Configuration
# ==========================================

echo "🚀 Installation de BackupDrive..."

# Vérifier Node.js
echo "✓ Vérification de Node.js..."
node --version
npm --version

# Nettoyer les anciennes installations
echo "🧹 Nettoyage..."
rm -rf node_modules package-lock.json

# Installer les dépendances
echo "📦 Installation des dépendances (peut prendre 2-3 minutes)..."
npm install

# Créer les dossiers nécessaires
echo "📁 Création des dossiers..."
mkdir -p public src/assets

echo ""
echo "✅ Installation terminée !"
echo ""
echo "📝 Commandes disponibles :"
echo ""
echo "  Développement :"
echo "    npm run dev          → Lance React + Electron"
echo "    npm run react-start  → Lance React seul (localhost:3000)"
echo "    npm run electron-dev → Lance Electron seul"
echo ""
echo "  Production :"
echo "    npm run react-build  → Build React"
echo "    npm run electron-build → Build exécutable"
echo ""
echo "🎉 Prêt à démarrer !"
