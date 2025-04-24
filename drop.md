# Plan de Refonte de la Logique de Dépôt (Drop)

Ce plan détaille les étapes pour refactoriser la gestion du dépôt (drop) dans le système de drag-and-drop, afin de centraliser la logique, de réduire la duplication et de faciliter la maintenance, tout en conservant la logique de démarrage du drag actuelle.

**Objectif :** Implémenter un comportement de dépôt unifié et intuitif pour toutes les interactions (Racine <-> Dossier, Dossier <-> Dossier, Réorganisation interne) avec un indicateur visuel clair.

**Composants Clés :**

*   `src/modules/drag-drop/dragDropCore.ts`: Contient l'état partagé (`dragState`) et les fonctions de base (indicateur de drag, nettoyage). Sera étendu.
*   `src/modules/drag-drop/dropHandler.ts`: **Nouveau fichier** contenant la logique centrale de décision et d'exécution du drop (`executeDrop`).
*   `standaloneConversationsDrag.ts`, `folderConversationsDrag.ts`, `mistralConversationsDrag.ts`: Seront simplifiés pour déléguer la détection de cible et l'exécution du drop.

**Tâches Détaillées :**

1.  [x] **Modifier `dragDropCore.ts` :**
    *   [x] Ajouter un champ `potentialDropTarget` à l'interface/type `DragState`. Il stockera `{ element: HTMLElement | null, type: 'conversation' | 'folderHeader' | 'rootArea' | null, position: 'before' | 'after' | 'inside' | null }`.
    *   [x] Créer et exporter une nouvelle fonction `updateDropTarget(event: MouseEvent): void`.
        *   Responsable de :
            *   Nettoyer les classes CSS `drag-over-*` précédentes.
            *   Utiliser `document.elementsFromPoint` pour trouver les éléments sous le curseur.
            *   Identifier la cible prioritaire (conversation > en-tête > zone racine).
            *   Calculer la `position` ('before', 'after', 'inside').
            *   Appliquer les classes CSS visuelles à la cible détectée.
            *   Mettre à jour `dragState.potentialDropTarget`.
    *   [x] (Optionnel) Centraliser la fonction `findFolderIdFromElement` ici si jugé pertinent. (Fait)

2.  [x] **Créer `dropHandler.ts` :**
    *   [x] Créer le fichier `src/modules/drag-drop/dropHandler.ts`.
    *   [x] Implémenter et exporter la fonction `async executeDrop(dragState: DragState): Promise<boolean>`.
        *   Responsable de :
            *   Importer les fonctions nécessaires de `conversation-operations.ts`.
            *   Importer/utiliser `findFolderIdFromElement`.
            *   Lire `dragState.potentialDropTarget` et `dragState.elementType` (source).
            *   Contenir la logique `switch` ou `if/else` principale basée sur le type de cible (`potentialDropTarget.type`).
            *   Pour chaque type de cible, déterminer la séquence d'opérations (`remove...`, `add...`, `reorder...`) en fonction de la source (`dragState.elementType`).
            *   Calculer les index/positions si nécessaire pour les opérations.
            *   Appeler les fonctions de `conversation-operations.ts`.
            *   Retourner `true` si une modification a été effectuée, `false` sinon.

3.  [x] **Refactoriser `standaloneConversationsDrag.ts` :**
    *   [x] Modifier `handleStandaloneConversationDragMove` : Supprimer la logique de détection de cible et appeler `updateDropTarget(event)`.
    *   [x] Modifier `handleStandaloneConversationDragEnd` :
        *   [x] Supprimer la logique de détection de cible et d'exécution des opérations.
        *   [x] Appeler `const success = await executeDrop(dragState)`.
        *   [x] Si `success` est `true`, appeler `await renderFolders()`.
        *   [x] Appeler `cleanupDrag()`.
    *   [x] Supprimer l'éventuelle fonction locale `findFolderIdFromElement`.

4.  [x] **Refactoriser `folderConversationsDrag.ts` :**
    *   [x] Modifier `handleFolderConversationDragMove` : Supprimer la logique de détection de cible et appeler `updateDropTarget(event)`.
    *   [x] Modifier `handleFolderConversationDragEnd` :
        *   [x] Supprimer la logique de détection de cible et d'exécution des opérations.
        *   [x] Appeler `const success = await executeDrop(dragState)`.
        *   [x] Si `success` est `true`, appeler `await renderFolders()`.
        *   [x] Appeler `cleanupDrag()`.
    *   [x] Supprimer la fonction locale `findFolderIdFromElement`.

5.  [x] **Refactoriser `mistralConversationsDrag.ts` :**
    *   [x] Modifier `handleMistralConversationDragMove` : Supprimer la logique de détection de cible et appeler `updateDropTarget(event)`.
    *   [x] Modifier `handleMistralConversationDragEnd` :
        *   [x] Supprimer la logique de détection de cible et d'exécution des opérations.
        *   [x] Appeler `const success = await executeDrop(dragState)`.
        *   [x] Si `success` est `true`, appeler `await renderFolders()`.
        *   [x] Appeler `cleanupDrag()`.
    *   [x] Supprimer la fonction locale `findFolderIdFromElement`.

6.  [x] **Centraliser `findFolderIdFromElement` (si pas fait en tâche 1) :** (Fait en Tâche 1)
    *   [x] Déplacer la fonction vers `dragDropCore.ts` ou `dropHandler.ts`.
    *   [x] Assurer l'import correct dans `executeDrop`.

7.  [x] **Mettre à jour `index.ts` si nécessaire :**
    *   [x] Vérifier que les nouvelles fonctions (si exportées directement) sont gérées ou que les modifications des handlers existants sont suffisantes. (Aucun changement nécessaire).

8.  [x] **Revue Finale et Nettoyage :**
    *   [x] Vérifier les imports/exports.
    *   [x] Supprimer le code mort ou commenté.
    *   [ ] Tester exhaustivement tous les scénarios de drag-and-drop. (À faire par l'utilisateur) 