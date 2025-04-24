/**
 * Le Chat+ : Extension pour améliorer l'interface de Mistral
 * Service worker en arrière-plan
 */

// Fonction d'initialisation du service worker
function initBackgroundService() {
  console.log("Service worker Le Chat+ démarré");
  
  // Écouter les messages de l'extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message reçu dans le service worker:", message);
    
    // Traiter les différents types de messages
    if (message.type === "GET_THEME") {
      chrome.storage.local.get(['theme'], (result) => {
        sendResponse({ theme: result.theme || 'auto' });
      });
      return true; // Indique que sendResponse sera appelé de manière asynchrone
    }
    
    // Gérer les communications entre popup et content script
    if (message.action === "relayToContentScript" || message.action === "relayToPopup") {
      handleMessageRelay(message, sender, sendResponse);
      return true; // Garder le canal de communication ouvert pour la réponse asynchrone
    }
    
    // Répondre par défaut
    sendResponse({ status: "ok" });
  });
  
  // Écouter les erreurs de connexion et les gérer proprement
  chrome.runtime.onConnect.addListener((port) => {
    console.log("Nouvelle connexion établie:", port.name);
    
    port.onDisconnect.addListener(() => {
      console.log("Connexion fermée:", port.name);
      if (chrome.runtime.lastError) {
        console.warn("Erreur de connexion:", chrome.runtime.lastError.message);
      }
    });
  });
}

/**
 * Gère le relais des messages entre les différentes parties de l'extension
 * en gérant les erreurs de communication
 */
function handleMessageRelay(message, sender, sendResponse) {
  const originalMessage = message.originalMessage || message;
  const target = message.action === "relayToContentScript" ? "content" : "popup";
  
  // Fonction pour gérer les erreurs de communication
  const handleError = () => {
    if (chrome.runtime.lastError) {
      console.warn(`Erreur lors de l'envoi du message au ${target}:`, chrome.runtime.lastError.message);
      // Répondre à l'expéditeur avec une erreur
      sendResponse({ error: chrome.runtime.lastError.message, success: false });
    }
  };
  
  if (target === "content") {
    // Relayer le message au script de contenu actif
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.warn("Aucun onglet actif trouvé pour relayer le message");
        sendResponse({ error: "Aucun onglet actif", success: false });
        return;
      }
      
      try {
        chrome.tabs.sendMessage(
          tabs[0].id,
          originalMessage,
          (response) => {
            if (chrome.runtime.lastError) {
              handleError();
            } else {
              sendResponse({ response, success: true });
            }
          }
        );
      } catch (error) {
        console.error("Erreur lors du relais du message:", error);
        sendResponse({ error: error.message, success: false });
      }
    });
  } else if (target === "popup") {
    // Relayer le message au popup
    try {
      chrome.runtime.sendMessage(
        originalMessage,
        (response) => {
          if (chrome.runtime.lastError) {
            handleError();
          } else {
            sendResponse({ response, success: true });
          }
        }
      );
    } catch (error) {
      console.error("Erreur lors du relais du message au popup:", error);
      sendResponse({ error: error.message, success: false });
    }
  }
}

// Démarrer le service worker
initBackgroundService(); 