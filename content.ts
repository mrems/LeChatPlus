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

// Fonction pour détecter le thème actuel de la page Mistral
async function detectAndSaveTheme() {
  try {
    // Vérifier si le thème sombre est appliqué en inspectant les couleurs CSS
    let isDarkMode = false;
    
    // Vérifier l'attribut data-theme si présent
    const htmlElement = document.documentElement;
    if (htmlElement.getAttribute('data-theme') === 'dark') {
      isDarkMode = true;
    } else {
      // Sinon, tester la couleur de fond ou de texte
      const bodyStyle = window.getComputedStyle(document.body);
      const backgroundColor = bodyStyle.backgroundColor;
      
      // Si la couleur de fond est foncée (RGB < 50), considérer comme thème sombre
      if (backgroundColor) {
        const rgb = backgroundColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const [r, g, b] = rgb.map(Number);
          // Si la luminosité est faible, c'est un thème sombre
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          isDarkMode = brightness < 125;
        }
      }
    }
    
    // Stocker le résultat dans chrome.storage.local
    chrome.storage.local.set({ "pageIsDarkMode": isDarkMode }, () => {
      if (chrome.runtime.lastError) {
        console.error("Erreur lors de la sauvegarde du thème:", chrome.runtime.lastError);
      } else {
        console.log("Le Chat+: Thème détecté et sauvegardé dans chrome.storage.local:", isDarkMode ? "Sombre" : "Clair");
      }
    });
    
    // Envoyer directement un message au popup
    chrome.runtime.sendMessage({
      action: "themeChanged",
      isDarkMode: isDarkMode
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Ignorer l'erreur si le popup n'est pas ouvert
        console.log("Le Chat+: Message de thème envoyé, mais aucun destinataire (normal si popup fermé)");
      } else if (response) {
        console.log("Le Chat+: Message de thème reçu par le popup:", response);
      }
    });
    
    return isDarkMode;
  } catch (error) {
    console.error("Erreur lors de la détection du thème:", error);
    return false;
  }
}

// Détecter le thème au chargement initial
setTimeout(detectAndSaveTheme, 1000);

// Observer les changements de thème sur la page
const themeObserver = new MutationObserver((mutations) => {
  // Vérifier si c'est un changement qui pourrait affecter le thème
  for (const mutation of mutations) {
    if (
      mutation.type === 'attributes' && 
      (mutation.attributeName === 'data-theme' || mutation.attributeName === 'class')
    ) {
      // Attendre un court délai pour que les styles soient appliqués
      setTimeout(detectAndSaveTheme, 300);
      break;
    }
  }
});

// Observer les attributs HTML et les changements de classe qui pourraient indiquer un changement de thème
themeObserver.observe(document.documentElement, { 
  attributes: true,
  attributeFilter: ['data-theme', 'class'] 
});

// Écouteur de messages pour répondre aux demandes du popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Le Chat+: Message reçu du popup:", message);
  
  if (message.action === "getTheme") {
    // Détecter et envoyer le thème actuel
    detectAndSaveTheme().then(isDarkMode => {
      console.log("Le Chat+: Envoi du thème actuel au popup:", isDarkMode ? "Sombre" : "Clair");
      sendResponse({
        action: "themeInfo",
        isDarkMode: isDarkMode,
        success: true
      });
    }).catch(error => {
      console.error("Le Chat+: Erreur lors de la détection du thème:", error);
      sendResponse({
        action: "themeInfo", 
        error: "Erreur de détection",
        success: false
      });
    });
    
    // Garder le canal de communication ouvert pour la réponse asynchrone
    return true;
  }
  
  if (message.action === "refreshFolders") {
    console.log("Le Chat+: Demande de rafraîchissement des dossiers reçue");
    renderFolders().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error("Le Chat+: Erreur lors du rafraîchissement des dossiers:", error);
      sendResponse({ success: false, error: String(error) });
    });
    return true;
  }
  
  // Pour les autres messages
  return false;
});

// Script de contenu pour interagir avec la page web de Mistral AI Chat
console.log("Le Chat+ Extension activée sur cette page Mistral AI")

// Réinitialiser l'état de chargement initial à chaque chargement de page
window.addEventListener('beforeunload', () => {
  if (renderFolders.hasOwnProperty('initialRenderDone')) {
    delete (renderFolders as any).initialRenderDone;
  }
});

