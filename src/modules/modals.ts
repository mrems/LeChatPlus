/**
 * Module pour gérer l'affichage des modales pour Le Chat+
 */

import type { SavedPrompt } from './storage';
import { getPrompts, savePrompt, deletePrompt, generatePromptId } from './storage';

// --- Variables globales pour les modales ---
let modalOverlay: HTMLDivElement | null = null;
let modalContainer: HTMLDivElement | null = null;

// --- Fonctions utilitaires pour les modales ---

/** Détecte le thème actuel */
function isDarkThemeActive(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark' || 
         document.documentElement.classList.contains('dark') || 
         document.body.classList.contains('dark');
}

/**
 * Crée et affiche l'overlay et le conteneur de la modale.
 * @param contentElement L'élément HTML à afficher dans la modale.
 * @param onClose Callback optionnel appelé à la fermeture.
 */
function displayModal(contentElement: HTMLElement, onClose?: () => void): void {
  closeModal(); 
  const isDark = isDarkThemeActive();

  // Créer l'overlay
  modalOverlay = document.createElement('div');
  modalOverlay.id = 'le-chat-plus-modal-overlay';
  Object.assign(modalOverlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Couleur semi-transparente, souvent ok pour les deux thèmes
    zIndex: '10001', display: 'flex', justifyContent: 'center', alignItems: 'center'
  });
  modalOverlay.onclick = (event) => {
    if (event.target === modalOverlay) closeModal(onClose);
  };

  // Créer le conteneur de la modale
  modalContainer = document.createElement('div');
  modalContainer.id = 'le-chat-plus-modal-container';
  Object.assign(modalContainer.style, {
    background: isDark ? '#2a2a2a' : '#ffffff', // Adapté de modal-system
    color: isDark ? '#e0e0e0' : '#333333',    // Adapté de modal-system (texte général)
    padding: '25px', borderRadius: '8px', 
    boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 5px 15px rgba(0, 0, 0, 0.2)', // Ombre adaptée
    maxWidth: '90%', maxHeight: '90vh', // Utiliser vh pour la hauteur
    overflowY: 'auto', position: 'relative', zIndex: '10002'
  });

  // Créer le bouton de fermeture
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;'; 
  Object.assign(closeButton.style, {
    position: 'absolute', top: '10px', right: '10px', background: 'transparent',
    border: 'none', fontSize: '1.8rem', lineHeight: '1', cursor: 'pointer',
    color: isDark ? '#aaaaaa' : '#888888', // Couleur gris clair/foncé
    padding: '0 5px' // Ajout d'un petit padding
  });
  closeButton.onclick = () => closeModal(onClose);
  // Effet hover pour le bouton fermer
  closeButton.onmouseover = () => closeButton.style.color = isDark ? '#ffffff' : '#000000';
  closeButton.onmouseout = () => closeButton.style.color = isDark ? '#aaaaaa' : '#888888';

  // Ajouter le contenu et le bouton de fermeture au conteneur
  modalContainer.appendChild(closeButton);
  modalContainer.appendChild(contentElement);
  modalOverlay.appendChild(modalContainer);
  document.body.appendChild(modalOverlay);
}

/**
 * Ferme la modale actuellement ouverte.
 * @param onClose Callback optionnel à exécuter après fermeture.
 */
function closeModal(onClose?: () => void): void {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
    modalContainer = null;
    if (onClose) {
      try {
        onClose();
      } catch (error) {
        console.error("Le Chat+ Error in onClose callback:", error);
      }
    }
  }
}

// --- Fonctions spécifiques pour chaque modale ---

