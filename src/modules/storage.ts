/**
 * Module pour gérer le stockage des prompts personnalisés pour Le Chat+
 * Utilise chrome.storage.local pour la persistance des données.
 */

// Définir une interface pour la structure d'un prompt sauvegardé
export interface SavedPrompt {
  id: string;       // Identifiant unique (timestamp ou UUID)
  title: string;    // Titre donné par l'utilisateur
  content: string;  // Le contenu du prompt
}

// Clé utilisée dans chrome.storage.local
const STORAGE_KEY = 'leChatPlus_savedPrompts';

/**
 * Récupère tous les prompts sauvegardés.
 * @returns Promise<SavedPrompt[]> Une promesse résolue avec la liste des prompts.
 */
export async function getPrompts(): Promise<SavedPrompt[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    // Retourne la liste des prompts ou un tableau vide si rien n'est trouvé
    return result[STORAGE_KEY] || [];
  } catch (error) {
    console.error("Le Chat+ Error getting prompts:", error);
    return []; // Retourner un tableau vide en cas d'erreur
  }
}

/**
 * Sauvegarde un nouveau prompt ou met à jour un prompt existant (basé sur l'ID).
 * @param prompt Le prompt à sauvegarder ou mettre à jour.
 * @returns Promise<void>
 */
export async function savePrompt(prompt: SavedPrompt): Promise<void> {
  try {
    const prompts = await getPrompts();
    const existingIndex = prompts.findIndex(p => p.id === prompt.id);
    
    if (existingIndex > -1) {
      // Mettre à jour le prompt existant
      prompts[existingIndex] = prompt;
    } else {
      // Ajouter le nouveau prompt (on pourrait vouloir le mettre au début)
      prompts.unshift(prompt); // Ajoute au début de la liste
    }
    
    await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
    console.log("Le Chat+ Prompt saved:", prompt.title);
  } catch (error) {
    console.error("Le Chat+ Error saving prompt:", error);
  }
}

/**
 * Supprime un prompt basé sur son ID.
 * @param promptId L'ID du prompt à supprimer.
 * @returns Promise<void>
 */
export async function deletePrompt(promptId: string): Promise<void> {
  try {
    let prompts = await getPrompts();
    prompts = prompts.filter(p => p.id !== promptId);
    await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
    console.log("Le Chat+ Prompt deleted:", promptId);
  } catch (error) {
    console.error("Le Chat+ Error deleting prompt:", error);
  }
}

/**
 * Génère un ID unique simple basé sur le timestamp.
 * @returns string Un ID unique.
 */
export function generatePromptId(): string {
  return `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
} 