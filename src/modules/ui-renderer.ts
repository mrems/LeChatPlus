import type { Folder, ConversationRef } from './types'
import { safeSetStyle } from './ui-helpers'
import { getFolders } from './folder-operations'
import { getValue, setValue } from './storage-manager'
import { getCurrentConversationId, getConversationsInFolder, removeConversationFromFolder } from './conversation-operations'
import { createFolder, deleteFolder } from './folder-operations'
import { showFolderCreateModal, showDeleteConfirmModal } from './modal-system'

// Variables globales pour l'état de l'UI
let foldersSection: HTMLElement | null = null;
let foldersList: HTMLElement | null = null;
let isRenderingFolders = false; // Verrou pour éviter les rendus concurrents

/**
 * Gère le clic sur un lien de conversation
 */
export const handleConvLinkClick = (e: MouseEvent, conv: ConversationRef, convLink: HTMLElement) => {
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

/**
 * Met à jour la mise en évidence de la conversation active
 */
export async function updateActiveConversationHighlight(): Promise<void> {
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

/**
 * Affiche tous les dossiers et leur contenu
 */
export async function renderFolders(): Promise<void> {
  if (isRenderingFolders) {
    console.warn("RenderFolders: Appel ignoré car un rendu est déjà en cours.");
    return;
  }
  isRenderingFolders = true;
  console.log("RenderFolders START"); // <-- Log de début
  
  try { // Ajouter un bloc try...finally pour garantir la libération du verrou
  const foldersList = document.getElementById('le-chat-plus-folders-list');
  if (!foldersList) {
    console.log("Liste des dossiers non trouvée, tentative de réinjection...");
    // Si la liste des dossiers n'existe pas, essayer de réinjecter l'interface complète
    if (!document.getElementById('le-chat-plus-folders')) {
      injectFoldersUI();
    }
      console.log("RenderFolders END (liste non trouvée)"); // <-- Log de fin précoce
      // Pas besoin de return ici, le finally s'exécutera
    } else {
        // Vider la liste de manière plus robuste
        while (foldersList.firstChild) {
          foldersList.removeChild(foldersList.firstChild);
        }
  
  const folders = await getFolders();
  
  // S'assurer que tous les dossiers sont fermés au chargement initial de la page
  // Utiliser une variable statique pour suivre si c'est le premier rendu depuis le chargement de la page
  if (!('initialRenderDone' in renderFolders)) {
    // Première exécution après le chargement de la page, fermer tous les dossiers
    const foldersWithUpdatedState = folders.map(folder => ({
      ...folder,
      expanded: false
    }));
    
    // Sauvegarder l'état fermé
    await setValue('folders', foldersWithUpdatedState);
    
    // Mettre à jour les folders locaux pour le rendu actuel
    folders.forEach(folder => {
      folder.expanded = false;
    });
    
    // Marquer comme fait pour ne pas répéter à chaque appel de renderFolders
    (renderFolders as any).initialRenderDone = true;
  }

  // Cas où il n'y a aucun dossier ni conversation à afficher
  if (folders.length === 0) {
    const { getStandaloneConversations } = await import('./conversation-operations');
    const standaloneConversations = await getStandaloneConversations();
    
    if (standaloneConversations.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'Aucun dossier ou conversation.';
      safeSetStyle(emptyMessage, 'padding', '8px');
      safeSetStyle(emptyMessage, 'color', '#888');
      safeSetStyle(emptyMessage, 'fontStyle', 'italic');
      safeSetStyle(emptyMessage, 'fontSize', '12px');
      
      if (foldersList) {
        foldersList.appendChild(emptyMessage);
      }
      return;
    }
  }
  
  // Afficher d'abord les dossiers normaux
  for (const folder of folders) {
    const folderItem = document.createElement('div');
    folderItem.className = 'le-chat-plus-folder-item';
    folderItem.setAttribute('data-folder-id', folder.id);
    safeSetStyle(folderItem, 'marginBottom', '2px');
    
    // En-tête du dossier
    const folderHeader = document.createElement('div');
    folderHeader.className = 'le-chat-plus-folder-header';
    safeSetStyle(folderHeader, 'display', 'flex');
    safeSetStyle(folderHeader, 'alignItems', 'center');
    safeSetStyle(folderHeader, 'paddingLeft', '15px');
    safeSetStyle(folderHeader, 'cursor', 'pointer');
    safeSetStyle(folderHeader, 'borderRadius', '4px');
    safeSetStyle(folderHeader, 'transition', 'background-color 0.2s');
    
    // Effet de hover sur l'en-tête du dossier
    folderHeader.addEventListener('mouseenter', () => {
      safeSetStyle(folderHeader, 'backgroundColor', 'rgba(0, 0, 0, 0.05)');
    });
    
    folderHeader.addEventListener('mouseleave', () => {
      safeSetStyle(folderHeader, 'backgroundColor', 'transparent');
    });
    
    // Icône pour plier/déplier
    const expandIcon = document.createElement('span');
    expandIcon.textContent = folder.expanded ? '▼' : '►';
    safeSetStyle(expandIcon, 'marginRight', '5px');
    safeSetStyle(expandIcon, 'fontSize', '6px');
    safeSetStyle(expandIcon, 'color', 'var(--text-color-subtle)');
    safeSetStyle(expandIcon, 'transition', 'transform 0.2s');
    
    // Nom du dossier
    const folderName = document.createElement('span');
    folderName.textContent = folder.name;
    folderName.className = 'folder-name';
    safeSetStyle(folderName, 'flex', '1');
    safeSetStyle(folderName, 'fontWeight', 'normal');
    safeSetStyle(folderName, 'fontSize', '13px');
    safeSetStyle(folderName, 'color', 'var(--text-color-subtle)');
    safeSetStyle(folderName, 'cursor', 'inherit');
    safeSetStyle(folderName, 'padding', '2px');
    safeSetStyle(folderName, 'borderRadius', '3px');
    safeSetStyle(folderName, 'transition', 'background-color 0.2s');
    
    // Ajouter un gestionnaire d'événements de double-clic pour l'édition du nom du dossier
    folderName.addEventListener('dblclick', async (e) => {
      e.stopPropagation(); // Empêcher la propagation vers les handlers parent
      
      // Rendre l'élément éditable
      folderName.setAttribute('contenteditable', 'true');
      folderName.focus();
      
      // Sélectionner tout le texte
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(folderName);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // Ajouter un style pour indiquer l'édition
      safeSetStyle(folderName, 'cursor', 'text');
      
      // Gestionnaire pour terminer l'édition
      const finishEditingName = async () => {
        folderName.removeAttribute('contenteditable');
        safeSetStyle(folderName, 'background-color', 'transparent');
        safeSetStyle(folderName, 'cursor', 'inherit');
        
        // Récupérer le nouveau nom
        const newName = folderName.textContent?.trim() || folder.name;
        
        // Si le nom a changé
        if (newName !== folder.name && newName) {
          // Mettre à jour le dossier
          const folders = await getFolders();
          const updatedFolders = folders.map(f => 
            f.id === folder.id ? { ...f, name: newName } : f
          );
          
          // Sauvegarder la modification
          await setValue('folders', updatedFolders);
          
          // Rafraîchir l'affichage
          await renderFolders();
        }
      };
      
      // Gestionnaires d'événements pour terminer l'édition
      folderName.addEventListener('blur', finishEditingName, { once: true });
      folderName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishEditingName();
        } else if (e.key === 'Escape') {
          folderName.textContent = folder.name; // Annuler les modifications
          folderName.blur();
        }
      });
    });
    
    // Conteneur pour les actions du dossier
    const actionsContainer = document.createElement('div');
    safeSetStyle(actionsContainer, 'display', 'flex');
    safeSetStyle(actionsContainer, 'alignItems', 'center');
    safeSetStyle(actionsContainer, 'opacity', '0');
    safeSetStyle(actionsContainer, 'transition', 'opacity 0.2s');
    
    // Afficher les actions au survol
    folderHeader.addEventListener('mouseenter', () => {
      safeSetStyle(actionsContainer, 'opacity', '1');
    });
    
    folderHeader.addEventListener('mouseleave', () => {
      safeSetStyle(actionsContainer, 'opacity', '0');
    });
    
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
    
    // Ajouter un gestionnaire d'événements pour le bouton de suppression
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation(); // Empêcher la propagation
      
      // Afficher le modal de confirmation
      const isConfirmed = await showDeleteConfirmModal(folder.name, 'dossier');
      
      // Si la suppression est confirmée
      if (isConfirmed) {
        // Supprimer le dossier
        await deleteFolder(folder.id);
        
        // Rafraîchir l'affichage
        await renderFolders();
      }
    });
    
    // Ajouter les boutons au conteneur d'actions
    actionsContainer.appendChild(deleteButton);
    
    folderHeader.appendChild(expandIcon);
    folderHeader.appendChild(folderName);
    folderHeader.appendChild(actionsContainer);
    folderItem.appendChild(folderHeader);
    
    // Conteneur pour les conversations
    const conversationsContainer = document.createElement('div');
    conversationsContainer.className = 'le-chat-plus-folder-conversations';
    safeSetStyle(conversationsContainer, 'paddingLeft', '15px');
    safeSetStyle(conversationsContainer, 'marginLeft', '5px');
    safeSetStyle(conversationsContainer, 'display', folder.expanded ? 'block' : 'none');
    
    // Ajouter le gestionnaire d'événements pour plier/déplier le dossier
    folderHeader.addEventListener('click', async (e) => {
      // Éviter de déclencher si on a cliqué sur un bouton d'action
      if (e.target && 
          ((e.target as HTMLElement).closest('button') || 
           (e.target as HTMLElement).tagName === 'BUTTON')) {
        return;
      }
      
      // Ne pas traiter le clic si nous sommes en train d'éditer le nom
      const folderNameElement = folderHeader.querySelector('.folder-name');
      if (folderNameElement && folderNameElement.getAttribute('contenteditable') === 'true') {
        return;
      }
      
      // Variable pour détecter un double-clic
      if ((folderHeader as any)._clickTimer) {
        // Double-clic détecté, ne pas traiter comme un clic simple
        clearTimeout((folderHeader as any)._clickTimer);
        (folderHeader as any)._clickTimer = null;
        return;
      }
      
      // Configurer un délai pour différencier le clic simple du double-clic
      (folderHeader as any)._clickTimer = setTimeout(() => {
        (folderHeader as any)._clickTimer = null;
        
        // Exécuter l'action de clic simple après le délai
        // Inverser l'état d'expansion
        folder.expanded = !folder.expanded;
        
        // Mettre à jour l'apparence visuelle
        expandIcon.textContent = folder.expanded ? '▼' : '►';
        conversationsContainer.style.display = folder.expanded ? 'block' : 'none';
        
        // Enregistrer l'état des dossiers
        const updateFolders = async () => {
          const folders = await getFolders();
          const updatedFolders = folders.map(f => 
            f.id === folder.id ? { ...f, expanded: folder.expanded } : f
          );
          
          await setValue('folders', updatedFolders);
        };
        
        updateFolders();
      }, 250); // Délai de 250ms pour détecter un clic simple
      
      // Empêcher la propagation pour éviter des conflits avec d'autres gestionnaires
      e.stopPropagation();
    });
    
    // Charger et afficher les conversations du dossier
    const conversations = await getConversationsInFolder(folder.id);
    
    // Obtenir l'ID de la conversation active
    const activeConversationId = getCurrentConversationId();
    
    if (conversations.length > 0) {
      for (const conv of conversations) {
        const convItem = document.createElement('div');
        convItem.className = 'le-chat-plus-conversation-item';
        convItem.setAttribute('data-conversation-id', conv.id);
        safeSetStyle(convItem, 'marginBottom', '0'); // Réduit l'espacement vertical
        safeSetStyle(convItem, 'lineHeight', '1.2'); // Réduit l'espacement vertical
        
        // Vérifier si cette conversation est active
        const isActive = conv.id === activeConversationId;
        
        // Titre de la conversation avec lien
        const convLink = document.createElement('a');
        convLink.textContent = conv.title || 'Conversation sans titre';
        convLink.href = conv.url;
        safeSetStyle(convLink, 'flex', '1');
        safeSetStyle(convLink, 'textDecoration', 'none');
        safeSetStyle(convLink, 'cursor', 'pointer');
        safeSetStyle(convLink, 'fontSize', '11px');
        safeSetStyle(convLink, 'marginLeft', '10px');
        safeSetStyle(convLink, 'marginRight', '10px');
        
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
        
        // Ajouter un gestionnaire d'événements de double-clic pour l'édition du titre de la conversation
        convLink.addEventListener('dblclick', (e) => {
          e.stopPropagation(); // Empêcher la propagation
          e.preventDefault(); // Empêcher la navigation
          
          // Rendre l'élément éditable
          convLink.setAttribute('contenteditable', 'true');
          convLink.focus();
          
          // Sélectionner tout le texte
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(convLink);
          selection?.removeAllRanges();
          selection?.addRange(range);
          
          // Ajouter un style pour indiquer l'édition
          safeSetStyle(convLink, 'cursor', 'text');
          
          // Désactiver temporairement le comportement du lien
          const originalClickHandler = convLink.onclick;
          convLink.onclick = (e) => {
            e.preventDefault();
            return false;
          };
          
          // Gestionnaire pour terminer l'édition
          const finishEditingConv = async () => {
            convLink.removeAttribute('contenteditable');
            safeSetStyle(convLink, 'background-color', 'transparent');
            safeSetStyle(convLink, 'cursor', 'pointer');
            
            // Réactiver le comportement du lien
            convLink.onclick = originalClickHandler;
            
            // Récupérer le nouveau titre
            const newTitle = convLink.textContent?.trim() || conv.title || 'Conversation sans titre';
            
            // Si le titre a changé
            if (newTitle !== conv.title && newTitle) {
              // Importer et utiliser la fonction de renommage de conversation
              const { renameConversation } = await import('./conversation-operations');
              await renameConversation(conv.id, newTitle);
              
              // Rafraîchir l'affichage
              await renderFolders();
            }
          };
          
          // Gestionnaires d'événements pour terminer l'édition
          convLink.addEventListener('blur', finishEditingConv, { once: true });
          convLink.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              finishEditingConv();
            } else if (e.key === 'Escape') {
              convLink.textContent = conv.title || 'Conversation sans titre'; // Annuler les modifications
              convLink.blur();
            }
          });
        });
        
        // Empêcher le comportement par défaut du lien et gérer la navigation
        convLink.addEventListener('click', (e) => {
          // Ne pas traiter le clic si nous sommes en train d'éditer le titre
          if (convLink.getAttribute('contenteditable') === 'true') {
            e.preventDefault();
            return;
          }
          
          // Variable pour détecter un double-clic
          if ((convLink as any)._clickTimer) {
            // Double-clic détecté, ne pas traiter comme un clic simple
            clearTimeout((convLink as any)._clickTimer);
            (convLink as any)._clickTimer = null;
            e.preventDefault();
            return;
          }
          
          // Configurer un délai pour différencier le clic simple du double-clic
          (convLink as any)._clickTimer = setTimeout(() => {
            (convLink as any)._clickTimer = null;
            
            // Exécuter l'action de clic simple après le délai
            handleConvLinkClick(e, conv, convLink as HTMLElement);
          }, 250); // Délai de 250ms pour détecter un clic simple
          
          e.preventDefault();
        });
        
        // Conteneur pour les boutons d'action
        const actionButtons = document.createElement('div');
        safeSetStyle(actionButtons, 'display', 'flex');
        safeSetStyle(actionButtons, 'opacity', '0');
        safeSetStyle(actionButtons, 'transition', 'opacity 0.2s');
        safeSetStyle(actionButtons, 'height', '16px'); // Réduire la hauteur des boutons d'action
        
        // Bouton pour supprimer
        const removeButton = document.createElement('button');
        removeButton.textContent = '×';
        safeSetStyle(removeButton, 'background', 'none');
        safeSetStyle(removeButton, 'border', 'none');
        safeSetStyle(removeButton, 'color', '#999');
        safeSetStyle(removeButton, 'cursor', 'pointer');
        safeSetStyle(removeButton, 'padding', '0');
        safeSetStyle(removeButton, 'fontSize', '12px');
        safeSetStyle(removeButton, 'lineHeight', '1');
        removeButton.title = 'Retirer du dossier';
        
        // Ajouter un gestionnaire d'événements pour le bouton de suppression
        removeButton.addEventListener('click', async (e) => {
          e.stopPropagation(); // Empêcher la propagation
          
          // Afficher le modal de confirmation
          const isConfirmed = await showDeleteConfirmModal(conv.title || 'Conversation sans titre', 'conversation');
          
          // Si la suppression est confirmée
          if (isConfirmed) {
            // Supprimer la conversation du dossier
            await removeConversationFromFolder(folder.id, conv.id);
            
            // Rafraîchir l'affichage
            await renderFolders();
          }
        });
        
        // Ajouter les boutons
        actionButtons.appendChild(removeButton);
        
        convItem.appendChild(convLink);
        convItem.appendChild(actionButtons);
        conversationsContainer.appendChild(convItem);
        
        // Afficher les boutons d'action au survol
        convItem.addEventListener('mouseenter', () => {
          safeSetStyle(actionButtons, 'opacity', '1');
        });
        
        convItem.addEventListener('mouseleave', () => {
          safeSetStyle(actionButtons, 'opacity', '0');
        });
      }
    } else {
      // Message si le dossier est vide
      const emptyFolder = document.createElement('div');
      emptyFolder.textContent = 'Dossier vide';
      safeSetStyle(emptyFolder, 'padding', '4px 0');
      safeSetStyle(emptyFolder, 'color', '#888');
      safeSetStyle(emptyFolder, 'fontStyle', 'italic');
      safeSetStyle(emptyFolder, 'fontSize', '12px');
      conversationsContainer.appendChild(emptyFolder);
    }
    
    folderItem.appendChild(conversationsContainer);
    foldersList.appendChild(folderItem);
  }
  
  // Ensuite afficher les conversations autonomes (hors dossier)
  const { getStandaloneConversations, removeStandaloneConversation } = await import('./conversation-operations');
  const standaloneConversations = await getStandaloneConversations();
  
  if (standaloneConversations.length > 0) {
    // Obtenir l'ID de la conversation active
    const activeConversationId = getCurrentConversationId();
    
    for (const conv of standaloneConversations) {
      const convItem = document.createElement('div');
      convItem.className = 'le-chat-plus-conversation-item';
      convItem.setAttribute('data-conversation-id', conv.id);
      safeSetStyle(convItem, 'marginBottom', '0'); // Réduit l'espacement vertical
      safeSetStyle(convItem, 'lineHeight', '1.8'); // Réduit l'espacement vertical
      
      // Vérifier si cette conversation est active
      const isActive = conv.id === activeConversationId;
      
      // Titre de la conversation avec lien
      const convLink = document.createElement('a');
      convLink.textContent = conv.title || 'Conversation sans titre';
      convLink.href = conv.url;
      safeSetStyle(convLink, 'flex', '1');
      safeSetStyle(convLink, 'textDecoration', 'none');
      safeSetStyle(convLink, 'cursor', 'pointer');
      safeSetStyle(convLink, 'fontSize', '11px');
      safeSetStyle(convLink, 'marginLeft', '10px');
      safeSetStyle(convLink, 'marginRight', '10px');
      
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
      
      // Ajouter un gestionnaire d'événements de double-clic pour l'édition du titre de la conversation
      convLink.addEventListener('dblclick', (e) => {
        e.stopPropagation(); // Empêcher la propagation
        e.preventDefault(); // Empêcher la navigation
        
        // Rendre l'élément éditable
        convLink.setAttribute('contenteditable', 'true');
        convLink.focus();
        
        // Sélectionner tout le texte
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(convLink);
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Ajouter un style pour indiquer l'édition
        safeSetStyle(convLink, 'cursor', 'text');
        
        // Désactiver temporairement le comportement du lien
        const originalClickHandler = convLink.onclick;
        convLink.onclick = (e) => {
          e.preventDefault();
          return false;
        };
        
        // Gestionnaire pour terminer l'édition
        const finishEditingConv = async () => {
          convLink.removeAttribute('contenteditable');
          safeSetStyle(convLink, 'background-color', 'transparent');
          safeSetStyle(convLink, 'cursor', 'pointer');
          
          // Réactiver le comportement du lien
          convLink.onclick = originalClickHandler;
          
          // Récupérer le nouveau titre
          const newTitle = convLink.textContent?.trim() || conv.title || 'Conversation sans titre';
          
          // Si le titre a changé
          if (newTitle !== conv.title && newTitle) {
            // Importer et utiliser la fonction de renommage de conversation
            const { renameConversation } = await import('./conversation-operations');
            await renameConversation(conv.id, newTitle);
            
            // Rafraîchir l'affichage
            await renderFolders();
          }
        };
        
        // Gestionnaires d'événements pour terminer l'édition
        convLink.addEventListener('blur', finishEditingConv, { once: true });
        convLink.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            finishEditingConv();
          } else if (e.key === 'Escape') {
            convLink.textContent = conv.title || 'Conversation sans titre'; // Annuler les modifications
            convLink.blur();
          }
        });
      });
      
      // Empêcher le comportement par défaut du lien et gérer la navigation
      convLink.addEventListener('click', (e) => {
        // Ne pas traiter le clic si nous sommes en train d'éditer le titre
        if (convLink.getAttribute('contenteditable') === 'true') {
          e.preventDefault();
          return;
        }
        
        // Variable pour détecter un double-clic
        if ((convLink as any)._clickTimer) {
          // Double-clic détecté, ne pas traiter comme un clic simple
          clearTimeout((convLink as any)._clickTimer);
          (convLink as any)._clickTimer = null;
          e.preventDefault();
          return;
        }
        
        // Configurer un délai pour différencier le clic simple du double-clic
        (convLink as any)._clickTimer = setTimeout(() => {
          (convLink as any)._clickTimer = null;
          
          // Exécuter l'action de clic simple après le délai
          handleConvLinkClick(e, conv, convLink as HTMLElement);
        }, 250); // Délai de 250ms pour détecter un clic simple
        
        e.preventDefault();
      });
      
      // Conteneur pour les boutons d'action
      const actionButtons = document.createElement('div');
      safeSetStyle(actionButtons, 'display', 'flex');
      safeSetStyle(actionButtons, 'opacity', '0');
      safeSetStyle(actionButtons, 'transition', 'opacity 0.2s');
      safeSetStyle(actionButtons, 'height', '16px'); // Réduire la hauteur des boutons d'action
      
      // Bouton pour supprimer
      const removeButton = document.createElement('button');
      removeButton.textContent = '×';
      safeSetStyle(removeButton, 'background', 'none');
      safeSetStyle(removeButton, 'border', 'none');
      safeSetStyle(removeButton, 'color', '#999');
      safeSetStyle(removeButton, 'cursor', 'pointer');
      safeSetStyle(removeButton, 'padding', '0');
      safeSetStyle(removeButton, 'fontSize', '12px');
      safeSetStyle(removeButton, 'lineHeight', '1');
      removeButton.title = 'Retirer de la liste';
      
      // Ajouter un gestionnaire d'événements pour le bouton de suppression
      removeButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Afficher le modal de confirmation
        const isConfirmed = await showDeleteConfirmModal(conv.title || 'Conversation sans titre', 'conversation');
        
        // Si la suppression est confirmée
        if (isConfirmed) {
                try {
          // Supprimer la conversation autonome
          await removeStandaloneConversation(conv.id);
                  // Rafraîchir l'interface après la suppression réussie
                  await renderFolders(); 
                } catch (error) {
                    console.error("Erreur lors de la suppression de la conversation autonome:", error);
                    // Afficher un message d'erreur à l'utilisateur si nécessaire
                }
        }
      });
      
      // Ajouter les boutons
      actionButtons.appendChild(removeButton);
      
      convItem.appendChild(convLink);
      convItem.appendChild(actionButtons);
      foldersList.appendChild(convItem);
      
      // Afficher les boutons d'action au survol
      convItem.addEventListener('mouseenter', () => {
        safeSetStyle(actionButtons, 'opacity', '1');
      });
      
      convItem.addEventListener('mouseleave', () => {
        safeSetStyle(actionButtons, 'opacity', '0');
      });
    }
  }
  
  // Configurer le drag and drop
  // Ce sera fait par un module séparé appelé par content.ts
        
        console.log("RenderFolders END (terminé normalement)"); // <-- Log de fin
    }
  } catch (error) {
      console.error("Erreur pendant renderFolders:", error);
      console.log("RenderFolders END (erreur)");
  } finally {
      isRenderingFolders = false; // Libérer le verrou
  }
}