// Variables pour le drag and drop
let draggedConversationId = null;
let draggedConversationElement = null;
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
    /* Styles de base pour notre interface */
    .le-chat-plus-folders-container-scrollbar::-webkit-scrollbar,
    .le-chat-plus-folder-content-scrollbar::-webkit-scrollbar,
    .le-chat-plus-folders-list-scrollbar::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    .le-chat-plus-folders-container-scrollbar::-webkit-scrollbar-track,
    .le-chat-plus-folder-content-scrollbar::-webkit-scrollbar-track,
    .le-chat-plus-folders-list-scrollbar::-webkit-scrollbar-track {
      background: #f0f0f0;
      border-radius: 4px;
    }
    
    .le-chat-plus-folders-container-scrollbar::-webkit-scrollbar-thumb,
    .le-chat-plus-folder-content-scrollbar::-webkit-scrollbar-thumb,
    .le-chat-plus-folders-list-scrollbar::-webkit-scrollbar-thumb {
      background: #cccccc;
      border-radius: 4px;
      border: 1px solid #f0f0f0;
    }
    
    .le-chat-plus-folders-container-scrollbar::-webkit-scrollbar-thumb:hover,
    .le-chat-plus-folder-content-scrollbar::-webkit-scrollbar-thumb:hover,
    .le-chat-plus-folders-list-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #aaaaaa;
    }
    
    /* Support de Firefox pour notre sidebar */
    .le-chat-plus-folders-container-scrollbar,
    .le-chat-plus-folder-content-scrollbar,
    .le-chat-plus-folders-list-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: #cccccc #f0f0f0;
    }
    
    /* Thème sombre pour notre sidebar */
    [data-theme="dark"] #le-chat-plus-folders-container::-webkit-scrollbar-track,
    [data-theme="dark"] .le-chat-plus-folder-content::-webkit-scrollbar-track,
    [data-theme="dark"] #le-chat-plus-folders-list::-webkit-scrollbar-track,
    .dark #le-chat-plus-folders-container::-webkit-scrollbar-track,
    .dark .le-chat-plus-folder-content::-webkit-scrollbar-track,
    .dark #le-chat-plus-folders-list::-webkit-scrollbar-track {
      background: #2a2a2a;
      border-radius: 4px;
    }
    
    [data-theme="dark"] #le-chat-plus-folders-container::-webkit-scrollbar-thumb,
    [data-theme="dark"] .le-chat-plus-folder-content::-webkit-scrollbar-thumb,
    [data-theme="dark"] #le-chat-plus-folders-list::-webkit-scrollbar-thumb,
    .dark #le-chat-plus-folders-container::-webkit-scrollbar-thumb,
    .dark .le-chat-plus-folder-content::-webkit-scrollbar-thumb,
    .dark #le-chat-plus-folders-list::-webkit-scrollbar-thumb {
      background: #555555;
      border-radius: 4px;
      border: 1px solid #2a2a2a;
    }
    
    [data-theme="dark"] #le-chat-plus-folders-container::-webkit-scrollbar-thumb:hover,
    [data-theme="dark"] .le-chat-plus-folder-content::-webkit-scrollbar-thumb:hover,
    [data-theme="dark"] #le-chat-plus-folders-list::-webkit-scrollbar-thumb:hover,
    .dark #le-chat-plus-folders-container::-webkit-scrollbar-thumb:hover,
    .dark .le-chat-plus-folder-content::-webkit-scrollbar-thumb:hover,
    .dark #le-chat-plus-folders-list::-webkit-scrollbar-thumb:hover {
      background: #666666;
    }
    
    [data-theme="dark"] #le-chat-plus-folders-container,
    [data-theme="dark"] .le-chat-plus-folder-content,
    [data-theme="dark"] #le-chat-plus-folders-list,
    .dark #le-chat-plus-folders-container,
    .dark .le-chat-plus-folder-content,
    .dark #le-chat-plus-folders-list {
      scrollbar-color: #555555 #2a2a2a;
    }
    
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
    
    
    
    .le-chat-plus-folder-header.drag-over {
      background-color: rgba(0, 0, 0, 0.05);
      border: 1px dashed rgba(0, 0, 0, 0.25);
    }
    
    .le-chat-plus-folder-header.drop-success {
      background-color: rgba(0, 128, 0, 0.05);
      border: 1px solid rgba(0, 128, 0, 0.2);
    }
    
    .folder-name {
      user-select: none;
      cursor: inherit;
    }
    
    .folder-name[contenteditable="true"] {
      user-select: text;
      cursor: text;
      min-width: 30px;
    }
    
    .folder-name:focus {
      outline: none;
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .le-chat-plus-conversation-item {
      display: flex;
      align-items: center;
      padding: 0px 4px;
      font-size: 12px;
      border-bottom: none;
      transition: background-color 0.2s;
    }
    
    
    
    .le-chat-plus-conversation-item.active-conversation a {
      opacity: 1 !important;
    }
    
    .mistral-conversation-item {
      cursor: pointer;
    }
    
    .mistral-conversation-item.dragging {
      opacity: 0.4;
      cursor: pointer;
    }
    
  
    
    /* Styles pour l'indicateur de position lors du drag and drop dans un dossier */
    .reorder-indicator {
      height: 1px;
      background-color: var(--text-color-subtle, #666);
      margin: 2px 0;
      opacity: 0;
      transition: opacity 0.2s;
      position: relative;
      width: 5%;
      height: 2px;
    }
    
  
    
    .reorder-indicator.visible {
      opacity: 0.6;
    }
    
    
    
   
    
    .folder-conversation-draggable {
      cursor: pointer;
    }
    
    .folder-conversation-draggable.dragging {
      cursor: pointer;
      background-color: rgba(0, 0, 0, 0.02);
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
    
    /* Style pour le mode clair (défaut) */
    .le-chat-plus-modal-content {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      width: 300px;
      max-width: 90%;
      padding: 16px;
      transform: translateY(-20px);
      transition: transform 0.2s;
    }
    
    /* Style pour le mode sombre */
    [data-theme="dark"] .le-chat-plus-modal-content {
      background-color: #1e1e1e;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
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
    
    [data-theme="dark"] .le-chat-plus-modal-header {
      color: #f0f0f0;
    }
    
    .le-chat-plus-modal-message {
      font-size: 14px;
      margin-bottom: 16px;
      color: #555;
      line-height: 1.4;
    }
    
    [data-theme="dark"] .le-chat-plus-modal-message {
      color: #cccccc;
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
      color: #333;
      background-color: #ffffff;
    }
    
    [data-theme="dark"] .le-chat-plus-modal-input {
      color: #f0f0f0;
      background-color: #333333;
      border-color: #444444;
    }
    
    .le-chat-plus-modal-input:focus {
      outline: none;
      border-color: #999;
    }
    
    [data-theme="dark"] .le-chat-plus-modal-input:focus {
      border-color: #666;
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
    
    [data-theme="dark"] .le-chat-plus-modal-button.cancel {
      color: #cccccc;
      border-color: #444444;
    }
    
    .le-chat-plus-modal-button.cancel:hover {
      background-color: #f5f5f5;
    }
    
    [data-theme="dark"] .le-chat-plus-modal-button.cancel:hover {
      background-color: #2a2a2a;
    }
    
    .le-chat-plus-modal-button.confirm {
      background-color: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
    }
    
    [data-theme="dark"] .le-chat-plus-modal-button.confirm {
      background-color: #2a2a2a;
      color: #f0f0f0;
      border-color: #444444;
    }
    
    .le-chat-plus-modal-button.confirm:hover {
      background-color: #e5e5e5;
    }
    
    [data-theme="dark"] .le-chat-plus-modal-button.confirm:hover {
      background-color: #333333;
    }
    
    .le-chat-plus-modal-button.delete {
      background-color: rgba(220, 0, 0, 0.05);
      color: #d00;
      border: 1px solid rgba(220, 0, 0, 0.2);
    }
    
    [data-theme="dark"] .le-chat-plus-modal-button.delete {
      background-color: rgba(150, 0, 0, 0.1);
      color: #ff5555;
      border-color: rgba(220, 0, 0, 0.3);
    }
    
    .le-chat-plus-modal-button.delete:hover {
      background-color: rgba(220, 0, 0, 0.1);
    }
    
    [data-theme="dark"] .le-chat-plus-modal-button.delete:hover {
      background-color: rgba(150, 0, 0, 0.2);
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
    // Détecter si le thème sombre est activé - utiliser plusieurs méthodes pour une détection plus fiable
    let isDarkTheme = false;
    
    // Méthode 1: Vérifier l'attribut data-theme du html
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      isDarkTheme = true;
    }
    // Méthode 2: Vérifier s'il y a une classe dark sur le html ou body
    else if (document.documentElement.classList.contains('dark') || document.body.classList.contains('dark')) {
      isDarkTheme = true;
    }
    // Méthode 3: Vérifier la couleur de fond du body
    else {
      try {
        const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
        if (bodyBgColor) {
          const rgb = bodyBgColor.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const [r, g, b] = rgb.map(Number);
            // Si la luminosité est faible, c'est un thème sombre
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            isDarkTheme = brightness < 125;
          }
        }
      } catch (error) {
        console.error("Erreur lors de la détection de la couleur de fond:", error);
      }
    }
    
    // Méthode 4: Dernier recours - vérifier depuis le stockage
    if (!isDarkTheme) {
      try {
        // Vérifier si nous avons stocké l'information de thème précédemment
        chrome.storage.local.get("pageIsDarkMode", (result) => {
          if (result && result.pageIsDarkMode === true) {
            isDarkTheme = true;
            // Réappliquer les styles avec le bon thème
            applyModalStyles(isDarkTheme);
          }
        });
      } catch (error) {
        console.error("Erreur lors de l'accès au stockage:", error);
      }
    }
    
    // Console log pour le débogage
    console.log("Le Chat+: Thème détecté pour le modal:", isDarkTheme ? "Sombre" : "Clair");
    
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = 'le-chat-plus-modal';
    
    // Contenu du modal
    const modalContent = document.createElement('div');
    modalContent.className = 'le-chat-plus-modal-content';
    
    let input: HTMLInputElement | null = null;
    let cancelButton: HTMLButtonElement;
    let confirmButton: HTMLButtonElement;
    
    // Fonction pour appliquer les styles selon le thème
    function applyModalStyles(isDark: boolean) {
      // Styles pour le contenu du modal
      if (isDark) {
        // Mode sombre
        modalContent.style.backgroundColor = '#2a2a2a'; // Fond sombre
        modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
        modalContent.style.color = '#ffffff';
        modalContent.style.border = '1px solid #444444';
      } else {
        // Mode clair
        modalContent.style.backgroundColor = '#ffffff';
        modalContent.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
        modalContent.style.color = '#333333';
        modalContent.style.border = '1px solid #eeeeee';
      }
      
      // Si l'input existe, appliquer les styles
      if (input) {
        if (isDark) {
          input.style.backgroundColor = '#3a3a3a';
          input.style.color = '#ffffff';
          input.style.border = '1px solid #555555';
        } else {
          input.style.backgroundColor = '#f5f5f5';
          input.style.color = '#333333';
          input.style.border = '1px solid #dddddd';
        }
      }
      
      // Si les boutons existent, appliquer les styles
      if (cancelButton) {
        if (isDark) {
          cancelButton.style.backgroundColor = 'transparent';
          cancelButton.style.color = '#cccccc';
          cancelButton.style.border = '1px solid #444444';
        } else {
          cancelButton.style.backgroundColor = 'transparent';
          cancelButton.style.color = '#666666';
          cancelButton.style.border = '1px solid #dddddd';
        }
      }
      
      if (confirmButton) {
        if (options.isDelete) {
          if (isDark) {
            confirmButton.style.backgroundColor = 'transparent'; // Fond transparent en dark mode
            confirmButton.style.color = '#ff5555';
            confirmButton.style.border = '1px solid #ff5555'; // Bordure rouge vif correspondant à la couleur du texte
          } else {
            confirmButton.style.backgroundColor = 'transparent'; // Fond transparent en mode clair
            confirmButton.style.color = '#dd0000';
            confirmButton.style.border = '1px solid #dd0000'; // Bordure de la même couleur que le texte
          }
        } else {
          if (isDark) {
            confirmButton.style.backgroundColor = '#3a3a3a';
            confirmButton.style.color = '#ffffff';
            confirmButton.style.border = '1px solid #555555';
          } else {
            confirmButton.style.backgroundColor = '#f0f0f0';
            confirmButton.style.color = '#333333';
            confirmButton.style.border = '1px solid #dddddd';
          }
        }
      }
    }
    
    // Styles communs
    modalContent.style.borderRadius = '8px';
    modalContent.style.width = '300px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.padding = '16px';
    modalContent.style.transform = 'translateY(-20px)';
    modalContent.style.transition = 'transform 0.2s';
    
    // En-tête
    const header = document.createElement('div');
    header.className = 'le-chat-plus-modal-header';
    header.textContent = options.title;
    
    // Styles pour l'en-tête
    header.style.fontSize = '16px';
    header.style.fontWeight = '500';
    header.style.marginBottom = '12px';
    header.style.color = isDarkTheme ? '#ffffff' : '#333333';
    
    // Message (optionnel)
    if (options.message) {
      const message = document.createElement('div');
      message.className = 'le-chat-plus-modal-message';
      message.textContent = options.message;
      message.style.fontSize = '14px';
      message.style.marginBottom = '16px';
      message.style.color = isDarkTheme ? '#cccccc' : '#555555';
      message.style.lineHeight = '1.4';
      modalContent.appendChild(message);
    }
    
    // Champ de saisie (optionnel)
    if (options.inputPlaceholder) {
      input = document.createElement('input');
      input.className = 'le-chat-plus-modal-input';
      input.type = 'text';
      input.placeholder = options.inputPlaceholder;
      
      // Styles pour l'input similaire à la barre du chat Mistral
      input.style.width = '100%';
      input.style.padding = '8px 10px';
      input.style.borderRadius = '8px';
      input.style.fontSize = '14px';
      input.style.marginBottom = '16px';
      input.style.boxSizing = 'border-box';
      input.style.transition = 'border-color 0.2s, background-color 0.2s';
      
      // Les couleurs seront appliquées par applyModalStyles
      
      // Style pour le focus
      input.addEventListener('focus', () => {
        if (isDarkTheme) {
          input.style.backgroundColor = '#444444';
          input.style.borderColor = '#666666';
        } else {
          input.style.backgroundColor = '#ffffff';
          input.style.borderColor = '#999999';
        }
      });
      
      // Style pour la perte de focus
      input.addEventListener('blur', () => {
        if (isDarkTheme) {
          input.style.backgroundColor = '#3a3a3a';
          input.style.borderColor = '#555555';
        } else {
          input.style.backgroundColor = '#f5f5f5';
          input.style.borderColor = '#dddddd';
        }
      });
      
      modalContent.appendChild(input);
    }
    
    // Conteneur pour les boutons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'le-chat-plus-modal-buttons';
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.justifyContent = 'flex-end';
    buttonsContainer.style.gap = '8px';
    
    // Bouton d'annulation
    cancelButton = document.createElement('button');
    cancelButton.className = 'le-chat-plus-modal-button cancel';
    cancelButton.textContent = options.cancelLabel;
    
    // Styles pour le bouton d'annulation
    cancelButton.style.padding = '6px 12px';
    cancelButton.style.borderRadius = '6px';
    cancelButton.style.fontSize = '14px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.transition = 'all 0.2s';
    
    // Les couleurs seront appliquées par applyModalStyles
    
    // Effet hover pour le bouton d'annulation
    cancelButton.addEventListener('mouseover', () => {
      if (isDarkTheme) {
        cancelButton.style.backgroundColor = '#333333';
      } else {
        cancelButton.style.backgroundColor = '#f5f5f5';
      }
    });
    
    cancelButton.addEventListener('mouseout', () => {
      cancelButton.style.backgroundColor = 'transparent';
    });
    
    // Bouton de confirmation
    confirmButton = document.createElement('button');
    confirmButton.className = `le-chat-plus-modal-button ${options.isDelete ? 'delete' : 'confirm'}`;
    confirmButton.textContent = options.confirmLabel;
    
    // Styles communs pour le bouton de confirmation
    confirmButton.style.padding = '6px 12px';
    confirmButton.style.borderRadius = '6px';
    confirmButton.style.fontSize = '14px';
    confirmButton.style.cursor = 'pointer';
    confirmButton.style.transition = 'all 0.2s';
    
    // Les couleurs seront appliquées par applyModalStyles
    
    // Effet hover pour les boutons
    if (options.isDelete) {
      confirmButton.addEventListener('mouseover', () => {
        if (isDarkTheme) {
          confirmButton.style.backgroundColor = 'rgba(220, 0, 0, 0.2)';
        } else {
          confirmButton.style.backgroundColor = 'rgba(220, 0, 0, 0.1)';
        }
      });
      
      confirmButton.addEventListener('mouseout', () => {
        if (isDarkTheme) {
          confirmButton.style.backgroundColor = 'transparent'; // Rétablir le fond transparent en mode sombre
        } else {
          confirmButton.style.backgroundColor = 'transparent'; // Rétablir le fond transparent en mode clair
        }
      });
    } else {
      confirmButton.addEventListener('mouseover', () => {
        if (isDarkTheme) {
          confirmButton.style.backgroundColor = '#444444';
        } else {
          confirmButton.style.backgroundColor = '#e5e5e5';
        }
      });
      
      confirmButton.addEventListener('mouseout', () => {
        if (isDarkTheme) {
          confirmButton.style.backgroundColor = '#3a3a3a';
        } else {
          confirmButton.style.backgroundColor = '#f0f0f0';
        }
      });
    }
    
    // Assembler les éléments
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(confirmButton);
    
    modalContent.appendChild(header);
    modalContent.appendChild(buttonsContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Styles du modal
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.2s';
    
    // Appliquer les styles initiaux
    applyModalStyles(isDarkTheme);
    
    // Gérer les événements
    const close = (result: string | boolean | null) => {
      modal.style.opacity = '0';
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
            input.style.borderColor = isDarkTheme ? '#555555' : '#dddddd';
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
      modal.style.opacity = '1';
      if (input) input.focus();
    });
  });
}

// Fonction pour afficher un modal de création de dossier
function showFolderCreateModal(): Promise<string | null> {
  return showModal({
    title: "Créer un nouveau dossier",
    inputPlaceholder: "Nom du dossier",
    confirmLabel: "Créer",
    cancelLabel: "Annuler"
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
      
      // Variables pour le drag and drop avec positionnement
      let currentDropTarget = null;
      let targetPosition = -1;
      let reorderIndicator = null;
      
      // Créer une copie visuelle de l'élément pour le drag
      const rect = item.getBoundingClientRect();
      dragIndicator = document.createElement('div');
      dragIndicator.className = 'conversation-drag-clone';
      dragIndicator.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>`;
      dragIndicator.style.position = 'fixed';
      dragIndicator.style.zIndex = '10000';
      dragIndicator.style.background = 'rgba(255, 255, 255, 0.25)';
      dragIndicator.style.border = '1px solid rgba(221, 221, 221, 0.3)';
      dragIndicator.style.borderRadius = '4px';
      dragIndicator.style.padding = '6px';
      dragIndicator.style.width = 'auto';
      dragIndicator.style.height = 'auto';
      dragIndicator.style.pointerEvents = 'none';
      dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
      dragIndicator.style.opacity = '0';
      dragIndicator.style.transition = 'opacity 0.15s';
      dragIndicator.style.color = 'rgba(51, 51, 51, 0.7)';
      dragIndicator.style.display = 'flex';
      dragIndicator.style.alignItems = 'center';
      dragIndicator.style.justifyContent = 'center';
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
        url: href.startsWith('/') ? window.location.origin + href : href
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
          
          // Nettoyer les indicateurs de réorganisation précédents
          if (reorderIndicator && reorderIndicator.parentNode) {
            reorderIndicator.parentNode.removeChild(reorderIndicator);
            reorderIndicator = null;
          }
          
          // Nettoyer les classes drag-over
          document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
          });
          
          // Trouver l'élément sous le curseur
          const elementsUnderCursor = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
          
          // Chercher un en-tête de dossier ou une conversation dans un dossier
          const folderHeader = elementsUnderCursor.find(el => 
            el.classList && el.classList.contains('le-chat-plus-folder-header')
          );
          
          const folderConversation = elementsUnderCursor.find(el => 
            el.classList && el.classList.contains('le-chat-plus-conversation-item')
          ) as HTMLElement | undefined;
          
          // Si on survole un en-tête de dossier
          if (folderHeader) {
            folderHeader.classList.add('drag-over');
            // Effet visuel sobre sur le clone
            dragIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
            dragIndicator.style.borderColor = 'rgba(176, 176, 176, 0.4)';
            dragIndicator.style.background = 'rgba(255, 255, 255, 0.35)';
            
            // Réinitialiser les variables de position
            currentDropTarget = null;
            targetPosition = -1;
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
            if (moveEvent.clientY < middleY) {
              // Survol de la moitié supérieure
              folderConversation.classList.add('drag-over-top');
              // Créer un indicateur visuel au-dessus
              reorderIndicator = createReorderIndicator(folderConversation, 'before');
            } else {
              // Survol de la moitié inférieure
              folderConversation.classList.add('drag-over-bottom');
              // Créer un indicateur visuel en-dessous
              reorderIndicator = createReorderIndicator(folderConversation, 'after');
            }
            
            // Sauvegarder la conversation et calculer la position
            currentDropTarget = folderConversation;
            if (folderItem) {
              const conversationsInFolder = Array.from(folderItem.querySelectorAll('.le-chat-plus-conversation-item'));
              const targetIndex = conversationsInFolder.indexOf(folderConversation);
              targetPosition = (moveEvent.clientY < middleY) ? targetIndex : targetIndex + 1;
            }
            
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
          
          const folderConversation = elementsUnderCursor.find(el => 
            el.classList && el.classList.contains('le-chat-plus-conversation-item')
          ) as HTMLElement | undefined;
          
          // 1. Drop sur une conversation dans un dossier (à une position spécifique)
          if (currentDropTarget && targetPosition !== -1) {
            // Animation vers la position cible
            if (reorderIndicator) {
              const rect = reorderIndicator.getBoundingClientRect();
              dragIndicator.style.transform = 'scale(0.9)';
              dragIndicator.style.top = `${rect.top}px`;
              dragIndicator.style.left = `${rect.left}px`;
              dragIndicator.style.opacity = '0';
            }
            
            // Trouver l'ID du dossier
            const folderItem = currentDropTarget.closest('.le-chat-plus-folder-item');
            if (folderItem) {
              // Chercher l'en-tête du dossier pour l'effet visuel
              const header = folderItem.querySelector('.le-chat-plus-folder-header');
              if (header) {
                header.classList.remove('drag-over');
                header.classList.add('drop-success');
              }
              
              // Trouver l'ID du dossier
              const findFolderIdFromElement = async () => {
                const folders = await getFolders();
                const folderItems = document.querySelectorAll('.le-chat-plus-folder-item');
                const folderIndex = Array.from(folderItems).indexOf(folderItem);
                if (folderIndex >= 0 && folderIndex < folders.length) {
                  return folders[folderIndex].id;
                }
                return null;
              };
              
              // Exécuter le drop à la position spécifique
              findFolderIdFromElement().then(folderId => {
                if (folderId) {
                  addConversationToFolder(folderId, conversationData, targetPosition);
                  
                  // Retirer la classe après un délai
                  setTimeout(() => {
                    const header = folderItem.querySelector('.le-chat-plus-folder-header');
                    if (header) {
                      header.classList.remove('drop-success');
                    }
                  }, 500);
                }
              });
            }
          }
          // 2. Drop sur un en-tête de dossier (comportement d'origine)
          else if (folderHeader) {
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
        document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
          el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
        
        if (dragIndicator && dragIndicator.parentNode) {
          dragIndicator.parentNode.removeChild(dragIndicator);
          dragIndicator = null;
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
      
      function updateDragIndicatorPosition(evt: MouseEvent) {
        if (dragIndicator) {
          // Déplacer l'élément avec un décalage par rapport au curseur
          dragIndicator.style.top = `${evt.clientY - 10}px`;
          dragIndicator.style.left = `${evt.clientX - dragIndicator.offsetWidth / 3}px`;
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
  safeSetStyle(folderHeader, 'padding', '8px 10px'); // Ajout de padding horizontal (10px à droite et à gauche)
  safeSetStyle(folderHeader, 'borderRadius', '4px');
  safeSetStyle(folderHeader, 'transition', 'background-color 0.2s ease');
  safeSetStyle(folderHeader, 'cursor', 'pointer');
  
  // Ajouter l'effet de hover avec support pour le thème sombre
  folderHeader.addEventListener('mouseenter', () => {
    // Détecter si nous sommes en dark mode
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark' || 
                     document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark');
    
    if (isDarkTheme) {
      // Couleur de survol pour le mode sombre - plus visible
      safeSetStyle(folderHeader, 'backgroundColor', 'var(--background-color-secondary, rgba(255, 255, 255, 0.1))');
    } else {
      // Couleur de survol pour le mode clair
      safeSetStyle(folderHeader, 'backgroundColor', 'var(--background-color-muted, rgba(0, 0, 0, 0.05))');
    }
  });
  
  folderHeader.addEventListener('mouseleave', () => {
    safeSetStyle(folderHeader, 'backgroundColor', 'transparent');
  });
  
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
  
  // Conteneur pour les boutons d'action (à droite)
  const buttonsContainer = document.createElement('div');
  safeSetStyle(buttonsContainer, 'display', 'flex');
  safeSetStyle(buttonsContainer, 'alignItems', 'center');
  
  // Bouton de rafraîchissement
  const refreshButton = document.createElement('button');
  refreshButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M23 4v6h-6"></path>
    <path d="M1 20v-6h6"></path>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
  </svg>`;
  refreshButton.title = 'Rafraîchir les dossiers';
  safeSetStyle(refreshButton, 'background', 'transparent');
  safeSetStyle(refreshButton, 'color', 'var(--text-color-subtle)');
  safeSetStyle(refreshButton, 'border', '1px solid transparent');
  safeSetStyle(refreshButton, 'borderRadius', '4px');
  safeSetStyle(refreshButton, 'width', '16px');
  safeSetStyle(refreshButton, 'height', '16px');
  safeSetStyle(refreshButton, 'display', 'flex');
  safeSetStyle(refreshButton, 'alignItems', 'center');
  safeSetStyle(refreshButton, 'justifyContent', 'center');
  safeSetStyle(refreshButton, 'cursor', 'pointer');
  safeSetStyle(refreshButton, 'fontWeight', 'normal');
  safeSetStyle(refreshButton, 'fontSize', '12px');
  safeSetStyle(refreshButton, 'transition', 'all 0.2s');
  safeSetStyle(refreshButton, 'boxShadow', 'none');
  safeSetStyle(refreshButton, 'marginRight', '3px');
  
  // Bouton pour fermer tous les dossiers
  const collapseAllButton = document.createElement('button');
  collapseAllButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="5 9 12 16 19 9"></polyline>
  </svg>`;
  collapseAllButton.title = 'Ouvrir la liste des dossiers';
  safeSetStyle(collapseAllButton, 'background', 'var(--background-color-badge-gray)');
  safeSetStyle(collapseAllButton, 'color', 'var(--text-color-subtle)');
  safeSetStyle(collapseAllButton, 'border', '1px solid var(--background-color-badge-gray)');
  safeSetStyle(collapseAllButton, 'borderRadius', '4px');
  safeSetStyle(collapseAllButton, 'width', '16px');
  safeSetStyle(collapseAllButton, 'height', '16px');
  safeSetStyle(collapseAllButton, 'display', 'flex');
  safeSetStyle(collapseAllButton, 'alignItems', 'center');
  safeSetStyle(collapseAllButton, 'justifyContent', 'center');
  safeSetStyle(collapseAllButton, 'cursor', 'pointer');
  safeSetStyle(collapseAllButton, 'fontWeight', 'normal');
  safeSetStyle(collapseAllButton, 'fontSize', '12px');
  safeSetStyle(collapseAllButton, 'transition', 'all 0.2s');
  safeSetStyle(collapseAllButton, 'boxShadow', 'none');
  safeSetStyle(collapseAllButton, 'marginRight', '3px');
  safeSetStyle(collapseAllButton, 'padding', '0'); // S'assurer qu'il n'y a pas de padding qui réduit la zone cliquable
  
  // Ajouter les boutons dans l'ordre souhaité
  buttonsContainer.appendChild(refreshButton);
  buttonsContainer.appendChild(collapseAllButton);
  
  const addFolderButton = document.createElement('button');
  addFolderButton.innerHTML = '+';
  addFolderButton.title = 'Ajouter un dossier';
  safeSetStyle(addFolderButton, 'background', 'var(--background-color-badge-gray)');
  safeSetStyle(addFolderButton, 'color', 'var(--text-color-subtle)');
  safeSetStyle(addFolderButton, 'border', '1px solid var(--background-color-badge-gray)');
  safeSetStyle(addFolderButton, 'borderRadius', '4px');
  safeSetStyle(addFolderButton, 'width', '16px');
  safeSetStyle(addFolderButton, 'height', '16px');
  safeSetStyle(addFolderButton, 'display', 'flex');
  safeSetStyle(addFolderButton, 'alignItems', 'center');
  safeSetStyle(addFolderButton, 'justifyContent', 'center');
  safeSetStyle(addFolderButton, 'cursor', 'pointer');
  safeSetStyle(addFolderButton, 'fontWeight', 'normal');
  safeSetStyle(addFolderButton, 'fontSize', '12px');
  safeSetStyle(addFolderButton, 'transition', 'all 0.2s');
  safeSetStyle(addFolderButton, 'boxShadow', 'none');
  
  // Ajouter le bouton + au conteneur de boutons
  buttonsContainer.appendChild(addFolderButton);
  
  folderHeader.appendChild(folderTitle);
  folderHeader.appendChild(buttonsContainer);
  foldersSection.appendChild(folderHeader);
  
  // Conteneur pour la liste des dossiers
  const foldersList = document.createElement('div');
  foldersList.id = 'le-chat-plus-folders-list';
  foldersList.className = 'le-chat-plus-folders-list-scrollbar'; // Ajout de la classe pour les styles de scrollbar
  safeSetStyle(foldersList, 'maxHeight', '0');
  safeSetStyle(foldersList, 'overflow', 'hidden');
  safeSetStyle(foldersList, 'transition', 'max-height 0.3s ease-in-out'); // Animation plus lente (0.5s au lieu de 0.3s)
  // Initialisation fermée par défaut
  foldersSection.appendChild(foldersList);
  
  // Ajouter un écouteur pour la fin de transition
  foldersList.addEventListener('transitionend', () => {
    // Si la liste est ouverte (maxHeight > 0), activer la scrollbar
    if (foldersList.style.maxHeight !== '0px') {
      safeSetStyle(foldersList, 'overflow', 'auto');
    }
  });
  
  // Rendre le titre cliquable
  safeSetStyle(folderTitle, 'cursor', 'pointer');
  safeSetStyle(folderTitle, 'user-select', 'none'); // Éviter la sélection du texte au clic
  
  // Ajouter une transition pour l'icône de dossier
  safeSetStyle(folderIcon, 'transition', 'transform 0.3s ease-in-out');
  
  // Fonction pour basculer l'affichage des dossiers
  const toggleFolderDisplay = () => {
    // Détecter l'état actuel à partir de la maxHeight
    const isVisible = foldersList.style.maxHeight !== '0px';
    
    if (isVisible) {
      // Fermeture du tiroir - d'abord mettre overflow hidden
      safeSetStyle(foldersList, 'overflow', 'hidden');
      foldersList.style.maxHeight = '0';
      // Rotation de l'icône du dossier à l'état normal
      safeSetStyle(folderIcon, 'transform', 'rotate(0deg)');
      // Changer l'icône du bouton collapseAll pour pointer vers le bas
      collapseAllButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="5 9 12 16 19 9"></polyline>
      </svg>`;
      collapseAllButton.title = 'Ouvrir la liste des dossiers';
    } else {
      // Ouverture du tiroir - calcul dynamique de la hauteur nécessaire
      foldersList.style.maxHeight = '200px';
      // On ne met plus le timeout ici, c'est géré par l'événement transitionend
      // Rotation de l'icône du dossier de 20 degrés
      safeSetStyle(folderIcon, 'transform', 'rotate(20deg)');
      // Remettre l'icône du bouton collapseAll pour pointer vers le haut
      collapseAllButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="19 15 12 8 5 15"></polyline>
      </svg>`;
      collapseAllButton.title = 'Fermer tous les dossiers';
    }
  };

  // Supprimer l'ancien écouteur du titre et ajouter un écouteur pour l'en-tête complet
  folderHeader.addEventListener('click', (e) => {
    // Empêcher les clics sur les boutons d'action de déclencher l'ouverture/fermeture
    if (buttonsContainer.contains(e.target as Node)) {
      return;
    }
    toggleFolderDisplay();
  });
  
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
      
      // Ouvrir la liste de dossiers si elle est fermée
      if (foldersList.style.maxHeight === '0px' || !foldersList.style.maxHeight) {
        foldersList.style.maxHeight = '200px';
      }
      
      // Rafraîchir l'affichage des dossiers
      await renderFolders();
      
      // Après le rendu terminé, s'assurer que l'icône et les autres éléments sont synchronisés
      safeSetStyle(folderIcon, 'transform', 'rotate(20deg)');
      collapseAllButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="19 15 12 8 5 15"></polyline>
      </svg>`;
      collapseAllButton.title = 'Fermer tous les dossiers';
    }
  });
  
  // Ajouter gestionnaire d'événements pour le bouton de rafraîchissement
  refreshButton.addEventListener('click', async () => {
    // Ajouter un effet visuel de rotation pendant le rafraîchissement
    refreshButton.style.transform = 'rotate(360deg)';
    refreshButton.style.transition = 'transform 0.5s';
    
    // Rafraîchir les dossiers
    await renderFolders();
    
    // Après 500ms, réinitialiser la rotation pour la prochaine utilisation
    setTimeout(() => {
      refreshButton.style.transform = '';
      refreshButton.style.transition = '';
    }, 500);
  });
  
  // Ajouter gestionnaire d'événements pour le bouton de fermeture de tous les dossiers
  collapseAllButton.addEventListener('click', async (e) => {
    // Empêcher la propagation pour éviter des conflits avec d'autres gestionnaires
    e.stopPropagation();
    
    // Obtenir l'état actuel de la liste
    const isListVisible = foldersList.style.maxHeight !== '0px';
    
    // Si la liste est fermée, on l'ouvre simplement
    if (!isListVisible) {
      foldersList.style.maxHeight = '200px';
      // On ne met plus le timeout ici, c'est géré par l'événement transitionend
      safeSetStyle(folderIcon, 'transform', 'rotate(20deg)');
      // Changer l'icône pour fermer tous les dossiers
      collapseAllButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="19 15 12 8 5 15"></polyline>
      </svg>`;
      collapseAllButton.title = 'Fermer tous les dossiers';
      return;
    }
    
    // Si la liste est ouverte, on agit sur les dossiers
    // Obtenir tous les dossiers
    const folders = await getFolders();
    
    // Vérifier si tous les dossiers sont déjà fermés
    const allFoldersClosed = folders.every(folder => !folder.expanded);
    
    // Si tous les dossiers sont déjà fermés, fermer le tiroir
    if (allFoldersClosed) {
      // Fermeture du tiroir - d'abord mettre overflow hidden
      safeSetStyle(foldersList, 'overflow', 'hidden');
      foldersList.style.maxHeight = '0';
      // Rotation de l'icône du dossier à l'état normal
      safeSetStyle(folderIcon, 'transform', 'rotate(0deg)');
      // Changer l'icône pour ouvrir la liste de dossiers
      collapseAllButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="5 9 12 16 19 9"></polyline>
      </svg>`;
      collapseAllButton.title = 'Ouvrir la liste des dossiers';
      return;
    }
    
    // Sinon, mettre à jour tous les dossiers pour les fermer
    const updatedFolders = folders.map(folder => ({
      ...folder,
      expanded: false
    }));
    
    // Sauvegarder l'état fermé
    await storage.set('folders', updatedFolders);
    
    // Rafraîchir l'affichage
    await renderFolders();
  });
  
  console.log("Interface des dossiers injectée avec succès");
}