/** Applique les styles de thème aux éléments interactifs courants */
function applyInteractiveStyles(element: HTMLElement, isDark: boolean, isDelete = false) {
  if (element instanceof HTMLButtonElement) {
    element.style.padding = '8px 12px';
    element.style.borderRadius = '6px';
    element.style.fontSize = '14px';
    element.style.cursor = 'pointer';
    element.style.transition = 'background-color 0.2s, border-color 0.2s, color 0.2s';
    
    if (isDelete) {
      element.style.border = isDark ? '1px solid #ff5555' : '1px solid #dd0000';
      element.style.background = 'transparent';
      element.style.color = isDark ? '#ff5555' : '#dd0000';
      element.onmouseover = () => element.style.backgroundColor = isDark ? 'rgba(255, 85, 85, 0.1)' : 'rgba(221, 0, 0, 0.05)';
      element.onmouseout = () => element.style.background = 'transparent';
    } else if (element.id === 'add-edit-confirm-button' || element.id === 'save-confirm-button') { // Bouton Primaire
      element.style.border = isDark ? '1px solid #555555' : '1px solid #cccccc';
      element.style.background = isDark ? '#3a3a3a' : '#f0f0f0';
      element.style.color = isDark ? '#ffffff' : '#333333';
      element.onmouseover = () => element.style.background = isDark ? '#444444' : '#e5e5e5';
      element.onmouseout = () => element.style.background = isDark ? '#3a3a3a' : '#f0f0f0';
    } else { // Autres boutons (secondaires)
      element.style.border = isDark ? '1px solid #444444' : '1px solid #dddddd';
      element.style.background = 'transparent';
      element.style.color = isDark ? '#cccccc' : '#666666';
      element.onmouseover = () => element.style.backgroundColor = isDark ? '#333333' : '#f5f5f5';
      element.onmouseout = () => element.style.background = 'transparent';
    }

  } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.style.padding = '8px 10px';
    element.style.borderRadius = '6px';
    element.style.fontSize = '14px';
    element.style.border = isDark ? '1px solid #555555' : '1px solid #dddddd';
    element.style.background = isDark ? '#3a3a3a' : '#f5f5f5';
    element.style.color = isDark ? '#ffffff' : '#333333';
    element.style.boxSizing = 'border-box';
    element.style.transition = 'border-color 0.2s, background-color 0.2s';

    element.addEventListener('focus', () => {
      element.style.background = isDark ? '#444444' : '#ffffff';
      element.style.borderColor = isDark ? '#777777' : '#999999'; // Focus plus visible
    });
    element.addEventListener('blur', () => {
      element.style.background = isDark ? '#3a3a3a' : '#f5f5f5';
      element.style.borderColor = isDark ? '#555555' : '#dddddd';
    });
  }
}

/**
 * Ouvre la modale pour sauvegarder le prompt actuel.
 */
export function openSavePromptModal(): void {
  console.log("Opening Save Prompt Modal...");
  const isDark = isDarkThemeActive();
  const textarea = document.querySelector('textarea');
  const currentPrompt = textarea ? textarea.value : '';

  const content = document.createElement('div');
  content.style.minWidth = '600px'; 
  content.style.maxWidth = '80vw';

  const titleHeader = document.createElement('h2');
  titleHeader.textContent = 'Sauvegarder le Prompt';
  titleHeader.style.color = isDark ? '#ffffff' : '#111111'; // Titre plus contrasté
  titleHeader.style.marginBottom = '20px';
  content.appendChild(titleHeader);

  const titleLabel = document.createElement('label');
  titleLabel.htmlFor = 'prompt-title';
  titleLabel.textContent = 'Titre:';
  Object.assign(titleLabel.style, { display: 'block', marginBottom: '5px', fontSize: '14px' });
  content.appendChild(titleLabel);

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'prompt-title';
  titleInput.placeholder = 'Donnez un titre à votre prompt';
  Object.assign(titleInput.style, { width: '100%', marginBottom: '15px' });
  applyInteractiveStyles(titleInput, isDark);
  content.appendChild(titleInput);

  const contentLabel = document.createElement('label');
  contentLabel.htmlFor = 'prompt-content';
  contentLabel.textContent = 'Contenu:';
  Object.assign(contentLabel.style, { display: 'block', marginBottom: '5px', fontSize: '14px' });
  content.appendChild(contentLabel);

  const contentTextarea = document.createElement('textarea');
  contentTextarea.id = 'prompt-content';
  contentTextarea.rows = 5;
  contentTextarea.readOnly = true;
  contentTextarea.value = currentPrompt;
  Object.assign(contentTextarea.style, { width: '100%', marginBottom: '15px' });
  // Appliquer les styles même si readonly
  contentTextarea.style.padding = '8px 10px';
  contentTextarea.style.borderRadius = '6px';
  contentTextarea.style.fontSize = '14px';
  contentTextarea.style.border = isDark ? '1px solid #4a4a4a' : '1px solid #eeeeee'; // Bordure plus subtile pour readonly
  contentTextarea.style.background = isDark ? '#2f2f2f' : 'f9f9f9'; // Fond légèrement différent
  contentTextarea.style.color = isDark ? '#cccccc' : '555555';
  contentTextarea.style.boxSizing = 'border-box';
  content.appendChild(contentTextarea);

  const saveButton = document.createElement('button');
  saveButton.id = 'save-confirm-button';
  saveButton.textContent = 'Sauvegarder';
  applyInteractiveStyles(saveButton, isDark);
  content.appendChild(saveButton);

  displayModal(content, () => console.log("Save modal closed."));

  titleInput.focus();

  saveButton.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (title && currentPrompt) {
      const newPrompt: SavedPrompt = {
        id: generatePromptId(), title: title, content: currentPrompt
      };
      await savePrompt(newPrompt);
      closeModal();
    } else {
      alert('Veuillez entrer un titre pour le prompt.');
      titleInput.focus(); // Remettre le focus sur le champ titre
    }
  });
}

