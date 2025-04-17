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

function IndexPopup() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [totalConversations, setTotalConversations] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [theme, setTheme] = useState<ThemeColors>(lightTheme)

  // Basculer manuellement entre les thèmes clair et sombre
  const toggleTheme = async () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    setTheme(newDarkMode ? darkTheme : lightTheme)
    // Sauvegarder la préférence de thème et marquer comme choix explicite de l'utilisateur
    await chrome.storage.local.set({ prefersDarkMode: newDarkMode })
    await chrome.storage.local.set({ userExplicitlySetTheme: true })
    console.log("🔀 Utilisateur a basculé manuellement vers le thème:", newDarkMode ? "Sombre" : "Clair");
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
    setTimeout(() => {
      console.log("🔍 Demande du thème actuel au script de contenu...");
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]?.id && tabs[0]?.url?.includes("chat.mistral.ai")) {
          try {
            chrome.tabs.sendMessage(
              tabs[0].id, 
              {action: "getTheme", timestamp: Date.now()}, 
              response => {
                if (chrome.runtime.lastError) {
                  console.error("❌ Erreur de communication:", chrome.runtime.lastError.message);
                } else if (response && response.success) {
                  console.log("✅ Réponse reçue du script de contenu:", response);
                }
              }
            );
          } catch (error) {
            console.error("❌ Exception lors de l'envoi du message:", error);
          }
        } else {
          console.log("⚠️ Aucun onglet Mistral actif trouvé");
        }
      });
    }, 500);
    
    // Nettoyer les écouteurs lors du démontage du composant
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [])

  // Fonction pour rafraîchir les dossiers en communiquant avec le content script
  const refreshFolders = async () => {
    try {
      console.log("🔄 Rafraîchissement des dossiers...");
      
      // D'abord, essayer de communiquer avec le content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]?.id && tabs[0]?.url?.includes("chat.mistral.ai")) {
          console.log("📡 Envoi de la demande de rafraîchissement au content script...");
          
          chrome.tabs.sendMessage(
            tabs[0].id, 
            {action: "refreshFolders", timestamp: Date.now()}, 
            response => {
              if (chrome.runtime.lastError) {
                console.error("❌ Erreur de communication avec le content script:", chrome.runtime.lastError);
                // Fallback: charger directement depuis le stockage
                loadFoldersFromStorage();
              } else {
                console.log("✅ Content script a rafraîchi les dossiers, chargement depuis le stockage...");
                // Même si le content script répond correctement, on doit quand même charger les dossiers depuis le stockage
                loadFoldersFromStorage();
              }
            }
          );
        } else {
          console.log("⚠️ Aucun onglet Mistral actif, chargement direct depuis le stockage...");
          loadFoldersFromStorage();
        }
      });
    } catch (error) {
      console.error("❌ Erreur lors du rafraîchissement des dossiers:", error);
      loadFoldersFromStorage(); // Fallback
    }
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
  
  // Fonction auxiliaire pour mettre à jour le compteur de conversations
  const updateTotalConversations = (folders: Folder[]) => {
    let total = 0;
    for (const folder of folders) {
      total += folder.conversationCount;
    }
    setTotalConversations(total);
  };

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
          color: theme.text
        }}>
          Statistiques
        </h3>
        <div style={{ fontSize: "10px", lineHeight: "1.4", color: theme.text }}>
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
        // Demander le thème actuel au script de contenu
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]?.id && tabs[0]?.url?.includes("chat.mistral.ai")) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "getTheme", timestamp: Date.now()});
          }
        });
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
      
      <h2 style={{ 
        textAlign: "center",
        color: isDarkMode ? theme.proColor : `${theme.proColor}bb`,
        display: "inline-block",
        width: "100%",
        fontSize: "22px",
        fontWeight: "bold",
        marginTop: "6px",
        marginBottom: "12px"
      }}>
        Le Chat+
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
            <h3 style={{ margin: 0, fontSize: "13px", color: theme.text }}>Mes dossiers</h3>
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
              marginBottom: "12px"
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
                    <span style={{ fontWeight: "bold", color: theme.text, fontSize: "10px" }}>
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