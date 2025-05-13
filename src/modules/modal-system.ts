/**
 * Module de gestion des modales pour Le Chat+
 * Fournit des fonctions permettant d'afficher différents types de modales
 */

interface ModalOptions {
  title: string;
  message?: string;
  inputPlaceholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  isDelete?: boolean;
}

/**
 * Affiche une modale personnalisée
 * @param options Options de configuration de la modale
 * @returns Promise qui résout avec la valeur saisie, true, ou null si annulé
 */
export function showModal(options: ModalOptions): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    // Détecter si le thème sombre est activé
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark' || 
                      document.documentElement.classList.contains('dark') || 
                      document.body.classList.contains('dark');
    
    // Créer les éléments du modal
    const modal = document.createElement('div');
    modal.className = 'le-chat-plus-modal';
    // Style pour l'overlay du modal (pour le centrage et le clic extérieur)
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fond semi-transparent
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '10003' // Z-index plus élevé pour être au-dessus de la modale des dossiers
    });
    
    const modalContent = document.createElement('div');
    modalContent.className = 'le-chat-plus-modal-content';
    
    let input: HTMLInputElement | null = null;
    let cancelButton: HTMLButtonElement;
    let confirmButton: HTMLButtonElement;
    
    /**
     * Applique les styles appropriés à la modale en fonction du thème
     */
    function applyModalStyles(isDark: boolean) {
      // Styles pour le contenu du modal
      if (isDark) {
        modalContent.style.backgroundColor = '#2a2a2a';
        modalContent.style.color = '#ffffff';
        modalContent.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      } else {
        modalContent.style.backgroundColor = '#ffffff';
        modalContent.style.color = '#333333';
        modalContent.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }
      
      // Styles pour l'input s'il existe
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
      
      // Styles pour les boutons
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
            confirmButton.style.backgroundColor = 'transparent';
            confirmButton.style.color = '#ff5555';
            confirmButton.style.border = '1px solid #ff5555';
          } else {
            confirmButton.style.backgroundColor = 'transparent';
            confirmButton.style.color = '#dd0000';
            confirmButton.style.border = '1px solid #dd0000';
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
        confirmButton.style.backgroundColor = 'transparent';
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
      modalContent.style.transform = 'translateY(0)';
      if (input) input.focus();
    });
  });
}

/**
 * Affiche un modal pour créer un nouveau dossier
 * @returns Promise qui résout avec le nom du dossier ou null si annulé
 */
export function showFolderCreateModal(): Promise<string | null> {
  return showModal({
    title: "Créer un nouveau dossier",
    inputPlaceholder: "Nom du dossier",
    confirmLabel: "Créer",
    cancelLabel: "Annuler"
  }) as Promise<string | null>;
}

/**
 * Affiche un modal de confirmation de suppression
 * @param itemName Nom de l'élément à supprimer
 * @param itemType Type d'élément ('dossier' ou 'conversation')
 * @returns Promise qui résout avec true si confirmé, null si annulé
 */
export function showDeleteConfirmModal(itemName: string, itemType: 'dossier' | 'conversation'): Promise<boolean | null> {
  return showModal({
    title: `Supprimer ${itemType === 'dossier' ? 'le dossier' : 'la conversation'}`,
    message: `Voulez-vous vraiment supprimer ${itemType === 'dossier' ? 'le dossier' : 'la conversation'} "${itemName}" ?`,
    confirmLabel: 'Supprimer',
    cancelLabel: 'Annuler',
    isDelete: true
  }) as Promise<boolean | null>;
}

/**
 * Affiche un modal de renommage
 * @param currentName Nom actuel de l'élément
 * @param itemType Type d'élément ('dossier' ou 'conversation')
 * @returns Promise qui résout avec le nouveau nom ou null si annulé
 */
export function showRenameModal(currentName: string, itemType: 'dossier' | 'conversation'): Promise<string | null> {
  return showModal({
    title: `Renommer ${itemType === 'dossier' ? 'le dossier' : 'la conversation'}`,
    inputPlaceholder: "Nouveau nom",
    confirmLabel: "Renommer",
    cancelLabel: "Annuler"
  }) as Promise<string | null>;
} 