/**
 * Ouvre la modale affichant la liste des prompts sauvegardés.
 */
export async function openPromptListModal(): Promise<void> {
  console.log("Opening Prompt List Modal...");
  const isDark = isDarkThemeActive();
  const prompts = await getPrompts();

  const content = document.createElement('div');
  content.style.minWidth = '600px'; 
  content.style.maxWidth = '80vw';

  const titleHeader = document.createElement('h2');
  titleHeader.textContent = 'Liste des Prompts';
  titleHeader.style.color = isDark ? '#ffffff' : '#111111';
  titleHeader.style.marginBottom = '15px';
  content.appendChild(titleHeader);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Rechercher par titre ou contenu...';
  Object.assign(searchInput.style, { 
      display: 'block', width: '100%', 
      marginBottom: '15px', boxSizing: 'border-box' 
  });
  applyInteractiveStyles(searchInput, isDark);
  content.appendChild(searchInput);

  const addButton = document.createElement('button');
  addButton.textContent = ' + Ajouter un Prompt';
  Object.assign(addButton.style, { 
      display: 'block', marginBottom: '15px', width: '100%', 
      textAlign: 'center' // Centrer le texte
  });
  // Style spécifique pour "Ajouter" (plus discret)
  addButton.style.border = isDark ? '1px dashed #555555' : '1px dashed #cccccc';
  addButton.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
  addButton.style.color = isDark ? '#aaaaaa' : '#777777';
  addButton.style.padding = '10px';
  addButton.style.borderRadius = '6px';
  addButton.style.fontSize = '14px';
  addButton.style.cursor = 'pointer';
  addButton.style.transition = 'background-color 0.2s, border-color 0.2s';
  addButton.onmouseover = () => {
      addButton.style.background = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
      addButton.style.borderColor = isDark ? '#777777' : '#aaaaaa';
  };
  addButton.onmouseout = () => {
      addButton.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
      addButton.style.borderColor = isDark ? '#555555' : '#cccccc';
  };
  addButton.onclick = () => openAddEditModal();
  content.appendChild(addButton);

  const listContainer = document.createElement('ul');
  listContainer.id = 'le-chat-plus-prompt-list';
  Object.assign(listContainer.style, {
    listStyle: 'none', padding: '0', maxHeight: '50vh', overflowY: 'auto',
    borderTop: isDark ? '1px solid #444444' : '1px solid #eeeeee', // Bordure adaptée
    marginTop: '15px'
  });

  const populateList = (filterText = '') => {
    listContainer.innerHTML = ''; 
    const lowerCaseFilter = filterText.toLowerCase();
    const filteredPrompts = prompts.filter(p => 
        p.title.toLowerCase().includes(lowerCaseFilter) || 
        p.content.toLowerCase().includes(lowerCaseFilter)
    );

    if (filteredPrompts.length === 0) {
      const noResultP = document.createElement('p');
      noResultP.textContent = filterText ? 'Aucun prompt correspondant trouvé.' : 'Aucun prompt sauvegardé.';
      Object.assign(noResultP.style, { 
          textAlign: 'center', 
          color: isDark ? '#888888' : '#aaaaaa', 
          padding: '20px' 
      });
      listContainer.appendChild(noResultP);
    } else {
      filteredPrompts.forEach((prompt, index) => {
        const listItem = document.createElement('li');
        Object.assign(listItem.style, {
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 10px', // Padding ajusté
          borderBottom: isDark ? '1px solid #3a3a3a' : '1px solid #eeeeee',
          transition: 'background-color 0.2s', // Effet hover
          borderRadius: '4px' // Léger arrondi
        });
        // Hover sur l'item de liste
        listItem.onmouseover = () => listItem.style.backgroundColor = isDark ? '#333333' : '#f5f5f5';
        listItem.onmouseout = () => listItem.style.backgroundColor = 'transparent';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = prompt.title;
        Object.assign(titleSpan.style, { 
            fontWeight: '500', // Moins gras
            flexGrow: '1', marginRight: '10px', cursor: 'pointer',
            color: 'inherit' // Hérite la couleur du li
        });
        titleSpan.title = 'Cliquer pour insérer';
        titleSpan.onclick = () => { insertPromptContent(prompt.content); closeModal(); };

        const actionsDiv = document.createElement('div');
        Object.assign(actionsDiv.style, { display: 'flex', gap: '8px' }); // Espace ajusté

        // Styles communs pour les boutons d'action (icônes)
        const actionButtonBaseStyle = {
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px',
          fontSize: '1rem', color: isDark ? '#aaaaaa' : '#888888', 
          transition: 'color 0.2s'
        };

        const editButton = document.createElement('button');
        editButton.innerHTML = '&#9998;'; 
        editButton.title = 'Modifier';
        Object.assign(editButton.style, actionButtonBaseStyle);
        editButton.onmouseover = () => editButton.style.color = isDark ? '#77bbff' : '#007bff'; // Bleu clair / Bleu
        editButton.onmouseout = () => editButton.style.color = isDark ? '#aaaaaa' : '#888888';
        editButton.onclick = () => openAddEditModal(prompt); 

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '&#128465;'; 
        deleteButton.title = 'Supprimer';
        Object.assign(deleteButton.style, actionButtonBaseStyle);
        deleteButton.onmouseover = () => deleteButton.style.color = isDark ? '#ff7777' : '#dc3545'; // Rouge clair / Rouge
        deleteButton.onmouseout = () => deleteButton.style.color = isDark ? '#aaaaaa' : '#888888';
        deleteButton.onclick = async () => {
          // Utiliser un modal de confirmation interne ou celui de modal-system si disponible
          if (confirm(`Êtes-vous sûr de vouloir supprimer le prompt "${prompt.title}" ?`)) {
            await deletePrompt(prompt.id);
            const currentFilter = searchInput.value;
            closeModal(); 
            openPromptListModal().then(() => {
                const newSearchInput = document.querySelector('#le-chat-plus-modal-container input[type="search"]') as HTMLInputElement | null;
                if(newSearchInput) {
                    newSearchInput.value = currentFilter;
                    newSearchInput.dispatchEvent(new Event('input')); 
                    newSearchInput.focus(); // Focus après rechargement
                }
            });
          }
        };
        
        actionsDiv.appendChild(editButton);
        actionsDiv.appendChild(deleteButton);
        listItem.appendChild(titleSpan);
        listItem.appendChild(actionsDiv);
        listContainer.appendChild(listItem);
      });
    }
  };

  searchInput.addEventListener('input', (event) => {
    populateList((event.target as HTMLInputElement).value);
  });

  content.appendChild(listContainer);
  populateList(); 
  displayModal(content, () => console.log("List modal closed."));
  searchInput.focus();
}

