/**
 * Le Chat+ : Extension pour améliorer l'interface de Mistral
 * Point d'entrée de l'extension (Content Script)
 */

import { injectStyles } from '~/modules/styles';
import { setupDOMObserver, setupURLChangeListener, setupExtensionMessageListener } from '~/modules/dom-observer';
import { detectAndSaveTheme } from '~/modules/theme-detector';
import { 
  setupFolderConversationsDragAndDrop, 
  setupDragAndDropForConversations, 
  setupStandaloneConversationsDragAndDrop,
  injectDragAndDropStyles,
  setupDragAndDrop
} from '../modules/drag-drop';
import { injectFoldersUI } from '~/modules/ui-renderer';
import { injectPromptButton } from '~/modules/prompt-button';
import { setupErrorInterceptor } from '~/modules/error-interceptor';

console.log("Le Chat+ : Initialisation de l'extension...");

/**
 * Détecte l'invalidation du contexte de l'extension et gère la récupération
 */
function setupContextInvalidationHandler(): void {
  // Fonction pour vérifier si le contexte de l'extension est toujours valide
  const checkExtensionContext = () => {
    try {
      // Une simple vérification - si chrome.runtime est undefined ou lastError existe, le contexte est invalide
      if (!chrome.runtime || chrome.runtime.lastError) {
        handleInvalidContext();
        return false;
      }
      return true;
    } catch (error) {
      // Si une erreur se produit lors de l'accès à chrome.runtime, le contexte est invalide
      handleInvalidContext();
      return false;
    }
  };

  // Fonction pour gérer un contexte d'extension invalide
  const handleInvalidContext = () => {
    // Nettoyer les écouteurs d'événements pour éviter les fuites de mémoire
    window.removeEventListener('error', checkExtensionContext);
    
    try {
      // Afficher un message discret à l'utilisateur
      const notificationElement = document.createElement('div');
      notificationElement.style.position = 'fixed';
      notificationElement.style.bottom = '10px';
      notificationElement.style.right = '10px';
      notificationElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      notificationElement.style.color = 'white';
      notificationElement.style.padding = '10px';
      notificationElement.style.borderRadius = '5px';
      notificationElement.style.zIndex = '9999';
      notificationElement.style.fontSize = '12px';
      notificationElement.textContent = "Le Chat+: Extension rechargée, actualisez la page pour restaurer les fonctionnalités.";
      
      // Ajouter un bouton pour actualiser la page
      const refreshButton = document.createElement('button');
      refreshButton.textContent = "Actualiser";
      refreshButton.style.marginLeft = '10px';
      refreshButton.style.padding = '3px 8px';
      refreshButton.style.border = 'none';
      refreshButton.style.borderRadius = '3px';
      refreshButton.style.backgroundColor = '#ff5500';
      refreshButton.style.color = 'white';
      refreshButton.style.cursor = 'pointer';
      
      refreshButton.onclick = () => {
        window.location.reload();
      };
      
      notificationElement.appendChild(refreshButton);
      document.body.appendChild(notificationElement);
      
      // Masquer la notification après 10 secondes
      setTimeout(() => {
        if (notificationElement.parentNode) {
          notificationElement.parentNode.removeChild(notificationElement);
        }
      }, 10000);
    } catch (error) {
      // Ne rien faire en cas d'erreur, pour éviter les boucles d'erreurs
    }
  };

  // Configurer un écouteur d'événements pour détecter les erreurs qui pourraient indiquer une invalidation
  window.addEventListener('error', (event) => {
    if (event.error && event.error.toString().includes("Extension context invalidated")) {
      handleInvalidContext();
      // Éviter la propagation pour ne pas polluer la console
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Vérifier périodiquement si le contexte est toujours valide
  const contextCheckInterval = setInterval(() => {
    if (!checkExtensionContext()) {
      clearInterval(contextCheckInterval);
    }
  }, 10000);

  // Vérifier immédiatement
  checkExtensionContext();
}

/**
 * Point d'entrée principal de l'extension
 */
async function main() {
  console.log("Initialisation de Le Chat+...");
  
  // Configurer le gestionnaire d'invalidation du contexte en premier
  setupContextInvalidationHandler();
  
  // Installer l'intercepteur d'erreurs pour éviter les erreurs "Cannot read properties of null"
  setupErrorInterceptor();
  
  // Détecter et sauvegarder le thème actuel
  await detectAndSaveTheme();
  
  // Injecter les styles CSS
  injectStyles();
  
  // Injecter les styles CSS spécifiques au drag and drop
  injectDragAndDropStyles();
  
  // Configurer l'observateur DOM pour réinjecter l'interface si nécessaire
  setupDOMObserver(injectFoldersUI);
  
  // Configurer l'écouteur pour les changements d'URL
  setupURLChangeListener();
  
  // Configurer l'écouteur pour les messages de l'extension
  setupExtensionMessageListener();
  
  // Injecter l'interface des dossiers
  await injectFoldersUI();
  
  // Configurer le drag and drop pour les dossiers et conversations
  setupDragAndDropFeatures();
  
  // Essayer d'injecter le bouton de prompt
  injectPromptButton();
  
  console.log("Le Chat+ initialisé avec succès");
}

// Lancer l'extension quand le DOM est chargé
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// Configuration spécifique à Plasmo pour ce content script
export const config = {
  matches: ["https://chat.mistral.ai/*"],
  run_at: "document_end"
};

/**
 * Configure le drag and drop pour les dossiers et conversations
 */
function setupDragAndDropFeatures() {
  // Utiliser le nouveau système unifié au lieu des appels séparés
  setupDragAndDrop();
  
  // Ces fonctions ne sont plus nécessaires car setupDragAndDrop fait tout
  // setupFolderConversationsDragAndDrop();
  // console.log("Configuration du drag and drop pour les conversations en dossiers terminée");
  
  // setupDragAndDropForConversations();
  // console.log("Configuration du drag and drop pour les conversations vers les dossiers terminée");
  
  // setupStandaloneConversationsDragAndDrop();
  // console.log("Configuration du drag and drop pour les conversations autonomes terminée");
} 