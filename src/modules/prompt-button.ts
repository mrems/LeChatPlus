/**
 * Module pour l'injection du bouton de prompt pour Le Chat+
 * Gère l'insertion d'un bouton permettant d'ajouter un modèle de prompt JSON
 */

import { ThemeChangeObserver } from './dom-observer';
// Importer les fonctions pour ouvrir les modales
import { openSavePromptModal, openPromptListModal } from './modals'; 
// TODO: Importer les fonctions de stockage si nécessaire directement ici (normalement non)
// import { savePrompt, getPrompts } from './storage';

// ID pour le popover
const POPOVER_ID = 'le-chat-plus-prompt-popover';
// ID pour le nouveau bouton dossier
const FOLDER_BUTTON_ID = 'le-chat-plus-folder-button';
// ID pour le popover des actions de dossier
const FOLDER_ACTIONS_POPOVER_ID = 'le-chat-plus-folder-actions-popover';

/** Détecte le thème actuel (copié de modals.ts pour l'instant) */
function isDarkThemeActive(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark' || 
         document.documentElement.classList.contains('dark') || 
         document.body.classList.contains('dark');
}

/**
 * Crée et affiche le popover près du bouton de prompt
 * @param promptButton Le bouton de prompt auquel attacher le popover
 */
function showPromptPopover(promptButton: HTMLElement): void {
  const existingPopover = document.getElementById(POPOVER_ID);
  if (existingPopover) {
    existingPopover.remove();
    return; 
  }

  const isDark = isDarkThemeActive();

  // Créer le conteneur du popover
  const popover = document.createElement('div');
  popover.id = POPOVER_ID;
  Object.assign(popover.style, {
    position: 'absolute', zIndex: '10000', 
    background: isDark ? '#3a3a3a' : '#ffffff', // Thème appliqué
    border: isDark ? '1px solid #555555' : '1px solid #dddddd', // Thème appliqué
    color: isDark ? '#e0e0e0' : '#333333', // Thème appliqué
    borderRadius: '8px', padding: '8px',
    boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)', // Thème appliqué
    width: '150px'
  });

  // Fonction pour styler les boutons du popover
  const stylePopoverButton = (button: HTMLButtonElement) => {
    Object.assign(button.style, {
      display: 'block', width: '100%', padding: '8px', 
      border: 'none', borderRadius: '4px', textAlign: 'left', cursor: 'pointer',
      background: 'transparent', 
      color: 'inherit', // Hérite la couleur du popover
      transition: 'background-color 0.2s'
    });
    button.onmouseover = () => button.style.backgroundColor = isDark ? '#444444' : '#f0f0f0'; // Thème appliqué (hover)
    button.onmouseout = () => button.style.backgroundColor = 'transparent';
  };

  // Créer le bouton "Save prompt"
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save prompt';
  stylePopoverButton(saveButton);
  saveButton.style.marginBottom = '4px'; // Garder l'espacement
  saveButton.onclick = () => {
    popover.remove(); 
    openSavePromptModal();
  };

  // Créer le bouton "Prompt list"
  const listButton = document.createElement('button');
  listButton.textContent = 'Prompt list';
  stylePopoverButton(listButton);
  listButton.onclick = () => {
    popover.remove();
    openPromptListModal(); 
  };

  popover.appendChild(saveButton);
  popover.appendChild(listButton);

  const rect = promptButton.getBoundingClientRect();
  popover.style.bottom = `${window.innerHeight - rect.top}px`; 
  popover.style.left = `${rect.left}px`; 

  document.body.appendChild(popover);
}

