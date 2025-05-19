/**
 * Module de base pour le système de drag and drop
 * Ce fichier contient les fonctions et types communs utilisés par tous les gestionnaires de drag and drop
 */

import { safeSetStyle } from '../ui-helpers';
import { getFolders } from '../folder-operations'; // Import nécessaire pour findFolderIdFromElement

// Types communs pour le système de drag and drop

// Interface pour la cible de dépôt potentielle
export interface PotentialDropTarget {
  element: HTMLElement | null;
  type: 'conversation' | 'folderHeader' | 'rootArea' | null;
  position: 'before' | 'after' | 'inside' | null;
}

export interface DragState {
  isDragging: boolean;
  elementType: 'mistral' | 'folder' | 'standalone' | null;
  element: HTMLElement | null;
  elementId: string | null;
  sourceContainer: HTMLElement | null;
  dragIndicator: HTMLElement | null;
  startPosition: { x: number, y: number };
  currentPosition: { x: number, y: number };
  potentialDropTarget: PotentialDropTarget; // Ajouté
}

// État global du drag
export const dragState: DragState = {
  isDragging: false,
  elementType: null,
  element: null,
  elementId: null,
  sourceContainer: null,
  dragIndicator: null,
  startPosition: { x: 0, y: 0 },
  currentPosition: { x: 0, y: 0 },
  potentialDropTarget: { // Initialisation
    element: null,
    type: null,
    position: null
  }
};

// Gestionnaires par type d'élément, à remplir par les modules spécifiques
export const handlers = {
  mistral: {
    onDragStart: (e: MouseEvent, element: HTMLElement) => {},
    onDragMove: (e: MouseEvent) => {},
    onDragEnd: (e: MouseEvent) => {}
  },
  folder: {
    onDragStart: (e: MouseEvent, element: HTMLElement) => {},
    onDragMove: (e: MouseEvent) => {},
    onDragEnd: (e: MouseEvent) => {}
  },
  standalone: {
    onDragStart: (e: MouseEvent, element: HTMLElement) => {},
    onDragMove: (e: MouseEvent) => {},
    onDragEnd: (e: MouseEvent) => {}
  }
};

/**
 * Injecte les styles CSS nécessaires pour le drag and drop
 */
export function injectDragAndDropStyles(): void {
  if (typeof document === 'undefined') return;
  
  // Si l'élément style existe déjà, ne rien faire
  if (document.getElementById('le-chat-plus-drag-drop-styles')) return;
  
  // Créer un élément style pour nos règles CSS
  const styleElement = document.createElement('style');
  styleElement.id = 'le-chat-plus-drag-drop-styles';
  
  // Définir les styles pour le drag and drop
  styleElement.textContent = `
    /* Styles pour les éléments en cours de glissement */
    .dragging {
      opacity: 0.5 !important;
      position: relative;
      z-index: 1;
    }
    
    /* Styles pour les zones de dépôt */
    .drag-over {
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }
    
    /* Animation lors d'un dépôt réussi */
    .drop-success {
      animation: success-pulse 0.5s ease;
    }
    
    @keyframes success-pulse {
      0% { background-color: rgba(255, 85, 0, 0.2); }
      100% { background-color: transparent; }
    }
    
    /* Indicateur de drag qui suit le curseur */
    .le-chat-plus-drag-indicator {
      transition: transform 0.1s ease-out, opacity 0.15s ease-out;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    
    /* Désactiver le drag natif du navigateur sur les éléments configurés */
    [data-drag-initialized="true"],
    [data-chat-plus-draggable="true"] {
      -webkit-user-drag: none;
      user-drag: none;
    }
  `;
  
  // Ajouter le style au DOM s'il n'existe pas déjà
  if (!document.getElementById('le-chat-plus-drag-drop-styles')) {
    document.head.appendChild(styleElement);
  }
}

/**
 * Fonctions utilitaires pour la détection du type d'élément
 */
