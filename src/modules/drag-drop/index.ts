/**
 * Point d'entrée pour le système de drag and drop
 * Ce fichier exporte l'API publique et l'initialisation du système
 */

import { initDragAndDrop } from './dragDropCore';
import { initFolderConversationsDragAndDrop } from './folderConversationsDrag';
import { initStandaloneConversationsDragAndDrop } from './standaloneConversationsDrag';
import { initMistralConversationsDragAndDrop } from './mistralConversationsDrag';

/**
 * Configure le système complet de drag and drop
 * Cette fonction est le point d'entrée principal pour activer toutes les fonctionnalités
 */
export function setupDragAndDrop(): void {
  console.log('[DragDrop] Initialisation du système de drag and drop');
  
  // 1. Initialiser le système de base
  initDragAndDrop();
  
  // 2. Initialiser les gestionnaires spécifiques par type
  initFolderConversationsDragAndDrop();
  initStandaloneConversationsDragAndDrop();
  initMistralConversationsDragAndDrop();
  
  console.log('[DragDrop] Système de drag and drop entièrement configuré');
}

// Fonctions de l'API publique pour l'ancien système
// Ces fonctions sont conservées pour la compatibilité avec le code existant

/**
 * Configure le drag & drop pour les conversations dans les dossiers
 * Version de compatibilité qui utilise le nouveau système
 */
export function setupFolderConversationsDragAndDrop(): void {
  console.log('[DragDrop] Appel à setupFolderConversationsDragAndDrop() - utilisation du nouveau système');
  
  // S'assurer que le système de base est initialisé
  initDragAndDrop();
  
  // Initialiser spécifiquement le gestionnaire pour les conversations en dossier
  initFolderConversationsDragAndDrop();
}

/**
 * Configure le drag & drop pour les conversations entre la liste principale et les dossiers
 * Version de compatibilité qui utilise le nouveau système
 */
export function setupDragAndDropForConversations(): void {
  console.log('[DragDrop] Appel à setupDragAndDropForConversations() - utilisation du nouveau système');
  
  // S'assurer que le système de base est initialisé
  initDragAndDrop();
  
  // Initialiser spécifiquement le gestionnaire pour les conversations Mistral
  initMistralConversationsDragAndDrop();
}

/**
 * Configure le drag & drop pour les conversations autonomes (à la racine)
 * Version de compatibilité qui utilise le nouveau système
 */
export function setupStandaloneConversationsDragAndDrop(): void {
  console.log('[DragDrop] Appel à setupStandaloneConversationsDragAndDrop() - utilisation du nouveau système');
  
  // S'assurer que le système de base est initialisé
  initDragAndDrop();
  
  // Initialiser spécifiquement le gestionnaire pour les conversations autonomes
  initStandaloneConversationsDragAndDrop();
}

// Exporter les fonctions utilitaires qui pourraient être utilisées ailleurs
export { injectDragAndDropStyles } from './dragDropCore'; 