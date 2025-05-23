/**
 * Module de gestion du drag & drop pour les conversations de la liste principale (Mistral)
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
 * Initialise les gestionnaires d'événements pour les conversations Mistral
 */
export function initMistralConversationsDragAndDrop(): void {
  // Configuration des gestionnaires dans le module principal
  handlers.mistral.onDragStart = handleMistralConversationDragStart;
  handlers.mistral.onDragMove = handleMistralConversationDragMove;
  handlers.mistral.onDragEnd = handleMistralConversationDragEnd;
  
  // Initialiser les éléments présents au démarrage
  initConversationItems();
  
  // Observer les nouveaux éléments
  setupMutationObserver();
}

/**
 * Initialise les écouteurs d'événements sur les conversations existantes
 */
function initConversationItems(): void {
  // Sélectionner tous les éléments de conversation dans la sidebar
  const conversationItems = document.querySelectorAll('a[href^="/chat/"]');
  
  conversationItems.forEach(item => {
    // Éviter de configurer deux fois le même élément
    if (item.getAttribute('data-chat-plus-draggable')) return;
    
    // Marquer cet élément comme configuré
    item.setAttribute('data-chat-plus-draggable', 'true');
    item.classList.add('mistral-conversation-item');
    
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
      handleMistralConversationDragStart(e, item as HTMLElement);
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
 * Gère le début du glisser pour une conversation Mistral
 */
function handleMistralConversationDragStart(e: MouseEvent, element: HTMLElement): void {
  // Ne pas démarrer le drag sur un clic droit
  if (e.button !== 0) return;
  
  // Prévenir le comportement par défaut pour éviter la navigation
  e.preventDefault();
  
  // Extraire l'ID de conversation de l'URL
  const href = element.getAttribute('href');
  const conversationId = href ? href.split('/').pop() : null;
  
  if (!conversationId) return;
  
  // Stocker les informations dans l'état global
  dragState.isDragging = false;
  dragState.elementType = 'mistral';
  dragState.element = element;
  dragState.elementId = conversationId;
  dragState.sourceContainer = element.parentElement;
  dragState.startPosition = { x: e.clientX, y: e.clientY };
  dragState.currentPosition = { x: e.clientX, y: e.clientY };
  
  // Créer l'indicateur de drag, mais le laisser invisible pour l'instant
  dragState.dragIndicator = createDragIndicator(e, element);
  
  // Position initiale mais invisible jusqu'à ce qu'on commence vraiment à déplacer
  if (dragState.dragIndicator) {
    dragState.dragIndicator.style.opacity = '0';
    updateDragIndicatorPosition(e, dragState.dragIndicator);
  }
  
  // Désactiver la sélection de texte pendant le drag
  document.body.style.userSelect = 'none';
  
  // Créer et enregistrer des fonctions de gestionnaire pour les utiliser et les supprimer plus tard
  mouseUpHandler = handleMistralConversationDragEnd;
  mouseMoveHandler = handleMistralConversationDragMove;
  
  // Ajouter les écouteurs d'événements globaux
  window.addEventListener('mousemove', mouseMoveHandler);
  window.addEventListener('mouseup', mouseUpHandler);
}

/**
 * Gère le déplacement de la souris pendant le drag d'une conversation Mistral
 */
function handleMistralConversationDragMove(e: MouseEvent): void {
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
        safeSetStyle(dragState.element, 'opacity', '0.6');
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
  
  // Mettre à jour l'indicateur de drag et la cible de drop potentielle
  if (dragState.isDragging) {
    updateDragIndicatorPosition(e, dragState.dragIndicator);
      updateDropTarget(e);
  }
}

/**
 * Gère le relâchement de la souris (fin du drag) pour une conversation Mistral
 */
async function handleMistralConversationDragEnd(e: MouseEvent): Promise<void> {
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
  
  if (dragState.isDragging && dragState.elementId && dragState.element && dragState.dragIndicator) {
    let operationSuccess = false;
    try {
      operationSuccess = await executeDrop(dragState);
      
      if (operationSuccess) {
          if (droppedInPopover && popoverListContainer) {
            await renderFolders(popoverListContainer);
          }
      }
    } catch (error) {
      console.error("[DragDrop:Mistral] Erreur lors de l'exécution du drop:", error);
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