// Observer les mutations du DOM pour injecter notre UI quand la sidebar devient disponible
function setupDOMObserver() {
  // Une variable pour suivre si nous avons déjà injecté l'interface avec succès
  let successfullyInjected = false;
  let lastInjectionAttempt = 0;
  const INJECTION_COOLDOWN = 2000; // 2 secondes entre les tentatives d'injection
  
  const observer = new MutationObserver((mutations) => {
    const now = Date.now();
    
    // Si nous avons récemment tenté une injection, ne pas réessayer tout de suite
    if (now - lastInjectionAttempt < INJECTION_COOLDOWN) {
      return;
    }
    
    // Vérifier si nos dossiers existent et sont visibles
    const foldersElement = document.getElementById('le-chat-plus-folders');
    const isVisible = foldersElement && 
                     window.getComputedStyle(foldersElement).display !== 'none' &&
                     foldersElement.offsetParent !== null;
    
    // Si notre interface a déjà été injectée avec succès et qu'elle est toujours visible
    if (successfullyInjected && isVisible) {
      // Mettre à jour le drag and drop, mais ne pas réinjecter
      setupDragAndDropForConversations();
      return;
    }
    
    // Si notre interface n'existe pas ou n'est plus visible, chercher la sidebar
    let shouldInject = false;
    
    // Chercher la sidebar dans les mutations
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // Vérifier si ce nœud ou ses enfants contiennent des liens de conversation
            const hasConversationLinks = node.querySelector('a[href^="/chat/"]');
            if (hasConversationLinks) {
              shouldInject = true;
              break;
            }
          }
        }
      }
      if (shouldInject) break;
    }
    
    // Si la sidebar est trouvée ou si notre interface a disparu
    if (shouldInject || (!isVisible && document.querySelector('a[href^="/chat/"]'))) {
      lastInjectionAttempt = now;
      
      // Appeler directement sans délai
        injectFoldersUI().then(() => {
          successfullyInjected = true;
        });
    }
  });
  
  // Observer tout le document
  observer.observe(document.body, { childList: true, subtree: true });
}

