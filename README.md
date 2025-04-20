# Le Chat+

Une extension de navigateur pour améliorer l'interface utilisateur de [Mistral AI](https://chat.mistral.ai/).

## Fonctionnalités

- **Organisation par dossiers** : Organisez vos conversations dans des dossiers personnalisés pour un accès plus facile
- **Modèles de prompts** : Ajoutez et utilisez des modèles de prompts pour des interactions plus rapides
- **Thème amélioré** : Support de thèmes clairs et sombres
- **Interface utilisateur améliorée** : Navigation simplifiée entre les conversations

## Installation

### Installation depuis les sources

1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/votretutilisateur/le-chat-plus.git
   ```

2. Ouvrez Chrome et accédez à `chrome://extensions/`

3. Activez le "Mode développeur" en haut à droite

4. Cliquez sur "Charger l'extension non empaquetée" et sélectionnez le dossier du projet

L'extension est maintenant installée et active sur le site chat.mistral.ai.

## Structure du projet

```
le-chat-plus/
│
├── assets/                # Ressources statiques (icônes, images)
│   └── icons/             # Icônes de l'extension
│
├── src/                   # Code source
│   ├── modules/           # Modules fonctionnels
│   │   ├── folders.ts     # Gestion des dossiers de conversations
│   │   ├── prompts.ts     # Gestion des modèles de prompts
│   │   ├── theme.ts       # Gestion des thèmes
│   │   └── ui-renderer.ts # Rendu de l'interface utilisateur
│   │
│   ├── utils/             # Utilitaires
│   │   ├── dom.ts         # Manipulation du DOM
│   │   ├── storage.ts     # Gestion du stockage
│   │   └── types.ts       # Types communs
│   │
│   ├── content.ts         # Point d'entrée pour le script de contenu
│   ├── background.ts      # Script d'arrière-plan
│   └── popup.ts           # Script pour la popup
│
├── styles/                # Styles CSS
│   ├── content.css        # Styles pour le script de contenu
│   └── popup.css          # Styles pour la popup
│
├── manifest.json          # Manifeste de l'extension
├── popup.html             # Page HTML pour la popup
└── README.md              # Documentation
```

## Développement

### Prérequis

- Node.js et npm

### Installation des dépendances

```bash
npm install
```

### Construction du projet

```bash
npm run build
```

### Tests

```bash
npm test
```

## Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou à soumettre une pull request.

1. Forkez le projet
2. Créez votre branche de fonctionnalité (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add some amazing feature'`)
4. Poussez vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request