export function isMistralConversation(element: HTMLElement): boolean {
  return element.classList.contains('mistral-conversation-item') || 
         (element.tagName === 'A' && element.getAttribute('href')?.startsWith('/chat/'));
}

export function isFolderConversation(element: HTMLElement): boolean {
  return element.classList.contains('le-chat-plus-conversation-item') && 
         !!element.closest('.le-chat-plus-folder-item');
}

export function isStandaloneConversation(element: HTMLElement): boolean {
  return element.classList.contains('le-chat-plus-conversation-item') && 
         !element.closest('.le-chat-plus-folder-item');
}

/**
 * Crée un indicateur visuel qui suit le curseur pendant le drag
 */
export function createDragIndicator(evt: MouseEvent, sourceElement: HTMLElement): HTMLElement | null {
  try {
    // Créer l'élément indicateur
    const indicator = document.createElement('div');
    indicator.className = 'le-chat-plus-drag-indicator';
    
    // Ajouter l'icône de document SVG
    indicator.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>`;
    
    // Appliquer les styles
    safeSetStyle(indicator, 'position', 'fixed');
    safeSetStyle(indicator, 'zIndex', '10000');
    safeSetStyle(indicator, 'background', 'rgba(255, 255, 255, 0.75)');
    safeSetStyle(indicator, 'border', '1px solid rgba(221, 221, 221, 0.5)');
    safeSetStyle(indicator, 'borderRadius', '4px');
    safeSetStyle(indicator, 'padding', '6px');
    safeSetStyle(indicator, 'width', 'auto');
    safeSetStyle(indicator, 'height', 'auto');
    safeSetStyle(indicator, 'pointerEvents', 'none');
    safeSetStyle(indicator, 'boxShadow', '0 2px 8px rgba(0,0,0,0.1)');
    safeSetStyle(indicator, 'opacity', '0');
    safeSetStyle(indicator, 'transition', 'opacity 0.15s');
    safeSetStyle(indicator, 'color', 'rgba(51, 51, 51, 0.8)');
    safeSetStyle(indicator, 'display', 'flex');
    safeSetStyle(indicator, 'alignItems', 'center');
    safeSetStyle(indicator, 'justifyContent', 'center');
    
    // Positionner initialement l'indicateur
    indicator.style.top = `${evt.clientY - 15}px`;
    indicator.style.left = `${evt.clientX - 25}px`;
    
    // Ajouter au DOM
    document.body.appendChild(indicator);
    
    return indicator;
  } catch (error) {
    console.error("Erreur lors de la création de l'indicateur de drag:", error);
    return null;
  }
}

/**
 * Met à jour la position de l'indicateur pendant le drag
 */
export function updateDragIndicatorPosition(evt: MouseEvent, indicator: HTMLElement | null = null): void {
  try {
    // S'assurer que l'indicateur existe avant de mettre à jour sa position
    const targetIndicator = indicator || dragState.dragIndicator;
    if (targetIndicator && typeof targetIndicator.style !== 'undefined') {
      // Déplacer l'élément avec un décalage par rapport au curseur
      targetIndicator.style.top = `${evt.clientY - 15}px`;
      targetIndicator.style.left = `${evt.clientX - 25}px`;
    }
  } catch (error) {
    // Ignorer les erreurs pour une expérience utilisateur fluide
    console.error("Erreur lors de la mise à jour de l'indicateur:", error);
  }
}

/**
 * Initialise le système de drag and drop global
 */
export function initDragAndDrop(): void {
  // Injecter les styles CSS
  injectDragAndDropStyles();
  
  console.log("[DragDrop] Système de drag and drop initialisé");
  
  // Nettoyer les potentiels états précédents au cas où
  cleanupDrag();
}

/**
 * Fonction principale de délégation pour le début du drag
 */
export function handleDragStart(e: MouseEvent, element: HTMLElement): void {
  // Empêcher le comportement par défaut du navigateur
  e.preventDefault();
  
  // Vérifier si l'événement doit être ignoré (clic sur bouton, élément éditable, etc.)
  if (shouldIgnoreDragEvent(e)) return;
  
  // Détection du type d'élément
  let type: DragState['elementType'] = null;
  if (isMistralConversation(element)) {
    console.log("[DragDrop] Début du drag pour une conversation Mistral");
    type = 'mistral';
  } else if (isFolderConversation(element)) {
    console.log("[DragDrop] Début du drag pour une conversation dans un dossier");
    type = 'folder';
  } else if (isStandaloneConversation(element)) {
    console.log("[DragDrop] Début du drag pour une conversation autonome");
    type = 'standalone';
  }

  if (type && handlers[type] && handlers[type].onDragStart) {
    handlers[type].onDragStart(e, element);
  }
}

/**
 * Vérifie si un événement drag doit être ignoré
 */
function shouldIgnoreDragEvent(e: MouseEvent): boolean {
  // Ignorer les clics droits
  if (e.button !== 0) return true;
  
  const target = e.target as HTMLElement;
  // Ignorer si on clique sur un bouton ou un lien dans un bouton
  if (target.tagName === 'BUTTON' || target.closest('button')) return true;
  // Ignorer si on clique sur un élément éditable
  if (target.getAttribute('contenteditable') === 'true' || target.closest('[contenteditable="true"]')) return true;
  
  return false;
}

/**
 * Nettoie les ressources après un drag
 */
export function cleanupDrag(): void {
  // Nettoyer les écouteurs globaux (important)
  // Les fonctions de fin de drag doivent aussi les retirer mais ceinture et bretelles
  if (typeof window !== 'undefined') {
      // Il faudra s'assurer que les références aux handlers sont disponibles ici
      // ou passer les handlers à supprimer en argument, ou les stocker globalement.
      // Pour l'instant, on suppose que les handle...End spécifiques les retirent.
  }

  // Nettoyer les classes CSS
  if (dragState.element) {
    dragState.element.classList.remove('dragging');
    safeSetStyle(dragState.element, 'opacity', '1');
  }
    document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });
    
  // Supprimer l'indicateur de drag
    if (dragState.dragIndicator && dragState.dragIndicator.parentNode) {
      dragState.dragIndicator.parentNode.removeChild(dragState.dragIndicator);
    }
    
  // Réinitialiser l'état global
  dragState.isDragging = false;
  dragState.elementType = null;
  dragState.element = null;
  dragState.elementId = null;
  dragState.sourceContainer = null;
  dragState.dragIndicator = null;
  dragState.startPosition = { x: 0, y: 0 };
  dragState.currentPosition = { x: 0, y: 0 };
  dragState.potentialDropTarget = { element: null, type: null, position: null };

  // Rétablir la sélection de texte
  if (typeof document !== 'undefined') {
    document.body.style.userSelect = '';
  }
}

/**
 * Met à jour la cible de dépôt potentielle et l'indicateur visuel.
 */
export function updateDropTarget(e: MouseEvent): void {
  // Nettoyer les anciens indicateurs
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
  dragState.potentialDropTarget = { element: null, type: null, position: null }; // Réinitialiser

  const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
  let potentialTarget: HTMLElement | null = null;
  let targetType: PotentialDropTarget['type'] = null;
  let targetPosition: PotentialDropTarget['position'] = null;

  // Priorité 1: Conversation cible (.le-chat-plus-conversation-item, pas l'élément glissé lui-même)
  potentialTarget = elementsUnderCursor.find(el => 
      el.classList && 
      el.classList.contains('le-chat-plus-conversation-item') && 
      el !== dragState.element
  ) as HTMLElement | null;
  if (potentialTarget) {
      targetType = 'conversation';
      const rect = potentialTarget.getBoundingClientRect();
      const midPoint = rect.top + rect.height / 2;
      if (e.clientY < midPoint) {
          targetPosition = 'before';
          potentialTarget.classList.add('drag-over-top');
      } else {
          targetPosition = 'after';
          potentialTarget.classList.add('drag-over-bottom');
      }
      potentialTarget.classList.add('drag-over');
  }

  // Priorité 2: En-tête de dossier (.le-chat-plus-folder-header)
  if (!potentialTarget) {
      potentialTarget = elementsUnderCursor.find(el => 
          el.classList && el.classList.contains('le-chat-plus-folder-header')
      ) as HTMLElement | null;
      if (potentialTarget) {
          targetType = 'folderHeader';
          targetPosition = 'inside';
          potentialTarget.classList.add('drag-over');
          // On peut aussi appliquer drag-over au folder-item parent pour un meilleur visuel
          potentialTarget.closest('.le-chat-plus-folder-item')?.classList.add('drag-over');
      }
  }

  // Priorité 3: Zone racine générale (par exemple, #le-chat-plus-folders-list)
  if (!potentialTarget) {
      potentialTarget = elementsUnderCursor.find(el => 
        el.id === 'le-chat-plus-folders-list' || 
        el.id === 'le-chat-plus-folder-popover-list-container' ||
        (el.closest && (el.closest('#le-chat-plus-folders-list') || el.closest('#le-chat-plus-folder-popover-list-container'))) 
      ) as HTMLElement | null;
      if (potentialTarget) {
          // S'assurer qu'on cible bien la liste elle-même (si on a trouvé un enfant)
          if (potentialTarget.id === 'le-chat-plus-folders-list' || potentialTarget.id === 'le-chat-plus-folder-popover-list-container') {
            // C'est bon, potentialTarget est déjà le bon conteneur
          } else if (potentialTarget.closest('#le-chat-plus-folder-popover-list-container')) {
            potentialTarget = potentialTarget.closest('#le-chat-plus-folder-popover-list-container');
          } else {
            potentialTarget = document.getElementById('le-chat-plus-folders-list'); 
          }
          
          if (potentialTarget) {
            targetType = 'rootArea';
            targetPosition = 'inside'; // Pour une zone racine, 'inside' signifie généralement à la fin
            potentialTarget.classList.add('drag-over');
          }
      }
  }

  // Mettre à jour l'état global
  dragState.potentialDropTarget = { 
      element: potentialTarget, 
      type: targetType, 
      position: targetPosition 
  };
  
  // Optionnel: ajuster le style de l'indicateur de drag
  if (dragState.dragIndicator) {
      dragState.dragIndicator.style.borderColor = 'rgba(221, 221, 221, 0.5)'; // Toujours la couleur par défaut
  }
}

/**
 * Centralise la fonction pour trouver l'ID d'un dossier depuis son élément DOM.
 */
export async function findFolderIdFromElement(folderElement: Element | null): Promise<string | null> {
    if (!folderElement) return null;
    
    const directId = folderElement.getAttribute('data-folder-id');
    if (directId) return directId;

    // Si l'ID n'est pas direct, essayer une méthode basée sur l'index DOM relatif aux données stockées
    // C'est moins robuste mais nécessaire si data-folder-id n'est pas sur l'élément folder-item
    try {
        const folders = await getFolders(); // Récupère les dossiers ordonnés du stockage
        const folderItemsInDOM = document.querySelectorAll('.le-chat-plus-folder-item'); // Récupère les éléments dossier dans le DOM
        
        // Trouver l'index de notre élément dans la liste du DOM
        const folderIndex = Array.from(folderItemsInDOM).indexOf(folderElement);
        
        // Si l'élément est trouvé dans le DOM et que son index correspond à un dossier dans les données
        if (folderIndex >= 0 && folderIndex < folders.length) {
            console.log(`findFolderIdFromElement: ID trouvé par index DOM (${folderIndex}) -> ${folders[folderIndex].id}`);
            return folders[folderIndex].id; // Retourne l'ID du dossier correspondant depuis les données stockées
        }
  } catch (error) {
        console.error("Erreur dans findFolderIdFromElement lors de l'utilisation de l'index DOM:", error);
  }
    
    console.warn("findFolderIdFromElement: Impossible de trouver l'ID pour l'élément:", folderElement);
    return null; // Retourner null si aucun ID n'est trouvé
} 