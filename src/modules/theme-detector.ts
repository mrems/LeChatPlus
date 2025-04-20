import { Storage } from "@plasmohq/storage"

// Initialisation du stockage pour notre module
const storage = new Storage()

/**
 * Détecte le thème actuel de la page Mistral et le sauvegarde
 * @returns Promise<boolean> indiquant si le thème sombre est actif
 */
export async function detectAndSaveTheme(): Promise<boolean> {
  try {
    // Vérifier si le thème sombre est appliqué en inspectant les couleurs CSS
    let isDarkMode = false;
    
    // Vérifier l'attribut data-theme si présent
    const htmlElement = document.documentElement;
    if (htmlElement.getAttribute('data-theme') === 'dark') {
      isDarkMode = true;
    } else {
      // Sinon, tester la couleur de fond ou de texte
      const bodyStyle = window.getComputedStyle(document.body);
      const backgroundColor = bodyStyle.backgroundColor;
      
      // Si la couleur de fond est foncée (RGB < 50), considérer comme thème sombre
      if (backgroundColor) {
        const rgb = backgroundColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const [r, g, b] = rgb.map(Number);
          // Si la luminosité est faible, c'est un thème sombre
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          isDarkMode = brightness < 125;
        }
      }
    }
    
    // Stocker le résultat dans chrome.storage.local
    chrome.storage.local.set({ "pageIsDarkMode": isDarkMode }, () => {
      if (chrome.runtime.lastError) {
        console.error("Erreur lors de la sauvegarde du thème:", chrome.runtime.lastError);
      } else {
        console.log("Le Chat+: Thème détecté et sauvegardé dans chrome.storage.local:", isDarkMode ? "Sombre" : "Clair");
      }
    });
    
    // Envoyer directement un message au popup
    chrome.runtime.sendMessage({
      action: "themeChanged",
      isDarkMode: isDarkMode
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Ignorer l'erreur si le popup n'est pas ouvert
        console.log("Le Chat+: Message de thème envoyé, mais aucun destinataire (normal si popup fermé)");
      } else if (response) {
        console.log("Le Chat+: Message de thème reçu par le popup:", response);
      }
    });
    
    return isDarkMode;
  } catch (error) {
    console.error("Erreur lors de la détection du thème:", error);
    return false;
  }
}

/**
 * Configure l'observateur de changement de thème
 */
export function setupThemeObserver(): void {
  // Observer les changements de thème sur la page
  const themeObserver = new MutationObserver((mutations) => {
    // Vérifier si c'est un changement qui pourrait affecter le thème
    for (const mutation of mutations) {
      if (
        mutation.type === 'attributes' && 
        (mutation.attributeName === 'data-theme' || mutation.attributeName === 'class')
      ) {
        // Attendre un court délai pour que les styles soient appliqués
        setTimeout(detectAndSaveTheme, 300);
        break;
      }
    }
  });

  // Observer les attributs HTML et les changements de classe qui pourraient indiquer un changement de thème
  themeObserver.observe(document.documentElement, { 
    attributes: true,
    attributeFilter: ['data-theme', 'class'] 
  });
}

/**
 * Initialise la détection de thème et configure les écouteurs de messages
 */
export function initThemeDetector(): void {
  // Détecter le thème au chargement initial
  setTimeout(detectAndSaveTheme, 1000);
  
  // Configurer l'observateur de thème
  setupThemeObserver();
  
  // Ajouter l'écouteur de messages pour les demandes liées au thème
  // Note: cette fonction ne gère que les messages liés au thème
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getTheme") {
      // Détecter et envoyer le thème actuel
      detectAndSaveTheme().then(isDarkMode => {
        console.log("Le Chat+: Envoi du thème actuel au popup:", isDarkMode ? "Sombre" : "Clair");
        sendResponse({
          action: "themeInfo",
          isDarkMode: isDarkMode,
          success: true
        });
      }).catch(error => {
        console.error("Le Chat+: Erreur lors de la détection du thème:", error);
        sendResponse({
          action: "themeInfo", 
          error: "Erreur de détection",
          success: false
        });
      });
      
      // Garder le canal de communication ouvert pour la réponse asynchrone
      return true;
    }
    
    // Laisser les autres messages être traités par d'autres écouteurs
    return false;
  });
} 