/**
 * Injecte l'interface des dossiers dans la page
 */
export async function injectFoldersUI(): Promise<void> {
  console.log("Tentative d'injection de l'interface des dossiers...");
  
  // Éviter les injections multiples
  if (document.getElementById('le-chat-plus-folders')) {
    console.log("Interface des dossiers déjà présente");
    return;
  }
  
  // Trouver la barre latérale avec une approche plus robuste
  // Plusieurs stratégies pour trouver la barre latérale
  let sidebarElement = null;
  
  // Stratégie 1: Rechercher les éléments nav
  const navElements = document.querySelectorAll('nav');
  if (navElements.length > 0) {
    // Préférer les navs spécifiques à l'historique de chat
    for (const nav of navElements) {
      const ariaLabel = nav.getAttribute('aria-label');
      if (ariaLabel && (ariaLabel.includes('chat') || ariaLabel.includes('Chat'))) {
        sidebarElement = nav;
        break;
      }
    }
    
    // Si on n'a pas trouvé, prendre le premier nav
    if (!sidebarElement && navElements.length > 0) {
      sidebarElement = navElements[0];
    }
  }
  
  // Stratégie 2: Rechercher les éléments qui contiennent des liens de conversation
  if (!sidebarElement) {
    const chatLinks = document.querySelectorAll('a[href^="/chat/"]');
    if (chatLinks.length > 0) {
      // Remonter jusqu'à un div parent qui pourrait être la barre latérale
      let element = chatLinks[0].parentElement;
      let depth = 0;
      const MAX_DEPTH = 5; // Limiter la remontée
      
      while (element && depth < MAX_DEPTH) {
        if (element.tagName === 'NAV' || 
            (element.tagName === 'DIV' && element.offsetWidth < 400)) {
          sidebarElement = element;
          break;
        }
        element = element.parentElement;
        depth++;
      }
    }
  }
  
  // Stratégie 3: Rechercher un div qui pourrait être une barre latérale
  if (!sidebarElement) {
    // Chercher des divs qui ressemblent à une barre latérale (largeur limitée, position à gauche)
    const potentialSidebars = Array.from(document.querySelectorAll('div')).filter(div => {
      const rect = div.getBoundingClientRect();
      return rect.width > 100 && rect.width < 400 && rect.left < 100;
    });
    
    if (potentialSidebars.length > 0) {
      // Prendre le premier qui contient des liens ou des boutons
      for (const div of potentialSidebars) {
        if (div.querySelectorAll('a, button').length > 0) {
          sidebarElement = div;
          break;
        }
      }
    }
  }
  
  // Si on n'a toujours pas trouvé, on peut chercher le bouton "New Chat"
  if (!sidebarElement) {
    const newChatButtons = Array.from(document.querySelectorAll('button')).filter(button => {
      const text = button.textContent?.toLowerCase() || '';
      return text.includes('new chat') || text.includes('nouveau chat');
    });
    
    if (newChatButtons.length > 0) {
      let element = newChatButtons[0].parentElement;
      let depth = 0;
      const MAX_DEPTH = 5;
      
      while (element && depth < MAX_DEPTH) {
        if (element.tagName === 'NAV' || 
            (element.tagName === 'DIV' && element.offsetWidth < 400)) {
          sidebarElement = element;
          break;
        }
        element = element.parentElement;
        depth++;
      }
    }
  }
  
  if (!sidebarElement) {
    console.log("Barre latérale non trouvée, l'injection sera retentée plus tard");
    
    return; // On quitte la fonction si la barre latérale n'est pas trouvée.
  }
  
  // Créer la section des dossiers
  foldersSection = document.createElement('div');
  foldersSection.id = 'le-chat-plus-folders';
  safeSetStyle(foldersSection, 'marginBottom', '0');
  safeSetStyle(foldersSection, 'maxWidth', '100%');
  
  // Titre de section
  const folderHeader = document.createElement('div');
  safeSetStyle(folderHeader, 'display', 'flex');
  safeSetStyle(folderHeader, 'justifyContent', 'space-between');
  safeSetStyle(folderHeader, 'alignItems', 'center');
  safeSetStyle(folderHeader, 'padding', '8px 10px');
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
  safeSetStyle(collapseAllButton, 'padding', '0');
  
  // Ajouter les boutons dans l'ordre souhaité
  buttonsContainer.appendChild(refreshButton);
  buttonsContainer.appendChild(collapseAllButton);
  
  // Bouton pour ajouter un dossier
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
  foldersList = document.createElement('div');
  foldersList.id = 'le-chat-plus-folders-list';
  foldersList.className = 'le-chat-plus-folders-list-scrollbar';
  safeSetStyle(foldersList, 'maxHeight', '0');
  safeSetStyle(foldersList, 'overflow', 'hidden');
  safeSetStyle(foldersList, 'transition', 'max-height 0.3s ease-in-out');
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
  safeSetStyle(folderTitle, 'user-select', 'none');
  
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
      // Rotation de l'icône du dossier de 20 degrés
      safeSetStyle(folderIcon, 'transform', 'rotate(20deg)');
      // Remettre l'icône du bouton collapseAll pour pointer vers le haut
      collapseAllButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="19 15 12 8 5 15"></polyline>
      </svg>`;
      collapseAllButton.title = 'Fermer tous les dossiers';
    }
  };
  
  // Rendre le titre et les boutons cliquables
  folderHeader.addEventListener('click', () => {
    toggleFolderDisplay();
  });
  
  // Injecter le conteneur dans la barre latérale
  try {
    // Rechercher spécifiquement le bouton "Passer à Le Chat Pro"
    const proChatButton = Array.from(document.querySelectorAll('a, button')).find(el => {
      const text = el.textContent?.toLowerCase() || '';
      return text.includes('passer à le chat pro') || 
             text.includes('upgrade to le chat pro') || 
             text.includes('pro');
    });
    
    if (proChatButton) {
      console.log("Bouton Pro trouvé, injection après ce bouton");
      
      // Trouver le bon parent où insérer nos dossiers
      let parentElement = proChatButton.parentElement;
      let targetNode = proChatButton.nextElementSibling;
      
      // Si le prochain élément n'existe pas ou est un bouton/lien, remonter d'un niveau
      if (!targetNode || targetNode.tagName === 'A' || targetNode.tagName === 'BUTTON') {
        if (parentElement && parentElement.parentElement) {
          parentElement = parentElement.parentElement;
          targetNode = proChatButton.parentElement.nextElementSibling;
        }
      }
      
      // Cas où on a un parent et un élément cible après lequel insérer
      if (parentElement) {
        if (targetNode) {
          // Insérer avant l'élément qui suit le bouton Pro
          parentElement.insertBefore(foldersSection, targetNode);
        } else {
          // Si pas d'élément après, ajouter à la fin de ce parent
          parentElement.appendChild(foldersSection);
        }
        console.log("Interface des dossiers injectée après le bouton Pro");
      } else {
        // Fallback: insérer au début de la sidebar
        sidebarElement.insertBefore(foldersSection, sidebarElement.firstChild);
      }
    } else {
      // Si le bouton Pro n'est pas trouvé, chercher le titre "Les 7 derniers jours" ou équivalent
      const recentDaysHeader = Array.from(document.querySelectorAll('h2, h3, div')).find(el => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('derniers jours') || 
               text.includes('last days') || 
               text.includes('recent');
      });
      
      if (recentDaysHeader) {
        console.log("En-tête des conversations récentes trouvé, injection avant");
        // Si l'en-tête est trouvé, insérer juste avant
        recentDaysHeader.parentElement.insertBefore(foldersSection, recentDaysHeader);
      } else {
        // Fallback aux autres méthodes
        const newChatButton = document.querySelector('button[class*="new-chat"], a[class*="new-chat"]');
        if (newChatButton) {
          const possibleParents = [];
          let parent = newChatButton.parentElement;
          // Remonter jusqu'à 3 niveaux pour trouver un bon point d'insertion
          for (let i = 0; i < 3 && parent; i++) {
            possibleParents.push(parent);
            parent = parent.parentElement;
          }
          
          // Chercher le meilleur conteneur parmi les candidats
          const targetContainer = possibleParents.find(p => p.tagName === 'NAV' || p.tagName === 'DIV');
          if (targetContainer && targetContainer !== sidebarElement) {
            targetContainer.insertBefore(foldersSection, targetContainer.firstChild);
          } else {
            sidebarElement.insertBefore(foldersSection, sidebarElement.firstChild);
          }
        } else {
          // Dernier recours: insérer au début de la sidebar
          sidebarElement.insertBefore(foldersSection, sidebarElement.firstChild);
        }
      }
    }
  } catch (error) {
    console.error("Erreur lors de l'injection de l'interface des dossiers:", error);
    // Dernier recours: insérer au début de la sidebar
    sidebarElement.insertBefore(foldersSection, sidebarElement.firstChild);
  }
  
  // Ajouter gestionnaire d'événements pour le bouton "+"
  addFolderButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // Empêcher le toggle du dossier
    
    // Afficher le modal de création de dossier
    const folderName = await showFolderCreateModal();
    
    // Si un nom a été saisi
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
  refreshButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // Empêcher le toggle du dossier
    
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
  
  // Fonction pour fermer tous les dossiers
  const closeAllFolders = async () => {
    const folders = await getFolders();
    let anyFolderOpen = false;
    
    // Vérifier si au moins un dossier est ouvert
    for (const folder of folders) {
      if (folder.expanded) {
        anyFolderOpen = true;
        break;
      }
    }
    
    // Si au moins un dossier est ouvert, les fermer tous
    if (anyFolderOpen) {
      const updatedFolders = folders.map(folder => ({
        ...folder,
        expanded: false
      }));
      
      await setValue('folders', updatedFolders);
      
      // Rafraîchir l'affichage pour mettre à jour l'interface
      await renderFolders();
      
      return true; // Indique que des dossiers ont été fermés
    }
    
    return false; // Indique qu'aucun dossier n'était ouvert
  };
  
  // Gestionnaire d'événements pour le bouton de fermeture/ouverture
  collapseAllButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // Empêcher le toggle du titre principal
    
    // Vérifier si des dossiers sont ouverts et les fermer le cas échéant
    const foldersWereClosed = await closeAllFolders();
    
    // Si aucun dossier n'était ouvert ou a été fermé, basculer l'état de la liste entière
    if (!foldersWereClosed) {
      toggleFolderDisplay();
    }
  });
  
  console.log("Interface des dossiers injectée avec succès");
  
  // Charger et afficher les dossiers
  await renderFolders();
} 