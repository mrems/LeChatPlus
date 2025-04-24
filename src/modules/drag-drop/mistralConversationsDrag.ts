/**
 * Module de gestion du drag & drop pour les conversations de la liste principale (Mistral)
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
  
  console.log('[DragDrop] Module pour les conversations Mistral initialisé');
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
  
  console.log("[DragDrop:Mistral] Mousedown sur conversation Mistral:", element.getAttribute('href')?.split('/').pop());
  
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
  // Vérifier que nous avons les informations nécessaires
  if (!dragState.element || !dragState.dragIndicator) return;
  
  // Si le bouton est relâché mais que mousemove est encore appelé
  if (e.buttons === 0) {
    cleanupDrag();
    return;
  }
  
  // Mettre à jour la position actuelle
  dragState.currentPosition = { x: e.clientX, y: e.clientY };
  
  // Activer le drag après un petit mouvement
  if (!dragState.isDragging) {
    const dx = dragState.currentPosition.x - dragState.startPosition.x;
    const dy = dragState.currentPosition.y - dragState.startPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
      dragState.isDragging = true;
      console.log("[DragDrop:Mistral] Drag démarré pour conversation Mistral:", dragState.elementId);
      
      // Maintenant qu'on drag vraiment, appliquer les styles
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
  
  if (dragState.isDragging && dragState.dragIndicator) {
    updateDragIndicatorPosition(e, dragState.dragIndicator);
    
    // Nettoyer les indicateurs de réorganisation précédents
    document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });
    
    // Trouver l'élément sous le curseur
    const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
    
    // Chercher un en-tête de dossier, une conversation dans un dossier, ou le dossier Chat principal
    const folderHeader = elementsUnderCursor.find(el => 
      el.classList && el.classList.contains('le-chat-plus-folder-header')
    ) as HTMLElement | undefined;
    
    const folderConversation = elementsUnderCursor.find(el => 
      el.classList && el.classList.contains('le-chat-plus-conversation-item')
    ) as HTMLElement | undefined;
    
    const chatFolder = elementsUnderCursor.find(el => 
      el.classList && (
        el.classList.contains('le-chat-plus-folders-container') || 
        el.classList.contains('le-chat-plus-folders-title') ||
        el.classList.contains('le-chat-plus-folders-wrapper') ||
        el.classList.contains('le-chat-folders') ||
        el.classList.contains('le-chat-plus-folders') ||
        el.id === 'le-chat-plus-folders-wrapper' ||
        el.id === 'le-chat-plus-folders' ||
        el.id === 'le-chat-plus-folders-list' ||
        el.id === 'le-chat-plus-folders-title' ||
        (el.querySelector && el.querySelector('.le-chat-plus-folders-title')) ||
        (el.closest && el.closest('#le-chat-plus-folders')) ||
        (el.closest && el.closest('#le-chat-plus-folders-wrapper'))
      )
    ) as HTMLElement | undefined;
    
    // Si on survole le dossier Chat principal
    if (chatFolder && !folderHeader && !folderConversation) {
      chatFolder.classList.add('drag-over');
      
      // Effet visuel sobre sur le clone
      dragState.dragIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      dragState.dragIndicator.style.borderColor = 'rgba(176, 176, 176, 0.4)';
      dragState.dragIndicator.style.background = 'rgba(255, 255, 255, 0.7)';
    }
    // Si on survole un en-tête de dossier
    else if (folderHeader) {
      folderHeader.classList.add('drag-over');
      // Effet visuel sobre sur le clone
      dragState.dragIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      dragState.dragIndicator.style.borderColor = 'rgba(176, 176, 176, 0.4)';
      dragState.dragIndicator.style.background = 'rgba(255, 255, 255, 0.7)';
    } 
    // Si on survole une conversation dans un dossier
    else if (folderConversation) {
      // Obtenir les dimensions de l'élément cible
      const targetRect = folderConversation.getBoundingClientRect();
      const middleY = targetRect.top + targetRect.height / 2;
      
      // Trouver le dossier parent
      const folderItem = folderConversation.closest('.le-chat-plus-folder-item');
      const folderHeader = folderItem?.querySelector('.le-chat-plus-folder-header');
      
      if (folderHeader) {
        folderHeader.classList.add('drag-over');
      }
      
      // Déterminer si on survole la moitié supérieure ou inférieure
      if (e.clientY < middleY) {
        // Survol de la moitié supérieure
        folderConversation.classList.add('drag-over-top');
      } else {
        // Survol de la moitié inférieure
        folderConversation.classList.add('drag-over-bottom');
      }
      
      // Effet visuel sobre sur le clone
      dragState.dragIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      dragState.dragIndicator.style.borderColor = 'rgba(176, 176, 176, 0.4)';
      dragState.dragIndicator.style.background = 'rgba(255, 255, 255, 0.7)';
    } else {
      // Pas de cible valide
      dragState.dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      dragState.dragIndicator.style.borderColor = 'rgba(221, 221, 221, 0.3)';
      dragState.dragIndicator.style.background = 'rgba(255, 255, 255, 0.6)';
    }
  }
}

/**
 * Gère le relâchement de la souris (fin du drag) pour une conversation Mistral
 */
