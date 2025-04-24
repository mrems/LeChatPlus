/**
 * Module d'interception des erreurs pour Le Chat+
 * Corrige les problèmes connus dans le code de Mistral
 */

// Étendre l'interface Window pour inclure notre fonction de correction
declare global {
  interface Window {
    __CHAT_PLUS_FIX_STYLE_ERROR__: (element: any, styleProperty: string, value: string) => void;
    __CHAT_PLUS_CONTEXT_VALID__: boolean;
  }
}

/**
 * Intercepte et corrige les erreurs "Cannot read properties of null (reading 'style')"
 * dans le code de Mistral
 */
export function setupErrorInterceptor(): void {
  // S'assurer que window existe (environnement navigateur)
  if (typeof window === 'undefined') return;

  // Définir une variable globale pour suivre la validité du contexte
  window.__CHAT_PLUS_CONTEXT_VALID__ = true;

  console.log("Le Chat+: Installation de l'intercepteur d'erreurs...");
  
  // Intercepter les erreurs non gérées
  window.addEventListener('error', (event) => {
    // Vérifier si c'est l'erreur que nous ciblons (style)
    if (event.error && event.error.toString().includes("Cannot read properties of null (reading 'style')")) {
      console.log("Le Chat+: Erreur interceptée:", event.error);
      // Empêcher l'erreur de remonter au navigateur
      event.preventDefault();
      event.stopPropagation();
      return true; // Indiquer que l'erreur a été gérée
    }
    
    // Vérifier si c'est une erreur d'invalidation de contexte
    if (event.error && event.error.toString().includes("Extension context invalidated")) {
      window.__CHAT_PLUS_CONTEXT_VALID__ = false;
      
      // Tenter de récupérer proprement
      try {
        // Notification discrète pour l'utilisateur
        const notificationElement = document.createElement('div');
        notificationElement.style.position = 'fixed';
        notificationElement.style.bottom = '10px';
        notificationElement.style.right = '10px';
        notificationElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notificationElement.style.color = 'white';
        notificationElement.style.padding = '10px';
        notificationElement.style.borderRadius = '5px';
        notificationElement.style.zIndex = '9999';
        notificationElement.style.fontSize = '12px';
        notificationElement.textContent = "Le Chat+: Extension rechargée, actualisez la page pour restaurer les fonctionnalités.";
        
        // Ajouter un bouton pour actualiser la page
        const refreshButton = document.createElement('button');
        refreshButton.textContent = "Actualiser";
        refreshButton.style.marginLeft = '10px';
        refreshButton.style.padding = '3px 8px';
        refreshButton.style.border = 'none';
        refreshButton.style.borderRadius = '3px';
        refreshButton.style.backgroundColor = '#ff5500';
        refreshButton.style.color = 'white';
        refreshButton.style.cursor = 'pointer';
        
        refreshButton.onclick = () => {
          window.location.reload();
        };
        
        notificationElement.appendChild(refreshButton);
        document.body.appendChild(notificationElement);
        
        // Masquer la notification après 10 secondes
        setTimeout(() => {
          if (notificationElement.parentNode) {
            notificationElement.parentNode.removeChild(notificationElement);
          }
        }, 10000);
      } catch (recoveryError) {
        // Ignorer les erreurs de récupération pour éviter les boucles
      }
      
      // Empêcher l'erreur de remonter au navigateur
      event.preventDefault();
      event.stopPropagation();
      return true; // Indiquer que l'erreur a été gérée
    }
    
    return false; // Laisser les autres erreurs être traitées normalement
  }, true);
  
  // Intercepter les rejets de promesses non gérés
  window.addEventListener('unhandledrejection', (event) => {
    // Vérifier si c'est l'erreur que nous ciblons (style)
    if (event.reason && event.reason.toString().includes("Cannot read properties of null (reading 'style')")) {
      console.log("Le Chat+: Rejet de promesse intercepté:", event.reason);
      // Empêcher l'erreur de remonter au navigateur
      event.preventDefault();
      event.stopPropagation();
      return true; // Indiquer que l'erreur a été gérée
    }
    
    // Vérifier si c'est une erreur d'invalidation de contexte
    if (event.reason && (
      event.reason.toString().includes("Extension context invalidated") || 
      event.reason.toString().includes("Cannot access a chrome API in this context") ||
      event.reason.toString().includes("Extension context was invalidated")
    )) {
      window.__CHAT_PLUS_CONTEXT_VALID__ = false;
      
      // Empêcher l'erreur de remonter au navigateur
      event.preventDefault();
      event.stopPropagation();
      return true; // Indiquer que l'erreur a été gérée
    }
    
    return false; // Laisser les autres erreurs être traitées normalement
  }, true);
  
  // Implémenter notre propre gestionnaire d'erreurs global compatible avec la CSP
  installSafeErrorHandler();
}

/**
 * Installe un gestionnaire d'erreurs global compatible avec les restrictions CSP
 * en utilisant les API web standards plutôt que l'injection de script
 */
