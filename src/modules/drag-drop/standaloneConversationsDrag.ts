/**
 * Module de gestion du drag & drop pour les conversations autonomes (à la racine)
 */

import { 
  dragState, 
  handlers, 
  createDragIndicator, 
  updateDragIndicatorPosition,
  cleanupDrag 
} from './dragDropCore';
import { safeSetStyle } from '../ui-helpers';
import { renderFolders } from '../ui-renderer';

let mouseUpHandler: ((e: MouseEvent) => void) | null = null;
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Initialise les gestionnaires d'événements pour les conversations autonomes
 */
export function initStandaloneConversationsDragAndDrop(): void {
  // Configuration des gestionnaires dans le module principal
  handlers.standalone.onDragStart = handleStandaloneConversationDragStart;
  handlers.standalone.onDragMove = handleStandaloneConversationDragMove;
  handlers.standalone.onDragEnd = handleStandaloneConversationDragEnd;
  
  // Initialiser les éléments présents au démarrage
  initConversationItems();
  
  // Observer les nouveaux éléments
  setupMutationObserver();
  
  console.log('[DragDrop] Module pour les conversations autonomes initialisé');
}

/**
 * Initialise les écouteurs d'événements sur les conversations existantes
 */
function initConversationItems(): void {
  // Sélectionner toutes les conversations autonomes (qui ne sont pas dans un dossier)
  const foldersList = document.querySelector('#le-chat-plus-folders-list');
  if (!foldersList) return;
  
  // Méthode 1: Conversations qui sont enfants directs du foldersList
  let conversationItems = Array.from(foldersList.children)
    .filter(child => 
      child.classList && 
      child.classList.contains('le-chat-plus-conversation-item') &&
      !child.closest('.le-chat-plus-folder-item'));
  
  // Si aucun élément n'est trouvé, essayer une méthode alternative
  if (conversationItems.length === 0) {
    // Méthode 2: Tous les éléments conversation-item qui ne sont pas dans un folder-item
    conversationItems = Array.from(document.querySelectorAll('.le-chat-plus-conversation-item'))
      .filter(item => !item.closest('.le-chat-plus-folder-item'));
  }
  
  console.log(`[DragDrop:Standalone] Détection de ${conversationItems.length} conversations autonomes`);
  
  // Éviter de configurer plusieurs fois les mêmes éléments
  conversationItems.forEach(item => {
    if (item.getAttribute('data-drag-initialized') === 'true') return;
    
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
      handleStandaloneConversationDragStart(e, item as HTMLElement);
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
 * Gère le début du glisser pour une conversation autonome
 */
function handleStandaloneConversationDragStart(e: MouseEvent, element: HTMLElement): void {
  // Ignorer les clics sur les boutons
  if ((e.target as HTMLElement).tagName === 'BUTTON' || 
      (e.target as HTMLElement).closest('button')) {
    return;
  }
  
  // S'assurer qu'on ne démarre pas le drag depuis un élément éditable
  if ((e.target as HTMLElement).getAttribute('contenteditable') === 'true') {
    return;
  }
  
  console.log("[DragDrop:Standalone] Mousedown sur conversation autonome:", element.getAttribute('data-conversation-id'));
  
  // Récupérer l'ID de la conversation
  const conversationId = element.getAttribute('data-conversation-id');
  
  if (conversationId) {
    // Mettre à jour l'état global du drag
    dragState.isDragging = false;
    dragState.elementType = 'standalone';
    dragState.element = element;
    dragState.elementId = conversationId;
    dragState.sourceContainer = document.querySelector('#le-chat-plus-folders-list');
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
    mouseUpHandler = handleStandaloneConversationDragEnd;
    mouseMoveHandler = handleStandaloneConversationDragMove;
    
    // Ajouter les écouteurs d'événements globaux
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);
    
    // Empêcher le comportement par défaut pour éviter la sélection de texte
    e.preventDefault();
  }
}

/**
 * Gère le déplacement de la souris pendant le drag d'une conversation autonome
 */
function handleStandaloneConversationDragMove(e: MouseEvent): void {
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
      console.log("[DragDrop:Standalone] Drag démarré pour conversation autonome:", dragState.elementId);
      
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
  
  // Nettoyer les indicateurs visuels précédents
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
  
  // Trouver si on survole un en-tête de dossier
  const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
  const folderHeader = elementsUnderCursor.find(el => 
    el.classList && el.classList.contains('le-chat-plus-folder-header')
  ) as HTMLElement | undefined;
  
  let targetFound = false;
  
  // Cas 1: Survol d'un en-tête de dossier (cible = dossier entier)
  if (folderHeader) {
    folderHeader.classList.add('drag-over');
    // Effet visuel sobre sur le clone
    dragState.dragIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    dragState.dragIndicator.style.borderColor = 'rgba(176, 176, 176, 0.4)';
    dragState.dragIndicator.style.background = 'rgba(255, 255, 255, 0.7)';
    targetFound = true;
  } 
  
  // Cas 2: Si pas sur un header, chercher une conversation cible (autonome ou dans un dossier)
  if (!targetFound) {
    // Sélectionner toutes les conversations (autonomes et dans les dossiers) comme cibles potentielles
    const potentialTargets = document.querySelectorAll('.le-chat-plus-conversation-item');
  let currentDropTarget: Element | null = null;
  
    for (const target of potentialTargets) {
      // Ignorer l'élément en cours de drag
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
      
        targetFound = true;
      // Nous avons trouvé une cible, sortir de la boucle
      break;
    }
    }
  }
  
  // Si aucune cible n'est trouvée (ni header, ni conversation)
  // On pourrait ajouter ici une logique pour cibler la zone racine vide si nécessaire
  if (!targetFound) {
      // Reset styles? Ou cibler la zone racine? Pour l'instant, on ne fait rien de plus.
  }
}

/**
 * Gère la fin du glisser pour une conversation autonome
 */
async function handleStandaloneConversationDragEnd(e: MouseEvent): Promise<void> {
  console.log("[DragDrop:Standalone] Mouse up, isDragging =", dragState.isDragging, "draggedConversationId =", dragState.elementId);

  // Nettoyer les écouteurs globaux immédiatement
  if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
  if (mouseUpHandler) window.removeEventListener('mouseup', mouseUpHandler);
    mouseMoveHandler = null;
    mouseUpHandler = null;

  // Vérifier si on était vraiment en train de glisser
  if (!dragState.isDragging) {
    // Si on n'a pas assez bougé, c'est un clic, on nettoie sans rien faire
    const distance = Math.hypot(e.clientX - dragState.startPosition.x, e.clientY - dragState.startPosition.y);
    if (distance <= 5) {
      console.log("[DragDrop:Standalone] Drag annulé (simple clic ou mouvement mineur)");
      cleanupDrag();
      return;
    }
    // Si on a bougé mais que le flag n'est pas passé à true (cas limite), on le force
    dragState.isDragging = true;
  }
  
  // Si on était en train de glisser et qu'on a un élément valide
  if (dragState.isDragging && dragState.elementId && dragState.element && dragState.dragIndicator) {
    let operationSuccess = false;
    
    // Trouver la cible de dépôt la plus spécifique (conversation avec drag-over)
    const dropTargetConversation = document.querySelector('.le-chat-plus-conversation-item.drag-over') as HTMLElement | null;
    
    // Trouver aussi si on survole un en-tête de dossier
    const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
    const folderHeader = elementsUnderCursor.find(el => 
      el.classList && el.classList.contains('le-chat-plus-folder-header') && el.classList.contains('drag-over')
    ) as HTMLElement | undefined;
    
    try {
      // Importer les opérations nécessaires
      const { 
        addConversationToFolder, 
        removeStandaloneConversation, 
        reorderStandaloneConversation 
      } = await import('../conversation-operations');
      const { renderFolders } = await import('../ui-renderer');
      
      // Cibler l'élément <a> pour le titre ET l'URL
      const linkElement = dragState.element.querySelector('a');
      const href = linkElement?.getAttribute('href') || '';
      const conversationData = {
        id: dragState.elementId,
        title: linkElement ? linkElement.textContent?.trim() || 'Conversation sans titre' : 'Conversation sans titre',
        // Utiliser l'URL complète récupérée du lien
        url: href.startsWith('/') ? window.location.origin + href : href 
      };
      
      // --- LOGIQUE DE DÉPÔT --- 

      // Cas 1: Déposer sur une conversation (autonome ou dans un dossier)
      if (dropTargetConversation) {
        const targetFolderItem = dropTargetConversation.closest('.le-chat-plus-folder-item');
        const isTargetInFolder = !!targetFolderItem;
        const isAbove = dropTargetConversation.classList.contains('drag-over-top');

        // Cas 1a: Déposer sur une conversation DANS UN DOSSIER
        if (isTargetInFolder && targetFolderItem) {
          console.log("[DragDrop:Standalone] Cible: Conversation dans un dossier");
          const targetFolderId = await findFolderIdFromElement(targetFolderItem);
          if (targetFolderId) {
            // Calculer la position dans le dossier cible
            const targetConversations = Array.from(targetFolderItem.querySelectorAll('.le-chat-plus-conversation-item'));
            const targetIndex = targetConversations.indexOf(dropTargetConversation);
            const targetPosition = isAbove ? targetIndex : targetIndex + 1;
            console.log(`[DragDrop:Standalone] Déplacement vers dossier ${targetFolderId}, position ${targetPosition}`);

            // Animer vers la position
            const targetRect = dropTargetConversation.getBoundingClientRect();
            dragState.dragIndicator.style.top = isAbove ? `${targetRect.top - 1}px` : `${targetRect.bottom + 1}px`;
            dragState.dragIndicator.style.left = `${targetRect.left + targetRect.width/2}px`;
            dragState.dragIndicator.style.opacity = '0';
            
            // Effectuer les opérations
            await removeStandaloneConversation(dragState.elementId);
            await addConversationToFolder(targetFolderId, conversationData, targetPosition);
            operationSuccess = true;
            
            // Effet visuel sur le dossier
            const header = targetFolderItem.querySelector('.le-chat-plus-folder-header');
            if(header) {
              header.classList.add('drop-success');
              setTimeout(() => header.classList.remove('drop-success'), 500);
            }
          } else {
            console.error("[DragDrop:Standalone] Impossible de trouver l'ID du dossier cible.");
          }
        } 
        // Cas 1b: Déposer sur une conversation AUTONOME (réorganisation)
        else {
          console.log("[DragDrop:Standalone] Cible: Autre conversation autonome (réorganisation)");
          // Calculer la position dans la liste autonome
          const standaloneConversations = Array.from(document.querySelectorAll('.le-chat-plus-conversation-item'))
            .filter(item => !item.closest('.le-chat-plus-folder-item'));
          const targetIndex = standaloneConversations.indexOf(dropTargetConversation);
          const currentIndex = standaloneConversations.indexOf(dragState.element); // L'index original
      let targetPosition = isAbove ? targetIndex : targetIndex + 1;
      
          // Ajuster si on déplace vers le bas après l'élément courant
          if (currentIndex !== -1 && currentIndex < targetIndex && !isAbove) {
        targetPosition--;
      }
          console.log(`[DragDrop:Standalone] Réorganisation à la position ${targetPosition}`);
          
          // Animer vers la position
          const targetRect = dropTargetConversation.getBoundingClientRect();
          dragState.dragIndicator.style.top = isAbove ? `${targetRect.top - 1}px` : `${targetRect.bottom + 1}px`;
      dragState.dragIndicator.style.left = `${targetRect.left + targetRect.width/2}px`;
      dragState.dragIndicator.style.opacity = '0';
      
          // Effectuer l'opération
        await reorderStandaloneConversation(dragState.elementId, targetPosition);
          operationSuccess = true;
        }
      } 
      // Cas 2: Déposer sur un en-tête de dossier (cible = fin du dossier)
    else if (folderHeader) {
        console.log("[DragDrop:Standalone] Cible: En-tête de dossier");
        const targetFolderItem = folderHeader.closest('.le-chat-plus-folder-item');
        if (targetFolderItem) {
          const targetFolderId = await findFolderIdFromElement(targetFolderItem);
          if (targetFolderId) {
            console.log(`[DragDrop:Standalone] Déplacement vers dossier ${targetFolderId} (fin)`);
            // Animer vers l'en-tête
      const folderRect = folderHeader.getBoundingClientRect();
      dragState.dragIndicator.style.transform = 'scale(0.9)';
      dragState.dragIndicator.style.top = `${folderRect.top + folderRect.height/2}px`;
      dragState.dragIndicator.style.left = `${folderRect.left + folderRect.width/2}px`;
      dragState.dragIndicator.style.opacity = '0';
      
            // Effectuer les opérations (ajout à la fin par défaut si pas de position)
            await removeStandaloneConversation(dragState.elementId);
            await addConversationToFolder(targetFolderId, conversationData);
            operationSuccess = true;

        // Effet visuel
        folderHeader.classList.remove('drag-over');
        folderHeader.classList.add('drop-success');
            setTimeout(() => folderHeader.classList.remove('drop-success'), 500);
          } else {
             console.error("[DragDrop:Standalone] Impossible de trouver l'ID du dossier cible depuis l'en-tête.");
          }
        } else {
           console.error("[DragDrop:Standalone] Impossible de trouver l'élément dossier parent de l'en-tête.");
        }
      } 
      // Cas 3: Déposer ailleurs (zone racine, non géré spécifiquement pour l'instant)
      else {
        console.log("[DragDrop:Standalone] Cible invalide ou zone racine non gérée.");
        // Animation de retour par défaut
      dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
      dragState.dragIndicator.style.opacity = '0';
    }
    
      // Si une opération a réussi, RAFRAICHIR L'UI
      if (operationSuccess) {
          console.log("[DragDrop:Standalone] Opération réussie, rafraîchissement de l'UI.");
          await renderFolders();
      } else {
        // Si l'opération a échoué ou pas de cible, on fait l'animation de retour
        if (dragState.dragIndicator && !folderHeader && !dropTargetConversation) {
           // Assurer l'animation de retour si pas déjà faite
           dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
           dragState.dragIndicator.style.opacity = '0';
        }
      }
      
    } catch (error) {
      console.error("[DragDrop:Standalone] Erreur lors de la finalisation du drag:", error);
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
  const { getFolders } = await import('../folder-operations');
  const folders = await getFolders();
  const folderItems = document.querySelectorAll('.le-chat-plus-folder-item');
  const folderIndex = Array.from(folderItems).indexOf(folderElement);
  if (folderIndex >= 0 && folderIndex < folders.length) {
    return folders[folderIndex].id;
  }
  return null;
} 