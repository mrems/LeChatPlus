# Le Chat+ Extension pour Mistral AI

Une extension Chrome qui intègre des fonctionnalités d'organisation directement dans l'interface de Mistral AI Chat, vous permettant de classer vos conversations dans des dossiers personnalisés.

## Fonctionnalités

- **Intégration native** : Ajoute une section "Mes Dossiers" directement dans l'interface Mistral AI
- **Création de dossiers** : Organisez vos conversations par thème, projet ou importance
- **Ajout facile** : Ajoutez la conversation active à n'importe quel dossier en un clic
- **Navigation intuitive** : Accédez rapidement à vos conversations classées
- **Popup informatif** : Consultez des statistiques et gérez vos dossiers depuis la popup de l'extension

## Installation

1. Clonez ce dépôt
2. Exécutez `pnpm install` pour installer les dépendances
3. Exécutez `pnpm dev` pour lancer le serveur de développement
4. Ouvrez Chrome et allez à `chrome://extensions/`
5. Activez le "Mode développeur"
6. Cliquez sur "Charger l'extension non empaquetée" et sélectionnez le dossier `build/chrome-mv3-dev`

## Comment utiliser

1. Naviguez vers [chat.mistral.ai](https://chat.mistral.ai/chat)
2. L'extension ajoute automatiquement une section "Mes Dossiers" dans la colonne de gauche
3. Cliquez sur le bouton "+" pour créer un nouveau dossier
4. Pour ajouter une conversation au dossier, ouvrez-la, cliquez sur le dossier puis sur "Ajouter conversation"
5. Utilisez les triangles pour plier/déplier les dossiers et voir leur contenu
6. Cliquez sur une conversation dans un dossier pour l'ouvrir

## Construction pour la production

Pour créer une version de production, exécutez :

```
pnpm build
```

La version de production sera disponible dans le dossier `build/chrome-mv3-prod`.

## Technologie

Cette extension est construite avec [Plasmo Framework](https://docs.plasmo.com/) et utilise :

- React pour l'interface popup
- TypeScript pour le typage statique
- Storage API de Plasmo pour le stockage des données
- DOM Manipulation pour l'injection dans l'interface Mistral AI
- MutationObserver pour détecter les changements de page

## Auteur

Pastaga

## Licence

MIT