// --- Popover pour les actions de dossier ---
async function showFolderActionsPopover(folderButton: HTMLElement): Promise<void> {
  const existingPopover = document.getElementById(FOLDER_ACTIONS_POPOVER_ID);
  if (existingPopover) {
    existingPopover.remove();
    return; 
  }

  // Imports dynamiques ici pour éviter les dépendances circulaires et alléger le chargement initial
  const { renderFolders, updateActiveConversationHighlight } = await import('./ui-renderer');
  const { safeSetStyle } = await import('./ui-helpers');
  const { showFolderCreateModal } = await import('./modal-system');
  const { getFolders, collapseAllFolders, expandAllFolders, createFolder } = await import('./folder-operations');
  // applyInteractiveStyles est déjà défini globalement dans modals.ts, 
  // mais pour la propreté, on pourrait l'importer ou la rendre plus locale.
  // Pour l'instant, on suppose qu'elle est accessible ou on la duplique/adapte si besoin.
  // Si applyInteractiveStyles n'est pas accessible, il faudra la copier/importer.
  // Pour cet exemple, je vais supposer qu'elle est disponible ou la définir localement si nécessaire.
  // Une meilleure solution serait de la mettre dans ui-helpers.ts et l'exporter.
  // Pour l'instant, je vais copier une version simplifiée pour les boutons du popover.

  const styleBoutonPopover = (bouton: HTMLButtonElement, isDarkTheme: boolean) => {
    Object.assign(bouton.style, {
        background: 'transparent',
        border: isDarkTheme ? '1px solid #555' : '1px solid #ccc',
        color: isDarkTheme ? '#eee' : '#333',
        padding: '5px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        marginLeft: '5px',
        fontSize: '12px'
    });
    bouton.onmouseover = () => bouton.style.borderColor = isDarkTheme ? '#777' : '#aaa';
    bouton.onmouseout = () => bouton.style.borderColor = isDarkTheme ? '#555' : '#ccc';
  };


  const isDark = isDarkThemeActive();

  const popover = document.createElement('div');
  popover.id = FOLDER_ACTIONS_POPOVER_ID;
  Object.assign(popover.style, {
    position: 'absolute', zIndex: '10000', 
    background: isDark ? '#3a3a3a' : '#ffffff', 
    border: isDark ? '1px solid #555555' : '1px solid #dddddd', 
    color: isDark ? '#e0e0e0' : '#333333', 
    borderRadius: '8px', padding: '12px',
    boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
    width: '250px', // Largeur à ajuster
    minHeight: '150px' // Hauteur minimale pour la future liste
  });

  // --- En-tête du Popover avec contrôles ---
  const popoverHeaderControls = document.createElement('div');
  safeSetStyle(popoverHeaderControls, 'display', 'flex');
  safeSetStyle(popoverHeaderControls, 'justifyContent', 'space-between');
  safeSetStyle(popoverHeaderControls, 'alignItems', 'center');
  safeSetStyle(popoverHeaderControls, 'marginBottom', '10px');
  // Pas de bordure pour un look plus intégré au popover

  // Titre réel déplacé ici
  const popoverTitleText = document.createElement('h4');
  popoverTitleText.textContent = 'Dossiers Le Chat';
  Object.assign(popoverTitleText.style, {
    margin: '0', fontSize: '14px', fontWeight: '600',
    color: isDark ? '#f0f0f0' : '#222222'
  });
  popoverHeaderControls.appendChild(popoverTitleText);

  const headerButtonsContainer = document.createElement('div');
  safeSetStyle(headerButtonsContainer, 'display', 'flex');
  safeSetStyle(headerButtonsContainer, 'alignItems', 'center');
  popoverHeaderControls.appendChild(headerButtonsContainer);

  // Bouton Ajouter (+)
  const addButton = document.createElement('button');
  addButton.innerHTML = '＋';
  addButton.title = 'Créer un dossier';
  styleBoutonPopover(addButton, isDark);
  addButton.onclick = async () => {
    const folderName = await showFolderCreateModal();
    if (folderName && folderName.trim() !== '') {
      try {
        await createFolder(folderName.trim()); // APPEL EXPLICITE ICI
        await renderFolders(folderListContainer); // Rafraîchir la liste dans le popover
        await updateActiveConversationHighlight();
      } catch (error) {
        console.error("Erreur lors de la création du dossier:", error);
        // Gérer l'erreur, peut-être afficher une notification à l'utilisateur
      }
    }
  };
  headerButtonsContainer.appendChild(addButton);

  popover.insertBefore(popoverHeaderControls, popover.firstChild); // Insérer l'en-tête en haut
  // Supprimer l'ancien titre qui était directement dans le popover
  const oldTitle = popover.querySelector('h4');
  if (oldTitle && oldTitle.parentNode === popover && oldTitle !== popoverTitleText) {
      oldTitle.remove();
  }

  // Conteneur pour la liste des dossiers (sera peuplé plus tard)
  const folderListContainer = document.createElement('div');
  folderListContainer.id = 'le-chat-plus-folder-popover-list-container'; // ID unique
  folderListContainer.textContent = 'Chargement des dossiers...'; // Placeholder
  // Styles pour le défilement si nécessaire
  Object.assign(folderListContainer.style, {
    maxHeight: '300px', // Hauteur max avant défilement
    overflowY: 'auto',
    paddingRight: '5px' // Pour la barre de défilement
  });
  popover.appendChild(folderListContainer);

  // Appel pour peupler la liste des dossiers
  try {
    await renderFolders(folderListContainer); // Passer le conteneur spécifique
    await updateActiveConversationHighlight();
  } catch (error) {
    console.error("Le Chat+ : Erreur lors du rendu des dossiers dans le popover:", error);
    folderListContainer.textContent = "Erreur chargement dossiers.";
  }

  const rect = folderButton.getBoundingClientRect();
  popover.style.bottom = `${window.innerHeight - rect.top}px`; 
  popover.style.left = `${rect.left}px`; 

  document.body.appendChild(popover);
}

