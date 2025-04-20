import type { ConversationRef } from './types'
import { getValue, setValue } from './storage-manager'
import { getFolders } from './folder-operations'

/**
 * Obtenir l'ID de la conversation active
 * @returns ID de la conversation active ou null
 */
export function getCurrentConversationId(): string | null {
  const pathSegments = window.location.pathname.split('/')
  const chatIndex = pathSegments.indexOf('chat')
  
  // Vérifier si nous sommes sur une page de conversation
  if (chatIndex >= 0 && chatIndex + 1 < pathSegments.length) {
    return pathSegments[chatIndex + 1]
  }
  
  return null
}

/**
 * Obtenir le titre de la conversation active
 * @returns Titre de la conversation
 */
export function getConversationTitle(): string {
  const titleElement = document.querySelector('h1') || document.querySelector('.conversation-title')
  return titleElement ? titleElement.textContent?.trim() || 'Conversation sans titre' : 'Conversation sans titre'
}

/**
 * Ajouter une conversation à un dossier
 * @param folderId ID du dossier
 * @param conversation Objet contenant les infos de la conversation
 * @param position Position optionnelle pour insérer la conversation
 * @returns Promise<void>
 */
export async function addConversationToFolder(
  folderId: string, 
  conversation: {id: string, title: string, url: string}, 
  position?: number
): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) return;
  
  // Récupérer les conversations actuelles du dossier
  const conversations = await getValue<ConversationRef[]>(`folder_conversations_${folderId}`) || [];
  
  // Vérifier si la conversation est déjà dans le dossier
  const existingIndex = conversations.findIndex(c => c.id === conversation.id);
  if (existingIndex !== -1) {
    // Si la position est spécifiée et différente, déplacer la conversation
    if (position !== undefined && position !== existingIndex) {
      const [conversationToMove] = conversations.splice(existingIndex, 1);
      conversations.splice(position, 0, conversationToMove);
      await setValue(`folder_conversations_${folderId}`, conversations);
    }
    return;
  }
  
  // Ajouter la conversation au dossier
  const newConversation: ConversationRef = {
    id: conversation.id,
    title: conversation.title,
    url: conversation.url,
    addedAt: Date.now()
  };
  
  // Insérer à la position spécifiée ou à la fin
  if (position !== undefined && position >= 0 && position <= conversations.length) {
    conversations.splice(position, 0, newConversation);
  } else {
    conversations.push(newConversation);
  }
  
  await setValue(`folder_conversations_${folderId}`, conversations);
  
  // Mettre à jour le compteur
  folders[folderIndex].conversationCount = conversations.length;
  await setValue('folders', folders);
}

/**
 * Supprimer une conversation d'un dossier
 * @param folderId ID du dossier
 * @param conversationId ID de la conversation
 * @returns Promise<void>
 */
export async function removeConversationFromFolder(folderId: string, conversationId: string): Promise<void> {
  const folders = await getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) return;
  
  const conversations = await getValue<ConversationRef[]>(`folder_conversations_${folderId}`) || [];
  const updatedConversations = conversations.filter(c => c.id !== conversationId);
  
  await setValue(`folder_conversations_${folderId}`, updatedConversations);
  
  // Mettre à jour le compteur
  folders[folderIndex].conversationCount = updatedConversations.length;
  await setValue('folders', folders);
}

/**
 * Réorganiser une conversation dans un dossier
 * @param folderId ID du dossier
 * @param conversationId ID de la conversation
 * @param newPosition Nouvelle position
 * @returns Promise<void>
 */
export async function reorderConversation(folderId: string, conversationId: string, newPosition: number): Promise<void> {
  const conversations = await getValue<ConversationRef[]>(`folder_conversations_${folderId}`) || [];
  
  // Trouver l'index actuel de la conversation
  const currentIndex = conversations.findIndex(c => c.id === conversationId);
  if (currentIndex === -1) return; // La conversation n'est pas dans ce dossier
  
  // S'assurer que la nouvelle position est valide
  if (newPosition < 0) newPosition = 0;
  if (newPosition >= conversations.length) newPosition = conversations.length - 1;
  
  // Si la position ne change pas, ne rien faire
  if (newPosition === currentIndex) return;
  
  // Déplacer la conversation à sa nouvelle position
  const [conversationToMove] = conversations.splice(currentIndex, 1);
  conversations.splice(newPosition, 0, conversationToMove);
  
  // Sauvegarder l'ordre mis à jour
  await setValue(`folder_conversations_${folderId}`, conversations);
}

/**
 * Renommer une conversation
 * @param conversationId ID de la conversation
 * @param newTitle Nouveau titre
 * @returns Promise<void>
 */
export async function renameConversation(conversationId: string, newTitle: string): Promise<void> {
  // Parcourir tous les dossiers pour trouver la conversation
  const folders = await getFolders();
  
  for (const folder of folders) {
    const conversations = await getValue<ConversationRef[]>(`folder_conversations_${folder.id}`) || [];
    const convIndex = conversations.findIndex(c => c.id === conversationId);
    
    if (convIndex !== -1) {
      // Mettre à jour le titre de la conversation
      conversations[convIndex].title = newTitle;
      await setValue(`folder_conversations_${folder.id}`, conversations);
    }
  }
}

/**
 * Obtenir toutes les conversations d'un dossier
 * @param folderId ID du dossier
 * @returns Promise<ConversationRef[]>
 */
export async function getConversationsInFolder(folderId: string): Promise<ConversationRef[]> {
  const conversations = await getValue<ConversationRef[]>(`folder_conversations_${folderId}`);
  return conversations || [];
}

/**
 * Vérifier si une conversation est présente dans un dossier
 * @param folderId ID du dossier
 * @param conversationId ID de la conversation
 * @returns Promise<boolean>
 */
export async function isConversationInFolder(folderId: string, conversationId: string): Promise<boolean> {
  const conversations = await getConversationsInFolder(folderId);
  return conversations.some(c => c.id === conversationId);
} 