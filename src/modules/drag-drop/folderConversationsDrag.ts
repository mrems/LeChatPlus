/**
 * Module de gestion du drag & drop pour les conversations dans les dossiers
 */

import { 
  dragState, 
  handlers, 
  createDragIndicator, 
  updateDragIndicatorPosition,
  cleanupDrag 
} from './dragDropCore';
import { safeSetStyle } from '../ui-helpers';
import { getFolders } from '../folder-operations';
import { reorderConversation } from '../conversation-operations';
import { renderFolders } from '../ui-renderer';

let mouseUpHandler: ((e: MouseEvent) => void) | null = null;
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Initialise les gestionnaires d'événements pour les conversations dans les dossiers
 */
export function initFolderConversationsDragAndDrop(): void {
  // Configuration des gestionnaires dans le module principal
  handlers.folder.onDragStart = handleFolderConversationDragStart;
  handlers.folder.onDragMove = handleFolderConversationDragMove;
  handlers.folder.onDragEnd = handleFolderConversationDragEnd;
  
  // Initialiser les éléments présents au démarrage
  initConversationItems();
  
  // Observer les nouveaux éléments
  setupMutationObserver();
  
  console.log('[DragDrop] Module pour les conversations en dossier initialisé');
}

/**
 * Initialise les écouteurs d'événements sur les conversations existantes
 */
function initConversationItems(): void {
  // Sélectionner tous les éléments de conversation dans les dossiers
  const conversationItems = document.querySelectorAll('.le-chat-plus-conversation-item');
  
  // Éviter de configurer plusieurs fois les mêmes éléments
  conversationItems.forEach(item => {
    if (item.getAttribute('data-drag-initialized') === 'true') return;
    
    // Vérifier si c'est une conversation en dossier
    const folderItem = item.closest('.le-chat-plus-folder-item');
    if (!folderItem) return; // Ce n'est pas une conversation en dossier
    
    item.setAttribute('data-drag-initialized', 'true');
    
    // Désactiver explicitement le comportement de drag natif du navigateur
    (item as HTMLElement).setAttribute('draggable', 'false');
    
    // Désactiver tous les événements dragstart, drag, dragend qui pourraient être déclenchés
    ['dragstart', 'drag', 'dragend'].forEach(eventType => {
      (item as HTMLElement).addEventListener(eventType, (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, { capture: true });
    });
    
    // Démarrer le glisser au mousedown
    (item as HTMLElement).addEventListener('mousedown', (e: MouseEvent) => {
      handleFolderConversationDragStart(e, item as HTMLElement);
    });
  });
}

/**
 * Observe les mutations du DOM pour initialiser les nouveaux éléments
 */
function setupMutationObserver(): void {
  // Et configurer un observateur pour initialiser les nouveaux éléments ajoutés au DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        initConversationItems();
      }
    }
  });
  
  // Observer tout le document pour détecter les nouveaux éléments
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

/**
 * Gère le début du glisser pour une conversation en dossier
 */
function handleFolderConversationDragStart(e: MouseEvent, element: HTMLElement): void {
  // Ignorer les clics sur les boutons
  if ((e.target as HTMLElement).tagName === 'BUTTON' || 
      (e.target as HTMLElement).closest('button')) {
    return;
  }
  
  // S'assurer qu'on ne démarre pas le drag depuis un élément éditable
  if ((e.target as HTMLElement).getAttribute('contenteditable') === 'true') {
    return;
  }
  
  console.log("[DragDrop:Folder] Mousedown sur conversation en dossier:", element.getAttribute('data-conversation-id'));
  
  // Récupérer l'ID de la conversation
  const conversationId = element.getAttribute('data-conversation-id');
  
  // Trouver le conteneur de dossier parent
  const originFolderItem = element.closest('.le-chat-plus-folder-item');
  
  if (conversationId && originFolderItem) {
    // Mettre à jour l'état global du drag
    dragState.isDragging = false;
    dragState.elementType = 'folder';
    dragState.element = element;
    dragState.elementId = conversationId;
    dragState.sourceContainer = originFolderItem as HTMLElement;
    dragState.startPosition = { x: e.clientX, y: e.clientY };
    dragState.currentPosition = { x: e.clientX, y: e.clientY };
    
    // Désactiver la sélection de texte pendant le drag
    document.body.style.userSelect = 'none';
    
    // Créer l'indicateur de drag qui suivra le curseur
    dragState.dragIndicator = createDragIndicator(e, element);
    
    // Position initiale mais caché jusqu'à ce que le drag commence vraiment
    if (dragState.dragIndicator) {
      dragState.dragIndicator.style.opacity = '0';
      updateDragIndicatorPosition(e, dragState.dragIndicator);
    }
    
    // Créer et enregistrer des fonctions de gestionnaire pour les utiliser et les supprimer plus tard
    mouseUpHandler = handleFolderConversationDragEnd;
    mouseMoveHandler = handleFolderConversationDragMove;
    
    // Ajouter les écouteurs d'événements globaux
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);
    
    // Empêcher le comportement par défaut pour éviter la sélection de texte
    e.preventDefault();
  }
}