// Attendre que le DOM soit chargé pour injecter notre UI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Attendre que la page Mistral AI ait terminé son chargement complet
    setTimeout(injectFoldersUI, 1000); // Attendre 1 seconde après le chargement du DOM
  });
} else {
  // Si le DOM est déjà chargé, attendre un peu pour que la page Mistral AI finisse de s'initialiser
  setTimeout(injectFoldersUI, 1000);
}

// Configurer l'observateur pour surveiller les modifications du DOM
setupDOMObserver();

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
async function addConversationToFolder(folderId: string, conversation: {id: string, title: string, url: string}, position?: number): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) return;
  
  // Récupérer les conversations actuelles du dossier
  const conversations = await storage.get<ConversationRef[]>(`folder_conversations_${folderId}`) || [];
  
  // Vérifier si la conversation est déjà dans le dossier
  const existingIndex = conversations.findIndex(c => c.id === conversation.id);
  if (existingIndex !== -1) {
    // Si la position est spécifiée et différente, déplacer la conversation
    if (position !== undefined && position !== existingIndex) {
      const [conversationToMove] = conversations.splice(existingIndex, 1);
      conversations.splice(position, 0, conversationToMove);
      await storage.set(`folder_conversations_${folderId}`, conversations);
      await renderFolders();
    }
    return;
  }
  
  // Ajouter la conversation au dossier
  const newConversation: ConversationRef = {
    id: conversation.id,
    title: conversation.title,
    url: conversation.url,
    addedAt: Date.now()
  };
  
  // Insérer à la position spécifiée ou à la fin
  if (position !== undefined && position >= 0 && position <= conversations.length) {
    conversations.splice(position, 0, newConversation);
  } else {
  conversations.push(newConversation);
  }
  
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
    // Correction du sélecteur - utiliser le-chat-plus-folder-content au lieu de le-chat-plus-folder-conversations
    const conversationsContainer = folderItem.querySelector('.le-chat-plus-folder-content');
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
  
  // S'assurer que tous les dossiers sont fermés au chargement initial de la page
  // Utiliser une variable statique pour suivre si c'est le premier rendu depuis le chargement de la page
  if (!renderFolders.hasOwnProperty('initialRenderDone')) {
    // Première exécution après le chargement de la page, fermer tous les dossiers
    const foldersWithUpdatedState = folders.map(folder => ({
      ...folder,
      expanded: false
    }));
    
    // Sauvegarder l'état fermé
    await storage.set('folders', foldersWithUpdatedState);
    
    // Mettre à jour les folders locaux pour le rendu actuel
    folders.forEach(folder => {
      folder.expanded = false;
    });
    
    // Marquer comme fait pour ne pas répéter à chaque appel de renderFolders
    (renderFolders as any).initialRenderDone = true;
  }
  
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
    safeSetStyle(expandIcon, 'fontSize', '6px');
    safeSetStyle(expandIcon, 'color', 'var(--text-color-subtle)');
    safeSetStyle(expandIcon, 'transition', 'transform 0.2s');
    
    // Nom du dossier
    const folderName = document.createElement('span');
    folderName.textContent = `${folder.name}`;
    folderName.className = 'folder-name';
    safeSetStyle(folderName, 'flex', '1');
    safeSetStyle(folderName, 'fontWeight', 'normal');
    safeSetStyle(folderName, 'fontSize', '13px');
    safeSetStyle(folderName, 'color', 'var(--text-color-subtle)');
    safeSetStyle(folderName, 'cursor', 'inherit'); // Hériter le curseur du parent (qui est pointer pour le header)
    safeSetStyle(folderName, 'padding', '2px');
    safeSetStyle(folderName, 'border-radius', '3px');
    safeSetStyle(folderName, 'transition', 'background-color 0.2s');
    
    // Fonction pour activer l'édition directe du nom
    const makeNameEditable = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault(); // Arrêter le comportement par défaut
      
      // Empêcher le toggle du dossier pendant l'édition
      if (folderName.getAttribute('contenteditable') === 'true') {
        return; // Déjà en mode édition
      }
      
      // Rendre le texte éditable
      folderName.setAttribute('contenteditable', 'true');
      folderName.focus();
      
      // Utiliser le curseur text pour l'édition
      safeSetStyle(folderName, 'cursor', 'text');
      
      // Sélectionner tout le texte
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(folderName);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // Style en mode édition
      safeSetStyle(folderName, 'background-color', 'rgba(0, 0, 0, 0.05)');
      safeSetStyle(folderName, 'outline', 'none');
      
      // Enregistrer le contenu original pour annulation
      const originalName = folderName.textContent || '';
      
      // Arrêter la propagation des événements de souris pendant l'édition
      const stopEventPropagation = (e: Event) => {
        e.stopPropagation();
      };
      
      folderName.addEventListener('mousedown', stopEventPropagation);
      folderName.addEventListener('click', stopEventPropagation);
      
      // Gérer la validation par la touche Entrée
      const handleEnterKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          folderName.blur(); // Déclenche l'événement blur qui validera
        } else if (e.key === 'Escape') {
          e.preventDefault();
          folderName.textContent = originalName;
          folderName.blur();
        }
      };
      
      // Valider le nouveau nom quand on perd le focus
      const handleBlur = async () => {
        folderName.removeEventListener('keydown', handleEnterKey);
        folderName.removeEventListener('blur', handleBlur);
        folderName.removeEventListener('mousedown', stopEventPropagation);
        folderName.removeEventListener('click', stopEventPropagation);
        
        // Désactiver l'édition
        folderName.setAttribute('contenteditable', 'false');
        safeSetStyle(folderName, 'background-color', 'transparent');
        
        // Rétablir le curseur normal
        safeSetStyle(folderName, 'cursor', 'inherit');
        
        // Récupérer le nouveau nom
        const newName = folderName.textContent?.trim();
        
        // Si le nom a changé et n'est pas vide
        if (newName && newName !== originalName && newName.length > 0) {
          await renameFolder(folder.id, newName);
        } else {
          // Restaurer le nom original si vide ou annulé
          folderName.textContent = originalName;
        }
      };
      
      folderName.addEventListener('keydown', handleEnterKey);
      folderName.addEventListener('blur', handleBlur);
    };
    
    // Ajouter la possibilité d'éditer en double-cliquant sur le nom
    folderName.addEventListener('dblclick', makeNameEditable);
    
    // Conteneur pour les boutons d'action (renommer et supprimer)
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'folder-actions';
    safeSetStyle(actionsContainer, 'opacity', '0');
    safeSetStyle(actionsContainer, 'transition', 'opacity 0.2s');
    safeSetStyle(actionsContainer, 'display', 'flex');
    
    // Bouton de renommage
    const renameButton = document.createElement('button');
    renameButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>`;
    safeSetStyle(renameButton, 'background', 'none');
    safeSetStyle(renameButton, 'border', 'none');
    safeSetStyle(renameButton, 'color', 'var(--text-color-subtle)');
    safeSetStyle(renameButton, 'cursor', 'pointer');
    safeSetStyle(renameButton, 'padding', '2px 5px');
    safeSetStyle(renameButton, 'opacity', '0.7');
    safeSetStyle(renameButton, 'transition', 'opacity 0.2s');
    safeSetStyle(renameButton, 'display', 'flex');
    safeSetStyle(renameButton, 'alignItems', 'center');
    renameButton.title = 'Renommer ce dossier';
    
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
    
    // Ajouter les boutons au conteneur d'actions
    actionsContainer.appendChild(renameButton);
    actionsContainer.appendChild(deleteButton);
    
    folderHeader.appendChild(expandIcon);
    folderHeader.appendChild(folderName);
    folderHeader.appendChild(actionsContainer);
    folderItem.appendChild(folderHeader);
    
    // Ajouter l'événement de survol pour afficher les boutons
    folderHeader.addEventListener('mouseenter', () => {
      safeSetStyle(actionsContainer, 'opacity', '1');
    });
    
    folderHeader.addEventListener('mouseleave', () => {
      safeSetStyle(actionsContainer, 'opacity', '0');
    });
    
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
    
    // Reste du code pour les conversations...
    
    // Conteneur pour les conversations du dossier
    const conversationsContainer = document.createElement('div');
    conversationsContainer.className = 'le-chat-plus-folder-content';
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
        safeSetStyle(convLink, 'cursor', 'pointer');
        
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
        
        // Variables pour gérer le clic et le double-clic
        let clickTimer: number = 0;
        let isDoubleClick = false;
        
        // Empêcher le comportement par défaut du lien et gérer la navigation avec notre propre gestionnaire
        convLink.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Si nous sommes en mode édition, ne rien faire
          if (convLink.getAttribute('contenteditable') === 'true') {
            return;
          }
          
          // Si c'est un double clic, ne pas naviguer (l'événement dblclick s'en chargera)
          if (isDoubleClick) {
            isDoubleClick = false;
            return;
          }
          
          // Utiliser un timer pour différencier clic simple et double-clic
          if (clickTimer) {
            // Déjà un clic en attente, c'est un double-clic
            clearTimeout(clickTimer);
            clickTimer = 0;
            isDoubleClick = true;
          } else {
            // Premier clic, attendre pour voir si un second suit
            clickTimer = window.setTimeout(() => {
              clickTimer = 0;
              if (!isDoubleClick) {
                // C'était un clic simple, naviguer
                handleConvLinkClick(e, conv, convLink as HTMLElement);
              }
            }, 250); // Délai de détection du double-clic
          }
        });
        
        // Conteneur pour les boutons d'action
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'conversation-actions';
        safeSetStyle(actionsContainer, 'display', 'flex');
        safeSetStyle(actionsContainer, 'opacity', '0');
        safeSetStyle(actionsContainer, 'transition', 'opacity 0.2s');
        
        // Bouton pour éditer le nom de la conversation
        const editButton = document.createElement('button');
        editButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>`;
        safeSetStyle(editButton, 'background', 'none');
        safeSetStyle(editButton, 'border', 'none');
        safeSetStyle(editButton, 'color', '#999');
        safeSetStyle(editButton, 'cursor', 'pointer');
        safeSetStyle(editButton, 'padding', '2px');
        safeSetStyle(editButton, 'marginRight', '2px');
        editButton.title = 'Renommer la conversation';
        
        // Bouton pour supprimer la conversation du dossier
        const removeButton = document.createElement('button');
        removeButton.textContent = '×';
        safeSetStyle(removeButton, 'background', 'none');
        safeSetStyle(removeButton, 'border', 'none');
        safeSetStyle(removeButton, 'color', '#999');
        safeSetStyle(removeButton, 'cursor', 'pointer');
        safeSetStyle(removeButton, 'padding', '2px');
        safeSetStyle(removeButton, 'fontSize', '12px');
        removeButton.title = 'Retirer du dossier';
        
        // Ajouter les boutons au conteneur d'actions
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(removeButton);
        
        convItem.appendChild(convLink);
        convItem.appendChild(actionsContainer);
        conversationsContainer.appendChild(convItem);
        
        // Afficher les boutons d'action au survol
        convItem.addEventListener('mouseenter', () => {
          safeSetStyle(actionsContainer, 'opacity', '1');
        });
        
        convItem.addEventListener('mouseleave', () => {
          safeSetStyle(actionsContainer, 'opacity', '0');
        });
        
        // Fonction pour activer l'édition directe du nom d'une conversation
        const makeConvNameEditable = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault(); // Arrêter le comportement par défaut
          
          // Empêcher la navigation pendant l'édition
          if (convLink.getAttribute('contenteditable') === 'true') {
            return; // Déjà en mode édition
          }
          
          // Désactiver le lien pendant l'édition
          const originalHref = convLink.href;
          convLink.removeAttribute('href');
          
          // Rendre le texte éditable
          convLink.setAttribute('contenteditable', 'true');
          convLink.focus();
          
          // Utiliser le curseur text pour l'édition
          safeSetStyle(convLink, 'cursor', 'text');
          
          // Sélectionner tout le texte
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(convLink);
          selection?.removeAllRanges();
          selection?.addRange(range);
          
          // Style en mode édition
          safeSetStyle(convLink, 'background-color', 'rgba(0, 0, 0, 0.05)');
          safeSetStyle(convLink, 'outline', 'none');
          safeSetStyle(convLink, 'padding', '0 2px');
          
          // Enregistrer le contenu original pour annulation
          const originalName = convLink.textContent || '';
          
          // Arrêter la propagation des événements de souris pendant l'édition
          const stopEventPropagation = (e: Event) => {
            e.stopPropagation();
          };
          
          convLink.addEventListener('mousedown', stopEventPropagation);
          convLink.addEventListener('click', stopEventPropagation);
          
          // Gérer la validation par la touche Entrée
          const handleEnterKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              convLink.blur(); // Déclenche l'événement blur qui validera
            } else if (e.key === 'Escape') {
              e.preventDefault();
              convLink.textContent = originalName;
              convLink.blur();
            }
          };
          
          // Valider le nouveau nom quand on perd le focus
          const handleBlur = async () => {
            convLink.removeEventListener('keydown', handleEnterKey);
            convLink.removeEventListener('blur', handleBlur);
            convLink.removeEventListener('mousedown', stopEventPropagation);
            convLink.removeEventListener('click', stopEventPropagation);
            
            // Désactiver l'édition
            convLink.setAttribute('contenteditable', 'false');
            safeSetStyle(convLink, 'background-color', 'transparent');
            safeSetStyle(convLink, 'padding', '0');
            
            // Rétablir le curseur pointer
            safeSetStyle(convLink, 'cursor', 'pointer');
            
            // Restaurer le lien
            convLink.href = originalHref;
            
            // Récupérer le nouveau nom
            const newName = convLink.textContent?.trim();
            
            // Si le nom a changé et n'est pas vide
            if (newName && newName !== originalName && newName.length > 0) {
              await renameConversation(conv.id, newName);
            } else {
              // Restaurer le nom original si vide ou annulé
              convLink.textContent = originalName;
            }
          };
          
          convLink.addEventListener('keydown', handleEnterKey);
          convLink.addEventListener('blur', handleBlur);
        };
        
        // Ajouter la possibilité d'éditer en double-cliquant sur le nom
        convLink.addEventListener('dblclick', makeConvNameEditable);
        
        // Gestionnaire d'événements pour éditer le nom de la conversation
        editButton.addEventListener('click', makeConvNameEditable);
        
        // Gestionnaire d'événements pour supprimer la conversation
        removeButton.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmed = await showDeleteConfirmModal(conv.title || 'Conversation sans titre', 'conversation');
          if (confirmed) {
            await removeConversationFromFolder(folder.id, conv.id);
          }
        });
      }
    }
    
    folderItem.appendChild(conversationsContainer);
    foldersList.appendChild(folderItem);
    
    // Gestionnaire d'événements pour plier/déplier avec distinction clic simple/double
    folderHeader.addEventListener('click', function(e) {
      // Vérifier si l'événement provient d'un bouton d'action ou d'un de ses enfants
      if (e.target === renameButton || e.target === deleteButton || 
          (renameButton.contains && renameButton.contains(e.target as Node)) ||
          (deleteButton.contains && deleteButton.contains(e.target as Node))) {
        return; // Ne rien faire si le clic est sur un bouton
      }
      
          e.stopPropagation();
      
      // Utiliser un attribut de données pour garder la trace du timer
      const timerId = folderHeader.getAttribute('data-click-timer');
      
      if (timerId) {
        // C'est un double-clic, annuler l'action de clic simple
        clearTimeout(parseInt(timerId));
        folderHeader.removeAttribute('data-click-timer');
        // Ne pas plier/déplier, le double-clic est destiné à l'édition
      } else {
        // Premier clic, attendre un peu pour voir si un second suit
        const newTimerId = setTimeout(() => {
          // Pas de double-clic détecté, plier/déplier le dossier
          toggleFolderExpand(folder.id);
          folderHeader.removeAttribute('data-click-timer');
        }, 250);
        
        folderHeader.setAttribute('data-click-timer', newTimerId.toString());
      }
    });
    
    // Ajouter un écouteur spécifique pour le double-clic sur le nom du dossier
    folderName.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      // Annuler le timer de clic simple pour éviter que le dossier se plie/déplie
      const timerId = folderHeader.getAttribute('data-click-timer');
      if (timerId) {
        clearTimeout(parseInt(timerId));
        folderHeader.removeAttribute('data-click-timer');
      }
      makeNameEditable(e);
    });
    
    // Gestionnaire d'événements pour renommer le dossier
    renameButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      makeNameEditable(e);
    });
    
    // Gestionnaire d'événements pour supprimer le dossier
    deleteButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      const confirmed = await showDeleteConfirmModal(folder.name, 'dossier');
      if (confirmed) {
        await deleteFolder(folder.id);
      }
    });
  }
  
  // Après avoir rendu les conversations, configurer le drag and drop
  setupFolderConversationsDragAndDrop();
}

