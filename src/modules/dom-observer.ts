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
  try {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        console.log("Message reçu dans le script de contenu:", message);
        
    if (message.action === "getConversationInfo") {
          try {
      const conversationId = getCurrentConversationId();
      const title = getConversationTitle();
      
      sendResponse({
        id: conversationId,
        title: title,
              url: window.location.href,
              success: true
            });
          } catch (error) {
            console.error("Erreur lors de la récupération des informations de conversation:", error);
            sendResponse({
              error: "Erreur lors de la récupération des informations de conversation",
              errorDetails: error.message,
              success: false
      });
          }
      
      return true;
    } else if (message.action === "refreshFolders") {
          try {
            renderFolders().then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              console.error("Erreur lors du rafraîchissement des dossiers:", error);
              sendResponse({ 
                success: false, 
                error: "Erreur lors du rafraîchissement des dossiers",
                errorDetails: error.message
              });
            });
          } catch (error) {
            console.error("Erreur lors du rafraîchissement des dossiers:", error);
            sendResponse({ 
              success: false, 
              error: "Erreur lors du rafraîchissement des dossiers",
              errorDetails: error.message
            });
          }
          
          return true;
        } else if (message.action === "getTheme") {
          // Récupérer le thème actuel
          try {
            const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark' || 
                               document.documentElement.classList.contains('dark') || 
                               document.body.classList.contains('dark');
            
            sendResponse({ 
              success: true, 
              isDarkMode: isDarkTheme,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error("Erreur lors de la récupération du thème:", error);
            sendResponse({ 
              success: false, 
              error: "Erreur lors de la récupération du thème",
              errorDetails: error.message
            });
          }
          
          return true;
        } else if (message.action === "themeChanged") {
          // Le popup nous informe d'un changement de thème
          try {
            console.log("Notification de changement de thème reçue:", message.isDarkMode ? "Sombre" : "Clair");
            sendResponse({ success: true, received: true });
          } catch (error) {
            console.error("Erreur lors du traitement du changement de thème:", error);
            sendResponse({ 
              success: false, 
              error: "Erreur lors du traitement du changement de thème",
              errorDetails: error.message
            });
          }
          
          return true;
        } else if (message.action === "ping") {
          // Message simple pour vérifier la connexion
          sendResponse({ success: true, message: "pong" });
          return true;
        }
        
        // Message non géré
        sendResponse({ success: false, error: "Message non géré" });
        return true;
      } catch (error) {
        console.error("Erreur lors du traitement du message:", error);
        sendResponse({ 
          success: false, 
          error: "Erreur lors du traitement du message",
          errorDetails: error.message
        });
      return true;
    }
  });
    
    // Informer le background script que le listener est prêt
    try {
      chrome.runtime.sendMessage({ 
        action: "contentScriptReady", 
        url: window.location.href
      }).catch(error => {
        // Ignorer les erreurs silencieusement - le background script pourrait ne pas être prêt
        console.log("Note: Le background script n'est peut-être pas encore prêt");
      });
    } catch (error) {
      // Ignorer les erreurs silencieusement
      console.log("Note: Impossible de notifier le background script");
    }
  
  console.log("Écouteur de messages de l'extension configuré avec succès");
  } catch (error) {
    console.error("Erreur lors de la configuration de l'écouteur de messages:", error);
  }
} 