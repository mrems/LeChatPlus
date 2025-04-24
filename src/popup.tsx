import { useEffect, useState } from "react"

// Reset CSS global
const globalStyles = `
  html, body, #__plasmo {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  * {
    box-sizing: border-box;
  }
  
  /* Styles de scrollbar globaux */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  /* Thème clair - sera surchargé par les styles spécifiques si nécessaire */
  ::-webkit-scrollbar-track {
    background: #f0f0f0;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #cccccc;
    border-radius: 4px;
    border: 1px solid #f0f0f0;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #aaaaaa;
  }
  
  /* Support de Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: #cccccc #f0f0f0;
  }
`;

// Types pour l'application
interface ConversationRef {
  id: string
  title: string
  url: string
  addedAt: number
}

interface Folder {
  id: string
  name: string
  createdAt: number
  conversationCount: number
}

// Thèmes pour l'application
interface ThemeColors {
  background: string
  cardBackground: string
  text: string
  secondaryText: string
  border: string
  primaryGradient: string
  primaryColor: string
  primaryBackground: string
  secondaryBackground: string
  hoverBackground: string
  proColor: string
}

const lightTheme: ThemeColors = {
  background: "#f9f9f9",
  cardBackground: "#ffffff",
  text: "#333333",
  secondaryText: "#666666",
  border: "#eeeeee",
  primaryGradient: "linear-gradient(to bottom, #ffdd00, #ff5500)",
  primaryColor: "#ff5500",
  primaryBackground: "linear-gradient(to bottom, #ffdd00, #ff5500)",
  secondaryBackground: "rgba(255, 85, 0, 0.05)",
  hoverBackground: "#f0f0f0",
  proColor: "#eb3a0b"
}

const darkTheme: ThemeColors = {
  background: "#121212",
  cardBackground: "#1e1e1e",
  text: "#ffffff",
  secondaryText: "#cccccc",
  border: "#444444",
  primaryGradient: "linear-gradient(to bottom, #ffdd00, #ff5500)",
  primaryColor: "#ff7733",
  primaryBackground: "linear-gradient(to bottom, #ffdd00, #ff5500)",
  secondaryBackground: "rgba(255, 85, 0, 0.15)",
  hoverBackground: "#333333",
  proColor: "#eb3a0b"
}

// Ajouter ces fonctions utilitaires pour la communication entre les composants de l'extension
// avant la fonction IndexPopup

/**
 * Envoie un message au script de contenu via le background script de manière sécurisée
 * en gérant les erreurs de communication
 */
const safelyMessagingContentScript = async (message: any): Promise<any> => {
  try {
    // Vérifier d'abord si le contexte de l'extension est valide
    if (!checkExtensionContextValidity()) {
      return { 
        success: false, 
        error: "Le contexte de l'extension est invalide. Veuillez actualiser la page." 
      };
    }
    
    // Vérifier d'abord si nous pouvons accéder directement au contenu actif
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) {
          resolve({ success: false, error: "Aucun onglet actif trouvé" });
          return;
        }
        
        const tabId = tabs[0].id;
        
        // Essayer d'envoyer le message directement
        chrome.tabs.sendMessage(
          tabId,
          { ...message, timestamp: Date.now() },
          (response) => {
            if (chrome.runtime.lastError) {
              // En cas d'erreur, essayer de relayer le message via le background script
              chrome.runtime.sendMessage(
                {
                  action: "relayToContentScript",
                  originalMessage: message,
                  tabId
                },
                (relayResponse) => {
                  if (chrome.runtime.lastError) {
                    resolve({ 
                      success: false, 
                      error: "Erreur de communication avec la page Mistral"
                    });
                  } else {
                    resolve(relayResponse || { success: false, error: "Aucune réponse reçue" });
                  }
                }
              );
            } else {
              resolve(response || { success: false, error: "Aucune réponse reçue" });
            }
          }
        );
      });
    });
  } catch (error) {
    return { success: false, error: "Erreur de communication" };
  }
};

/**
 * Vérifie si le contexte de l'extension est valide et tente de récupérer si nécessaire
 * @returns Un booléen indiquant si le contexte semble valide
 */
