/**
 * Module d'observation du DOM pour Le Chat+
 * Gère les observateurs pour détecter les changements dans la page
 */

import { renderFolders } from './ui-renderer';
import { updateActiveConversationHighlight } from './ui-renderer';
import { getCurrentConversationId } from './conversation-operations';
import { getConversationTitle } from './conversation-operations';

/**
 * Configure un observateur pour détecter les changements dans la structure du DOM
 * et réinjecter l'interface des dossiers si nécessaire
 */
export function setupDOMObserver(injectFoldersUI: () => Promise<void>): void {
  // Créer un observateur de mutations
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Si le conteneur de dossiers n'existe pas, tenter de le réinjecter
        if (!document.getElementById('le-chat-plus-folders')) {
          console.log("Réinjection de l'interface des dossiers suite à des changements dans le DOM");
          injectFoldersUI();
          break;
        }
      }
    }
  });

  // Observer tout le document pour détecter les changements
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("Observateur DOM configuré avec succès");
}

/**
 * Configure un écouteur pour les changements d'URL
 * afin de mettre à jour l'interface en conséquence
 */
export function setupURLChangeListener(): void {
  // Stocker l'URL actuelle pour détecter les changements
  let currentUrl = window.location.href;
  let currentConversationId = getCurrentConversationId();
  
  // Fonction pour vérifier si l'URL a changé et mettre à jour si nécessaire
  const checkURLChange = () => {
    const newUrl = window.location.href;
    const newConversationId = getCurrentConversationId();
    
    if (newUrl !== currentUrl || newConversationId !== currentConversationId) {
      console.log("Changement d'URL ou de conversation détecté, mise à jour des dossiers...");
      currentUrl = newUrl;
      currentConversationId = newConversationId;
      
      // Mettre à jour l'état actif des conversations dans les dossiers
      updateActiveConversationHighlight();
    }
  };
  
  // Vérifier périodiquement les changements d'URL
  setInterval(checkURLChange, 500);
  
  // Écouter aussi les événements de navigation
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      checkURLChange();
    }, 100);
  });
  
  // Intercepter les clics sur les liens de conversation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const conversationLink = target.closest('a[href^="/chat/"]');
    
    if (conversationLink) {
      // Attendre un peu que la navigation se produise
      setTimeout(() => {
        checkURLChange();
      }, 100);
    }
  });
  
  console.log("Écouteur de changements d'URL configuré avec succès");
}

/**
 * Classe d'observateur pour détecter les changements de thème dans le DOM
 */
export class ThemeChangeObserver {
  private themeObserver: MutationObserver;
  private styleObserver: MutationObserver;
  private callback: (isDarkTheme: boolean) => void;
  private checkInterval: number | null = null;
  
  /**
   * Crée un nouvel observateur de changement de thème
   * @param onThemeChange Fonction à appeler lorsque le thème change
   */
  constructor(onThemeChange: (isDarkTheme: boolean) => void) {
    this.callback = onThemeChange;
    
    // Créer l'observateur pour les changements d'attributs
    this.themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Si un changement d'attribut de classe ou de thème est détecté
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'class' || 
             mutation.attributeName === 'data-theme' || 
             mutation.attributeName === 'theme')) {
          this.detectThemeChange();
        }
      }
    });
    
    // Créer l'observateur pour les changements de style
    this.styleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLStyleElement || node instanceof HTMLLinkElement) {
              // Un nouveau style a été ajouté, vérifier si cela affecte le thème
              setTimeout(() => this.detectThemeChange(), 100);
              break;
            }
          }
        }
      }
    });
  }
  
  /**
   * Démarre l'observation des changements de thème
   */
  public start(): void {
    // Observer les changements sur html et body
    this.observeElement(document.documentElement);
    this.observeElement(document.body);
    
    // Observer les changements de style dans le head
    if (document.head) {
      this.styleObserver.observe(document.head, { childList: true });
    }
    
    // Vérifier aussi périodiquement (backup)
    this.checkInterval = window.setInterval(() => this.detectThemeChange(), 2000);
    
    // Vérifier immédiatement
    this.detectThemeChange();
    
    console.log("Observateur de thème démarré");
  }
  
  /**
   * Arrête l'observation des changements de thème
   */
  public stop(): void {
    this.themeObserver.disconnect();
    this.styleObserver.disconnect();
    
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    console.log("Observateur de thème arrêté");
  }
  
  /**
   * Configure l'observation sur un élément spécifique
   */
  private observeElement(element: Element): void {
    if (element) {
      this.themeObserver.observe(element, { 
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'theme']
      });
    }
  }
  
  /**
   * Détecte le thème actuel et notifie la callback si un changement est détecté
   */
  private detectThemeChange(): void {
    const isDarkTheme = this.isCurrentlyDarkTheme();
    this.callback(isDarkTheme);
  }
  
  /**
   * Détermine si le thème actuel est sombre
   */
  private isCurrentlyDarkTheme(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark' || 
           document.documentElement.classList.contains('dark') || 
           document.body.classList.contains('dark');
  }
}

/**
 * Écouteur pour les messages de l'extension
 */
export function setupExtensionMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getConversationInfo") {
      const conversationId = getCurrentConversationId();
      const title = getConversationTitle();
      
      sendResponse({
        id: conversationId,
        title: title,
        url: window.location.href
      });
      
      return true;
    } else if (message.action === "refreshFolders") {
      renderFolders();
      return true;
    }
  });
  
  console.log("Écouteur de messages de l'extension configuré avec succès");
} 