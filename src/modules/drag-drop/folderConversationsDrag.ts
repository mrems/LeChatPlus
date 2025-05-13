/**
 * Module de gestion du drag & drop pour les conversations dans les dossiers
 */

import { 
  dragState, 
  handlers, 
  createDragIndicator, 
  updateDragIndicatorPosition,
  cleanupDrag,
  updateDropTarget
} from './dragDropCore';
import { safeSetStyle } from '../ui-helpers';
import { renderFolders } from '../ui-renderer';
import { executeDrop } from './dropHandler';

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
  }
}

/**
 * Gère le déplacement de la souris pendant le drag d'une conversation en dossier
 * Simplifié pour appeler updateDropTarget
 */
function handleFolderConversationDragMove(e: MouseEvent): void {
  if (!dragState.element || !dragState.dragIndicator) return;
  
  dragState.currentPosition = { x: e.clientX, y: e.clientY };
  
  if (!dragState.isDragging) {
    const distance = Math.hypot(dragState.currentPosition.x - dragState.startPosition.x, 
                              dragState.currentPosition.y - dragState.startPosition.y);
    if (distance > 5) {
      // Empêcher le comportement par défaut SEULEMENT MAINTENANT qu'on drag vraiment
      e.preventDefault();
      dragState.isDragging = true;
      if (dragState.element) {
        dragState.element.classList.add('dragging');
        safeSetStyle(dragState.element, 'opacity', '0.5');
      }
      if (dragState.dragIndicator) {
        dragState.dragIndicator.style.opacity = '1';
      }
    } else {
      return;
    }
  }
  
  // Mettre à jour l'indicateur de drag et la cible de drop potentielle
  updateDragIndicatorPosition(e, dragState.dragIndicator);
  updateDropTarget(e);
}

/**
 * Gère la fin du glisser pour une conversation en dossier
 * Simplifié pour appeler executeDrop
 */
async function handleFolderConversationDragEnd(e: MouseEvent): Promise<void> {
  const folderActionsPopover = document.getElementById('le-chat-plus-folder-actions-popover');
  let droppedInPopover = false;
  let popoverListContainer: HTMLElement | null = null;

  if (folderActionsPopover && dragState.potentialDropTarget && dragState.potentialDropTarget.element) {
    if (dragState.potentialDropTarget.element.id === 'le-chat-plus-folder-popover-list-container') {
      droppedInPopover = true;
      popoverListContainer = dragState.potentialDropTarget.element;
    } else if (folderActionsPopover.contains(dragState.potentialDropTarget.element)) {
      const listContainer = dragState.potentialDropTarget.element.closest('#le-chat-plus-folder-popover-list-container');
      if (listContainer) {
        droppedInPopover = true;
        popoverListContainer = listContainer as HTMLElement;
      }
    }
  }

  if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
  if (mouseUpHandler) window.removeEventListener('mouseup', mouseUpHandler);
    mouseMoveHandler = null;
    mouseUpHandler = null;

  if (!dragState.isDragging) {
    const distance = Math.hypot(e.clientX - dragState.startPosition.x, e.clientY - dragState.startPosition.y);
    if (distance <= 5) {
      cleanupDrag();
      return;
    }
    dragState.isDragging = true; 
  }
  
  if (dragState.isDragging && dragState.elementId && dragState.element && dragState.sourceContainer && dragState.dragIndicator) {
    let operationSuccess = false;
    try {
      operationSuccess = await executeDrop(dragState);
      
      if (operationSuccess) {
          if (droppedInPopover && popoverListContainer) {
            await renderFolders(popoverListContainer);
          } else {
            await renderFolders();
          }
      }
    } catch (error) {
      console.error("[DragDrop:Folder] Erreur lors de l'exécution du drop:", error);
      operationSuccess = false;
    } finally {
        if (!operationSuccess && dragState.dragIndicator) {
             dragState.dragIndicator.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
             dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
             dragState.dragIndicator.style.opacity = '0';
        } else if (operationSuccess && dragState.dragIndicator) {
             dragState.dragIndicator.style.transition = 'opacity 0.1s ease-out';
             dragState.dragIndicator.style.opacity = '0';
        }
        setTimeout(cleanupDrag, 200);
    }
  } else {
    cleanupDrag();
  }
} 