// Fonction pour configurer le drag and drop personnalisé pour les conversations dans les dossiers
function setupFolderConversationsDragAndDrop() {
  // Sélectionner tous les éléments de conversation dans les dossiers
  const folderConversationItems = document.querySelectorAll('.le-chat-plus-conversation-item');
  
  folderConversationItems.forEach(item => {
    // Éviter de configurer deux fois le même élément
    if (item.getAttribute('data-chat-plus-folder-draggable')) return;
    
    // Marquer cet élément comme configuré
    item.setAttribute('data-chat-plus-folder-draggable', 'true');
    item.classList.add('folder-conversation-draggable');
    
    // Ajouter des styles pour le curseur pointer au lieu de grab
    safeSetStyle(item as HTMLElement, 'cursor', 'pointer');
    
    // Trouver le lien pour extraire l'ID de conversation
    const convLink = item.querySelector('a');
    if (!convLink) return;
    
    // S'assurer que le lien a aussi un curseur pointer
    safeSetStyle(convLink as HTMLElement, 'cursor', 'pointer');
    
    const href = convLink.getAttribute('href');
    if (!href) return;
    
    // Extraire l'ID de conversation de l'URL
    const pathSegments = href.split('/');
    const chatIndex = pathSegments.indexOf('chat');
    const conversationId = chatIndex >= 0 && chatIndex + 1 < pathSegments.length ? pathSegments[chatIndex + 1] : null;
    
    if (!conversationId) return;
    
    // Trouver le dossier parent
    const folderItem = item.closest('.le-chat-plus-folder-item');
    if (!folderItem) return;
    
    // Utiliser mousedown/mousemove/mouseup au lieu de drag and drop natif
    item.addEventListener('mousedown', (e: MouseEvent) => {
      // Ne pas démarrer le drag sur un clic droit ou sur le bouton de suppression
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      const isRemoveButton = target.tagName === 'BUTTON' || target.closest('button');
      if (isRemoveButton) return;
      
      e.preventDefault(); // Empêcher la sélection de texte
      
      // Variables pour le drag
      let isDragging = false;
      let originFolderItem = folderItem;
      let currentTargetFolder = null;
      let reorderIndicator: HTMLElement | null = null;
      let targetPosition = -1;
      let currentDropTarget: HTMLElement | null = null;
      
      // Créer une copie visuelle de l'élément pour le drag
      const rect = item.getBoundingClientRect();
      const dragIndicator = document.createElement('div');
      dragIndicator.className = 'folder-conversation-drag-clone';
      dragIndicator.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>`;
      dragIndicator.style.position = 'fixed';
      dragIndicator.style.zIndex = '10000';
      dragIndicator.style.background = 'rgba(255, 255, 255, 0.25)';
      dragIndicator.style.border = '1px solid rgba(221, 221, 221, 0.3)';
      dragIndicator.style.borderRadius = '4px';
      dragIndicator.style.padding = '6px';
      dragIndicator.style.width = 'auto';
      dragIndicator.style.height = 'auto';
      dragIndicator.style.pointerEvents = 'none';
      dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
      dragIndicator.style.opacity = '0';
      dragIndicator.style.transition = 'opacity 0.15s';
      dragIndicator.style.color = 'rgba(51, 51, 51, 0.7)';
      dragIndicator.style.display = 'flex';
      dragIndicator.style.alignItems = 'center';
      dragIndicator.style.justifyContent = 'center';
      document.body.appendChild(dragIndicator);
      
      // Position initiale
      updateDragIndicatorPosition(e);
      
      // Ajouter la classe pour le style
      item.classList.add('dragging');
      
      // Semi-transparence pour l'élément original
      (item as HTMLElement).style.opacity = '0.6';
      
      // Désactiver la sélection de texte pendant le drag
      document.body.style.userSelect = 'none';
      
      // Données de la conversation
      const conversationData = {
        id: conversationId,
        title: convLink.textContent?.trim() || 'Conversation sans titre',
        url: href.startsWith('/') ? window.location.origin + href : href
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
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
          
          // Nettoyer les indicateurs de réorganisation précédents
          if (reorderIndicator && reorderIndicator.parentNode) {
            reorderIndicator.parentNode.removeChild(reorderIndicator);
            reorderIndicator = null;
          }
          
          // Nettoyer les classes de survol précédentes
          document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
          });
          
          // Trouver l'élément sous le curseur
          const elementsUnderCursor = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
          
          // Chercher un dossier cible
          const targetFolder = elementsUnderCursor.find(el => 
            el.classList && el.classList.contains('le-chat-plus-folder-header')
          ) as HTMLElement | undefined;
          
          // Chercher une conversation cible pour le repositionnement
          const targetConversation = elementsUnderCursor.find(el => 
            el.classList && el.classList.contains('le-chat-plus-conversation-item') && !el.classList.contains('dragging')
          ) as HTMLElement | undefined;
          
          // Trouver le dossier qui contient la conversation cible
          const targetFolderItem = targetConversation ? 
            targetConversation.closest('.le-chat-plus-folder-item') : 
            (targetFolder ? targetFolder.closest('.le-chat-plus-folder-item') : null);
          
          // Déterminer si nous sommes dans le même dossier ou un dossier différent
          const isSameFolder = targetFolderItem === originFolderItem;
          
          // 1. Si on survole un en-tête de dossier, préparer pour un transfert vers ce dossier
          if (targetFolder) {
            targetFolder.classList.add('drag-over');
            currentTargetFolder = targetFolder;
            
            // Effet visuel sobre sur le clone
            dragIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
            dragIndicator.style.borderColor = 'rgba(176, 176, 176, 0.4)';
            dragIndicator.style.background = 'rgba(255, 255, 255, 0.35)';
            
            // Réinitialiser la cible de repositionnement
            currentDropTarget = null;
            targetPosition = -1;
          } 
          // 2. Si on survole une conversation
          else if (targetConversation) {
            // Obtenir les dimensions de l'élément cible
            const targetRect = targetConversation.getBoundingClientRect();
            const middleY = targetRect.top + targetRect.height / 2;
            
            // Déterminer si on survole la moitié supérieure ou inférieure
            if (moveEvent.clientY < middleY) {
              // Survol de la moitié supérieure
              targetConversation.classList.add('drag-over-top');
              // Créer un indicateur visuel au-dessus
              reorderIndicator = createReorderIndicator(targetConversation, 'before');
} else {
              // Survol de la moitié inférieure
              targetConversation.classList.add('drag-over-bottom');
              // Créer un indicateur visuel en-dessous
              reorderIndicator = createReorderIndicator(targetConversation, 'after');
            }
            
            // Sauvegarder l'élément cible actuel pour le drop
            currentDropTarget = targetConversation;
            
            // Calculer la position cible pour l'ordre
            if (targetFolderItem) {
              const conversationsInFolder = Array.from(targetFolderItem.querySelectorAll('.le-chat-plus-conversation-item'));
              const targetIndex = conversationsInFolder.indexOf(targetConversation);
              targetPosition = (moveEvent.clientY < middleY) ? targetIndex : targetIndex + 1;
              
              // Si on déplace après nous-mêmes dans le même dossier, corriger la position
              if (isSameFolder) {
                const ourIndex = conversationsInFolder.indexOf(item as HTMLElement);
                if (ourIndex !== -1 && ourIndex < targetPosition) {
                  targetPosition--; 
                }
              }
            }
            
            // Si on est dans le même dossier, montrer indicateur de repositionnement
            if (isSameFolder) {
              // Effet visuel sobre pour le repositionnement
              dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              dragIndicator.style.borderColor = 'rgba(120, 120, 120, 0.3)';
              dragIndicator.style.background = 'rgba(245, 245, 245, 0.3)';
            } 
            // Si on est dans un dossier différent, montrer indicateur de transfert + position
            else if (targetFolderItem) {
              // Montrer qu'on va déplacer vers un autre dossier
              const targetFolderHeader = targetFolderItem.querySelector('.le-chat-plus-folder-header');
              if (targetFolderHeader) {
                targetFolderHeader.classList.add('drag-over');
                currentTargetFolder = targetFolderHeader as HTMLElement;
              }
              
              // Effet visuel pour le transfert vers une position spécifique
              dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              dragIndicator.style.borderColor = 'rgba(150, 150, 150, 0.3)';
              dragIndicator.style.background = 'rgba(250, 250, 250, 0.3)';
            }
          } else {
            // Pas de cible valide
            dragIndicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            dragIndicator.style.borderColor = 'rgba(221, 221, 221, 0.3)';
            dragIndicator.style.background = 'rgba(255, 255, 255, 0.25)';
            currentTargetFolder = null;
            currentDropTarget = null;
            targetPosition = -1;
          }
        }
      }
      
      async function handleMouseUp(upEvent: MouseEvent) {
        if (isDragging) {
          // Animation de drop
          dragIndicator.style.transition = 'all 0.15s ease-out';
          
          // Cas 1: Drop dans un dossier différent à une position spécifique
          if (currentDropTarget && targetPosition !== -1 && currentDropTarget.closest('.le-chat-plus-folder-item') !== originFolderItem) {
            // Animation vers la position cible
            const targetRect = currentDropTarget.getBoundingClientRect();
            dragIndicator.style.transform = 'scale(0.9)';
            
            // Animer vers la position d'insertion
            if (currentDropTarget.classList.contains('drag-over-top')) {
              dragIndicator.style.top = `${targetRect.top - 1}px`;
            } else {
              dragIndicator.style.top = `${targetRect.bottom + 1}px`;
            }
            
            dragIndicator.style.left = `${targetRect.left + targetRect.width/2}px`;
            dragIndicator.style.opacity = '0';
            
            // Trouver l'ID du dossier source
            const sourceFolderId = await findFolderIdFromElement(originFolderItem);
            
            // Trouver l'ID du dossier cible
            const targetFolderItem = currentDropTarget.closest('.le-chat-plus-folder-item');
            const targetFolderId = targetFolderItem ? await findFolderIdFromElement(targetFolderItem) : null;
            
            if (sourceFolderId && targetFolderId) {
              // Même dossier = pas d'action de déplacement entre dossiers
              if (sourceFolderId === targetFolderId) {
                // S'assurer que la classe drop-success est retirée avant de sortir
                currentTargetFolder.classList.remove('drop-success');
                cleanup();
                return;
              }
              
              // Supprimer du dossier source
              await removeConversationFromFolder(sourceFolderId, conversationId);
              
              // Ajouter au dossier cible à la position spécifique
              await addConversationToFolder(targetFolderId, conversationData, targetPosition);
              
              // Retirer la classe après un délai
              setTimeout(() => {
                if (currentTargetFolder) {
                  currentTargetFolder.classList.remove('drop-success');
                }
              }, 500);
            }
          }
          // Cas 2: Drop sur un en-tête de dossier
          else if (currentTargetFolder) {
            // Animation vers le dossier cible
            const folderRect = currentTargetFolder.getBoundingClientRect();
            dragIndicator.style.transform = 'scale(0.8)';
            dragIndicator.style.top = `${folderRect.top + folderRect.height/2}px`;
            dragIndicator.style.left = `${folderRect.left + folderRect.width/2}px`;
            dragIndicator.style.opacity = '0';
            
            // Trouver l'ID du dossier
            const targetFolderItem = currentTargetFolder.closest('.le-chat-plus-folder-item');
            if (targetFolderItem) {
              // Effet visuel
              currentTargetFolder.classList.remove('drag-over');
              currentTargetFolder.classList.add('drop-success');
              
              // Trouver l'ID du dossier source
              const sourceFolderId = await findFolderIdFromElement(originFolderItem);
              
              // Trouver l'ID du dossier cible
              const targetFolderId = await findFolderIdFromElement(targetFolderItem);
              
              if (sourceFolderId && targetFolderId) {
                // Même dossier = pas d'action de déplacement entre dossiers
                if (sourceFolderId === targetFolderId) {
                  // S'assurer que la classe drop-success est retirée avant de sortir
                  currentTargetFolder.classList.remove('drop-success');
                  cleanup();
                  return;
                }
                
                // Supprimer du dossier source
                await removeConversationFromFolder(sourceFolderId, conversationId);
                
                // Ajouter au dossier cible
                await addConversationToFolder(targetFolderId, conversationData);
                
                // Retirer la classe après un délai
    setTimeout(() => {
                  if (currentTargetFolder) {
                    currentTargetFolder.classList.remove('drop-success');
                  }
                }, 500);
              }
            }
          } 
          // Cas 3: Réorganisation dans le même dossier
          else if (currentDropTarget && targetPosition !== -1) {
            // Animation vers la position cible
            const targetRect = currentDropTarget.getBoundingClientRect();
            dragIndicator.style.transform = 'scale(0.9)';
            
            // Selon que l'on dépose au-dessus ou en-dessous
            if (currentDropTarget.classList.contains('drag-over-top')) {
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
              await reorderConversation(sourceFolderId, conversationId, targetPosition);
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
      
      async function findFolderIdFromElement(folderElement: Element): Promise<string | null> {
        const folders = await getFolders();
        const folderItems = document.querySelectorAll('.le-chat-plus-folder-item');
        const folderIndex = Array.from(folderItems).indexOf(folderElement);
        if (folderIndex >= 0 && folderIndex < folders.length) {
          return folders[folderIndex].id;
        }
        return null;
      }
      
      function cleanup() {
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

// Fonction pour mettre à jour uniquement l'état actif des conversations sans recharger tous les dossiers
async function updateActiveConversationHighlight() {
  const activeConversationId = getCurrentConversationId();
  
  // Obtenir tous les éléments de conversation dans les dossiers
  const conversationElements = document.querySelectorAll('.le-chat-plus-conversation-item');
  
  // Supprimer d'abord tous les états actifs
  conversationElements.forEach((convItem) => {
    const link = convItem.querySelector('a');
    if (link) {
      safeSetStyle(link, 'color', 'var(--text-color-muted)');
      safeSetStyle(link, 'fontWeight', 'normal');
      safeSetStyle(link, 'opacity', '1');
    }
    // Réinitialiser les styles de l'élément conversation
    convItem.classList.remove('active-conversation');
    safeSetStyle(convItem as HTMLElement, 'opacity', '1');
    safeSetStyle(convItem as HTMLElement, 'background-color', 'transparent');
  });
  
  // Si nous sommes sur un nouveau chat (pas d'ID de conversation), arrêter ici
  // Cela évite qu'une conversation reste marquée comme active lorsqu'on navigue vers un nouveau chat
  if (!activeConversationId) {
    return;
  }
  
  console.log("Mise à jour de la conversation active:", activeConversationId);
  
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
          safeSetStyle(link, 'opacity', '1');
          convItem.classList.add('active-conversation');
        }
      }
    }
  }
}

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
  // console.log("Tentative d'injection du bouton de prompt...");
  
  // Définir une constante pour l'opacité par défaut du bouton
  const BUTTON_DEFAULT_OPACITY = '0.5';
  const BUTTON_HOVER_OPACITY = '0.8';
  
  // Observer les changements de thème
  function setupThemeChangeObserver() {
    // Fonction pour détecter les changements de thème
    const detectThemeChange = () => {
      // console.log("Vérification des changements de thème...");
      
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
      
      // console.log("Styles du bouton de prompt mis à jour après changement de thème");
    };
    
    // Observer les changements d'attributs dans le body ou html pour détecter les changements de thème
    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Si un changement d'attribut de classe ou de thème est détecté
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'class' || 
             mutation.attributeName === 'data-theme' || 
             mutation.attributeName === 'theme')) {
          // console.log("Changement de thème détecté via attribut:", mutation.attributeName);
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
      // console.log("Bouton d'envoi trouvé, injection du bouton de prompt...");
      
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
      // console.log("Bouton de prompt injecté avec succès");
      
      // Configurer l'observateur de changement de thème après avoir injecté le bouton
      setupThemeChangeObserver();
    } 
    
    // Vérifier si le bouton d'envoi existe mais que notre bouton a disparu
    // (ce qui arrive quand l'interface est reconstruite)
    else if (sendButton && !document.getElementById('le-chat-plus-prompt-button')) {
      // console.log("Le bouton de prompt a disparu, réinjection...");
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
      // console.log("Surveillance périodique: bouton manquant, tentative de réinjection...");
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

// Fonction pour réorganiser une conversation dans un dossier
async function reorderConversation(folderId: string, conversationId: string, newPosition: number): Promise<void> {
  const conversations = await storage.get<ConversationRef[]>(`folder_conversations_${folderId}`) || [];
  
  // Trouver l'index actuel de la conversation
  const currentIndex = conversations.findIndex(c => c.id === conversationId);
  if (currentIndex === -1) return; // La conversation n'est pas dans ce dossier
  
  // S'assurer que la nouvelle position est valide
  if (newPosition < 0) newPosition = 0;
  if (newPosition >= conversations.length) newPosition = conversations.length - 1;
  
  // Si la position ne change pas, ne rien faire
  if (newPosition === currentIndex) return;
  
  // Déplacer la conversation à sa nouvelle position
  const [conversationToMove] = conversations.splice(currentIndex, 1);
  conversations.splice(newPosition, 0, conversationToMove);
  
  // Sauvegarder l'ordre mis à jour
  await storage.set(`folder_conversations_${folderId}`, conversations);
  
  // Rafraîchir l'interface
  await renderFolders();
} 

// Fonction pour renommer un dossier
async function renameFolder(folderId: string, newName: string): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  
  if (folderIndex !== -1) {
    folders[folderIndex].name = newName;
    await storage.set('folders', folders);
    await renderFolders();
  }
}

// Fonction pour renommer une conversation
async function renameConversation(conversationId: string, newTitle: string): Promise<void> {
  // Parcourir tous les dossiers pour trouver la conversation
  const folders = await getFolders();
  
  for (const folder of folders) {
    const conversations = await storage.get<ConversationRef[]>(`folder_conversations_${folder.id}`) || [];
    const convIndex = conversations.findIndex(c => c.id === conversationId);
    
    if (convIndex !== -1) {
      // Mettre à jour le titre de la conversation
      conversations[convIndex].title = newTitle;
      await storage.set(`folder_conversations_${folder.id}`, conversations);
    }
  }
  
  // Rafraîchir l'interface
  await renderFolders();
}

// Fonction pour gérer les clics sur une conversation dans un dossier
const handleConvLinkClick = (e: MouseEvent, conv: ConversationRef, convLink: HTMLElement) => {
  // Si en mode édition, ne rien faire
  if (convLink.getAttribute('contenteditable') === 'true') {
    return;
  }
  
  e.preventDefault();
  
  // Extraire le chemin correct de l'URL
  let path;
  try {
    // Vérifier si l'URL est déjà une URL complète
    if (conv.url.includes('//')) {
      const url = new URL(conv.url);
      path = url.pathname;
    } else {
      // Sinon, c'est juste un chemin
      path = conv.url;
    }
    
    // S'assurer que le chemin commence par /chat/
    if (!path.startsWith('/chat/')) {
      if (path.includes('/chat/')) {
        // Extraire la partie après /chat/
        const parts = path.split('/chat/');
        path = '/chat/' + parts[parts.length - 1];
      } else {
        console.error('Format de chemin invalide:', path);
        return;
      }
    }
    
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
  } catch (error) {
    console.error('Erreur lors de la navigation:', error);
  }
};