async function handleMistralConversationDragEnd(e: MouseEvent): Promise<void> {
  console.log("[DragDrop:Mistral] Mouse up, isDragging =", dragState.isDragging, "elementId =", dragState.elementId);
  
  // Nettoyer les écouteurs d'événements globaux
  if (mouseMoveHandler) {
    window.removeEventListener('mousemove', mouseMoveHandler);
    mouseMoveHandler = null;
  }
  
  if (mouseUpHandler) {
    window.removeEventListener('mouseup', mouseUpHandler);
    mouseUpHandler = null;
  }
  
  if (dragState.isDragging && dragState.elementId && dragState.element && dragState.dragIndicator) {
    // Trouver les éléments sous le curseur au moment du relâchement
    const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
    const folderConversation = elementsUnderCursor.find(el => el.classList && el.classList.contains('le-chat-plus-conversation-item') && el.classList.contains('drag-over')) as HTMLElement | null;
    const folderHeader = elementsUnderCursor.find(el => el.classList && el.classList.contains('le-chat-plus-folder-header') && el.classList.contains('drag-over')) as HTMLElement | undefined;
    
    // Détecter si on est sur la zone générale des dossiers
    const chatFolder = elementsUnderCursor.find(el => 
      el.classList && (
        el.classList.contains('le-chat-plus-folders-wrapper') ||
        el.classList.contains('le-chat-folders') ||
        el.classList.contains('le-chat-plus-folders') ||
        el.id === 'le-chat-plus-folders-wrapper' ||
        el.id === 'le-chat-plus-folders' ||
        el.id === 'le-chat-plus-folders-list' ||
        el.id === 'le-chat-plus-folders-title' ||
        (el.querySelector && el.querySelector('.le-chat-plus-folders-title')) ||
        (el.closest && el.closest('#le-chat-plus-folders')) ||
        (el.closest && el.closest('#le-chat-plus-folders-wrapper'))
      )
    ) as HTMLElement | undefined;
    
    // Mettre à jour isOverChatFolder en fonction des éléments sous le curseur au moment du relâchement
    const isOverChatFolder = !!chatFolder && !folderHeader && !folderConversation;
    
    let operationSuccess = false;
    
    try {
      // Importer les fonctions nécessaires
      const { addStandaloneConversation, addConversationToFolder } = await import('../conversation-operations');
      const { renderFolders } = await import('../ui-renderer');

      // Si on drop sur le dossier Chat principal
      if (isOverChatFolder && chatFolder) {
        // Animation vers le dossier Chat
        const folderRect = chatFolder.getBoundingClientRect();
        dragState.dragIndicator.style.transform = 'scale(0.9)';
        dragState.dragIndicator.style.top = `${folderRect.top + 20}px`;
        dragState.dragIndicator.style.left = `${folderRect.left + 20}px`;
        dragState.dragIndicator.style.opacity = '0';
        
        chatFolder.classList.remove('drag-over');
        chatFolder.classList.add('drop-success');
        
        // Créer l'objet de données de conversation
        const href = dragState.element.getAttribute('href') || '';
        const conversationData = {
          id: dragState.elementId,
          title: dragState.element.textContent?.trim() || 'Conversation sans titre',
          url: href.startsWith('/') ? window.location.origin + href : href
        };
        
        await addStandaloneConversation(conversationData);
        operationSuccess = true; // Marquer comme succès
        
        setTimeout(() => chatFolder.classList.remove('drop-success'), 500);
        console.log(`[DragDrop:Mistral] Conversation ${dragState.elementId} ajoutée comme élément autonome`);
      }
      // 1. Drop sur une conversation dans un dossier (à une position spécifique)
      else if (folderConversation && folderConversation.closest('.le-chat-plus-folder-item')) {
        // Animation vers la position cible
        const rect = (folderConversation as HTMLElement).getBoundingClientRect();
        dragState.dragIndicator.style.transform = 'scale(0.9)';
        
        if (folderConversation.classList.contains('drag-over-top')) {
          dragState.dragIndicator.style.top = `${rect.top}px`;
        } else {
          dragState.dragIndicator.style.top = `${rect.bottom}px`;
        }
        
        dragState.dragIndicator.style.left = `${rect.left}px`;
        dragState.dragIndicator.style.opacity = '0';
        
        // Trouver l'ID du dossier et la position cible
        const folderItem = folderConversation.closest('.le-chat-plus-folder-item');
        if (folderItem) {
          // Chercher l'en-tête du dossier pour l'effet visuel
          const header = folderItem.querySelector('.le-chat-plus-folder-header');
          if (header) {
            header.classList.remove('drag-over');
            header.classList.add('drop-success');
          }
          
          // Trouver l'ID du dossier
          const folderId = await findFolderIdFromElement(folderItem);
          
          // Récupérer toutes les conversations du dossier pour calculer la position
          const conversationsInFolder = Array.from(folderItem.querySelectorAll('.le-chat-plus-conversation-item'));
          const targetIndex = conversationsInFolder.indexOf(folderConversation);
          
          // Déterminer si on dépose avant ou après la cible
          const isAbove = folderConversation.classList.contains('drag-over-top');
          const targetPosition = isAbove ? targetIndex : targetIndex + 1;
          
          console.log(`[DragDrop:Mistral] Drop sur conversation en dossier - position: ${targetPosition}`);
          
          if (folderId) {
            // Créer l'objet de données de conversation
            const href = dragState.element.getAttribute('href') || '';
            const conversationData = {
              id: dragState.elementId,
              title: dragState.element.textContent?.trim() || 'Conversation sans titre',
              url: href.startsWith('/') ? window.location.origin + href : href
            };
            
            await addConversationToFolder(folderId, conversationData, targetPosition);
            operationSuccess = true; // Marquer comme succès
            
            setTimeout(() => header?.classList.remove('drop-success'), 500);
            console.log(`[DragDrop:Mistral] Conversation ajoutée au dossier ${folderId} à la position ${targetPosition}`);
          }
        }
      }
      // 2. Drop sur un en-tête de dossier (ajouter à la fin du dossier)
      else if (folderHeader) {
        // Animation vers l'en-tête
        const folderRect = folderHeader.getBoundingClientRect();
        dragState.dragIndicator.style.transform = 'scale(0.9)';
        dragState.dragIndicator.style.top = `${folderRect.top + folderRect.height/2}px`;
        dragState.dragIndicator.style.left = `${folderRect.left + folderRect.width/2}px`;
        dragState.dragIndicator.style.opacity = '0';
        
        // Trouver l'ID du dossier
        const targetFolderItem = folderHeader.closest('.le-chat-plus-folder-item');
        if (targetFolderItem) {
          // Effet visuel
          folderHeader.classList.remove('drag-over');
          folderHeader.classList.add('drop-success');
          
          // Trouver l'ID du dossier
          const folderId = await findFolderIdFromElement(targetFolderItem);
          
          if (folderId) {
            // Créer l'objet de données de conversation
            const href = dragState.element.getAttribute('href') || '';
            const conversationData = {
              id: dragState.elementId,
              title: dragState.element.textContent?.trim() || 'Conversation sans titre',
              url: href.startsWith('/') ? window.location.origin + href : href
            };
            
            await addConversationToFolder(folderId, conversationData);
            operationSuccess = true; // Marquer comme succès
            
            setTimeout(() => folderHeader.classList.remove('drop-success'), 500);
            console.log(`[DragDrop:Mistral] Conversation ajoutée au dossier ${folderId}`);
          }
        }
      } 
      // Cas 3: Drop ailleurs (animation de retour)
      else {
        if (dragState.dragIndicator) {
            dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
            dragState.dragIndicator.style.opacity = '0';
        }
      }

      // Si une opération a réussi, RAFRAICHIR L'UI
      if (operationSuccess) {
          console.log("[DragDrop:Mistral] Opération réussie, rafraîchissement de l'UI.");
          await renderFolders();
      } 
      // Si échec ou drop invalide, s'assurer que l'animation de retour est faite (si pas déjà fait)
      else if (!folderConversation && !folderHeader && !isOverChatFolder && dragState.dragIndicator) {
           dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
           dragState.dragIndicator.style.opacity = '0';
      }

    } catch (error) {
      console.error("[DragDrop:Mistral] Erreur lors de la finalisation du drag:", error);
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