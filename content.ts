/**
 * @plasmo-inject-css
 */
import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

// Configuration pour cibler uniquement les pages Mistral AI
export const config: PlasmoCSConfig = {
  matches: ["https://chat.mistral.ai/*"],
  all_frames: true
}

// Types pour l'application
interface ConversationRef {
  id: string
  title: string
  url: string
  addedAt: number
}

interface Folder {
  id: string
  name: string
  createdAt: number
  conversationCount: number
  expanded?: boolean
}

// Initialisation du stockage
const storage = new Storage()

// Script de contenu pour interagir avec la page web de Mistral AI Chat
console.log("Le Chat+ Extension activée sur cette page Mistral AI")

// Variables pour le drag and drop
let draggedConversationId = null;
let draggedConversationElement = null;
let dragOverlay = null;
let isDragging = false;
let dragIndicator = null;

// Image vide pour le drag and drop
const emptyDragImage = new Image();
emptyDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Fonction pour obtenir l'ID de la conversation active
function getCurrentConversationId(): string | null {
  const pathSegments = window.location.pathname.split('/')
  const chatIndex = pathSegments.indexOf('chat')
  
  // Vérifier si nous sommes sur une page de conversation
  if (chatIndex >= 0 && chatIndex + 1 < pathSegments.length) {
    return pathSegments[chatIndex + 1]
  }
  
  return null
}

// Fonction pour obtenir le titre de la conversation
function getConversationTitle(): string {
  const titleElement = document.querySelector('h1') || document.querySelector('.conversation-title')
  return titleElement ? titleElement.textContent?.trim() || 'Conversation sans titre' : 'Conversation sans titre'
}

// Injecter des styles CSS pour notre interface
function injectStyles() {
  const styleElement = document.createElement('style');
  styleElement.id = 'le-chat-plus-styles';
  styleElement.textContent = `
    .le-chat-plus-folder-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0px 8px;
      border-radius: 4px;
      cursor: pointer;
      background-color: transparent;
      border: none;
      transition: all 0.2s;
      box-sizing: border-box;
    }
    
    .le-chat-plus-folder-header:hover {
      background-color: var(--background-color-muted);
    }
    
    .le-chat-plus-folder-header.drag-over {
      background-color: rgba(0, 0, 0, 0.05);
      border: 1px dashed rgba(0, 0, 0, 0.25);
    }
    
    .le-chat-plus-folder-header.drop-success {
      background-color: rgba(0, 128, 0, 0.05);
      border: 1px solid rgba(0, 128, 0, 0.2);
    }
    
    .le-chat-plus-conversation-item {
      display: flex;
      align-items: center;
      padding: 0px 4px;
      font-size: 12px;
      border-bottom: none;
      transition: background-color 0.2s;
    }
    
    .le-chat-plus-conversation-item:hover {
      background-color: var(--background-color-muted);
    }
    
    .mistral-conversation-item {
      cursor: grab;
    }
    
    .mistral-conversation-item.dragging {
      opacity: 0.4;
      cursor: grabbing;
    }
    
    /* Styles pour masquer l'overlay pendant le drag */
    .drag-active-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: transparent;
      z-index: 9999;
      pointer-events: none;
    }
    
    /* Modal pour création et confirmation */
    .le-chat-plus-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .le-chat-plus-modal.visible {
      opacity: 1;
    }
    
    .le-chat-plus-modal-content {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      width: 300px;
      max-width: 90%;
      padding: 16px;
      transform: translateY(-20px);
      transition: transform 0.2s;
    }
    
    .le-chat-plus-modal.visible .le-chat-plus-modal-content {
      transform: translateY(0);
    }
    
    .le-chat-plus-modal-header {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 12px;
      color: #333;
    }
    
    .le-chat-plus-modal-message {
      font-size: 14px;
      margin-bottom: 16px;
      color: #555;
      line-height: 1.4;
    }
    
    .le-chat-plus-modal-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 16px;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    
    .le-chat-plus-modal-input:focus {
      outline: none;
      border-color: #999;
    }
    
    .le-chat-plus-modal-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    
    .le-chat-plus-modal-button {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    
    .le-chat-plus-modal-button.cancel {
      background-color: transparent;
      color: #666;
      border: 1px solid #ddd;
    }
    
    .le-chat-plus-modal-button.cancel:hover {
      background-color: #f5f5f5;
    }
    
    .le-chat-plus-modal-button.confirm {
      background-color: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
    }
    
    .le-chat-plus-modal-button.confirm:hover {
      background-color: #e5e5e5;
    }
    
    .le-chat-plus-modal-button.delete {
      background-color: rgba(220, 0, 0, 0.05);
      color: #d00;
      border: 1px solid rgba(220, 0, 0, 0.2);
    }
    
    .le-chat-plus-modal-button.delete:hover {
      background-color: rgba(220, 0, 0, 0.1);
    }
  `;
  
  document.head.appendChild(styleElement);
}

// Fonction pour afficher un modal
function showModal(options: {
  title: string;
  message?: string;
  inputPlaceholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  isDelete?: boolean;
}): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'le-chat-plus-modal';
    
    // Contenu du modal
    const modalContent = document.createElement('div');
    modalContent.className = 'le-chat-plus-modal-content';
    
    // En-tête
    const header = document.createElement('div');
    header.className = 'le-chat-plus-modal-header';
    header.textContent = options.title;
    
    // Message (optionnel)
    let input: HTMLInputElement | null = null;
    
    if (options.message) {
      const message = document.createElement('div');
      message.className = 'le-chat-plus-modal-message';
      message.textContent = options.message;
      modalContent.appendChild(message);
    }
    
    // Champ de saisie (optionnel)
    if (options.inputPlaceholder) {
      input = document.createElement('input');
      input.className = 'le-chat-plus-modal-input';
      input.type = 'text';
      input.placeholder = options.inputPlaceholder;
      modalContent.appendChild(input);
    }
    
    // Conteneur pour les boutons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'le-chat-plus-modal-buttons';
    
    // Bouton d'annulation
    const cancelButton = document.createElement('button');
    cancelButton.className = 'le-chat-plus-modal-button cancel';
    cancelButton.textContent = options.cancelLabel;
    
    // Bouton de confirmation
    const confirmButton = document.createElement('button');
    confirmButton.className = `le-chat-plus-modal-button ${options.isDelete ? 'delete' : 'confirm'}`;
    confirmButton.textContent = options.confirmLabel;
    
    // Assembler les éléments
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(confirmButton);
    
    modalContent.appendChild(header);
    modalContent.appendChild(buttonsContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Gérer les événements
    const close = (result: string | boolean | null) => {
      modal.classList.remove('visible');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }, 200);
      resolve(result);
    };
    
    cancelButton.addEventListener('click', () => close(null));
    
    confirmButton.addEventListener('click', () => {
      if (input) {
        const value = input.value.trim();
        if (value) {
          close(value);
        } else {
          input.focus();
          input.style.borderColor = '#ff5555';
          setTimeout(() => {
            input.style.borderColor = '#ddd';
          }, 800);
        }
      } else {
        close(true);
      }
    });
    
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = input.value.trim();
          if (value) {
            close(value);
          }
        } else if (e.key === 'Escape') {
          close(null);
        }
      });
    }
    
    // Fermer le modal si on clique en dehors
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        close(null);
      }
    });
    
    // Afficher le modal avec une animation
    requestAnimationFrame(() => {
      modal.classList.add('visible');
      if (input) input.focus();
    });
  });
}

