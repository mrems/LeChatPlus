/**
 * Module de gestion du drag & drop pour Le Chat+
 * Gère le glisser-déposer des conversations entre dossiers
 */

import type { ConversationRef, Folder } from './types';
import { safeSetStyle } from './ui-helpers';
import { getFolders } from './folder-operations';
import { reorderConversation } from './conversation-operations';
import { renderFolders } from './ui-renderer';
import { getValue } from './storage-manager';

/**
 * Configure le drag & drop pour les conversations dans les dossiers
 */
export function setupFolderConversationsDragAndDrop(): void {
  // Attendre que le DOM soit complètement chargé
  document.addEventListener('DOMContentLoaded', () => {
    // Initialiser une fois que les dossiers sont rendus
    setTimeout(() => {
      // Sélectionner tous les éléments de conversation dans les dossiers
      const conversationItems = document.querySelectorAll('.le-chat-plus-conversation-item');
      
      // Éviter de configurer plusieurs fois les mêmes éléments
      conversationItems.forEach(item => {
        if (item.getAttribute('data-drag-initialized') === 'true') return;
        
        item.setAttribute('data-drag-initialized', 'true');
        
        // Variables pour le suivi du drag & drop
        let isDragging = false;
        let draggedConversationId: string | null = null;
        let draggedConversationElement: Element | null = null;
        let originFolderItem: Element | null = null;
        let dragIndicator: HTMLElement | null = null;
        let reorderIndicator: HTMLElement | null = null;
        let startY = 0;
        
        // Démarrer le glisser au mousedown
        (item as HTMLElement).addEventListener('mousedown', (e: MouseEvent) => {
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
          draggedConversationId = item.getAttribute('data-conversation-id');
          draggedConversationElement = item;
          
          // Trouver le conteneur de dossier parent
          originFolderItem = (item as HTMLElement).closest('.le-chat-plus-folder-item');
          
          if (draggedConversationId && draggedConversationElement) {
            // Marquer le début du glisser
            isDragging = true;
            startY = e.clientY;
            
            // Désactiver la sélection de texte pendant le drag
            document.body.style.userSelect = 'none';
            
            // Créer l'indicateur de drag qui suivra le curseur
            dragIndicator = createDragIndicator(e, item as HTMLElement);
            
            // Ajouter les écouteurs de mouvement et relâchement
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            
            // Style de l'élément en cours de drag
            (draggedConversationElement as HTMLElement).classList.add('dragging');
            safeSetStyle(draggedConversationElement as HTMLElement, 'opacity', '0.5');
          }
        });
        
        // Fonction pour gérer le déplacement de la souris pendant le drag
        function handleMouseMove(moveEvent: MouseEvent): void {
          if (!isDragging || !draggedConversationElement || !dragIndicator) return;
          
          // Déplacer l'indicateur avec la souris
          updateDragIndicatorPosition(moveEvent);
          
          // Distance parcourue depuis le début du drag
          const distance = Math.abs(moveEvent.clientY - startY);
          
          // Ne commencer à traiter le drag qu'après un mouvement significatif
          if (distance < 5) return;
          
          // Trouver tous les éléments de conversation comme cibles potentielles
          const potentialTargets = document.querySelectorAll('.le-chat-plus-conversation-item');
          let currentDropTarget: Element | null = null;
          
          // Retirer les indicateurs visuels des précédentes cibles
          potentialTargets.forEach(target => {
            if (target !== draggedConversationElement) {
              target.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
            }
          });
          
          // Trouver la cible actuelle sous le curseur
          for (const target of potentialTargets) {
            if (target === draggedConversationElement) continue;
            
            const rect = (target as HTMLElement).getBoundingClientRect();
            
            // Vérifier si le curseur est sur cette cible
            if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
              currentDropTarget = target;
              
              // Déterminer si le curseur est dans la moitié supérieure ou inférieure
              const midPoint = rect.top + rect.height / 2;
              
              if (moveEvent.clientY < midPoint) {
                target.classList.add('drag-over', 'drag-over-top');
              } else {
                target.classList.add('drag-over', 'drag-over-bottom');
              }
              
              // Nous avons trouvé une cible, sortir de la boucle
              break;
            }
          }
          
          // Si nous avons un indicateur de réordonnancement existant, le supprimer
          if (reorderIndicator && reorderIndicator.parentNode) {
            reorderIndicator.parentNode.removeChild(reorderIndicator);
            reorderIndicator = null;
          }
          
          // Créer un indicateur visuel à la position de dépôt potentielle
          if (currentDropTarget) {
            const position = currentDropTarget.classList.contains('drag-over-top') ? 'before' : 'after';
            reorderIndicator = createReorderIndicator(currentDropTarget as HTMLElement, position);
          }
        }
        
        // Fonction pour gérer le relâchement de la souris (fin du drag)
        async function handleMouseUp(upEvent: MouseEvent): Promise<void> {
          if (isDragging && draggedConversationId && draggedConversationElement && originFolderItem) {
            // Trouver la cible de dépôt
            const dropTarget = document.querySelector('.le-chat-plus-conversation-item.drag-over');
            
            if (dropTarget) {
              // Calculer la position cible
              const isAbove = dropTarget.classList.contains('drag-over-top');
              let targetPosition = 0;
              
              // Récupérer toutes les conversations du même dossier
              const targetFolderItem = (dropTarget as HTMLElement).closest('.le-chat-plus-folder-item');
              if (targetFolderItem) {
                const allConversations = Array.from(
                  targetFolderItem.querySelectorAll('.le-chat-plus-conversation-item')
                );
                
                // Trouver l'index de la cible
                const targetIndex = allConversations.indexOf(dropTarget);
                
                // Calculer la position finale
                targetPosition = isAbove ? targetIndex : targetIndex + 1;
                
                // Ajuster si on déplace dans le même dossier et que la position est après l'élément courant
                if (targetFolderItem === originFolderItem) {
                  const currentIndex = allConversations.indexOf(draggedConversationElement);
                  if (currentIndex < targetIndex && !isAbove) {
                    targetPosition--;
                  }
                }
              }
              
              // Animation finale
              const targetRect = (dropTarget as HTMLElement).getBoundingClientRect();
              
              // Selon que l'on dépose au-dessus ou en-dessous
              if (dropTarget.classList.contains('drag-over-top')) {
                dragIndicator.style.top = `${targetRect.top - 1}px`;
              } else {
                dragIndicator.style.top = `${targetRect.bottom + 1}px`;
              }
              
              dragIndicator.style.left = `${targetRect.left + targetRect.width/2}px`;
              dragIndicator.style.opacity = '0';
              
              // Trouver l'ID du dossier
              const sourceFolderId = await findFolderIdFromElement(originFolderItem);
              
              if (sourceFolderId) {
                // Réorganiser la conversation dans le dossier
                await reorderConversation(sourceFolderId, draggedConversationId, targetPosition);
              }
            } else {
              // Pas de cible valide, animation de retour
              dragIndicator.style.transform = 'scale(0) rotate(0deg)';
              dragIndicator.style.opacity = '0';
            }
            
            // Laisser l'animation se terminer avant de nettoyer
            setTimeout(cleanup, 200);
          } else {
            cleanup();
          }
        }
        
        // Créer un indicateur visuel de position pour le réordonnancement
        function createReorderIndicator(targetElement: HTMLElement, position: 'before' | 'after'): HTMLElement {
          const indicator = document.createElement('div');
          indicator.className = 'reorder-indicator visible';
          
          // Insérer l'indicateur avant ou après l'élément cible
          if (position === 'before') {
            targetElement.parentNode?.insertBefore(indicator, targetElement);
          } else {
            const nextElement = targetElement.nextElementSibling;
            if (nextElement) {
              targetElement.parentNode?.insertBefore(indicator, nextElement);
            } else {
              targetElement.parentNode?.appendChild(indicator);
            }
          }
          
          return indicator;
        }
        
        // Trouver l'ID du dossier à partir de son élément DOM
        async function findFolderIdFromElement(folderElement: Element): Promise<string | null> {
          const folders = await getFolders();
          const folderItems = document.querySelectorAll('.le-chat-plus-folder-item');
          const folderIndex = Array.from(folderItems).indexOf(folderElement);
          if (folderIndex >= 0 && folderIndex < folders.length) {
            return folders[folderIndex].id;
          }
          return null;
        }
        
        // Nettoyer les ressources après le drag
        function cleanup(): void {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          
          // Nettoyer toutes les classes liées au drag
          document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
          });
          
          if (dragIndicator && dragIndicator.parentNode) {
            dragIndicator.parentNode.removeChild(dragIndicator);
          }
          
          // Nettoyer l'indicateur de réorganisation
          if (reorderIndicator && reorderIndicator.parentNode) {
            reorderIndicator.parentNode.removeChild(reorderIndicator);
          }
          
          if (draggedConversationElement) {
            draggedConversationElement.classList.remove('dragging');
            (draggedConversationElement as HTMLElement).style.opacity = '1';
          }
          
          document.body.style.userSelect = '';
          isDragging = false;
          draggedConversationId = null;
          draggedConversationElement = null;
        }
        
        // Mettre à jour la position de l'indicateur de drag
        function updateDragIndicatorPosition(evt: MouseEvent): void {
          if (dragIndicator) {
            // Déplacer l'élément avec un décalage par rapport au curseur
            dragIndicator.style.top = `${evt.clientY - 10}px`;
            dragIndicator.style.left = `${evt.clientX - dragIndicator.offsetWidth / 3}px`;
          }
        }
      });
    });
  });
}

