// Types communs pour l'application Le Chat+

/**
 * Référence à une conversation Mistral
 */
export interface ConversationRef {
  id: string
  title: string
  url: string
  addedAt: number
}

/**
 * Structure d'un dossier de conversations
 */
export interface Folder {
  id: string
  name: string
  createdAt: number
  conversationCount: number
  expanded?: boolean
}

/**
 * Structure d'une conversation individuelle affichée dans la section des dossiers
 */
export interface StandaloneConversation {
  id: string
  title: string
  url: string
  addedAt: number
} 