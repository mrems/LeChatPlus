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

  const closePopoverHandler = (event: MouseEvent) => {
    if (!popover.contains(event.target as Node) && event.target !== promptButton) {
      popover.remove();
      document.removeEventListener('click', closePopoverHandler, true);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closePopoverHandler, true);
  }, 0);
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
        buttonWrapper.appendChild(addFilesButton);
        console.log("Le Chat+ : Wrapper de boutons créé.");
    } else {
        if (!buttonWrapper.contains(addFilesButton)) {
            buttonWrapper.appendChild(addFilesButton);
        }
        buttonWrapper.style.gap = '10px'; 
    }
    
    const parentNode = buttonWrapper; 

    // --- Injection/Gestion dans le nouvel ordre : Outils -> Bibliothèque -> Prompt ---

    // --- 1. Gérer le bouton Outils (insérer APRÈS AddFiles) ---
    let currentToolsButton = document.getElementById(TOOLS_BUTTON_ID) as HTMLButtonElement | null;
    if (!currentToolsButton) { 
        const originalToolsButton = document.querySelector<HTMLElement>(`${TOOLS_BUTTON_SELECTOR}:not(.${REPLACED_BUTTON_MARKER_CLASS})`);
        if (originalToolsButton) {
            if (!originalToolsButton.classList.contains(REPLACED_BUTTON_MARKER_CLASS)) {
                originalToolsButton.classList.add(REPLACED_BUTTON_MARKER_CLASS);
                originalToolsButton.style.display = 'none'; 
            }
            const newToolsButton = document.createElement('button');
            newToolsButton.id = TOOLS_BUTTON_ID; 
            newToolsButton.type = 'button';
            newToolsButton.title = originalToolsButton.textContent || 'Outils';
            newToolsButton.classList.add(ICON_BUTTON_CLASS);
            newToolsButton.appendChild(createToolsIcon());
            applyButtonStyle(newToolsButton, addFilesButton, true);
            newToolsButton.onclick = () => originalToolsButton.click(); 
            parentNode.insertBefore(newToolsButton, addFilesButton.nextSibling);
            currentToolsButton = newToolsButton; 
        }
    } else if (!parentNode.contains(currentToolsButton)) {
        parentNode.insertBefore(currentToolsButton, addFilesButton.nextSibling);
    }
    if (currentToolsButton && !toolsButtonRef) toolsButtonRef = currentToolsButton;

    // --- 2. Gérer le bouton Bibliothèque (insérer APRÈS Outils ou AddFiles) ---
    let currentLibraryButton = document.getElementById(LIBRARY_BUTTON_ID) as HTMLButtonElement | null;
    if (!currentLibraryButton) { 
        const originalLibraryButton = document.querySelector<HTMLElement>(`${LIBRARY_BUTTON_SELECTOR}:not(.${REPLACED_BUTTON_MARKER_CLASS})`);
        if (originalLibraryButton) {
             if (!originalLibraryButton.classList.contains(REPLACED_BUTTON_MARKER_CLASS)) {
                 originalLibraryButton.classList.add(REPLACED_BUTTON_MARKER_CLASS);
                 originalLibraryButton.style.display = 'none'; 
            }
            const newLibraryButton = document.createElement('button');
            newLibraryButton.id = LIBRARY_BUTTON_ID; 
            newLibraryButton.type = 'button';
            newLibraryButton.title = originalLibraryButton.textContent || 'Bibliothèque';
            newLibraryButton.classList.add(ICON_BUTTON_CLASS);
            newLibraryButton.appendChild(createLibraryIcon());
            applyButtonStyle(newLibraryButton, addFilesButton, true);
            newLibraryButton.onclick = () => originalLibraryButton.click(); 
            const insertAfterTools = currentToolsButton || addFilesButton;
            parentNode.insertBefore(newLibraryButton, insertAfterTools.nextSibling);
            currentLibraryButton = newLibraryButton; 
        }
    } else if (!parentNode.contains(currentLibraryButton)){
        const insertAfterTools = currentToolsButton || addFilesButton;
        parentNode.insertBefore(currentLibraryButton, insertAfterTools.nextSibling);
    }
    if (currentLibraryButton && !libraryButtonRef) libraryButtonRef = currentLibraryButton;

    // --- 3. Assurer l'existence du bouton Prompt { } (insérer APRÈS Bibliothèque ou Outils ou AddFiles) ---
    let currentPromptButton = document.getElementById(PROMPT_BUTTON_ID) as HTMLButtonElement | null;
    if (!currentPromptButton) {
        const newPromptButton = document.createElement('button');
        newPromptButton.id = PROMPT_BUTTON_ID;
        newPromptButton.type = 'button'; 
        newPromptButton.innerHTML = '{ }';
        newPromptButton.title = 'Gérer les prompts'; 
        applyButtonStyle(newPromptButton, addFilesButton, false);
        newPromptButton.addEventListener('click', (event) => { event.stopPropagation(); showPromptPopover(newPromptButton); });
        const insertAfterLib = currentLibraryButton || currentToolsButton || addFilesButton;
        parentNode.insertBefore(newPromptButton, insertAfterLib.nextSibling);
        currentPromptButton = newPromptButton; 
    } else if(!parentNode.contains(currentPromptButton)){
         const insertAfterLib = currentLibraryButton || currentToolsButton || addFilesButton;
         parentNode.insertBefore(currentPromptButton, insertAfterLib.nextSibling);
    }
    if (currentPromptButton && !promptButtonRef) promptButtonRef = currentPromptButton;
    
    document.querySelectorAll<HTMLElement>(`${LIBRARY_BUTTON_SELECTOR}:not(.${REPLACED_BUTTON_MARKER_CLASS}), ${TOOLS_BUTTON_SELECTOR}:not(.${REPLACED_BUTTON_MARKER_CLASS})`).forEach(btn => {
        if (!btn.classList.contains(REPLACED_BUTTON_MARKER_CLASS)) {
            btn.classList.add(REPLACED_BUTTON_MARKER_CLASS);
            btn.style.display = 'none';
        }
    });

  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

// **Important**: Renommer l'exportation ou la fonction appelée dans mistral.ts si nécessaire.
// Par exemple, si mistral.ts appelle `injectPromptButton`, il faut maintenant qu'il appelle `injectAndReplaceButtons`. 