// Sélecteurs et constantes
const ADD_FILES_BUTTON_SELECTOR = 'button[aria-label="Add files"]';
const SEND_BUTTON_SELECTOR = 'button[type="submit"], button[aria-label*="envoyer"], button[aria-label*="send"]';
const LIBRARY_BUTTON_SELECTOR = 'button[data-testid="library-selection-button"]';
const TOOLS_BUTTON_SELECTOR = 'button[data-testid="tools-selection-button"]';
const PROMPT_BUTTON_ID = 'le-chat-plus-prompt-button';
const LIBRARY_BUTTON_ID = 'le-chat-plus-library-button';
const TOOLS_BUTTON_ID = 'le-chat-plus-tools-button';
const WRAPPER_ID = 'le-chat-plus-button-wrapper'; // ID pour notre conteneur stable
const REPLACED_BUTTON_MARKER_CLASS = 'le-chat-plus-replaced-button';
const ICON_BUTTON_CLASS = 'le-chat-plus-icon-button';

// --- Fonctions de création des icônes SVG (Mises à jour) ---
function createLibraryIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  // Utiliser les attributs fournis par l'utilisateur, ajuster la taille si nécessaire
  svg.setAttribute('width', '18'); // Taille cohérente
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // Utiliser le path fourni par l'utilisateur
  svg.innerHTML = `<path d="m16 6 4 14"></path><path d="M12 6v14"></path><path d="M8 8v12"></path><path d="M4 4v16"></path>`; 
  svg.style.display = 'block';
  svg.style.margin = 'auto';
  return svg;
}

function createToolsIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '18'); // Taille cohérente
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // Icône clé à molette
  svg.innerHTML = `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>`; 
  svg.style.display = 'block';
  svg.style.margin = 'auto';
  return svg;
}

function createFolderIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // Icône dossier simple
  svg.innerHTML = `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>`;
  svg.style.display = 'block';
  svg.style.margin = 'auto';
  return svg;
}

// --- Fonction pour appliquer le thème aux boutons (utilise TOUJOURS addFilesButton comme référence couleur/fond/bordure) ---
function applyButtonStyle(button: HTMLButtonElement, referenceButtonForStyle: HTMLButtonElement, isIcon = false) {
  const refStyles = window.getComputedStyle(referenceButtonForStyle);
  const isPromptButton = button.id === PROMPT_BUTTON_ID;

  Object.assign(button.style, {
    background: refStyles.background,
    color: refStyles.color,          
    border: refStyles.border, 
    borderRadius: refStyles.borderRadius, 
    width: '32px', height: '32px', minWidth: '32px',
    padding: isIcon ? '0' : '0',
    cursor: 'pointer', display: 'flex', 
    alignItems: 'center', justifyContent: 'center',
    fontSize: refStyles.fontSize, 
    fontWeight: isPromptButton ? 'bold' : 'normal', 
    lineHeight: isPromptButton ? '32px' : 'normal',
    opacity: '0.7', 
    transition: 'opacity 0.2s, background-color 0.2s, color 0.2s, border-color 0.2s'
  });

  if (isIcon) {
    const svgIcon = button.querySelector('svg');
    if (svgIcon) {
      svgIcon.style.stroke = button.style.color; 
    }
  }

  button.onmouseover = () => button.style.opacity = '1';
  button.onmouseout = () => button.style.opacity = '0.7';
}

