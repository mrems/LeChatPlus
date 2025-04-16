import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"

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

// Initialisation du stockage
const storage = new Storage()

function IndexPopup() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [totalConversations, setTotalConversations] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFolderControls, setShowFolderControls] = useState(false)
  const [folderName, setFolderName] = useState("")

  // Charger les données au démarrage
  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les dossiers
        const storedFolders = await storage.get<Folder[]>("folders") || []
        setFolders(storedFolders)
        
        // Calculer le nombre total de conversations classées
        let total = 0
        for (const folder of storedFolders) {
          total += folder.conversationCount
        }
        setTotalConversations(total)
        
        setLoading(false)
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error)
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  // Créer un nouveau dossier
  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    
    try {
      const newFolder: Folder = {
        id: crypto.randomUUID(),
        name: folderName,
        createdAt: Date.now(),
        conversationCount: 0
      }
      
      const updatedFolders = [...folders, newFolder]
      await storage.set("folders", updatedFolders)
      setFolders(updatedFolders)
      setFolderName("")
      setShowFolderControls(false)
      
      // Communiquer avec le script de contenu pour rafraîchir les dossiers
      refreshContentScript()
    } catch (error) {
      console.error("Erreur lors de la création du dossier:", error)
    }
  }

  // Fonction pour communiquer avec le script de contenu
  const refreshContentScript = () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]?.id && tabs[0]?.url?.includes("chat.mistral.ai")) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "refreshFolders"})
      }
    })
  }

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
        padding: "15px", 
        borderRadius: "8px",
        marginBottom: "15px"
      }}>
        <h3 style={{ 
          margin: "0 0 10px 0", 
          fontSize: "14px",
          color: "#ff5500"
        }}>
          Statistiques
        </h3>
        <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
          <div>Nombre de dossiers: <strong>{folders.length}</strong></div>
          <div>Conversations classées: <strong>{totalConversations}</strong></div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: "5px 10px",
        fontFamily: "Arial, sans-serif",
        width: 300,
        backgroundColor: "#f9f9f9",
        borderRadius: 8
      }}>
      <h2 style={{ 
        textAlign: "center",
        background: "linear-gradient(to bottom, #ffdd00, #ff5500)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        display: "inline-block",
        width: "100%",
        fontSize: "28px",
        fontWeight: "bold",
        marginTop: "8px",
        marginBottom: "16px"
      }}>
        Le Chat+
      </h2>
      
      {loading ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          Chargement...
        </div>
      ) : (
        <>
          {renderStats()}
          
          <div style={{ marginBottom: "15px" }}>
            <button 
              style={{ 
                width: "100%", 
                background: "linear-gradient(to bottom, #ffdd00, #ff5500)",
                color: "white",
                border: "none",
                padding: "10px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                marginBottom: "10px"
              }}
              onClick={goToMistral}
            >
              Ouvrir Mistral AI Chat
            </button>
            
            {!showFolderControls ? (
              <button 
                style={{ 
                  width: "100%", 
                  background: "none",
                  border: "1px solid #ff5500",
                  color: "#ff5500",
                  padding: "8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
                onClick={goToMistralPro}
              >
                Passer à Le Chat Pro
              </button>
            ) : (
              <div style={{ 
                border: "1px solid rgba(255, 85, 0, 0.3)",
                borderRadius: "4px",
                padding: "10px",
                backgroundColor: "white"
              }}>
                <input 
                  style={{ 
                    width: "100%", 
                    padding: "8px", 
                    marginBottom: "8px", 
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    boxSizing: "border-box"
                  }}
                  placeholder="Nom du dossier"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    style={{ 
                      flex: 1,
                      background: "linear-gradient(to bottom, #ffdd00, #ff5500)",
                      color: "white",
                      border: "none",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                    onClick={handleCreateFolder}
                  >
                    Créer
                  </button>
                  <button 
                    style={{ 
                      flex: 1,
                      background: "none",
                      border: "1px solid #ccc",
                      color: "#666",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                    onClick={() => {
                      setShowFolderControls(false)
                      setFolderName("")
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div style={{ borderTop: "1px solid #eee", paddingTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ 
                fontSize: "14px", 
                color: "#333", 
                margin: "0"
              }}>
                Mes dossiers
              </h3>
              <button 
                onClick={refreshContentScript} 
                title="Rafraîchir les dossiers dans la page Mistral AI"
                style={{
                  background: "none",
                  border: "none",
                  color: "#ff5500",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "2px 5px"
                }}
              >
                ↺ Rafraîchir
              </button>
            </div>
            
            {folders.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>
                Aucun dossier créé. Créez des dossiers pour organiser vos conversations Mistral AI.
              </p>
            ) : (
              <div style={{ 
                maxHeight: "150px", 
                overflowY: "auto",
                fontSize: "13px"
              }}>
                {folders.map(folder => (
                  <div 
                    key={folder.id}
                    style={{ 
                      padding: "6px 8px",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold" }}>{folder.name}</div>
                      <div style={{ fontSize: "11px", color: "#888" }}>
                        {folder.conversationCount} conversation{folder.conversationCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ marginTop: "30px", fontSize: "8px", textAlign: "center", color: "#888" }}>
            <p>
              Le Chat+ est une extension pour améliorer votre expérience avec Mistral AI.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default IndexPopup