/**
 * Configure le drag & drop pour les conversations entre la liste principale et les dossiers
 */
export function setupDragAndDropForConversations(): void {
  // Attendre que le DOM soit complètement chargé
  document.addEventListener('DOMContentLoaded', () => {
    // Initialiser une fois que l'interface est chargée
    setTimeout(() => {
      // TODO: Implémenter le drag & drop des conversations vers les dossiers
      console.log("Configuration du drag & drop des conversations principales");
    }, 1000);
  });
}

/**
 * Crée un indicateur visuel qui suit le curseur pendant le drag
 */
function createDragIndicator(evt: MouseEvent, sourceElement: HTMLElement): HTMLElement {
  // Créer l'élément indicateur
  const indicator = document.createElement('div');
  indicator.className = 'le-chat-plus-drag-indicator';
  
  // Appliquer les styles
  safeSetStyle(indicator, 'position', 'fixed');
  safeSetStyle(indicator, 'width', '16px');
  safeSetStyle(indicator, 'height', '16px');
  safeSetStyle(indicator, 'backgroundColor', 'var(--surface-primary, #6366f1)');
  safeSetStyle(indicator, 'borderRadius', '50%');
  safeSetStyle(indicator, 'zIndex', '10000');
  safeSetStyle(indicator, 'pointerEvents', 'none');
  safeSetStyle(indicator, 'transform', 'scale(0.7)');
  safeSetStyle(indicator, 'transition', 'transform 0.2s, opacity 0.2s');
  safeSetStyle(indicator, 'opacity', '0.85');
  safeSetStyle(indicator, 'boxShadow', '0 2px 4px rgba(0,0,0,0.2)');
  
  // Positionner initialement l'indicateur
  indicator.style.top = `${evt.clientY - 10}px`;
  indicator.style.left = `${evt.clientX - 8}px`;
  
  // Ajouter au DOM
  document.body.appendChild(indicator);
  
  return indicator;
} 