/**
 * Fonction principale pour injecter les boutons et remplacer les existants
 */
export function injectAndReplaceButtons(): void {
  let promptButtonRef: HTMLButtonElement | null = null; 
  let libraryButtonRef: HTMLButtonElement | null = null;
  let toolsButtonRef: HTMLButtonElement | null = null;

  const globalThemeObserver = new ThemeChangeObserver(() => {
    const currentAddFilesButton = document.querySelector<HTMLButtonElement>(ADD_FILES_BUTTON_SELECTOR);
    if (!currentAddFilesButton) return;

    const currentPromptButton = document.getElementById(PROMPT_BUTTON_ID) as HTMLButtonElement | null;
    if (currentPromptButton) applyButtonStyle(currentPromptButton, currentAddFilesButton, false); 
    
    const currentLibraryButton = document.getElementById(LIBRARY_BUTTON_ID) as HTMLButtonElement | null;
    if (currentLibraryButton) applyButtonStyle(currentLibraryButton, currentAddFilesButton, true);
    
    const currentToolsButton = document.getElementById(TOOLS_BUTTON_ID) as HTMLButtonElement | null;
    if (currentToolsButton) applyButtonStyle(currentToolsButton, currentAddFilesButton, true);

    const currentFolderButton = document.getElementById(FOLDER_BUTTON_ID) as HTMLButtonElement | null;
    if (currentFolderButton) applyButtonStyle(currentFolderButton, currentAddFilesButton, true);
  });
  globalThemeObserver.start(); 

  const observer = new MutationObserver(() => {
    const addFilesButton = document.querySelector<HTMLButtonElement>(ADD_FILES_BUTTON_SELECTOR);
    if (!addFilesButton || !addFilesButton.parentNode) return; 
    
    const originalParentNode = addFilesButton.parentNode as HTMLElement; 

    // --- Création ou récupération du Wrapper Stable ---
    let buttonWrapper = document.getElementById(WRAPPER_ID) as HTMLDivElement | null;
    if (!buttonWrapper) {
        buttonWrapper = document.createElement('div');
        buttonWrapper.id = WRAPPER_ID;
        Object.assign(buttonWrapper.style, {
            display: 'flex',
            alignItems: 'center', 
            gap: '10px',
            paddingLeft: '10px'
        });
        originalParentNode.insertBefore(buttonWrapper, addFilesButton);
        buttonWrapper.appendChild(addFilesButton); // addFilesButton est le premier enfant
        console.log("Le Chat+ : Wrapper de boutons créé.");
    } else {
        if (!buttonWrapper.contains(addFilesButton)) {
            buttonWrapper.appendChild(addFilesButton); // S'assurer qu'il est dans le wrapper
        }
    }
    
    const parentNode = buttonWrapper; 

    // S'assurer que addFilesButton est le premier enfant du wrapper
    if (parentNode.firstChild !== addFilesButton && parentNode.contains(addFilesButton)) {
        parentNode.insertBefore(addFilesButton, parentNode.firstChild);
    }

    let currentRefNode: HTMLElement = addFilesButton; // Référence pour l'insertion

    // --- Ordre d'injection : AddFiles -> Bibliothèque -> Outils -> Dossier -> Prompt ---

    // --- 1. Gérer le bouton Bibliothèque ---
    let currentLibraryButton = document.getElementById(LIBRARY_BUTTON_ID) as HTMLButtonElement | null;
    const originalLibraryButton = document.querySelector<HTMLElement>(`${LIBRARY_BUTTON_SELECTOR}:not(.${REPLACED_BUTTON_MARKER_CLASS})`);

    if (!currentLibraryButton && originalLibraryButton) { 
        const newLibraryButton = document.createElement('button');
        newLibraryButton.id = LIBRARY_BUTTON_ID; 
        newLibraryButton.type = 'button';
        newLibraryButton.title = originalLibraryButton.textContent || 'Bibliothèque';
        newLibraryButton.classList.add(ICON_BUTTON_CLASS);
        newLibraryButton.appendChild(createLibraryIcon());
        applyButtonStyle(newLibraryButton, addFilesButton, true);
        newLibraryButton.onclick = () => originalLibraryButton.click(); 
        parentNode.insertBefore(newLibraryButton, currentRefNode.nextSibling);
        currentLibraryButton = newLibraryButton; 
        console.log("Le Chat+ : Bouton Bibliothèque injecté.");
    } else if (currentLibraryButton && (currentLibraryButton.parentNode !== parentNode || currentLibraryButton.previousSibling !== currentRefNode)) {
        parentNode.insertBefore(currentLibraryButton, currentRefNode.nextSibling);
        console.log("Le Chat+ : Bouton Bibliothèque repositionné.");
    }
    // Mettre à jour la référence si le bouton a été placé avec succès
    if (currentLibraryButton && currentLibraryButton.parentNode === parentNode && currentLibraryButton.previousSibling === currentRefNode) {
        currentRefNode = currentLibraryButton;
        if (originalLibraryButton && !originalLibraryButton.classList.contains(REPLACED_BUTTON_MARKER_CLASS)) {
            originalLibraryButton.classList.add(REPLACED_BUTTON_MARKER_CLASS);
            originalLibraryButton.style.display = 'none';
        }
    } else if (currentLibraryButton && currentLibraryButton.parentNode === parentNode && currentRefNode === addFilesButton && !addFilesButton.nextSibling) { 
        // Cas spécial: si addFilesButton était seul et Library a été ajouté, il devient la ref
         currentRefNode = currentLibraryButton;
          if (originalLibraryButton && !originalLibraryButton.classList.contains(REPLACED_BUTTON_MARKER_CLASS)) {
            originalLibraryButton.classList.add(REPLACED_BUTTON_MARKER_CLASS);
            originalLibraryButton.style.display = 'none';
        }
    }


    // --- 2. Gérer le bouton Outils ---
    let currentToolsButton = document.getElementById(TOOLS_BUTTON_ID) as HTMLButtonElement | null;
        const originalToolsButton = document.querySelector<HTMLElement>(`${TOOLS_BUTTON_SELECTOR}:not(.${REPLACED_BUTTON_MARKER_CLASS})`);

    if (!currentToolsButton && originalToolsButton) { 
            const newToolsButton = document.createElement('button');
            newToolsButton.id = TOOLS_BUTTON_ID; 
            newToolsButton.type = 'button';
            newToolsButton.title = originalToolsButton.textContent || 'Outils';
            newToolsButton.classList.add(ICON_BUTTON_CLASS);
            newToolsButton.appendChild(createToolsIcon());
            applyButtonStyle(newToolsButton, addFilesButton, true);
            newToolsButton.onclick = () => originalToolsButton.click(); 
        parentNode.insertBefore(newToolsButton, currentRefNode.nextSibling);
            currentToolsButton = newToolsButton; 
        console.log("Le Chat+ : Bouton Outils injecté.");
    } else if (currentToolsButton && (currentToolsButton.parentNode !== parentNode || currentToolsButton.previousSibling !== currentRefNode)) {
        parentNode.insertBefore(currentToolsButton, currentRefNode.nextSibling);
        console.log("Le Chat+ : Bouton Outils repositionné.");
    }
     // Mettre à jour la référence
    if (currentToolsButton && currentToolsButton.parentNode === parentNode && currentToolsButton.previousSibling === currentRefNode) {
        currentRefNode = currentToolsButton;
        if (originalToolsButton && !originalToolsButton.classList.contains(REPLACED_BUTTON_MARKER_CLASS)) {
            originalToolsButton.classList.add(REPLACED_BUTTON_MARKER_CLASS);
            originalToolsButton.style.display = 'none';
        }
    } else if (currentToolsButton && currentToolsButton.parentNode === parentNode && currentRefNode.nextSibling === currentToolsButton && currentRefNode !== currentToolsButton) {
      // Cas où il est bien après currentRefNode mais currentRefNode.previousSibling n'est pas directement lui (ex: currentRefNode est addFilesButton)
      currentRefNode = currentToolsButton;
      if (originalToolsButton && !originalToolsButton.classList.contains(REPLACED_BUTTON_MARKER_CLASS)) {
          originalToolsButton.classList.add(REPLACED_BUTTON_MARKER_CLASS);
          originalToolsButton.style.display = 'none';
      }
    }


    // --- 3. Gérer le bouton Dossier ---
    let currentFolderButton = document.getElementById(FOLDER_BUTTON_ID) as HTMLButtonElement | null;
    if (!currentFolderButton) {
      const newFolderButton = document.createElement('button');
      newFolderButton.id = FOLDER_BUTTON_ID;
      newFolderButton.type = 'button';
      newFolderButton.title = 'Ouvrir les dossiers de chat';
      newFolderButton.classList.add(ICON_BUTTON_CLASS);
      newFolderButton.appendChild(createFolderIcon());
      applyButtonStyle(newFolderButton, addFilesButton, true);
      newFolderButton.onclick = (event) => {
        event.stopPropagation();
        showFolderActionsPopover(newFolderButton);
      };
      parentNode.insertBefore(newFolderButton, currentRefNode.nextSibling);
      currentFolderButton = newFolderButton;
      console.log("Le Chat+ : Bouton dossier injecté.");
    } else if (currentFolderButton && (currentFolderButton.parentNode !== parentNode || currentFolderButton.previousSibling !== currentRefNode)) {
       parentNode.insertBefore(currentFolderButton, currentRefNode.nextSibling);
       console.log("Le Chat+ : Bouton dossier repositionné.");
    }
    // Mettre à jour la référence
    if (currentFolderButton && currentFolderButton.parentNode === parentNode && currentFolderButton.previousSibling === currentRefNode) {
        currentRefNode = currentFolderButton;
    } else if (currentFolderButton && currentFolderButton.parentNode === parentNode && currentRefNode.nextSibling === currentFolderButton && currentRefNode !== currentFolderButton) {
      currentRefNode = currentFolderButton;
    }


    // --- 4. Gérer le bouton Prompt ---
    let currentPromptButton = document.getElementById(PROMPT_BUTTON_ID) as HTMLButtonElement | null;
    if (!currentPromptButton) {
        const newPromptButton = document.createElement('button');
        newPromptButton.id = PROMPT_BUTTON_ID;
        newPromptButton.type = 'button'; 
        newPromptButton.innerHTML = '{ }';
        newPromptButton.title = 'Gérer les prompts'; 
        applyButtonStyle(newPromptButton, addFilesButton, false);
        newPromptButton.addEventListener('click', (event) => { event.stopPropagation(); showPromptPopover(newPromptButton); });
        parentNode.insertBefore(newPromptButton, currentRefNode.nextSibling);
        currentPromptButton = newPromptButton; 
        console.log("Le Chat+ : Bouton de prompt injecté.");
    } else if (currentPromptButton && (currentPromptButton.parentNode !== parentNode || currentPromptButton.previousSibling !== currentRefNode)) {
        parentNode.insertBefore(currentPromptButton, currentRefNode.nextSibling);
        console.log("Le Chat+ : Bouton Prompt repositionné.");
    }
    // currentRefNode n'a plus besoin d'être mis à jour car c'est le dernier bouton.
    
    // S'assurer que les boutons originaux qui ont été remplacés sont bien cachés
    // Cela est géré dans chaque bloc maintenant si le remplacement est confirmé.
    // Mais une vérification finale peut être utile pour ceux qui n'auraient pas été créés/déplacés mais dont l'original existe.
    const allOriginalSelectors = [LIBRARY_BUTTON_SELECTOR, TOOLS_BUTTON_SELECTOR];
    allOriginalSelectors.forEach(selector => {
        const originalBtn = document.querySelector<HTMLElement>(`${selector}:not(.${REPLACED_BUTTON_MARKER_CLASS})`);
        if (originalBtn) {
            // Si son remplaçant existe et est dans le DOM, ou si on a décidé de le cacher de toute façon.
            // Pour l'instant, on se fie au marquage fait lors de la création/repositionnement.
            // Si un bouton original existe mais son remplaçant n'a pas été injecté (ex: currentToolsButton est null),
            // il ne sera pas caché par cette logique, ce qui est correct.
        }
    });

  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

// **Important**: Renommer l'exportation ou la fonction appelée dans mistral.ts si nécessaire.
// Par exemple, si mistral.ts appelle `injectPromptButton`, il faut maintenant qu'il appelle `injectAndReplaceButtons`. 