import { Storage } from "@plasmohq/storage"

// Initialisation du stockage
let storageInstance: Storage | null = null

/**
 * Obtenir l'instance du stockage (Singleton)
 * @returns Instance du stockage
 */
export function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = new Storage()
  }
  return storageInstance
}

/**
 * Récupérer une valeur du stockage
 * @param key Clé de la valeur à récupérer
 * @returns Valeur stockée ou null si non trouvée
 */
export async function getValue<T>(key: string): Promise<T | null> {
  try {
    const storage = getStorage()
    const value = await storage.get<T>(key)
    return value || null
  } catch (error) {
    console.error(`Erreur lors de la récupération de ${key}:`, error)
    return null
  }
}

/**
 * Sauvegarder une valeur dans le stockage
 * @param key Clé de la valeur à sauvegarder
 * @param value Valeur à sauvegarder
 * @returns Booléen indiquant si l'opération a réussi
 */
export async function setValue<T>(key: string, value: T): Promise<boolean> {
  try {
    const storage = getStorage()
    await storage.set(key, value)
    return true
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde de ${key}:`, error)
    return false
  }
}

/**
 * Supprimer une valeur du stockage
 * @param key Clé de la valeur à supprimer
 * @returns Booléen indiquant si l'opération a réussi
 */
export async function removeValue(key: string): Promise<boolean> {
  try {
    const storage = getStorage()
    await storage.remove(key)
    return true
  } catch (error) {
    console.error(`Erreur lors de la suppression de ${key}:`, error)
    return false
  }
}

/**
 * Fonction pour synchroniser les données entre chrome.storage.local et @plasmohq/storage
 * Utile pour assurer la compatibilité entre le content script et le popup
 * @param key Clé à synchroniser
 */
export async function syncWithChromeStorage<T>(key: string): Promise<T | null> {
  try {
    // D'abord, essayer de récupérer depuis @plasmohq/storage
    const value = await getValue<T>(key)
    
    if (value) {
      // Si trouvé, synchroniser avec chrome.storage.local
      await chrome.storage.local.set({ [key]: value })
      return value
    }
    
    // Si non trouvé, essayer de récupérer depuis chrome.storage.local
    const chromeResult = await chrome.storage.local.get(key)
    if (chromeResult[key]) {
      // Si trouvé, synchroniser avec @plasmohq/storage
      await setValue(key, chromeResult[key])
      return chromeResult[key]
    }
    
    return null
  } catch (error) {
    console.error(`Erreur lors de la synchronisation de ${key}:`, error)
    return null
  }
}

/**
 * Initialise le service de stockage
 */
export function setupStorage(): void {
  console.log("Initialisation du service de stockage")
  getStorage() // Initialise le singleton
} 