/**
 * Module de gestion des styles CSS pour Le Chat+
 * Centralise tous les styles injectés dans la page
 */

/**
 * Styles principaux pour l'interface des dossiers
 */
export const folderStyles = `
/* Styles pour le conteneur de dossiers */
#le-chat-plus-folders {
  margin-bottom: 10px;
  transition: opacity 0.3s ease;
}

/* Styles pour l'en-tête du conteneur de dossiers */
.le-chat-plus-folder-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.le-chat-plus-folder-header:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Styles pour la liste des dossiers */
.le-chat-plus-folders-list {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
}

.le-chat-plus-folders-list-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

.le-chat-plus-folders-list-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.le-chat-plus-folders-list-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.le-chat-plus-folders-list-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(155, 155, 155, 0.5);
  border-radius: 6px;
}

/* Styles pour les éléments de dossier */
.le-chat-plus-folder-item {
  margin-bottom: 4px;
}

/* Styles pour les icônes d'état des dossiers */
.le-chat-plus-folder-header .folder-icon {
  margin-right: 5px;
  font-size: 6px;
  color: var(--text-color-subtle);
  transition: transform 0.2s;
}

/* Styles pour le nom des dossiers */
.le-chat-plus-folder-header .folder-name {
  flex: 1;
  font-weight: normal;
  font-size: 13px;
  color: var(--text-color-subtle);
  cursor: inherit;
  padding: 2px;
  border-radius: 3px;
  transition: background-color 0.2s;
}

/* Styles pour les conteneurs de conversations */
.le-chat-plus-folder-conversations {
  padding-left: 15px;
}

/* Styles pour les éléments de conversation */
.le-chat-plus-conversation-item {
  display: flex;
  align-items: center;
  margin: 1px 0;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.le-chat-plus-conversation-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

/* Styles pour la conversation active */
.le-chat-plus-conversation-item.active-conversation {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Styles pour les liens de conversation */
.le-chat-plus-conversation-item a {
  flex: 1;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-color-muted);
}

.le-chat-plus-conversation-item.active-conversation a {
  color: var(--text-color-subtle);
  font-weight: bold;
}

/* Styles pour le drag & drop */
.le-chat-plus-conversation-item.dragging {
  opacity: 0.5;
}

.le-chat-plus-conversation-item.drag-over {
  position: relative;
}

.le-chat-plus-conversation-item.drag-over-top::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--surface-primary, #6366f1);
  border-radius: 1px;
}

.le-chat-plus-conversation-item.drag-over-bottom::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--surface-primary, #6366f1);
  border-radius: 1px;
}

/* Styles pour l'indicateur de réorganisation */
.reorder-indicator {
  height: 2px;
  background-color: var(--surface-primary, #6366f1);
  margin: 1px 0;
  border-radius: 1px;
  opacity: 0;
  transition: opacity 0.2s;
}

.reorder-indicator.visible {
  opacity: 1;
}
`;

/**
 * Styles pour les modales
 */
export const modalStyles = `
/* Fond de la modale */
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

/* Contenu de la modale */
.le-chat-plus-modal-content {
  border-radius: 8px;
  width: 300px;
  max-width: 90%;
  padding: 16px;
  transform: translateY(-20px);
  transition: transform 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* En-tête de la modale */
.le-chat-plus-modal-header {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
}

/* Message de la modale */
.le-chat-plus-modal-message {
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.4;
}

/* Champ de saisie */
.le-chat-plus-modal-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
  box-sizing: border-box;
  transition: border-color 0.2s, background-color 0.2s;
}

/* Conteneur des boutons */
.le-chat-plus-modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Styles communs pour les boutons */
.le-chat-plus-modal-button {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

/* Bouton d'annulation */
.le-chat-plus-modal-button.cancel {
  background-color: transparent;
}

/* Bouton de confirmation */
.le-chat-plus-modal-button.confirm {
  background-color: #f0f0f0;
}

/* Bouton de suppression */
.le-chat-plus-modal-button.delete {
  color: #dd0000;
  border: 1px solid #dd0000;
  background-color: transparent;
}

/* Bouton de prompt */
#le-chat-plus-prompt-button {
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

#le-chat-plus-prompt-button:hover {
  opacity: 0.8;
}
`;

/**
 * Styles pour les thèmes sombres
 */
export const darkThemeStyles = `
/* Modale en thème sombre */
.dark .le-chat-plus-modal-content {
  background-color: #2a2a2a;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark .le-chat-plus-modal-input {
  background-color: #3a3a3a;
  color: #ffffff;
  border: 1px solid #555555;
}

.dark .le-chat-plus-modal-button.cancel {
  color: #cccccc;
  border: 1px solid #444444;
}

.dark .le-chat-plus-modal-button.confirm {
  background-color: #3a3a3a;
  color: #ffffff;
  border: 1px solid #555555;
}

.dark .le-chat-plus-modal-button.delete {
  color: #ff5555;
  border: 1px solid #ff5555;
}

/* Hover sur les éléments en thème sombre */
.dark .le-chat-plus-folder-header:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.dark .le-chat-plus-conversation-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.dark .le-chat-plus-conversation-item.active-conversation {
  background-color: rgba(255, 255, 255, 0.08);
}
`;

/**
 * Injecte tous les styles CSS dans la page
 */
export function injectStyles(): void {
  // Créer l'élément de style
  const styleElement = document.createElement('style');
  styleElement.id = 'le-chat-plus-styles';
  
  // Combiner tous les styles
  styleElement.textContent = `
    ${folderStyles}
    ${modalStyles}
    ${darkThemeStyles}
  `;
  
  // Ajouter au document
  document.head.appendChild(styleElement);
  
  console.log("Styles CSS injectés avec succès");
} 