const checkExtensionContextValidity = (): boolean => {
  try {
    // Vérifier si on peut accéder aux API Chrome
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      // Afficher un message à l'utilisateur
      const errorMessage = document.createElement('div');
      errorMessage.style.padding = '10px';
      errorMessage.style.marginTop = '10px';
      errorMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      errorMessage.style.borderRadius = '5px';
      errorMessage.style.color = '#d32f2f';
      errorMessage.style.fontSize = '12px';
      errorMessage.style.textAlign = 'center';
      
      errorMessage.innerHTML = `
        Le contexte de l'extension a été invalidé.<br>
        <button 
          style="margin-top: 8px; padding: 5px 10px; background: #d32f2f; color: white; border: none; border-radius: 3px; cursor: pointer;"
          onclick="window.location.reload()">
          Actualiser la page
        </button>
      `;
      
      // Insérer le message dans le DOM du popup
      try {
        const root = document.getElementById('__plasmo');
        if (root) {
          root.prepend(errorMessage);
        }
      } catch (domError) {
        // Ignorer les erreurs DOM
      }
      
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

function IndexPopup() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [totalConversations, setTotalConversations] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [theme, setTheme] = useState<ThemeColors>(lightTheme)

  // Vérifier si le contexte de l'extension est valide au démarrage du composant
  const [contextValid, setContextValid] = useState<boolean>(checkExtensionContextValidity());

  // Fonction auxiliaire pour mettre à jour le compteur de conversations
  const updateTotalConversations = (folders: Folder[]) => {
    let total = 0;
    for (const folder of folders) {
      total += folder.conversationCount;
    }
    setTotalConversations(total);
  };
  
  // Fonction auxiliaire pour charger les dossiers depuis le stockage
  const loadFoldersFromStorage = async () => {
    try {
      // Essayer les deux méthodes de stockage pour maximiser les chances de succès
      
      // 1. Essayer d'abord avec @plasmohq/storage (utilisé par content.ts)
      try {
        const { Storage } = await import("@plasmohq/storage");
        const storage = new Storage();
        const storedFolders = await storage.get<Folder[]>("folders") || [] as Folder[];
        
        if (storedFolders && storedFolders.length > 0) {
          console.log("✅ Dossiers chargés depuis @plasmohq/storage:", storedFolders.length, "dossiers trouvés");
          setFolders(storedFolders);
          updateTotalConversations(storedFolders);
          return;
        }
      } catch (storageError) {
        console.log("⚠️ Erreur avec @plasmohq/storage, essai avec chrome.storage.local...", storageError);
      }
      
      // 2. Essayer ensuite avec chrome.storage.local
      const foldersResult = await chrome.storage.local.get("folders");
      const storedFolders = foldersResult.folders || [] as Folder[];
      console.log("✅ Dossiers chargés depuis chrome.storage.local:", storedFolders.length, "dossiers trouvés");
      setFolders(storedFolders);
      updateTotalConversations(storedFolders);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des dossiers:", error);
    }
  };

  // Fonction pour rafraîchir les dossiers en communiquant avec le content script
  const refreshFolders = async () => {
    setLoading(true);
    
    try {
      // Utiliser la fonction sécurisée pour communiquer avec le script de contenu
      const response = await safelyMessagingContentScript({
        action: "refreshFolders"
      });
      
      // Charger les dossiers depuis le stockage local
      await loadFoldersFromStorage();
      
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };
  
  // Fonction pour chercher et modifier les logs dans toggleTheme
  const toggleTheme = async () => {
    try {
      // Vérifier d'abord si le contexte de l'extension est valide
      if (!checkExtensionContextValidity()) {
        return;
      }
      
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    setTheme(newDarkMode ? darkTheme : lightTheme)
      
    // Sauvegarder la préférence de thème et marquer comme choix explicite de l'utilisateur
      await Promise.all([
        chrome.storage.local.set({ prefersDarkMode: newDarkMode }),
        chrome.storage.local.set({ userExplicitlySetTheme: true })
      ]);
      
      // Tenter de notifier le script de contenu du changement de thème de façon sécurisée
      try {
        // Utiliser notre fonction sécurisée pour éviter les erreurs "Receiving end does not exist"
        await safelyMessagingContentScript({
          action: "themeChanged",
          isDarkMode: newDarkMode,
          source: "popup",
          timestamp: Date.now()
        }).catch(() => {
          // Ignorer les erreurs silencieusement
        });
      } catch (error) {
        // Ignorer les erreurs de communication - le thème sera synchronisé à la prochaine ouverture
      }
    } catch (error) {
      // Assurer que l'interface reste cohérente même en cas d'erreur
      const fallbackDarkMode = !isDarkMode; // Créer une nouvelle variable locale
      setIsDarkMode(fallbackDarkMode);
      setTheme(fallbackDarkMode ? darkTheme : lightTheme);
    }
  }

  // Détecter le thème et charger les données au démarrage
  useEffect(() => {
    // Fonction pour gérer les messages reçus
    const handleMessage = (message, sender, sendResponse) => {
      if (message.action === "themeChanged" || message.action === "themeInfo") {
        console.log("🔍 Message reçu: Thème détecté:", message.isDarkMode);
        
        // Répondre au message pour confirmer la réception
        if (sendResponse) {
          sendResponse({ received: true, status: "ok" });
        }
        
        // Ne mettre à jour que si l'utilisateur n'a pas défini de préférence explicite
        chrome.storage.local.get("userExplicitlySetTheme").then(userPreference => {
          const hasExplicitPreference = userPreference.userExplicitlySetTheme === true;
          console.log("🔒 Vérification si l'utilisateur a choisi un thème explicite:", hasExplicitPreference);
          
          if (!hasExplicitPreference) {
            console.log("🔄 Mise à jour du thème avec:", message.isDarkMode ? "Sombre" : "Clair");
            setIsDarkMode(message.isDarkMode);
            setTheme(message.isDarkMode ? darkTheme : lightTheme);
          } else {
            console.log("🔄 Message ignoré car l'utilisateur a une préférence explicite");
          }
        });
      }
    };

    // Enregistrer l'écouteur de messages
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Charger les données et la préférence de thème
    const loadData = async () => {
      try {
        // Récupérer toutes les données liées au thème en une seule fois
        const themeData = await chrome.storage.local.get([
          "pageIsDarkMode", 
          "prefersDarkMode", 
          "userExplicitlySetTheme"
        ]);
        
        console.log("🔍 Données de thème récupérées:", themeData);
        
        // Vérifier si l'utilisateur a explicitement choisi un thème
        const hasExplicitPreference = themeData.userExplicitlySetTheme === true;
        console.log("🔒 Utilisateur a explicitement choisi:", hasExplicitPreference);
        
        // Déterminer le thème à utiliser
        if (hasExplicitPreference && themeData.prefersDarkMode !== undefined) {
          // 1. Utiliser la préférence explicite de l'utilisateur
          console.log("✅ Utilisation de la préférence explicite de l'utilisateur:", themeData.prefersDarkMode ? "Sombre" : "Clair");
          setIsDarkMode(themeData.prefersDarkMode);
          setTheme(themeData.prefersDarkMode ? darkTheme : lightTheme);
        } else if (themeData.pageIsDarkMode !== undefined) {
          // 2. Utiliser le thème détecté de la page Mistral
          console.log("✅ Utilisation du thème détecté de la page:", themeData.pageIsDarkMode ? "Sombre" : "Clair");
          setIsDarkMode(themeData.pageIsDarkMode);
          setTheme(themeData.pageIsDarkMode ? darkTheme : lightTheme);
        } else {
          // 3. Essayer de détecter le thème du système
          try {
            const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            console.log("✅ Utilisation du thème du système:", isDark ? "Sombre" : "Clair");
            setIsDarkMode(isDark);
            setTheme(isDark ? darkTheme : lightTheme);
          } catch (error) {
            console.error("❌ Erreur lors de la détection du thème système:", error);
            // 4. Par défaut, utiliser le thème clair
            console.log("✅ Utilisation du thème par défaut: Clair");
            setIsDarkMode(false);
            setTheme(lightTheme);
          }
        }
        
        // Charger les dossiers avec notre nouvelle fonction qui vérifie les deux stockages
        await loadFoldersFromStorage();
        
        setLoading(false);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        setLoading(false);
      }
    }
    
    loadData()
    
    // Écouter les changements dans chrome.storage.local
    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'local') {
        console.log("🔄 Changements détectés dans chrome.storage.local:", changes);
        
        // Vérifier si le thème de la page a changé
        if (changes.pageIsDarkMode) {
          console.log("🔍 Changement du thème de page détecté:", 
            changes.pageIsDarkMode.oldValue, "->", changes.pageIsDarkMode.newValue);
          
          // Mettre à jour seulement si l'utilisateur n'a pas de préférence explicite
          chrome.storage.local.get("userExplicitlySetTheme").then(result => {
            const hasExplicitPreference = result.userExplicitlySetTheme === true;
            console.log("🔒 Vérification si l'utilisateur a une préférence:", hasExplicitPreference);
            
            if (!hasExplicitPreference) {
              console.log("✅ Mise à jour du thème via storage.onChanged:", 
                changes.pageIsDarkMode.newValue ? "Sombre" : "Clair");
              setIsDarkMode(changes.pageIsDarkMode.newValue);
              setTheme(changes.pageIsDarkMode.newValue ? darkTheme : lightTheme);
            } else {
              console.log("❌ Pas de mise à jour car préférence utilisateur définie");
            }
          });
        }
      }
    };
    
    // Ajouter l'écouteur pour storage.onChanged
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // Demander le thème actuel après un délai
    setTimeout(async () => {
      try {
        const response = await safelyMessagingContentScript({
          action: "getTheme",
          timestamp: Date.now()
        });
          } catch (error) {
        // Ignorer les erreurs silencieusement
        }
    }, 500);
    
    // Nettoyer les écouteurs lors du démontage du composant
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [])

  // Ajouter cet effet useEffect après les autres effets pour surveiller la validité du contexte
  useEffect(() => {
    // Ne pas exécuter si le contexte est déjà invalide
    if (!contextValid) return;
    
    // Vérifier périodiquement si le contexte est toujours valide
    const intervalId = setInterval(() => {
      const isValid = checkExtensionContextValidity();
      
      // Si le contexte est devenu invalide, mettre à jour l'état
      if (!isValid && contextValid) {
        setContextValid(false);
        }
    }, 5000); // Vérifier toutes les 5 secondes
    
    // Nettoyer l'intervalle lors du démontage du composant
    return () => {
      clearInterval(intervalId);
    };
  }, [contextValid]); // Dépendance à contextValid

  // Naviguer vers la page Mistral AI
  const goToMistral = () => {
    chrome.tabs.create({ url: "https://chat.mistral.ai/chat" })
  }

  // Naviguer vers la page d'abonnement Pro de Mistral AI
  const goToMistralPro = () => {
    chrome.tabs.create({ url: "https://chat.mistral.ai/upgrade/plans" })
  }

  // Afficher les statistiques de l'extension
  const renderStats = () => {
    return (
      <div style={{ 
        padding: "12px",
        borderRadius: "6px",
        marginBottom: "12px",
        backgroundColor: theme.cardBackground,
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{ 
          margin: "0 0 8px 0",
          fontSize: "11px",
          color: theme.secondaryText
        }}>
          Statistiques
        </h3>
        <div style={{ fontSize: "10px", lineHeight: "1.4", color: theme.secondaryText }}>
          <div>Nombre de dossiers: <strong>{folders.length}</strong></div>
          <div>Conversations classées: <strong>{totalConversations}</strong></div>
        </div>
      </div>
    )
  }

  // Réinitialiser la préférence explicite de l'utilisateur
  const resetUserThemePreference = async () => {
    try {
      console.log("🔄 Réinitialisation de la préférence de thème utilisateur");
      await chrome.storage.local.set({ userExplicitlySetTheme: false });
      
      // Récupérer le thème actuel de la page
      const themeData = await chrome.storage.local.get("pageIsDarkMode");
      if (themeData.pageIsDarkMode !== undefined) {
        console.log("✅ Adoption du thème de la page:", themeData.pageIsDarkMode ? "Sombre" : "Clair");
        setIsDarkMode(themeData.pageIsDarkMode);
        setTheme(themeData.pageIsDarkMode ? darkTheme : lightTheme);
      } else {
        // Demander le thème actuel au script de contenu de façon sécurisée
        try {
          const response = await safelyMessagingContentScript({
            action: "getTheme"
          });
          
          if (response && response.success && response.isDarkMode !== undefined) {
            console.log("✅ Thème récupéré du content script:", response.isDarkMode ? "Sombre" : "Clair");
            setIsDarkMode(response.isDarkMode);
            setTheme(response.isDarkMode ? darkTheme : lightTheme);
          }
        } catch (error) {
          console.error("❌ Erreur lors de la récupération du thème:", error);
          }
      }
    } catch (error) {
      console.error("❌ Erreur lors de la réinitialisation de la préférence:", error);
    }
  }

  return (
    <div
      style={{
        padding: "4px 8px",
        fontFamily: "Arial, sans-serif",
        width: 240,
        backgroundColor: theme.background,
        color: theme.text,
        transition: "background-color 0.3s ease, color 0.3s ease"
      }}>
      {/* Injecter le reset CSS global */}
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      
      {/* Injecter les styles de scrollbar basés sur le thème */}
      <style dangerouslySetInnerHTML={{ __html: isDarkMode ? `
        ::-webkit-scrollbar-track {
          background: #2a2a2a !important;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #555555 !important;
          border-radius: 4px;
          border: 1px solid #2a2a2a !important;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #666666 !important;
        }
        
        * {
          scrollbar-color: #555555 #2a2a2a !important;
        }
      ` : '' }} />
      
      {/* Afficher un message d'erreur si le contexte est invalide */}
      {!contextValid && (
        <div style={{
          padding: '10px',
          margin: '10px 0',
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          borderRadius: '5px',
          color: '#d32f2f',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          <p>Le contexte de l'extension a été invalidé.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px', 
              padding: '5px 10px', 
              background: '#d32f2f', 
              color: 'white', 
              border: 'none', 
              borderRadius: '3px', 
              cursor: 'pointer'
            }}>
            Actualiser la page
          </button>
        </div>
      )}
      
      <h2 style={{ 
        textAlign: "center",
        color: isDarkMode ? theme.proColor : `${theme.proColor}bb`,
        display: "inline-block",
        width: "100%",
        fontSize: "44px",
        fontWeight: "bold",
        marginTop: "0px",
        marginBottom: "0px"
      }}>
        LeChat<span style={{ fontSize: "60px", verticalAlign: "middle", position: "relative", top: "-3px" }}>+</span>
      </h2>
      
      {/* Bouton de bascule de thème */}
      <div style={{ 
        display: "flex", 
        justifyContent: "center",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "12px"
      }}>
        <button 
          onClick={toggleTheme} 
          title={isDarkMode ? "Passer au thème clair" : "Passer au thème sombre"}
          style={{
            background: theme.cardBackground,
            color: theme.secondaryText,
            border: `1px solid ${theme.border}`,
            padding: "6px 10px",
            borderRadius: "16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            transition: "all 0.2s ease",
            marginBottom: "6px"
          }}>
          {isDarkMode ? "🌙 Thème sombre" : "☀️ Thème clair"}
        </button>
        
        <button
          onClick={resetUserThemePreference}
          title="Synchroniser avec le thème de la page"
          style={{
            background: "transparent",
            color: theme.secondaryText,
            border: "none",
            padding: "2px 5px",
            cursor: "pointer",
            fontSize: "9px",
            transition: "all 0.2s ease"
          }}>
          Synchroniser avec la page
        </button>
      </div>
      
      {renderStats()}
      
      {loading ? (
        <div style={{ textAlign: "center", padding: "16px", color: theme.secondaryText, fontSize: "10px" }}>
          Chargement...
        </div>
      ) : (
        <>
              <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center",
            marginBottom: "8px"
          }}>
            <h3 style={{ margin: 0, fontSize: "13px", color: theme.secondaryText }}>Mes dossiers</h3>
          </div>
          
          {folders.length === 0 ? (
            <div style={{ 
              padding: "16px", 
              textAlign: "center", 
              color: theme.secondaryText,
              backgroundColor: theme.cardBackground,
              borderRadius: "6px",
              marginBottom: "12px"
            }}>
              <span style={{ fontSize: "10px" }}>Aucun dossier disponible</span>
            </div>
            ) : (
              <div style={{ 
              maxHeight: "160px", 
                overflowY: "auto",
              marginBottom: "12px",
              // Styles de scrollbar de base sans les styles spécifiques de thème (ils sont gérés globalement)
              borderRadius: "4px",
              padding: "0 4px"
              }}>
                {folders.map(folder => (
                  <div 
                    key={folder.id}
                    style={{ 
                    padding: "8px",
                    backgroundColor: theme.cardBackground,
                    borderRadius: "6px",
                    marginBottom: "6px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                  }}>
                  <div style={{ 
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                  }}>
                    <span style={{ fontWeight: "normal", color: theme.secondaryText, fontSize: "10px" }}>
                      {folder.name}
                    </span>
                    <span style={{ 
                      fontSize: "9px",
                      color: theme.secondaryText
                    }}>
                      {folder.conversationCount} conv.
                    </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <button
              onClick={goToMistral}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: `1px solid ${theme.proColor}`,
                backgroundColor: theme.cardBackground,
                color: theme.proColor,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                fontSize: "10px"
              }}>
              Ouvrir Mistral
            </button>
            <button
              onClick={goToMistralPro}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: `1px solid ${theme.proColor}`,
                backgroundColor: theme.cardBackground,
                color: theme.proColor,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                fontSize: "10px"
              }}>
              Passer à Mistral Pro
            </button>
          </div>
        </>
      )}
      
      {/* Petit padding en bas pour l'esthétique */}
      <div style={{ height: "4px" }}></div>
    </div>
  )
}

export default IndexPopup