function installSafeErrorHandler(): void {
  console.log("Le Chat+: Installation du gestionnaire d'erreurs compatible CSP...");
  
  try {
    // Créer un proxy pour la méthode querySelector
    const originalQuerySelector = Element.prototype.querySelector;
    Element.prototype.querySelector = function(...args) {
      try {
        return originalQuerySelector.apply(this, args);
      } catch (error) {
        console.warn('Le Chat+: Erreur dans querySelector interceptée:', error);
        return null;
      }
    };
    
    // Créer un proxy pour window.getComputedStyle
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function(...args) {
      try {
        if (!args[0]) {
          console.warn('Le Chat+: getComputedStyle appelé avec élément null');
          // Créer un objet factice qui retourne des valeurs par défaut
          return new Proxy({}, {
            get: function(target, prop) {
              return typeof prop === 'string' ? '' : undefined;
            }
          });
        }
        return originalGetComputedStyle.apply(this, args);
      } catch (error) {
        console.warn('Le Chat+: Erreur dans getComputedStyle interceptée:', error);
        // Créer un objet factice qui retourne des valeurs par défaut
        return new Proxy({}, {
          get: function(target, prop) {
            return typeof prop === 'string' ? '' : undefined;
          }
        });
      }
    };
    
    // Intercepter les accès à Element.classList
    const originalClassListGetter = Object.getOwnPropertyDescriptor(Element.prototype, 'classList')?.get;
    if (originalClassListGetter) {
      Object.defineProperty(Element.prototype, 'classList', {
        get: function() {
          try {
            return originalClassListGetter.call(this);
          } catch (error) {
            console.warn('Le Chat+: Erreur dans l\'accès à classList interceptée:', error);
            // Retourner un objet DOMTokenList factice
            return {
              add: () => {},
              remove: () => {},
              toggle: () => false,
              contains: () => false,
              item: () => null
            };
          }
        },
        configurable: true
      });
    }
    
    // Fonction pour accéder en toute sécurité aux styles
    const safeStyleAccess = (element, styleProperty, value) => {
      try {
        if (element && element.style) {
          element.style[styleProperty] = value;
        }
      } catch (error) {
        console.warn('Le Chat+: Erreur lors de l\'accès au style:', error);
      }
    };
    
    // Ajouter une fonction globale pour corriger le problème à la demande
    window.__CHAT_PLUS_FIX_STYLE_ERROR__ = function(element, styleProperty, value) {
      safeStyleAccess(element, styleProperty, value);
    };
    
    // Créer une fonction MutationObserver pour surveiller les changements DOM
    // et intercepter les appels problématiques liés aux styles
    setupMutationObserver();
    
    console.log("Le Chat+: Gestionnaire d'erreurs compatible CSP installé avec succès");
  } catch (error) {
    console.error("Le Chat+: Erreur lors de l'installation du gestionnaire:", error);
  }
}

/**
 * Configure un observateur de mutations pour surveiller les éléments problématiques 
 * et prévenir les erreurs de style
 */
function setupMutationObserver(): void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  
  // Surveiller les éléments qui pourraient avoir des problèmes de style
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Vérifier si c'est un élément qui pourrait être impliqué dans l'erreur
            try {
              const element = node as HTMLElement;
              if (element.tagName === 'DIV' && (element.id === 'error-container' || element.classList.contains('error-container'))) {
                // Prévenir les erreurs de style en appliquant une méthode sécurisée
                const setOpacitySafely = () => {
                  try {
                    if (element.style) {
                      element.style.opacity = '1';
                      element.style.cursor = 'pointer';
                      element.style.pointerEvents = 'all';
                    }
                  } catch (error) {
                    console.warn('Le Chat+: Erreur interceptée lors de la modification du style:', error);
                  }
                };
                
                // Appliquer immédiatement et également après un court délai
                setOpacitySafely();
                setTimeout(setOpacitySafely, 100);
              }
            } catch (error) {
              // Ignorer les erreurs pour ne pas causer plus de problèmes
            }
          }
        }
      }
    }
  });
  
  // Observer tout le document
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  console.log("Le Chat+: Observateur de mutations configuré pour intercepter les erreurs de style");
}

/**
 * Surveille spécifiquement le code qui charge la fonction problématique
 * et tente de la remplacer par une version sécurisée
 */
function monitorProblematicFunction(): void {
  // Utiliser les APIs performance pour détecter le chargement de la fonction
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource' && 
              entry.name.includes('mistral') && 
              entry.name.endsWith('.js')) {
            console.log("Le Chat+: Ressource Mistral détectée:", entry.name);
            
            // Une fois la ressource chargée, installer un hook sur l'API fetch
            // pour intercepter les erreurs de style lors des requêtes réseau
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              return originalFetch.apply(this, args)
                .catch(error => {
                  if (error && error.toString().includes("Cannot read properties of null (reading 'style')")) {
                    console.log("Le Chat+: Erreur fetch interceptée:", error);
                    // Retourner une réponse vide au lieu de rejeter
                    return new Response(JSON.stringify({}), {
                      status: 200,
                      headers: { 'Content-Type': 'application/json' }
                    });
                  }
                  throw error; // Relancer les autres erreurs
                });
            };
            
            // Arrêter l'observation une fois détectée
            observer.disconnect();
          }
        }
      });
      
      // Observer les ressources chargées
      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.error("Le Chat+: Erreur lors de la configuration du PerformanceObserver:", error);
    }
  }
} 