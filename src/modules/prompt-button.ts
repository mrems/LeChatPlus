/**
 * Module pour l'injection du bouton de prompt pour Le Chat+
 * Gère l'insertion d'un bouton permettant d'ajouter un modèle de prompt JSON
 */

import { ThemeChangeObserver } from './dom-observer';

/**
 * Injecte un bouton pour insérer un modèle de prompt dans le champ de texte
 */
export function injectPromptButton(): void {
  // Définir une constante pour l'opacité par défaut du bouton
  const BUTTON_DEFAULT_OPACITY = '0.5';
  const BUTTON_HOVER_OPACITY = '0.8';
  
  // Observer les mutations du DOM pour trouver le bouton d'envoi lorsqu'il apparaît
  const observer = new MutationObserver(() => {
    // Chercher le bouton d'envoi dans le DOM
    const sendButton = document.querySelector('button[type="submit"], button[aria-label*="envoyer"], button[aria-label*="send"]');
    const promptButtonExists = document.getElementById('le-chat-plus-prompt-button');
    
    // Si on a trouvé le bouton d'envoi et que notre bouton n'existe pas
    if (sendButton && !promptButtonExists) {
      // Créer notre bouton de prompt
      const promptButton = document.createElement('button');
      promptButton.id = 'le-chat-plus-prompt-button';
      promptButton.type = 'button'; // Important: type="button" pour éviter qu'il ne soumette le formulaire
      promptButton.innerHTML = '{ }';
      promptButton.title = 'Insérer un prompt';
      
      // Copier les styles du bouton d'envoi
      const sendButtonStyles = window.getComputedStyle(sendButton);
      
      // Appliquer des styles similaires à notre bouton
      promptButton.style.background = sendButtonStyles.background;
      promptButton.style.color = sendButtonStyles.color;
      promptButton.style.border = sendButtonStyles.border;
      promptButton.style.borderRadius = sendButtonStyles.borderRadius;
      promptButton.style.padding = sendButtonStyles.padding;
      promptButton.style.margin = '0 5px';
      promptButton.style.cursor = 'pointer';
      promptButton.style.display = 'flex';
      promptButton.style.alignItems = 'center';
      promptButton.style.justifyContent = 'center';
      promptButton.style.fontSize = sendButtonStyles.fontSize;
      promptButton.style.fontWeight = 'bold';
      promptButton.style.width = '32px';
      promptButton.style.height = '32px';
      promptButton.style.minWidth = '32px';
      promptButton.style.opacity = BUTTON_DEFAULT_OPACITY;
      
      // Gérer le survol avec des classes
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
      
      // Ajouter la fonctionnalité d'insertion de prompt
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
      
      // Configurer l'observateur de changement de thème
      const themeObserver = new ThemeChangeObserver((isDarkTheme) => {
        // Rechercher le bouton d'envoi pour obtenir ses styles actuels (avec le nouveau thème)
        const updateButton = document.querySelector('button[type="submit"], button[aria-label*="envoyer"], button[aria-label*="send"]');
        if (!updateButton || !promptButton) return;
        
        // Copier les styles du bouton d'envoi mis à jour
        const updatedStyles = window.getComputedStyle(updateButton);
        
        // Réappliquer les styles qui pourraient changer avec le thème
        promptButton.style.background = updatedStyles.background;
        promptButton.style.color = updatedStyles.color;
        promptButton.style.border = updatedStyles.border;
      });
      
      // Démarrer l'observateur de thème
      themeObserver.start();
    }
  });
  
  // Observer tout le document
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Vérifier périodiquement la présence du bouton
  setInterval(() => {
    const sendButton = document.querySelector('button[type="submit"], button[aria-label*="envoyer"], button[aria-label*="send"]');
    const promptButton = document.getElementById('le-chat-plus-prompt-button');
    
    if (sendButton && !promptButton) {
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
  }, 2000);
} 