// Fonction pour afficher un modal de création de dossier
function showFolderCreateModal(): Promise<string | null> {
  return showModal({
    title: 'Créer un nouveau dossier',
    inputPlaceholder: 'Nom du dossier',
    confirmLabel: 'Créer',
    cancelLabel: 'Annuler'
  }) as Promise<string | null>;
}

// Fonction pour afficher un modal de confirmation de suppression
function showDeleteConfirmModal(itemName: string, itemType: 'dossier' | 'conversation'): Promise<boolean | null> {
  return showModal({
    title: `Supprimer ${itemType === 'dossier' ? 'le dossier' : 'la conversation'}`,
    message: `Voulez-vous vraiment supprimer ${itemType === 'dossier' ? 'le dossier' : 'la conversation'} "${itemName}" ?`,
    confirmLabel: 'Supprimer',
    cancelLabel: 'Annuler',
    isDelete: true
  }) as Promise<boolean | null>;
}

// Ajouter les attributs et événements drag and drop aux conversations Mistral
function setupDragAndDropForConversations() {
  // Sélectionner tous les éléments de conversation dans la sidebar
  const conversationItems = document.querySelectorAll('a[href^="/chat/"]');
  
  conversationItems.forEach(item => {
    // Éviter de configurer deux fois le même élément
    if (item.getAttribute('data-chat-plus-draggable')) return;
    
    // Marquer cet élément comme configuré
    item.setAttribute('data-chat-plus-draggable', 'true');
    item.classList.add('mistral-conversation-item');
    
    // Extraire l'ID de conversation de l'URL
    const href = item.getAttribute('href');
    const conversationId = href ? href.split('/').pop() : null;
    
    if (!conversationId) return;
    
    // Utiliser mousedown/mousemove au lieu de drag and drop natif
    item.addEventListener('mousedown', (e: MouseEvent) => {
      // Ne pas démarrer le drag sur un clic droit
      if (e.button !== 0) return;
      
      // Stocker les informations de la conversation
      draggedConversationId = conversationId;
      draggedConversationElement = item;
      
      // Créer une copie visuelle de l'élément pour le drag
      const rect = item.getBoundingClientRect();
      dragIndicator = document.createElement('div');
      dragIndicator.className = 'conversation-drag-clone';
      dragIndicator.innerHTML = item.innerHTML;
      dragIndicator.style.position = 'fixed';
      dragIndicator.style.zIndex = '10000';
      dragIndicator.style.background = 'rgba(255, 255, 255, 0.25)';
      dragIndicator.style.border = '1px solid rgba(221, 221, 221, 0.3)';
      dragIndicator.style.borderRadius = '4px';
      dragIndicator.style.padding = '8px';
      dragIndicator.style.width = `${rect.width}px`;
      dragIndicator.style.pointerEvents = 'none';
      dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
      dragIndicator.style.opacity = '0';
      dragIndicator.style.transition = 'opacity 0.15s';
      dragIndicator.style.color = 'rgba(51, 51, 51, 0.7)';
      dragIndicator.style.fontSize = '12px';
      document.body.appendChild(dragIndicator);
      
      // Position initiale
      updateDragIndicatorPosition(e);
      
      // Ajouter la classe pour le style
      item.classList.add('dragging');
      
      // Semi-transparence pour l'élément original
      (item as HTMLElement).style.opacity = '0.6';
      
      // Désactiver la sélection de texte pendant le drag
      document.body.style.userSelect = 'none';
      
      // Stocker les informations dans une variable globale 
      const conversationData = {
        id: conversationId,
        title: item.textContent?.trim() || 'Conversation sans titre',
        url: window.location.origin + href
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      // Prévenir le comportement par défaut 
      e.preventDefault();
      
      function handleMouseMove(moveEvent: MouseEvent) {
        if (!isDragging && moveEvent.buttons === 0) {
          // Si le bouton est relâché mais que mousemove est encore appelé
          cleanup();
          return;
        }
        
        // Activer le drag après un petit mouvement
        if (!isDragging) {
          const dx = moveEvent.clientX - e.clientX;
          const dy = moveEvent.clientY - e.clientY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 5) {
            isDragging = true;
            dragIndicator.style.opacity = '1';
          }
        }
        
        if (isDragging) {
          updateDragIndicatorPosition(moveEvent);
          
          // Trouver l'élément sous le curseur
          const elementsUnderCursor = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
          const folderHeader = elementsUnderCursor.find(el => 
            el.classList && el.classList.contains('le-chat-plus-folder-header')
          );
          
          // Nettoyer les classes drag-over
          document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
          });
          
          // Ajouter la classe drag-over
          if (folderHeader) {
            folderHeader.classList.add('drag-over');
            // Effet visuel sobre sur le clone
            dragIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
            dragIndicator.style.borderColor = 'rgba(176, 176, 176, 0.4)';
            dragIndicator.style.background = 'rgba(255, 255, 255, 0.35)';
          } else {
            dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            dragIndicator.style.borderColor = 'rgba(221, 221, 221, 0.3)';
            dragIndicator.style.background = 'rgba(255, 255, 255, 0.25)';
          }
        }
      }
      
      function handleMouseUp(upEvent: MouseEvent) {
        if (isDragging) {
          // Animation de drop
          dragIndicator.style.transition = 'all 0.15s ease-out';
          
          // Trouver l'élément sous le curseur pour le drop
          const elementsUnderCursor = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
          const folderHeader = elementsUnderCursor.find(el => 
            el.classList && el.classList.contains('le-chat-plus-folder-header')
          );
          
          if (folderHeader) {
            // Animation vers le dossier cible
            const folderRect = folderHeader.getBoundingClientRect();
            dragIndicator.style.transform = 'scale(0.8)';
            dragIndicator.style.top = `${folderRect.top + folderRect.height/2}px`;
            dragIndicator.style.left = `${folderRect.left + folderRect.width/2}px`;
            dragIndicator.style.opacity = '0';
            
            // Trouver l'ID du dossier
            const folderItem = folderHeader.closest('.le-chat-plus-folder-item');
            if (folderItem) {
              // Effet visuel
              folderHeader.classList.remove('drag-over');
              folderHeader.classList.add('drop-success');
              
              // Trouver l'ID du dossier en parcourant les données
              const findFolderIdFromElement = async () => {
                const folders = await getFolders();
                const folderItems = document.querySelectorAll('.le-chat-plus-folder-item');
                const folderIndex = Array.from(folderItems).indexOf(folderItem);
                if (folderIndex >= 0 && folderIndex < folders.length) {
                  return folders[folderIndex].id;
                }
                return null;
              };
              
              // Exécuter le drop
              findFolderIdFromElement().then(folderId => {
                if (folderId) {
                  addConversationToFolder(folderId, conversationData);
                  
                  // Retirer la classe après un délai
                  setTimeout(() => {
                    if (folderHeader) {
                      folderHeader.classList.remove('drop-success');
                    }
                  }, 500);
                }
              });
            }
          } else {
            // Animation de retour à l'origine si pas déposé sur un dossier
            dragIndicator.style.transform = 'scale(0) rotate(0deg)';
            dragIndicator.style.opacity = '0';
          }
          
          // Laisser l'animation se terminer avant de nettoyer
          setTimeout(cleanup, 200);
        } else {
          cleanup();
        }
      }
      
      function cleanup() {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        // Nettoyer toutes les classes liées au drag
        document.querySelectorAll('.drag-over').forEach(el => {
          el.classList.remove('drag-over');
        });
        
        if (dragIndicator && dragIndicator.parentNode) {
          dragIndicator.parentNode.removeChild(dragIndicator);
          dragIndicator = null;
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
      
      function updateDragIndicatorPosition(evt: MouseEvent) {
        if (dragIndicator) {
          // Déplacer l'élément avec un décalage par rapport au curseur
          dragIndicator.style.top = `${evt.clientY - 10}px`;
          dragIndicator.style.left = `${evt.clientX - dragIndicator.offsetWidth / 3}px`;
        }
      }
    });
  });
}