/**
 * Gère le déplacement de la souris pendant le drag d'une conversation en dossier
 */
function handleFolderConversationDragMove(e: MouseEvent): void {
  // Vérifier que nous avons les informations nécessaires
  if (!dragState.element || !dragState.dragIndicator) return;
  
  // Mettre à jour la position actuelle
  dragState.currentPosition = { x: e.clientX, y: e.clientY };
  
  // Distance parcourue depuis le début du drag
  const distance = Math.abs(dragState.currentPosition.y - dragState.startPosition.y);
  
  // Activer le drag après un mouvement significatif
  if (!dragState.isDragging) {
    if (distance > 5) {
      dragState.isDragging = true;
      console.log("[DragDrop:Folder] Drag démarré pour conversation en dossier:", dragState.elementId);
      
      // Maintenant qu'on drag vraiment, appliquer les styles
      if (dragState.element) {
        dragState.element.classList.add('dragging');
        safeSetStyle(dragState.element, 'opacity', '0.5');
      }
      
      // Et rendre visible l'indicateur
      if (dragState.dragIndicator) {
        dragState.dragIndicator.style.opacity = '1';
      }
    } else {
      // Pas assez déplacé, ne rien faire pour l'instant
      return;
    }
  }
  
  // Déplacer l'indicateur avec la souris
  updateDragIndicatorPosition(e, dragState.dragIndicator);
  
  // Trouver tous les éléments de conversation comme cibles potentielles
  const potentialTargets = document.querySelectorAll('.le-chat-plus-conversation-item');
  let currentDropTarget: Element | null = null;
  
  // Retirer les indicateurs visuels des précédentes cibles
  potentialTargets.forEach(target => {
    if (target !== dragState.element) {
      target.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    }
  });
  
  // Trouver la cible actuelle sous le curseur
  for (const target of potentialTargets) {
    if (target === dragState.element) continue;
    
    const rect = (target as HTMLElement).getBoundingClientRect();
    
    // Vérifier si le curseur est sur cette cible
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      currentDropTarget = target;
      
      // Déterminer si le curseur est dans la moitié supérieure ou inférieure
      const midPoint = rect.top + rect.height / 2;
      
      if (e.clientY < midPoint) {
        target.classList.add('drag-over', 'drag-over-top');
      } else {
        target.classList.add('drag-over', 'drag-over-bottom');
      }
      
      // Nous avons trouvé une cible, sortir de la boucle
      break;
    }
  }
}

/**
 * Gère le relâchement de la souris (fin du drag) pour une conversation en dossier
 */
