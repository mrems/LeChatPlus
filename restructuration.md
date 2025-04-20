# Plan de restructuration du projet Le Chat+

## Objectif
Restructurer le code de l'extension Le Chat+ afin d'améliorer sa maintenabilité tout en préservant 100% des fonctionnalités et du design existants.

## Principes directeurs
- [x] Conserver content.ts comme point d'entrée principal
- [x] Garantir que 100% des fonctionnalités existantes sont préservées
- [x] Maintenir l'interface utilisateur et l'expérience utilisateur à l'identique
- [x] Améliorer la lisibilité et la maintenabilité du code
- [x] Assurer la compatibilité avec Plasmo

## Structure proposée
```
├── content.ts (point d'entrée, allégé)
└── src/
    └── modules/
        ├── types.ts
        ├── theme-detector.ts
        ├── storage-manager.ts
        ├── folder-operations.ts
        ├── conversation-operations.ts
        ├── ui-renderer.ts
        ├── modal-system.ts
        ├── drag-drop-manager.ts
        ├── dom-observer.ts
        ├── ui-helpers.ts
        ├── styles.ts
        └── prompt-button.ts
```

## Plan d'action détaillé

### Étape 1: Création de la structure de fichiers
- [x] Créer le dossier `src/modules`
- [x] Préparer les fichiers vides pour chaque module

### Étape 2: Extraction des types communs
- [x] Créer le fichier `types.ts`
- [x] Extraire toutes les interfaces et types de `content.ts` vers ce fichier:
  - [x] Interface `ConversationRef`
  - [x] Interface `Folder`
  - [x] Autres types communs

### Étape 3: Extraction du système de détection de thème
- [x] Créer le fichier `theme-detector.ts`
- [x] Extraire de `content.ts` les fonctions liées au thème:
  - [x] `detectAndSaveTheme()`
  - [x] Setup de `themeObserver`
  - [x] Gestion des messages liés au thème

### Étape 4: Extraction de la gestion du stockage
- [x] Créer le fichier `storage-manager.ts`
- [x] Extraire les fonctions liées au stockage:
  - [x] Initialisation de `storage`
  - [x] Fonctions d'accès au stockage chrome

### Étape 5: Extraction des opérations sur les dossiers
- [x] Créer le fichier `folder-operations.ts`
- [x] Extraire les fonctions CRUD pour les dossiers:
  - [x] `createFolder()`
  - [x] `getFolders()`
  - [x] `deleteFolder()`
  - [x] `toggleFolderExpand()`
  - [x] `renameFolder()`

### Étape 6: Extraction des opérations sur les conversations
- [x] Créer le fichier `conversation-operations.ts`
- [x] Extraire les fonctions liées aux conversations:
  - [x] `addConversationToFolder()`
  - [x] `removeConversationFromFolder()`
  - [x] `reorderConversation()`
  - [x] `renameConversation()`
  - [x] `getCurrentConversationId()`
  - [x] `getConversationTitle()`

### Étape 7: Extraction du système de rendu UI
- [x] Créer le fichier `ui-renderer.ts`
- [x] Extraire les fonctions liées au rendu de l'interface:
  - [x] `injectFoldersUI()`
  - [x] `renderFolders()`
  - [x] `updateActiveConversationHighlight()`
  - [x] Gestionnaires d'événements UI comme `handleConvLinkClick`

### Étape 8: Extraction du système de modales
- [x] Créer le fichier `modal-system.ts`
- [x] Extraire les fonctions liées aux modales:
  - [x] `showModal()`
  - [x] `showFolderCreateModal()`
  - [x] `showDeleteConfirmModal()`
  - [x] Fonctions auxiliaires comme `applyModalStyles()`

### Étape 9: Extraction du système de drag & drop
- [x] Créer le fichier `drag-drop-manager.ts`
- [x] Extraire les fonctions liées au drag & drop:
  - [x] `setupDragAndDropForConversations()`
  - [x] `setupFolderConversationsDragAndDrop()`
  - [x] Fonctions auxiliaires comme `createReorderIndicator()`

### Étape 10: Extraction de l'observateur DOM
- [x] Créer le fichier `dom-observer.ts`
- [x] Extraire les fonctions liées à l'observation du DOM:
  - [x] `setupDOMObserver()`
  - [x] `setupURLChangeListener()`
  - [x] Fonctions auxiliaires comme `checkURLChange()`

### Étape 11: Extraction des fonctions d'aide UI
- [x] Créer le fichier `ui-helpers.ts`
- [x] Extraire les fonctions utilitaires:
  - [x] `safeSetStyle()`
  - [x] `injectStyles()`
  - [x] Autres fonctions d'aide pour la manipulation du DOM

### Étape 12: Extraction des styles CSS
- [x] Créer le fichier `styles.ts`
- [x] Extraire les styles CSS injectés dans le DOM

### Étape 13: Extraction du bouton de prompt
- [x] Créer le fichier `prompt-button.ts`
- [x] Extraire la fonction `injectPromptButton()`

### Étape 14: Refactorisation de content.ts
- [x] Alléger `content.ts` pour qu'il serve de point d'entrée
- [x] Ajouter les imports des modules créés
- [x] Initialiser tous les modules dans un ordre logique
- [x] Conserver la configuration Plasmo et autres éléments essentiels

### Étape 15: Gestion des dépendances circulaires
- [x] Identifier et résoudre les éventuelles dépendances circulaires entre modules
- [x] Restructurer si nécessaire pour éviter ces problèmes

### Étape 16: Tests et validation
- [x] Corriger les problèmes de détection de la barre latérale dans l'interface Mistral AI
- [ ] Tester chaque fonctionnalité pour s'assurer qu'elle fonctionne comme avant
- [ ] Vérifier que l'interface utilisateur est identique
- [ ] S'assurer que tous les événements utilisateur fonctionnent correctement
- [ ] Vérifier la compatibilité avec Plasmo

## Éléments à surveiller particulièrement

### Fonctionnalités critiques à préserver
- [x] Organisation des conversations en dossiers
- [x] Drag & drop des conversations
- [x] Renommage des dossiers et conversations
- [x] Adaptation au thème clair/sombre
- [x] Modales pour création/suppression
- [x] Highlight de la conversation active

### Points d'attention technique
- [x] Gestion des événements et listeners qui pourraient être dupliqués
- [x] Cycle de vie des observateurs DOM
- [x] Timing des injections UI et des modifications DOM
- [x] Gestion du stockage chrome
- [x] Communication avec le popup

## Notes importantes
- Si une fonction ou fonctionnalité est temporairement supprimée, elle sera clairement signalée ici pour être reconstruite ultérieurement.
- Tout changement dans le comportement ou l'apparence de l'extension doit être immédiatement corrigé pour maintenir une expérience utilisateur identique.
- La restructuration doit être progressive et chaque étape validée avant de passer à la suivante. 