// Fonction sûre pour définir des styles
function safeSetStyle(element: HTMLElement | null, property: string, value: string): void {
  if (element && element.style) {
    element.style[property as any] = value;
  }
}

// Injecter l'interface des dossiers dans la sidebar
async function injectFoldersUI() {
  console.log("Tentative d'injection de l'interface des dossiers...");
  
  // Injecter d'abord les styles CSS
  if (!document.getElementById('le-chat-plus-styles')) {
    injectStyles();
  }
  
  // Vérifier si nous avons déjà injecté notre UI
  if (document.getElementById('le-chat-plus-folders')) {
    setupDragAndDropForConversations();
    return;
  }
  
  // Trouver l'élément "Passez à Le Chat Pro" - plusieurs approches pour le trouver
  const proBtnSelectors = [
    'a[href*="pro"]', // Sélecteur basé sur l'attribut href
    'a:contains("Pro")', // Sélecteur basé sur le texte
    'a:contains("Passez")', // Autre texte possible
    '[role="navigation"] a', // Tous les liens dans la navigation
  ];
  
  let proButton = null;
  let sidebarElement = null;
  
  // Trouver tous les liens dans le document
  const allLinks = document.querySelectorAll('a');
  
  // Rechercher le bouton "Passez à Le Chat Pro" en fonction du texte
  for (const link of allLinks) {
    const linkText = link.textContent?.toLowerCase() || '';
    if (linkText.includes('pro') || linkText.includes('passez') || linkText.includes('chat pro')) {
      proButton = link;
      console.log("Bouton Pro trouvé:", proButton);
      break;
    }
  }
  
  // Si nous avons trouvé le bouton Pro, chercher son conteneur parent
  if (proButton) {
    // Remonter dans la hiérarchie DOM pour trouver l'élément de navigation
    let parent = proButton.parentElement;
    while (parent && !parent.querySelector('a[href^="/chat/"]') && parent.tagName !== 'NAV' && parent.tagName !== 'ASIDE') {
      parent = parent.parentElement;
    }
    
    if (parent) {
      sidebarElement = parent;
      console.log("Sidebar trouvée via le bouton Pro:", sidebarElement);
    }
  }
  
  // Si nous n'avons pas trouvé via le bouton Pro, essayer d'autres méthodes
  if (!sidebarElement) {
    // Essayons plusieurs sélecteurs pour trouver la barre latérale
    const sidebarSelectors = [
      '[role="navigation"]',
      'nav',
      'aside',
      '.sidebar', 
      '.navigation',
      // Sélecteur spécifique à Mistral AI (à mettre à jour si nécessaire)
      'div[class*="sidebar"], div[class*="navigation"], div[class*="nav-"]'
    ];
    
    for (const selector of sidebarSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Vérifier si cet élément contient des liens vers des conversations
        if (el.querySelector('a[href^="/chat/"]')) {
          sidebarElement = el;
          break;
        }
      }
      if (sidebarElement) break;
    }
  }
  
  // Si nous n'avons pas trouvé la sidebar, cherchons des conversations directement
  if (!sidebarElement) {
    const conversationLinks = document.querySelectorAll('a[href^="/chat/"]');
    if (conversationLinks.length > 0) {
      // Remonter dans le DOM pour trouver un conteneur commun
      let parent = conversationLinks[0].parentElement as HTMLElement | null;
      while (parent && parent.tagName !== 'NAV' && parent.tagName !== 'ASIDE' && parent.tagName !== 'DIV') {
        parent = parent.parentElement as HTMLElement | null;
      }
      if (parent) {
        sidebarElement = parent;
      }
    }
  }
  
  // Dernière tentative: si nous n'avons pas trouvé de sidebar, créons un observateur pour le DOM
  if (!sidebarElement) {
    console.log("Sidebar non trouvée, configuration d'un observateur...");
    setupDOMObserver();
    return;
  }
  
  console.log("Sidebar trouvée:", sidebarElement);
  
  // Créer une section pour nos dossiers
  const foldersSection = document.createElement('div');
  foldersSection.id = 'le-chat-plus-folders';
  safeSetStyle(foldersSection, 'padding', '0 8px');
  safeSetStyle(foldersSection, 'maxWidth', '100%');
  
  // Titre de section
  const folderHeader = document.createElement('div');
  safeSetStyle(folderHeader, 'display', 'flex');
  safeSetStyle(folderHeader, 'justifyContent', 'space-between');
  safeSetStyle(folderHeader, 'alignItems', 'center');
  safeSetStyle(folderHeader, 'padding', '8px 0px');
  safeSetStyle(folderHeader, 'borderBottom', '1px solid rgba(0, 0, 0, 0.1)');
  
  const folderTitle = document.createElement('h3');
  safeSetStyle(folderTitle, 'margin', '0');
  safeSetStyle(folderTitle, 'fontSize', '12px');
  safeSetStyle(folderTitle, 'fontWeight', 'bolder');
  safeSetStyle(folderTitle, 'color', '#4D4D55');
  safeSetStyle(folderTitle, 'display', 'flex');
  safeSetStyle(folderTitle, 'alignItems', 'center');
  
  // Ajout de l'icône dossier
  const folderIcon = document.createElement('span');
  folderIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>`;
  safeSetStyle(folderIcon, 'marginRight', '8px');
  safeSetStyle(folderIcon, 'display', 'flex');
  safeSetStyle(folderIcon, 'alignItems', 'center');
  safeSetStyle(folderIcon, 'color', 'var(--text-color-subtle)');
  
  const titleText = document.createElement('span');
  titleText.textContent = 'Le Chat Folders';
  safeSetStyle(titleText, 'color', 'var(--text-color-subtle)');
  
  folderTitle.appendChild(folderIcon);
  folderTitle.appendChild(titleText);
  
  const addFolderButton = document.createElement('button');
  addFolderButton.innerHTML = '+';
  addFolderButton.title = 'Ajouter un dossier';
  safeSetStyle(addFolderButton, 'background', 'var(--background-color-badge-gray)');
  safeSetStyle(addFolderButton, 'color', 'var(--text-color-subtle)');
  safeSetStyle(addFolderButton, 'border', '1px solid var(--background-color-badge-gray)');
  safeSetStyle(addFolderButton, 'borderRadius', '4px');
  safeSetStyle(addFolderButton, 'width', '20px');
  safeSetStyle(addFolderButton, 'height', '20px');
  safeSetStyle(addFolderButton, 'display', 'flex');
  safeSetStyle(addFolderButton, 'alignItems', 'center');
  safeSetStyle(addFolderButton, 'justifyContent', 'center');
  safeSetStyle(addFolderButton, 'cursor', 'pointer');
  safeSetStyle(addFolderButton, 'fontWeight', 'normal');
  safeSetStyle(addFolderButton, 'fontSize', '16px');
  safeSetStyle(addFolderButton, 'transition', 'all 0.2s');
  safeSetStyle(addFolderButton, 'boxShadow', 'none');
  
  folderHeader.appendChild(folderTitle);
  folderHeader.appendChild(addFolderButton);
  foldersSection.appendChild(folderHeader);
  
  // Conteneur pour la liste des dossiers
  const foldersList = document.createElement('div');
  foldersList.id = 'le-chat-plus-folders-list';
  safeSetStyle(foldersList, 'maxHeight', '300px');
  safeSetStyle(foldersList, 'overflowY', 'auto');
  foldersSection.appendChild(foldersList);
  
  // Stratégie d'insertion : essayer d'abord après le bouton Pro
  if (proButton) {
    const proButtonContainer = proButton.parentElement;
    if (proButtonContainer && proButtonContainer.parentElement) {
      const targetNode = proButtonContainer.parentElement;
      
      // Insérer après le bouton Pro
      if (targetNode.nextSibling) {
        targetNode.parentElement.insertBefore(foldersSection, targetNode.nextSibling);
        console.log("Dossiers insérés après le bouton Pro");
      } else {
        targetNode.parentElement.appendChild(foldersSection);
        console.log("Dossiers ajoutés à la fin du parent du bouton Pro");
      }
    } else {
      // Fallback: insérer après le bouton Pro directement
      if (proButton.nextSibling) {
        proButton.parentElement.insertBefore(foldersSection, proButton.nextSibling);
      } else {
        proButton.parentElement.appendChild(foldersSection);
      }
    }
  } else {
    // Fallback: utiliser la stratégie précédente
    // Corriger le problème de type pour conversationsContainer
    const divs = Array.from(sidebarElement.querySelectorAll('div'));
    let conversationsContainer: HTMLElement | null = null;

    for (const div of divs) {
      const htmlDiv = div as HTMLElement;
      if (htmlDiv.querySelector && htmlDiv.querySelector('a[href^="/chat/"]')) {
        const parent = htmlDiv.parentElement;
        if (parent) {
          conversationsContainer = parent;
          break;
        }
      }
    }
    
    if (conversationsContainer) {
      // Insérer avant le conteneur de conversations
      conversationsContainer.parentElement.insertBefore(foldersSection, conversationsContainer);
    } else {
      // Stratégie 2: Insérer au début de la sidebar
      sidebarElement.insertBefore(foldersSection, sidebarElement.firstChild);
    }
  }
  
  // Charger et afficher les dossiers
  await renderFolders();
  
  // Configurer le drag and drop pour les conversations existantes
  setupDragAndDropForConversations();
  
  // Ajouter gestionnaire d'événements pour le bouton "+"
  addFolderButton.addEventListener('click', async () => {
    const folderName = await showFolderCreateModal();
    if (folderName) {
      await createFolder(folderName);
      await renderFolders();
    }
  });
  
  console.log("Interface des dossiers injectée avec succès");
}

// Observer les mutations du DOM pour injecter notre UI quand la sidebar devient disponible
function setupDOMObserver() {
  const observer = new MutationObserver((mutations) => {
    // Chercher la sidebar dans les mutations
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // Vérifier si ce nœud ou ses enfants contiennent des liens de conversation
            const hasConversationLinks = node.querySelector('a[href^="/chat/"]');
            if (hasConversationLinks) {
              // Trouvé! Injectons notre interface
              injectFoldersUI();
              return;
            }
          }
        }
      }
    }
    
    // Vérifier périodiquement si notre interface existe déjà
    if (!document.getElementById('le-chat-plus-folders')) {
      injectFoldersUI();
    } else {
      // Si notre interface existe, configurer le drag and drop
      setupDragAndDropForConversations();
    }
  });
  
  // Observer tout le document
  observer.observe(document.body, { childList: true, subtree: true });
}

// Créer un nouveau dossier
async function createFolder(name: string): Promise<void> {
  const folders = await getFolders();
  
  const newFolder: Folder = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    conversationCount: 0,
    expanded: false
  };
  
  folders.push(newFolder);
  await storage.set('folders', folders);
}

// Obtenir tous les dossiers
async function getFolders(): Promise<Folder[]> {
  const folders = await storage.get<Folder[]>('folders');
  return folders || [];
}

// Ajouter une conversation à un dossier
async function addConversationToFolder(folderId: string, conversation: {id: string, title: string, url: string}): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) return;
  
  // Récupérer les conversations actuelles du dossier
  const conversations = await storage.get<ConversationRef[]>(`folder_conversations_${folderId}`) || [];
  
  // Vérifier si la conversation est déjà dans le dossier
  if (conversations.some(c => c.id === conversation.id)) return;
  
  // Ajouter la conversation au dossier
  const newConversation: ConversationRef = {
    id: conversation.id,
    title: conversation.title,
    url: conversation.url,
    addedAt: Date.now()
  };
  
  conversations.push(newConversation);
  await storage.set(`folder_conversations_${folderId}`, conversations);
  
  // Mettre à jour le compteur
  folders[folderIndex].conversationCount = conversations.length;
  await storage.set('folders', folders);
  
  // Rafraîchir l'interface
  await renderFolders();
}

// Supprimer un dossier
async function deleteFolder(folderId: string): Promise<void> {
  const folders = await getFolders();
  const updatedFolders = folders.filter(f => f.id !== folderId);
  await storage.set('folders', updatedFolders);
  await storage.remove(`folder_conversations_${folderId}`);
  await renderFolders();
}

// Supprimer une conversation d'un dossier
async function removeConversationFromFolder(folderId: string, conversationId: string): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) return;
  
  const conversations = await storage.get<ConversationRef[]>(`folder_conversations_${folderId}`) || [];
  const updatedConversations = conversations.filter(c => c.id !== conversationId);
  
  await storage.set(`folder_conversations_${folderId}`, updatedConversations);
  
  // Mettre à jour le compteur
  folders[folderIndex].conversationCount = updatedConversations.length;
  await storage.set('folders', folders);
  
  // Rafraîchir l'interface
  await renderFolders();
}

// Basculer l'état plié/déplié d'un dossier
async function toggleFolderExpand(folderId: string): Promise<void> {
  console.log("Tentative de basculement du dossier:", folderId);
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) {
    console.log("Dossier non trouvé");
    return;
  }
  
  // Inverser l'état de développement du dossier
  folders[folderIndex].expanded = !folders[folderIndex].expanded;
  console.log(`Dossier ${folderId} état changé à: ${folders[folderIndex].expanded ? 'développé' : 'plié'}`);
  
  // Sauvegarder la modification
  await storage.set('folders', folders);
  
  // Rafraîchir l'affichage
  const folderItems = document.querySelectorAll('.le-chat-plus-folder-item');
  const folderItem = Array.from(folderItems)[folderIndex];
  
  if (folderItem) {
    const conversationsContainer = folderItem.querySelector('.le-chat-plus-folder-conversations');
    const expandIcon = folderItem.querySelector('.le-chat-plus-folder-header span:first-child');
    
    if (conversationsContainer) {
      // Mettre à jour directement le DOM pour un changement immédiat
      (conversationsContainer as HTMLElement).style.display = 
        folders[folderIndex].expanded ? 'block' : 'none';
    }
    
    if (expandIcon) {
      expandIcon.textContent = folders[folderIndex].expanded ? '▼' : '►';
    }
  } else {
    // Si on ne peut pas manipuler directement le DOM, recharger tous les dossiers
    await renderFolders();
  }
}

// Afficher tous les dossiers et leur contenu
async function renderFolders(): Promise<void> {
  const foldersList = document.getElementById('le-chat-plus-folders-list');
  if (!foldersList) {
    console.log("Liste des dossiers non trouvée, tentative de réinjection...");
    // Si la liste des dossiers n'existe pas, essayer de réinjecter l'interface complète
    if (!document.getElementById('le-chat-plus-folders')) {
      injectFoldersUI();
    }
    return;
  }
  
  foldersList.innerHTML = '';
  
  const folders = await getFolders();
  
  if (folders.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.textContent = 'Aucun dossier créé.';
    safeSetStyle(emptyMessage, 'padding', '8px');
    safeSetStyle(emptyMessage, 'color', '#888');
    safeSetStyle(emptyMessage, 'fontStyle', 'italic');
    safeSetStyle(emptyMessage, 'fontSize', '12px');
    
    if (foldersList) {
      foldersList.appendChild(emptyMessage);
    }
    return;
  }
  
  for (const folder of folders) {
    const folderItem = document.createElement('div');
    folderItem.className = 'le-chat-plus-folder-item';
    safeSetStyle(folderItem, 'marginBottom', '4px');
    
    // En-tête du dossier
    const folderHeader = document.createElement('div');
    folderHeader.className = 'le-chat-plus-folder-header';
    
    // Icône pour plier/déplier (triangle)
    const expandIcon = document.createElement('span');
    expandIcon.textContent = folder.expanded ? '▼' : '►';
    safeSetStyle(expandIcon, 'marginRight', '5px');
    safeSetStyle(expandIcon, 'fontSize', '10px');
    safeSetStyle(expandIcon, 'color', 'var(--text-color-subtle)');
    safeSetStyle(expandIcon, 'transition', 'transform 0.2s');
    
    // Nom du dossier
    const folderName = document.createElement('span');
    folderName.textContent = `${folder.name}`;
    safeSetStyle(folderName, 'flex', '1');
    safeSetStyle(folderName, 'fontWeight', 'normal');
    safeSetStyle(folderName, 'fontSize', '13px');
    safeSetStyle(folderName, 'color', 'var(--text-color-subtle)');
    
    // Bouton de suppression
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '×';
    safeSetStyle(deleteButton, 'background', 'none');
    safeSetStyle(deleteButton, 'border', 'none');
    safeSetStyle(deleteButton, 'color', 'var(--text-color-subtle)');
    safeSetStyle(deleteButton, 'fontWeight', 'bold');
    safeSetStyle(deleteButton, 'cursor', 'pointer');
    safeSetStyle(deleteButton, 'padding', '2px 5px');
    safeSetStyle(deleteButton, 'fontSize', '14px');
    safeSetStyle(deleteButton, 'opacity', '0.7');
    safeSetStyle(deleteButton, 'transition', 'opacity 0.2s');
    deleteButton.title = 'Supprimer ce dossier';
    
    folderHeader.appendChild(expandIcon);
    folderHeader.appendChild(folderName);
    folderHeader.appendChild(deleteButton);
    folderItem.appendChild(folderHeader);
    
    // Événements de drag and drop sur le dossier
    folderHeader.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      folderHeader.classList.add('drag-over');
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    });
    
    folderHeader.addEventListener('dragleave', () => {
      folderHeader.classList.remove('drag-over');
    });
    
    folderHeader.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault();
      folderHeader.classList.remove('drag-over');
      
      if (e.dataTransfer) {
        const data = e.dataTransfer.getData('text/plain');
        try {
          const conversation = JSON.parse(data);
          if (conversation && conversation.id) {
            await addConversationToFolder(folder.id, conversation);
            
            // Afficher un feedback visuel en utilisant une classe plutôt que style directement
            folderHeader.classList.add('drop-success');
            setTimeout(() => {
              // Vérifier que l'élément existe toujours avant de modifier ses classes
              if (folderHeader && folderHeader.classList) {
                folderHeader.classList.remove('drop-success');
              }
            }, 500);
          }
        } catch (err) {
          console.error("Erreur lors du drop:", err);
        }
      }
    });
    
    // Conteneur pour les conversations du dossier
    const conversationsContainer = document.createElement('div');
    conversationsContainer.className = 'le-chat-plus-folder-conversations';
    safeSetStyle(conversationsContainer, 'paddingLeft', '15px');
    safeSetStyle(conversationsContainer, 'display', folder.expanded ? 'block' : 'none');
    
    // Charger et afficher les conversations du dossier
    const conversations = await storage.get<ConversationRef[]>(`folder_conversations_${folder.id}`) || [];
    
    // Obtenir l'ID de la conversation active
    const activeConversationId = getCurrentConversationId();
    
    if (conversations.length > 0) {
      for (const conv of conversations) {
        const convItem = document.createElement('div');
        convItem.className = 'le-chat-plus-conversation-item';
        
        // Vérifier si cette conversation est active
        const isActive = conv.id === activeConversationId;
        
        // Titre de la conversation avec lien
        const convLink = document.createElement('a');
        convLink.textContent = conv.title || 'Conversation sans titre';
        convLink.href = conv.url;
        safeSetStyle(convLink, 'flex', '1');
        safeSetStyle(convLink, 'textDecoration', 'none');
        
        // Appliquer la couleur en fonction de si la conversation est active ou non
        if (isActive) {
          safeSetStyle(convLink, 'color', 'var(--text-color-subtle)');
          safeSetStyle(convLink, 'fontWeight', 'bold');
          convItem.classList.add('active-conversation');
        } else {
          safeSetStyle(convLink, 'color', 'var(--text-color-muted)');
        }
        
        safeSetStyle(convLink, 'whiteSpace', 'nowrap');
        safeSetStyle(convLink, 'overflow', 'hidden');
        safeSetStyle(convLink, 'textOverflow', 'ellipsis');
        
        // Empêcher le comportement par défaut du lien pour éviter le rechargement
        convLink.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Utiliser l'API History pour naviguer sans rechargement
          const url = new URL(conv.url);
          const path = url.pathname;
          
          // Trouver les liens de conversation natifs
          const sidebarLinks = Array.from(document.querySelectorAll('a[href^="/chat/"]'));
          const matchingLink = sidebarLinks.find(link => link.getAttribute('href') === path);
          
          if (matchingLink) {
            // Si un lien natif correspondant existe, simuler un clic dessus
            (matchingLink as HTMLElement).click();
          } else {
            // Sinon, utiliser l'API History
            window.history.pushState({}, '', path);
            
            // Déclencher un événement de changement d'URL pour que l'application réagisse
            const navEvent = new PopStateEvent('popstate');
            window.dispatchEvent(navEvent);
          }
        });
        
        // Bouton pour supprimer la conversation du dossier
        const removeButton = document.createElement('button');
        removeButton.textContent = '×';
        safeSetStyle(removeButton, 'background', 'none');
        safeSetStyle(removeButton, 'border', 'none');
        safeSetStyle(removeButton, 'color', '#999');
        safeSetStyle(removeButton, 'cursor', 'pointer');
        safeSetStyle(removeButton, 'padding', '2px');
        safeSetStyle(removeButton, 'fontSize', '12px');
        safeSetStyle(removeButton, 'opacity', '0.6');
        safeSetStyle(removeButton, 'transition', 'opacity 0.2s');
        removeButton.title = 'Retirer du dossier';
        
        convItem.appendChild(convLink);
        convItem.appendChild(removeButton);
        conversationsContainer.appendChild(convItem);
        
        // Gestionnaire d'événements pour supprimer la conversation
        removeButton.addEventListener('click', async () => {
          const confirmed = await showDeleteConfirmModal(conv.title || 'Conversation sans titre', 'conversation');
          if (confirmed) {
            await removeConversationFromFolder(folder.id, conv.id);
          }
        });
      }
    } else if (folder.expanded) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'Aucune conversation dans ce dossier';
      safeSetStyle(emptyMsg, 'fontSize', '11px');
      safeSetStyle(emptyMsg, 'color', '#888');
      safeSetStyle(emptyMsg, 'padding', '5px 0');
      safeSetStyle(emptyMsg, 'fontStyle', 'italic');
      conversationsContainer.appendChild(emptyMsg);
    }
    
    folderItem.appendChild(conversationsContainer);
    foldersList.appendChild(folderItem);
    
    // Gestionnaire d'événements pour plier/déplier
    folderHeader.addEventListener('click', (e) => {
      if (e.target !== deleteButton) {
        // Vérifier si l'événement provient du bouton de suppression ou d'un enfant du bouton
        const isDeleteButtonClick = e.target === deleteButton || 
                                    (deleteButton.contains && deleteButton.contains(e.target as Node));
                                    
        // Ne pas déclencher toggleFolderExpand si le clic est sur le bouton de suppression
        if (!isDeleteButtonClick) {
          e.stopPropagation();
          toggleFolderExpand(folder.id);
        }
      }
    });
    
    // Gestionnaire d'événements pour supprimer le dossier
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showDeleteConfirmModal(folder.name, 'dossier');
      if (confirmed) {
        await deleteFolder(folder.id);
      }
    });
  }
}

// Attendre que le DOM soit chargé pour injecter notre UI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFoldersUI);
} else {
  injectFoldersUI();
}

// Configurer l'observateur pour surveiller les modifications du DOM
setupDOMObserver();

// Ajouter un écouteur pour les changements d'URL
function setupURLChangeListener() {
  // Stocker l'URL actuelle pour détecter les changements
  let currentUrl = window.location.href;
  let currentConversationId = getCurrentConversationId();
  
  // Fonction pour vérifier si l'URL a changé et mettre à jour si nécessaire
  const checkURLChange = () => {
    const newUrl = window.location.href;
    const newConversationId = getCurrentConversationId();
    
    if (newUrl !== currentUrl || newConversationId !== currentConversationId) {
      console.log("Changement d'URL ou de conversation détecté, mise à jour des dossiers...");
      currentUrl = newUrl;
      currentConversationId = newConversationId;
      
      // Mettre à jour l'état actif des conversations dans les dossiers
      updateActiveConversationHighlight();
    }
  };
  
  // Vérifier périodiquement les changements d'URL
  setInterval(checkURLChange, 500);
  
  // Écouter aussi les événements de navigation
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      checkURLChange();
    }, 100);
  });
  
  // Intercepter les clics sur les liens de conversation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const conversationLink = target.closest('a[href^="/chat/"]');
    
    if (conversationLink) {
      // Attendre un peu que la navigation se produise
      setTimeout(() => {
        checkURLChange();
      }, 100);
    }
  });
}

// Fonction pour mettre à jour uniquement l'état actif des conversations sans recharger tous les dossiers
async function updateActiveConversationHighlight() {
  const activeConversationId = getCurrentConversationId();
  if (!activeConversationId) return;
  
  console.log("Mise à jour de la conversation active:", activeConversationId);
  
  // Obtenir tous les éléments de conversation dans les dossiers
  const conversationElements = document.querySelectorAll('.le-chat-plus-conversation-item');
  
  // Supprimer d'abord tous les états actifs
  conversationElements.forEach(convItem => {
    const link = convItem.querySelector('a');
    if (link) {
      safeSetStyle(link, 'color', 'var(--text-color-muted)');
      safeSetStyle(link, 'fontWeight', 'normal');
    }
    convItem.classList.remove('active-conversation');
  });
  
  // Parcourir toutes les conversations dans les dossiers
  for (const convItem of conversationElements) {
    const link = convItem.querySelector('a');
    if (link && link.href) {
      // Extraire l'ID de la conversation du lien
      const url = new URL(link.href);
      const pathSegments = url.pathname.split('/');
      const chatIndex = pathSegments.indexOf('chat');
      
      if (chatIndex >= 0 && chatIndex + 1 < pathSegments.length) {
        const convId = pathSegments[chatIndex + 1];
        
        // Si cette conversation est active, mettre à jour son style
        if (convId === activeConversationId) {
          safeSetStyle(link, 'color', 'var(--text-color-subtle)');
          safeSetStyle(link, 'fontWeight', 'bold');
          convItem.classList.add('active-conversation');
        }
      }
    }
  }
}

// Initialiser l'écouteur de changements d'URL
setupURLChangeListener();

// Écouter les messages de l'extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getConversationInfo") {
    const conversationId = getCurrentConversationId();
    const title = getConversationTitle();
    
    sendResponse({
      id: conversationId,
      title: title,
      url: window.location.href
    });
    
    return true;
  } else if (message.action === "refreshFolders") {
    renderFolders();
    return true;
  }
});

// Injecter un bouton avec icône de crochets à côté du bouton d'envoi
function injectPromptButton() {
  console.log("Tentative d'injection du bouton de prompt...");
  
  // Définir une constante pour l'opacité par défaut du bouton
  const BUTTON_DEFAULT_OPACITY = '0.5';
  const BUTTON_HOVER_OPACITY = '0.8';
  
  // Observer les changements de thème
  function setupThemeChangeObserver() {
    // Fonction pour détecter les changements de thème
    const detectThemeChange = () => {
      console.log("Vérification des changements de thème...");
      
      // Rechercher le bouton de prompt
      const promptButton = document.getElementById('le-chat-plus-prompt-button');
      if (!promptButton) return;
      
      // Rechercher le bouton d'envoi pour obtenir ses styles actuels (avec le nouveau thème)
      const sendButton = document.querySelector('button[type="submit"], button[aria-label*="envoyer"], button[aria-label*="send"]');
      if (!sendButton) return;
      
      // Copier les styles du bouton d'envoi mis à jour
      const sendButtonStyles = window.getComputedStyle(sendButton);
      
      // Réappliquer les styles qui pourraient changer avec le thème
      safeSetStyle(promptButton, 'background', sendButtonStyles.background);
      safeSetStyle(promptButton, 'color', sendButtonStyles.color);
      safeSetStyle(promptButton, 'border', sendButtonStyles.border);
      
      console.log("Styles du bouton de prompt mis à jour après changement de thème");
    };
    
    // Observer les changements d'attributs dans le body ou html pour détecter les changements de thème
    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Si un changement d'attribut de classe ou de thème est détecté
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'class' || 
             mutation.attributeName === 'data-theme' || 
             mutation.attributeName === 'theme')) {
          console.log("Changement de thème détecté via attribut:", mutation.attributeName);
          detectThemeChange();
        }
      }
    });
    
    // Observer les changements sur html et body
    const observeElement = (element: Element) => {
      themeObserver.observe(element, { 
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'theme']
      });
    };
    
    // Observer html et body pour les changements de thème
    if (document.documentElement) observeElement(document.documentElement);
    if (document.body) observeElement(document.body);
    
    // Vérifier aussi périodiquement (backup)
    setInterval(detectThemeChange, 2000);
    
    // Observer également tous les changements de style dans la page
    const styleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLStyleElement || node instanceof HTMLLinkElement) {
              // Un nouveau style a été ajouté, vérifier si cela affecte le thème
              setTimeout(detectThemeChange, 100);
              break;
            }
          }
        }
      }
    });
    
    // Observer les changements de style dans le head
    if (document.head) {
      styleObserver.observe(document.head, { childList: true });
    }
  }
  
  // Observer les mutations du DOM pour trouver le bouton d'envoi lorsqu'il apparaît
  const observer = new MutationObserver((mutations) => {
    // Chercher le bouton d'envoi dans le DOM
    const sendButton = document.querySelector('button[type="submit"], button[aria-label*="envoyer"], button[aria-label*="send"]');
    const promptButtonExists = document.getElementById('le-chat-plus-prompt-button');
    
    // Si on a trouvé le bouton d'envoi et que notre bouton n'existe pas
    if (sendButton && !promptButtonExists) {
      console.log("Bouton d'envoi trouvé, injection du bouton de prompt...");
      
      // Créer notre bouton de prompt
      const promptButton = document.createElement('button');
      promptButton.id = 'le-chat-plus-prompt-button';
      promptButton.type = 'button'; // Important: type="button" pour éviter qu'il ne soumette le formulaire
      promptButton.innerHTML = '{ }';
      promptButton.title = 'Insérer un prompt';
      
      // Copier les styles du bouton d'envoi
      const sendButtonStyles = window.getComputedStyle(sendButton);
      
      // Appliquer les styles similaires à notre bouton
      safeSetStyle(promptButton, 'background', sendButtonStyles.background);
      safeSetStyle(promptButton, 'color', sendButtonStyles.color);
      safeSetStyle(promptButton, 'border', sendButtonStyles.border);
      safeSetStyle(promptButton, 'borderRadius', sendButtonStyles.borderRadius);
      safeSetStyle(promptButton, 'padding', sendButtonStyles.padding);
      safeSetStyle(promptButton, 'margin', '0 5px');
      safeSetStyle(promptButton, 'cursor', 'pointer');
      safeSetStyle(promptButton, 'display', 'flex');
      safeSetStyle(promptButton, 'alignItems', 'center');
      safeSetStyle(promptButton, 'justifyContent', 'center');
      safeSetStyle(promptButton, 'fontSize', sendButtonStyles.fontSize);
      safeSetStyle(promptButton, 'fontWeight', 'bold');
      safeSetStyle(promptButton, 'width', '32px');
      safeSetStyle(promptButton, 'height', '32px');
      safeSetStyle(promptButton, 'minWidth', '32px');
      
      // Appliquer l'opacité directement dans un style inline pour plus de robustesse
      promptButton.style.opacity = BUTTON_DEFAULT_OPACITY;
      
      // Gérer le survol avec des classes plutôt que des styles inline
      const styleElement = document.createElement('style');
      styleElement.id = 'le-chat-plus-prompt-button-styles';
      styleElement.textContent = `
        #le-chat-plus-prompt-button {
          opacity: ${BUTTON_DEFAULT_OPACITY} !important;
          transition: opacity 0.2s ease;
        }
        
        #le-chat-plus-prompt-button:hover {
          opacity: ${BUTTON_HOVER_OPACITY} !important;
        }
      `;
      document.head.appendChild(styleElement);
      
      // Supprimer les écouteurs d'événements pour le survol car nous utilisons CSS
      // Toutefois, nous gardons la fonctionnalité du bouton
      promptButton.addEventListener('click', () => {
        // Trouver la zone de texte
        const textarea = document.querySelector('textarea');
        if (textarea) {
          // Insérer un modèle de prompt à la position du curseur
          const cursorPos = textarea.selectionStart;
          const textBefore = textarea.value.substring(0, cursorPos);
          const textAfter = textarea.value.substring(cursorPos);
          
          // Modèle de prompt à insérer
          const promptTemplate = '{\n  "prompt": "votre_prompt_ici"\n}';
          
          // Mettre à jour le contenu de la zone de texte
          textarea.value = textBefore + promptTemplate + textAfter;
          
          // Replacer le curseur après le texte inséré
          textarea.selectionStart = cursorPos + promptTemplate.length;
          textarea.selectionEnd = cursorPos + promptTemplate.length;
          
          // Donner le focus à la zone de texte
          textarea.focus();
        }
      });
      
      // Insérer notre bouton avant le bouton d'envoi
      sendButton.parentNode.insertBefore(promptButton, sendButton);
      console.log("Bouton de prompt injecté avec succès");
      
      // Configurer l'observateur de changement de thème après avoir injecté le bouton
      setupThemeChangeObserver();
    } 
    
    // Vérifier si le bouton d'envoi existe mais que notre bouton a disparu
    // (ce qui arrive quand l'interface est reconstruite)
    else if (sendButton && !document.getElementById('le-chat-plus-prompt-button')) {
      console.log("Le bouton de prompt a disparu, réinjection...");
      // La logique sera appelée à nouveau au prochain cycle d'observation
      
      // S'assurer également que nos styles sont toujours présents
      if (!document.getElementById('le-chat-plus-prompt-button-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'le-chat-plus-prompt-button-styles';
        styleElement.textContent = `
          #le-chat-plus-prompt-button {
            opacity: ${BUTTON_DEFAULT_OPACITY} !important;
            transition: opacity 0.2s ease;
          }
          
          #le-chat-plus-prompt-button:hover {
            opacity: ${BUTTON_HOVER_OPACITY} !important;
          }
        `;
        document.head.appendChild(styleElement);
      }
    }
  });
  
  // Observer tout le document en continu, même après avoir injecté le bouton
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Vérifier périodiquement la présence du bouton
  setInterval(() => {
    const sendButton = document.querySelector('button[type="submit"], button[aria-label*="envoyer"], button[aria-label*="send"]');
    const promptButton = document.getElementById('le-chat-plus-prompt-button');
    
    if (sendButton && !promptButton) {
      console.log("Surveillance périodique: bouton manquant, tentative de réinjection...");
      // Le MutationObserver se chargera de réinjecter le bouton
    }
    
    // Vérifier également que nos styles sont présents
    if (!document.getElementById('le-chat-plus-prompt-button-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'le-chat-plus-prompt-button-styles';
      styleElement.textContent = `
        #le-chat-plus-prompt-button {
          opacity: ${BUTTON_DEFAULT_OPACITY} !important;
          transition: opacity 0.2s ease;
        }
        
        #le-chat-plus-prompt-button:hover {
          opacity: ${BUTTON_HOVER_OPACITY} !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
  }, 2000); // Vérifier toutes les 2 secondes
  
  // Configurer l'observateur de changements de thème
  setupThemeChangeObserver();
}

// Lancer l'injection du bouton au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPromptButton);
} else {
  injectPromptButton();
} 