async function handleFolderConversationDragEnd(e: MouseEvent): Promise<void> {
  console.log("[DragDrop:Folder] Mouse up, isDragging =", dragState.isDragging, "elementId =", dragState.elementId);
  
  // Nettoyer les écouteurs d'événements globaux
  if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
  if (mouseUpHandler) window.removeEventListener('mouseup', mouseUpHandler);
    mouseMoveHandler = null;
    mouseUpHandler = null;

  // Vérifier si on était vraiment en train de glisser
  if (!dragState.isDragging) {
    const distance = Math.hypot(e.clientX - dragState.startPosition.x, e.clientY - dragState.startPosition.y);
    if (distance <= 5) {
      console.log("[DragDrop:Folder] Drag annulé (simple clic ou mouvement mineur)");
      cleanupDrag();
      return;
    }
    dragState.isDragging = true;
  }
  
  if (dragState.isDragging && dragState.elementId && dragState.element && dragState.sourceContainer && dragState.dragIndicator) {
    let operationSuccess = false;
    
    // Trouver la cible de dépôt (conversation avec .drag-over)
    const dropTargetConversation = document.querySelector('.le-chat-plus-conversation-item.drag-over') as HTMLElement | null;
    
    // Trouver aussi si on survole un en-tête de dossier
    const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
    const folderHeader = elementsUnderCursor.find(el => 
      el.classList && el.classList.contains('le-chat-plus-folder-header') && el.classList.contains('drag-over')
    ) as HTMLElement | undefined;
    
    // Identifier le dossier source
    const sourceFolderId = await findFolderIdFromElement(dragState.sourceContainer);
    if (!sourceFolderId) {
      console.error("[DragDrop:Folder] Impossible de trouver l'ID du dossier source.");
      cleanupDrag();
      return;
    }

    try {
      // Importer les opérations nécessaires
      const { 
        addConversationToFolder, 
        removeConversationFromFolder, 
        reorderConversation,
        addStandaloneConversation,
        reorderStandaloneConversation, // Au cas où on réorganise directement à la racine
        getStandaloneConversations // Pour vérifier la position après ajout
      } = await import('../conversation-operations');
      // Importer aussi le renderer
      const { renderFolders } = await import('../ui-renderer');
      
      // Cibler l'élément <a> pour le titre
      const titleElement = dragState.element.querySelector('a');
      const conversationData = {
          id: dragState.elementId,
          title: titleElement ? titleElement.textContent?.trim() || 'Conversation sans titre' : 'Conversation sans titre',
          url: `/chat/${dragState.elementId}`
      };
      
      // --- LOGIQUE DE DÉPÔT --- 

      // Cas 1: Déposer sur une conversation (dans un dossier, ou autonome)
      if (dropTargetConversation) {
        const targetFolderItem = dropTargetConversation.closest('.le-chat-plus-folder-item');
        const isTargetInFolder = !!targetFolderItem;
        const isAbove = dropTargetConversation.classList.contains('drag-over-top');

        // Cas 1a: Déposer sur une conversation DANS UN DOSSIER
        if (isTargetInFolder && targetFolderItem) {
          const targetFolderId = await findFolderIdFromElement(targetFolderItem);
          if (targetFolderId) {
             // Calculer la position cible
            const targetConversations = Array.from(targetFolderItem.querySelectorAll('.le-chat-plus-conversation-item'));
            const targetIndex = targetConversations.indexOf(dropTargetConversation);
            let targetPosition = isAbove ? targetIndex : targetIndex + 1;
            
            // Animer vers la position
            const targetRect = dropTargetConversation.getBoundingClientRect();
            dragState.dragIndicator.style.top = isAbove ? `${targetRect.top - 1}px` : `${targetRect.bottom + 1}px`;
            dragState.dragIndicator.style.left = `${targetRect.left + targetRect.width/2}px`;
            dragState.dragIndicator.style.opacity = '0';

            // Si c'est le même dossier, on réorganise
            if (targetFolderId === sourceFolderId) {
              console.log(`[DragDrop:Folder] Réorganisation dans le dossier ${sourceFolderId}, position ${targetPosition}`);
              // Ajuster la position si on déplace après l'élément courant dans le même dossier
              const sourceConversations = Array.from(dragState.sourceContainer.querySelectorAll('.le-chat-plus-conversation-item'));
              const currentIndex = sourceConversations.indexOf(dragState.element);
              if (currentIndex !== -1 && currentIndex < targetIndex && !isAbove) {
                 targetPosition--;
                 console.log(`[DragDrop:Folder] Position ajustée: ${targetPosition}`);
              }
              await reorderConversation(sourceFolderId, dragState.elementId, targetPosition);
              operationSuccess = true;
            } 
            // Si c'est un dossier différent, on déplace
            else {
              console.log(`[DragDrop:Folder] Déplacement vers dossier ${targetFolderId}, position ${targetPosition}`);
              await removeConversationFromFolder(sourceFolderId, dragState.elementId);
              await addConversationToFolder(targetFolderId, conversationData, targetPosition);
              operationSuccess = true;
              
              // Effet visuel sur le dossier cible
                const header = targetFolderItem.querySelector('.le-chat-plus-folder-header');
              if(header) {
                  header.classList.add('drop-success');
                  setTimeout(() => header.classList.remove('drop-success'), 500);
              }
            }
          } else {
            console.error("[DragDrop:Folder] Impossible de trouver l'ID du dossier cible.");
          }
        } 
        // Cas 1b: Déposer sur une conversation AUTONOME (déplacement vers la racine)
        else {
          console.log("[DragDrop:Folder] Cible: Conversation autonome (déplacement vers la racine)");
          // Calculer la position dans la liste autonome
          const standaloneConversations = Array.from(document.querySelectorAll('.le-chat-plus-conversation-item'))
            .filter(item => !item.closest('.le-chat-plus-folder-item'));
          const targetIndex = standaloneConversations.indexOf(dropTargetConversation);
          let targetPosition = isAbove ? targetIndex : targetIndex + 1;
          console.log(`[DragDrop:Folder] Déplacement vers la racine, position ${targetPosition}`);

          // Animer vers la position
          const targetRect = dropTargetConversation.getBoundingClientRect();
          dragState.dragIndicator.style.top = isAbove ? `${targetRect.top - 1}px` : `${targetRect.bottom + 1}px`;
          dragState.dragIndicator.style.left = `${targetRect.left + targetRect.width/2}px`;
          dragState.dragIndicator.style.opacity = '0';
          
          // Effectuer les opérations
          await removeConversationFromFolder(sourceFolderId, dragState.elementId);
          // Note: addStandaloneConversation n'accepte pas de position, il faudra peut-être le modifier
          // ou utiliser reorderStandaloneConversation après ajout.
          // Pour l'instant, ajoutons à la fin puis réorganisons si nécessaire.
          await addStandaloneConversation(conversationData); 
          
          // Si la position n'était pas la fin, réorganiser
          const newStandaloneList = await getStandaloneConversations();
          if (targetPosition < newStandaloneList.length) {
              console.log(`[DragDrop:Folder] Réorganisation post-ajout à la racine vers position ${targetPosition}`);
              await reorderStandaloneConversation(dragState.elementId, targetPosition);
          }
          
          operationSuccess = true;
        }
      } 
      // Cas 2: Déposer sur un en-tête de dossier (déplacement vers un autre dossier)
      else if (folderHeader) {
        const targetFolderItem = folderHeader.closest('.le-chat-plus-folder-item');
        if (targetFolderItem && targetFolderItem !== dragState.sourceContainer) {
          const targetFolderId = await findFolderIdFromElement(targetFolderItem);
          if (targetFolderId) {
            console.log(`[DragDrop:Folder] Déplacement vers dossier ${targetFolderId} (via en-tête)`);
            // Animer vers l'en-tête
        const folderRect = folderHeader.getBoundingClientRect();
        dragState.dragIndicator.style.transform = 'scale(0.9)';
        dragState.dragIndicator.style.top = `${folderRect.top + folderRect.height/2}px`;
        dragState.dragIndicator.style.left = `${folderRect.left + folderRect.width/2}px`;
        dragState.dragIndicator.style.opacity = '0';
        
            // Effectuer les opérations
            await removeConversationFromFolder(sourceFolderId, dragState.elementId);
            await addConversationToFolder(targetFolderId, conversationData); // Ajout à la fin
            operationSuccess = true;
            
          // Effet visuel
          folderHeader.classList.remove('drag-over');
          folderHeader.classList.add('drop-success');
            setTimeout(() => folderHeader.classList.remove('drop-success'), 500);
          } else {
             console.error("[DragDrop:Folder] Impossible de trouver l'ID du dossier cible depuis l'en-tête.");
          }
        } else if (targetFolderItem === dragState.sourceContainer) {
            console.log("[DragDrop:Folder] Dépôt sur l'en-tête du dossier source. Annulation.");
            // Juste animer le retour
            dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
            dragState.dragIndicator.style.opacity = '0';
        }
      } 
      // Cas 3: Déposer ailleurs (potentiellement la zone racine ou invalide)
      else {
         // Vérifier si on est sur la zone racine (utiliser une détection robuste)
         const rootAreaElement = elementsUnderCursor.find(el => 
            el.id === 'le-chat-plus-folders-list' ||
            el.id === 'le-chat-plus-folders' ||
            el.id === 'le-chat-plus-folders-title' ||
            el.id === 'le-chat-plus-folders-wrapper' ||
            (el.classList && (
              el.classList.contains('le-chat-plus-folders-wrapper') ||
              el.classList.contains('le-chat-plus-folders') ||
              el.classList.contains('le-chat-plus-folders-title')
            )) ||
            (el.closest && el.closest('#le-chat-plus-folders')) ||
            (el.closest && el.closest('#le-chat-plus-folders-wrapper'))
         ) as HTMLElement | undefined;

         if (rootAreaElement) {
            console.log("[DragDrop:Folder] Cible: Zone racine générale");
            // Déplacer vers la racine (à la fin)
             // Animer vers une position par défaut (peut être amélioré)
            const listRect = rootAreaElement.getBoundingClientRect();
            dragState.dragIndicator.style.top = `${e.clientY}px`; // Ou listRect.bottom ?
            dragState.dragIndicator.style.left = `${listRect.left + listRect.width/2}px`;
            dragState.dragIndicator.style.opacity = '0';

              await removeConversationFromFolder(sourceFolderId, dragState.elementId);
            await addStandaloneConversation(conversationData);
            operationSuccess = true;
         } else {
            console.log("[DragDrop:Folder] Cible invalide.");
             // Animation de retour par défaut
            if (dragState.dragIndicator) {
               dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
               dragState.dragIndicator.style.opacity = '0';
            }
         }
      }
      
      // Si une opération de modification a réussi, RAFRAICHIR L'UI
      if (operationSuccess) {
          console.log("[DragDrop:Folder] Opération réussie, rafraîchissement de l'UI.");
          await renderFolders(); 
      } else {
         // Si l'opération a échoué ou pas de cible, on fait l'animation de retour
         // (Déjà géré dans les blocs logiques plus haut si nécessaire)
         console.log("[DragDrop:Folder] Aucune opération valide ou échec, annulation ou animation de retour déjà effectuée.");
         // On peut s'assurer ici que l'indicateur est bien caché si aucune autre animation n'a eu lieu
         if (dragState.dragIndicator && !operationSuccess) { // Double check
             // Peut-être redondant si l'animation de retour est déjà faite dans les 'else'
             // dragIndicator.style.transform = 'scale(0) rotate(0deg)';
             // dragIndicator.style.opacity = '0';
         }
      }
      
    } catch (error) {
      console.error("[DragDrop:Folder] Erreur lors de la finalisation du drag:", error);
      // Assurer l'animation de retour en cas d'erreur
      if (dragState.dragIndicator) {
        dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
        dragState.dragIndicator.style.opacity = '0';
      }
    } finally {
    // Laisser l'animation se terminer avant de nettoyer
    setTimeout(cleanupDrag, 200);
    }
  } else {
    // Si pas de drag ou élément invalide, nettoyer immédiatement
    cleanupDrag();
  }
}

/**
 * Trouve l'ID du dossier à partir de son élément DOM
 */
async function findFolderIdFromElement(folderElement: Element): Promise<string | null> {
  const folders = await getFolders();
  const folderItems = document.querySelectorAll('.le-chat-plus-folder-item');
  const folderIndex = Array.from(folderItems).indexOf(folderElement);
  if (folderIndex >= 0 && folderIndex < folders.length) {
    return folders[folderIndex].id;
  }
  return null;
} 