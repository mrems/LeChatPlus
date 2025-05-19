/**
 * Module de gestion du drag & drop pour les conversations autonomes (à la racine)
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
  // Sélectionner tous les éléments .le-chat-plus-conversation-item potentiels
  const allPotentialStandaloneItems = document.querySelectorAll('.le-chat-plus-conversation-item');
  
  // Filtrer pour ne garder que les vraies conversations autonomes non encore initialisées
  const standaloneConversationItems = Array.from(allPotentialStandaloneItems).filter(item => {
    // Si déjà initialisé, on ne le refait pas
    if (item.getAttribute('data-drag-initialized') === 'true') {
      return false;
    }
    // Doit ne pas être dans un dossier
    return !item.closest('.le-chat-plus-folder-item');
  });

  if (standaloneConversationItems.length > 0) {
    console.log(`[DragDrop:Standalone] Initialisation de ${standaloneConversationItems.length} nouvelle(s) conversation(s) autonome(s)`);
  }
  
  standaloneConversationItems.forEach(item => {
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

  // Empêcher le comportement par défaut du navigateur IMMÉDIATEMENT
  e.preventDefault();
  
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
  }
}

/**
 * Gère le déplacement de la souris pendant le drag d'une conversation autonome
 */
function handleStandaloneConversationDragMove(e: MouseEvent): void {
  if (!dragState.element || !dragState.dragIndicator) return;
  
  dragState.currentPosition = { x: e.clientX, y: e.clientY };
  
  if (!dragState.isDragging) {
    const distance = Math.hypot(dragState.currentPosition.x - dragState.startPosition.x, 
                              dragState.currentPosition.y - dragState.startPosition.y);
    if (distance > 5) {
      // Empêcher le comportement par défaut SEULEMENT MAINTENANT qu'on drag vraiment
      e.preventDefault();
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
  
  // Mettre à jour l'indicateur de drag et la cible de drop potentielle
  updateDragIndicatorPosition(e, dragState.dragIndicator);
  updateDropTarget(e);
}

/**
 * Gère la fin du glisser pour une conversation autonome
 */
async function handleStandaloneConversationDragEnd(e: MouseEvent): Promise<void> {
  console.log("[DragDrop:Standalone] Mouse up. Drag state:", JSON.stringify(dragState));

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
  
  // Exécuter l'action de drop si on était en train de glisser
  if (dragState.isDragging && dragState.elementId && dragState.element && dragState.dragIndicator) {
    let operationSuccess = false;
    try {
      // Appeler le gestionnaire centralisé
      console.log("[DragDrop:Standalone] Avant executeDrop. Drag state:", JSON.stringify(dragState));
      operationSuccess = await executeDrop(dragState);
      console.log("[DragDrop:Standalone] Après executeDrop. operationSuccess:", operationSuccess);
      
      // Si une opération a réussi, rafraîchir l'UI
      if (operationSuccess) {
          console.log("[DragDrop:Standalone] Opération réussie, tentative de rafraîchissement de l'UI.");
          
          let targetRenderContainer: HTMLElement | undefined | null = undefined; // Initialiser à undefined ou null
          const folderActionsPopover = document.getElementById('le-chat-plus-folder-actions-popover');
          const popoverListContainer = document.getElementById('le-chat-plus-folder-popover-list-container');

          if (folderActionsPopover && folderActionsPopover.style.display !== 'none' && popoverListContainer) {
            if (dragState.potentialDropTarget && 
                dragState.potentialDropTarget.element && 
                folderActionsPopover.contains(dragState.potentialDropTarget.element)) {
              console.log("[DragDrop:Standalone] Le popover des actions de dossier est ouvert et la cible est dedans, rendu dans le popover.");
              targetRenderContainer = popoverListContainer;
            } else if ((!dragState.potentialDropTarget || !dragState.potentialDropTarget.element) && dragState.potentialDropTarget.type === 'rootArea') {
              // Cas où l'on dépose sur la rootArea du popover lui-même
              if (dragState.potentialDropTarget.element === popoverListContainer) {
                console.log("[DragDrop:Standalone] Le popover des actions de dossier est ouvert, rendu dans le popover (cible rootArea du popover).");
                targetRenderContainer = popoverListContainer;
              }
            }
          }
          
          if (targetRenderContainer) {
            console.log("[DragDrop:Standalone] Appel de renderFolders avec targetRenderContainer:", targetRenderContainer.id);
            await renderFolders(targetRenderContainer);
          } else {
            console.log("[DragDrop:Standalone] Pas de targetRenderContainer pertinent pour le popover, renderFolders n'est pas appelé.");
            // Auparavant: await renderFolders(); // Supprimé car il n'y a plus de sidebar à rendre par défaut
          }
          console.log("[DragDrop:Standalone] Fin de la logique de rafraîchissement UI.");
      } else {
          console.log("[DragDrop:Standalone] Opération NON réussie (operationSuccess est false), pas de rafraîchissement UI.");
      }
    } catch (error) {
      console.error("[DragDrop:Standalone] Erreur lors de l'exécution du drop ou du rendu:", error);
      operationSuccess = false; // S'assurer que c'est false en cas d'erreur
    } finally {
        console.log("[DragDrop:Standalone] Bloc finally. operationSuccess:", operationSuccess);
        // Gérer l'animation de fin (retour ou succès)
        if (!operationSuccess && dragState.dragIndicator) {
             // Animation de retour si échec ou pas de cible valide trouvée par executeDrop implicitement
             dragState.dragIndicator.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
             dragState.dragIndicator.style.transform = 'scale(0) rotate(0deg)';
      dragState.dragIndicator.style.opacity = '0';
        } else if (operationSuccess && dragState.dragIndicator) {
             // Animation de succès (disparition rapide)
             dragState.dragIndicator.style.transition = 'opacity 0.1s ease-out';
      dragState.dragIndicator.style.opacity = '0';
        }
      // Nettoyer après un délai pour l'animation
      setTimeout(cleanupDrag, 200);
    }
  } else {
    // Si pas de drag valide, nettoyer immédiatement
    cleanupDrag();
  }
} 