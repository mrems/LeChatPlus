/**
 * Module de base pour le système de drag and drop
 * Ce fichier contient les fonctions et types communs utilisés par tous les gestionnaires de drag and drop
 */

import { safeSetStyle } from '../ui-helpers';

// Types communs pour le système de drag and drop
export interface DragState {
  isDragging: boolean;
  elementType: 'mistral' | 'folder' | 'standalone' | null;
  element: HTMLElement | null;
  elementId: string | null;
  sourceContainer: HTMLElement | null;
  dragIndicator: HTMLElement | null;
  startPosition: { x: number, y: number };
  currentPosition: { x: number, y: number };
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
  currentPosition: { x: 0, y: 0 }
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
      background-color: rgba(255, 85, 0, 0.08);
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }
    
    /* Style spécifique pour le conteneur de dossiers */
    .le-chat-plus-folders-container.drag-over,
    .le-chat-plus-folders-title.drag-over,
    .le-chat-plus-folders-wrapper.drag-over {
      background-color: rgba(255, 85, 0, 0.08);
      border-radius: 4px;
      outline: 2px dashed rgba(255, 85, 0, 0.3);
      outline-offset: -2px;
      transition: all 0.2s ease;
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
    if (indicator && typeof indicator.style !== 'undefined') {
      // Déplacer l'élément avec un décalage par rapport au curseur
      indicator.style.top = `${evt.clientY - 15}px`;
      indicator.style.left = `${evt.clientX - 25}px`;
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
  if (isMistralConversation(element)) {
    console.log("[DragDrop] Début du drag pour une conversation Mistral");
    handlers.mistral.onDragStart(e, element);
  } else if (isFolderConversation(element)) {
    console.log("[DragDrop] Début du drag pour une conversation dans un dossier");
    handlers.folder.onDragStart(e, element);
  } else if (isStandaloneConversation(element)) {
    console.log("[DragDrop] Début du drag pour une conversation autonome");
    handlers.standalone.onDragStart(e, element);
  }
}

/**
 * Vérifie si un événement drag doit être ignoré
 */
function shouldIgnoreDragEvent(e: MouseEvent): boolean {
  const target = e.target as HTMLElement;
  
  // Ignorer les clics sur les boutons
  if (target.tagName === 'BUTTON' || target.closest('button')) {
    return true;
  }
  
  // Ignorer les clics sur les éléments éditables
  if (target.getAttribute('contenteditable') === 'true') {
    return true;
  }
  
  return false;
}

/**
 * Nettoie les ressources après un drag
 */
export function cleanupDrag(): void {
  try {
    // Nettoyer toutes les classes liées au drag
    document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });
    
    // Supprimer l'indicateur de drag s'il existe
    if (dragState.dragIndicator && dragState.dragIndicator.parentNode) {
      dragState.dragIndicator.parentNode.removeChild(dragState.dragIndicator);
    }
    
    // Restaurer le style de l'élément original s'il existe
    if (dragState.element) {
      dragState.element.classList.remove('dragging');
      safeSetStyle(dragState.element, 'opacity', '1');
    }
    
    // Réinitialiser l'état du document
    document.body.style.userSelect = '';
    
    // Réinitialiser l'état du drag
    Object.assign(dragState, {
      isDragging: false,
      elementType: null,
      element: null,
      elementId: null,
      sourceContainer: null,
      dragIndicator: null,
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 }
    });
  } catch (error) {
    console.error("Erreur lors du nettoyage du drag and drop:", error);
  }
} 