/**
 * Ouvre la modale pour ajouter ou modifier un prompt.
 * @param promptToEdit Prompt existant à modifier (optionnel).
 */
function openAddEditModal(promptToEdit?: SavedPrompt): void {
  const isDark = isDarkThemeActive();
  const isEditing = !!promptToEdit;
  const modalTitleText = isEditing ? 'Modifier le Prompt' : 'Ajouter un Prompt';
  const buttonText = isEditing ? 'Mettre à jour' : 'Ajouter';

  const content = document.createElement('div');
  content.style.minWidth = '600px'; 
  content.style.maxWidth = '80vw';
  // content.style.color = isDark ? '#e0e0e0' : '#333333';

  const modalTitle = document.createElement('h2');
  modalTitle.textContent = modalTitleText;
  modalTitle.style.color = isDark ? '#ffffff' : '#111111';
  modalTitle.style.marginBottom = '20px';
  content.appendChild(modalTitle);

  const titleLabel = document.createElement('label');
  titleLabel.htmlFor = 'prompt-title-edit';
  titleLabel.textContent = 'Titre:';
  Object.assign(titleLabel.style, { display: 'block', marginBottom: '5px', fontSize: '14px' });
  content.appendChild(titleLabel);

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'prompt-title-edit';
  titleInput.placeholder = 'Titre du prompt';
  titleInput.value = isEditing ? promptToEdit.title : '';
  Object.assign(titleInput.style, { width: '100%', marginBottom: '15px' });
  applyInteractiveStyles(titleInput, isDark);
  content.appendChild(titleInput);

  const contentLabel = document.createElement('label');
  contentLabel.htmlFor = 'prompt-content-edit';
  contentLabel.textContent = 'Contenu:';
  Object.assign(contentLabel.style, { display: 'block', marginBottom: '5px', fontSize: '14px' });
  content.appendChild(contentLabel);

  const contentTextarea = document.createElement('textarea');
  contentTextarea.id = 'prompt-content-edit';
  contentTextarea.rows = 8; // Augmenté comme demandé précédemment
  contentTextarea.placeholder = 'Entrez le contenu du prompt ici...';
  contentTextarea.value = isEditing ? promptToEdit.content : '';
  Object.assign(contentTextarea.style, { width: '100%', marginBottom: '15px' });
  applyInteractiveStyles(contentTextarea, isDark);
  content.appendChild(contentTextarea);

  const confirmButton = document.createElement('button');
  confirmButton.id = 'add-edit-confirm-button';
  confirmButton.textContent = buttonText;
  applyInteractiveStyles(confirmButton, isDark);
  content.appendChild(confirmButton);

  displayModal(content, () => console.log("Add/Edit modal closed."));

  if (isEditing) {
    contentTextarea.focus();
    contentTextarea.setSelectionRange(contentTextarea.value.length, contentTextarea.value.length);
  } else {
    titleInput.focus();
  }

  confirmButton.addEventListener('click', async () => {
    const newTitle = titleInput.value.trim();
    const newContent = contentTextarea.value.trim();

    if (newTitle && newContent) {
      const promptData: SavedPrompt = {
        id: isEditing ? promptToEdit.id : generatePromptId(), title: newTitle, content: newContent
      };
      await savePrompt(promptData);
      closeModal(); 
      
      let currentFilter = '';
      const listSearchInput = document.querySelector('#le-chat-plus-prompt-list input[type="search"]') as HTMLInputElement | null;
      if (listSearchInput) currentFilter = listSearchInput.value;

      openPromptListModal().then(() => {
        const newSearchInput = document.querySelector('#le-chat-plus-modal-container input[type="search"]') as HTMLInputElement | null;
        if(newSearchInput && currentFilter) {
            newSearchInput.value = currentFilter;
            newSearchInput.dispatchEvent(new Event('input')); 
            newSearchInput.focus();
        }
      }); 
    } else {
      alert('Veuillez remplir le titre et le contenu du prompt.');
      if (!newTitle) titleInput.focus();
      else contentTextarea.focus();
    }
  });
}

/**
 * Insère le contenu d'un prompt dans le textarea principal.
 * @param content Contenu du prompt à insérer.
 */
function insertPromptContent(content: string): void {
  const textarea = document.querySelector('textarea');
  if (textarea) {
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    textarea.value = textBefore + content + textAfter;
    textarea.selectionStart = cursorPos + content.length;
    textarea.selectionEnd = cursorPos + content.length;
    textarea.focus();
  }
} 