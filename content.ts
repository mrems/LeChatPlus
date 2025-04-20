/**
 * Le Chat+ : Extension pour améliorer l'interface de Mistral
 * Point d'entrée de l'extension
 */

// Imports des modules
import { injectStyles } from './src/modules/styles';
import { ThemeChangeObserver, setupDOMObserver, setupURLChangeListener, setupExtensionMessageListener } from './src/modules/dom-observer';
import { detectAndSaveTheme } from './src/modules/theme-detector';
import { setupFolderConversationsDragAndDrop, setupDragAndDropForConversations } from './src/modules/drag-drop-manager';
import { injectFoldersUI } from './src/modules/ui-renderer';
import { showFolderCreateModal, showDeleteConfirmModal, showRenameModal } from './src/modules/modal-system';
import { injectPromptButton } from './src/modules/prompt-button';

/**
 * Point d'entrée principal de l'extension
 */
async function main() {
  console.log("Initialisation de Le Chat+...");
  
  // Détecter et sauvegarder le thème actuel
  await detectAndSaveTheme();
  
  // Injecter les styles CSS
    injectStyles();
  
  // Configurer l'observateur DOM pour réinjecter l'interface si nécessaire
  setupDOMObserver(injectFoldersUI);
  
  // Configurer l'écouteur pour les changements d'URL
  setupURLChangeListener();
  
  // Configurer l'écouteur pour les messages de l'extension
  setupExtensionMessageListener();
  
  // Injecter l'interface des dossiers
  await injectFoldersUI();
  
  // Configurer le drag & drop pour les conversations dans les dossiers
  setupFolderConversationsDragAndDrop();
  
  // Configurer le drag & drop pour les conversations principales
  setupDragAndDropForConversations();
  
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

