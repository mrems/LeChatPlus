import type { Folder } from './types'
import { getValue, setValue, removeValue } from './storage-manager'

/**
 * Créer un nouveau dossier
 * @param name Nom du dossier à créer
 * @returns Promise<void>
 */
export async function createFolder(name: string): Promise<void> {
  const folders = await getFolders();
  
  const newFolder: Folder = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    conversationCount: 0,
    expanded: false
  };
  
  folders.push(newFolder);
  await setValue('folders', folders);
}

/**
 * Obtenir tous les dossiers
 * @returns Promise<Folder[]>
 */
export async function getFolders(): Promise<Folder[]> {
  const folders = await getValue<Folder[]>('folders');
  return folders || [];
}

/**
 * Supprimer un dossier
 * @param folderId ID du dossier à supprimer
 * @returns Promise<void>
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const folders = await getFolders();
  const updatedFolders = folders.filter(f => f.id !== folderId);
  await setValue('folders', updatedFolders);
  await removeValue(`folder_conversations_${folderId}`);
}

/**
 * Basculer l'état plié/déplié d'un dossier
 * @param folderId ID du dossier à basculer
 * @returns Promise<void>
 */
export async function toggleFolderExpand(folderId: string): Promise<void> {
  console.log("Tentative de basculement du dossier:", folderId);
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) {
    console.log("Dossier non trouvé");
    return;
  }
  
  // Inverser l'état de développement du dossier
  folders[folderIndex].expanded = !folders[folderIndex].expanded;
  console.log(`Dossier ${folderId} état changé à: ${folders[folderIndex].expanded ? 'développé' : 'plié'}`);
  
  // Sauvegarder la modification
  await setValue('folders', folders);
  
  // Note: La mise à jour visuelle sera gérée par ui-renderer.ts
}

/**
 * Renommer un dossier
 * @param folderId ID du dossier à renommer
 * @param newName Nouveau nom du dossier
 * @returns Promise<void>
 */
export async function renameFolder(folderId: string, newName: string): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  
  if (folderIndex !== -1) {
    folders[folderIndex].name = newName;
    await setValue('folders', folders);
  }
}

/**
 * Fermer tous les dossiers
 * @returns Promise<void>
 */
export async function collapseAllFolders(): Promise<void> {
  const folders = await getFolders();
  
  // Mettre à jour tous les dossiers pour les fermer
  const updatedFolders = folders.map(folder => ({
    ...folder,
    expanded: false
  }));
  
  // Sauvegarder l'état fermé
  await setValue('folders', updatedFolders);
}

/**
 * Mettre à jour le compteur de conversations d'un dossier
 * @param folderId ID du dossier à mettre à jour
 * @param count Nombre de conversations (optionnel)
 * @returns Promise<void>
 */
export async function updateFolderConversationCount(folderId: string, count?: number): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  
  if (folderIndex !== -1) {
    if (count !== undefined) {
      folders[folderIndex].conversationCount = count;
    } else {
      // Obtenir les conversations actuelles du dossier
      const conversations = await getValue<any[]>(`folder_conversations_${folderId}`) || [];
      folders[folderIndex].conversationCount = conversations.length;
    }
    
    await setValue('folders', folders);
  }
} 