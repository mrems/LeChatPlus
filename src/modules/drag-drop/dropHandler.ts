/**
 * Module central pour gérer l'exécution du dépôt (drop)
 */

import type { DragState } from './dragDropCore';
import { 
    addConversationToFolder, 
    removeConversationFromFolder, 
    reorderConversation,
    addStandaloneConversation,
    removeStandaloneConversation,
    reorderStandaloneConversation,
    getStandaloneConversations // Pour calculer la position à la racine
} from '../conversation-operations';
import { findFolderIdFromElement } from './dragDropCore'; // Fonction centralisée

/**
 * Exécute l'action de dépôt en fonction de l'élément glissé et de la cible.
 * @param dragState L'état actuel du drag and drop.
 * @returns Promise<boolean> Indique si une opération de modification a été effectuée.
 */
export async function executeDrop(dragState: DragState): Promise<boolean> {
    const { potentialDropTarget, elementType, elementId, element, sourceContainer } = dragState;

    if (!potentialDropTarget || !potentialDropTarget.element || !potentialDropTarget.type || !elementId || !element) {
        console.log("[DropHandler] Action annulée: Cible ou élément source invalide.");
        return false; // Pas de cible valide ou d'élément source
    }

    const targetElement = potentialDropTarget.element;
    const targetType = potentialDropTarget.type;
    const targetPositionType = potentialDropTarget.position; // 'before', 'after', 'inside'
    
    // Préparer les données de la conversation (titre et URL)
    let title: string | null = null;
    let href: string | null = null;
    
    if (elementType === 'mistral') {
        // Si l'élément glissé est de type Mistral, c'est déjà le lien <a>
        href = element.getAttribute('href');
        title = element.textContent?.trim() || null;
    } else {
        // Pour les types standalone et folder, chercher le lien <a> à l'intérieur du div
        const linkElement = element.querySelector('a');
        href = linkElement?.getAttribute('href') || null;
        title = linkElement ? linkElement.textContent?.trim() : null;
    }
    
    // Fallback générique si le titre n'est toujours pas trouvé
    title = title || element.getAttribute('data-fallback-title') || 'Conversation inconnue';
    href = href || ''; // S'assurer que href n'est pas null

    const conversationData = {
        id: elementId,
        title: title, // Utiliser le titre déterminé ci-dessus
        url: href.startsWith('/') ? window.location.origin + href : href // Utilise l'URL complète
    };
    
    let operationSuccess = false;

    try {
        // --- Logique basée sur le TYPE DE CIBLE --- 

        // CAS 1: Cible = Une conversation (.le-chat-plus-conversation-item)
        if (targetType === 'conversation') {
            const isTargetInFolder = !!targetElement.closest('.le-chat-plus-folder-item');
            const targetFolderItem = targetElement.closest('.le-chat-plus-folder-item');
            const targetFolderId = targetFolderItem ? await findFolderIdFromElement(targetFolderItem) : null;
            const isSourceFolder = elementType === 'folder';
            const sourceFolderId = isSourceFolder && sourceContainer ? await findFolderIdFromElement(sourceContainer) : null;
            
            // Calculer l'index de position cible
            let targetPositionIndex = -1;
            if (isTargetInFolder && targetFolderItem) { // Cible dans un dossier
                const targetConversations = Array.from(targetFolderItem.querySelectorAll('.le-chat-plus-conversation-item'));
                const targetIndex = targetConversations.indexOf(targetElement);
                targetPositionIndex = (targetPositionType === 'before') ? targetIndex : targetIndex + 1;
            } else { // Cible est autonome (racine)
                const standaloneConversations = await getStandaloneConversations();
                const targetIndex = standaloneConversations.findIndex(c => c.id === targetElement.getAttribute('data-conversation-id'));
                targetPositionIndex = (targetPositionType === 'before') ? targetIndex : targetIndex + 1;
            }

            // SOUS-CAS selon la SOURCE
            if (elementType === 'standalone') {
                // Déplacement: Racine -> ?
                if (isTargetInFolder && targetFolderId) {
                    // Racine -> Dossier (à position index)
                    console.log(`[DropHandler] Standalone -> Folder ${targetFolderId} at index ${targetPositionIndex}`);
                    await removeStandaloneConversation(elementId);
                    await addConversationToFolder(targetFolderId, conversationData, targetPositionIndex);
                    operationSuccess = true;
                } else {
                    // Racine -> Racine (Réorganisation)
                    console.log(`[DropHandler] Standalone -> Standalone at index ${targetPositionIndex}`);
                    await reorderStandaloneConversation(elementId, targetPositionIndex);
                    operationSuccess = true;
                }
            } else if (elementType === 'folder' && sourceFolderId) {
                // Déplacement: Dossier -> ?
                if (isTargetInFolder && targetFolderId) {
                    // Dossier -> Dossier
                    if (sourceFolderId === targetFolderId) {
                        // Dossier -> Même dossier (Réorganisation)
                        console.log(`[DropHandler] Folder ${sourceFolderId} -> Same folder at index ${targetPositionIndex}`);
                        await reorderConversation(sourceFolderId, elementId, targetPositionIndex);
                        operationSuccess = true;
                    } else {
                        // Dossier -> Autre dossier (à position index)
                        console.log(`[DropHandler] Folder ${sourceFolderId} -> Folder ${targetFolderId} at index ${targetPositionIndex}`);
                        await removeConversationFromFolder(sourceFolderId, elementId);
                        await addConversationToFolder(targetFolderId, conversationData, targetPositionIndex);
                        operationSuccess = true;
                    }
                } else {
                    // Dossier -> Racine (à position index)
                    console.log(`[DropHandler] Folder ${sourceFolderId} -> Standalone at index ${targetPositionIndex}`);
                    await removeConversationFromFolder(sourceFolderId, elementId);
                    // Ajouter d'abord (à la fin), puis réorganiser
                    await addStandaloneConversation(conversationData);
                    const newList = await getStandaloneConversations();
                    if (targetPositionIndex < newList.length) {
                        await reorderStandaloneConversation(elementId, targetPositionIndex);
                    }
                    operationSuccess = true;
                }
            } else if (elementType === 'mistral') {
                 // Déplacement: Mistral -> ?
                 if (isTargetInFolder && targetFolderId) {
                    // Mistral -> Dossier (à position index)
                    console.log(`[DropHandler] Mistral -> Folder ${targetFolderId} at index ${targetPositionIndex}`);
                    await addConversationToFolder(targetFolderId, conversationData, targetPositionIndex);
                    operationSuccess = true;
                 } else {
                    // Mistral -> Racine (à position index)
                    console.log(`[DropHandler] Mistral -> Standalone at index ${targetPositionIndex}`);
                    // Ajouter d'abord (à la fin), puis réorganiser
                    await addStandaloneConversation(conversationData);
                    const newList = await getStandaloneConversations();
                    if (targetPositionIndex < newList.length) {
                        await reorderStandaloneConversation(elementId, targetPositionIndex);
                    }
                    operationSuccess = true;
                 }
            }
        } 
        // CAS 2: Cible = En-tête de dossier (.le-chat-plus-folder-header)
        else if (targetType === 'folderHeader') {
            const targetFolderItem = targetElement.closest('.le-chat-plus-folder-item');
            const targetFolderId = await findFolderIdFromElement(targetFolderItem);
            const isSourceFolder = elementType === 'folder';
            const sourceFolderId = isSourceFolder && sourceContainer ? await findFolderIdFromElement(sourceContainer) : null;

            if (targetFolderId) {
                // SOUS-CAS selon la SOURCE
                if (elementType === 'standalone') {
                    // Racine -> Dossier (fin)
                    console.log(`[DropHandler] Standalone -> Folder ${targetFolderId} (end)`);
                    await removeStandaloneConversation(elementId);
                    await addConversationToFolder(targetFolderId, conversationData); // Ajout à la fin
                    operationSuccess = true;
                } else if (elementType === 'folder' && sourceFolderId) {
                    // Dossier -> Dossier (fin)
                    if (sourceFolderId !== targetFolderId) {
                        console.log(`[DropHandler] Folder ${sourceFolderId} -> Folder ${targetFolderId} (end)`);
                        await removeConversationFromFolder(sourceFolderId, elementId);
                        await addConversationToFolder(targetFolderId, conversationData);
                        operationSuccess = true;
                    } else {
                        console.log("[DropHandler] Drop sur le dossier source ignoré.");
                    }
                } else if (elementType === 'mistral') {
                    // Mistral -> Dossier (fin)
                    console.log(`[DropHandler] Mistral -> Folder ${targetFolderId} (end)`);
                    await addConversationToFolder(targetFolderId, conversationData);
                    operationSuccess = true;
                }
            } else {
                 console.warn("[DropHandler] Impossible de trouver l'ID du dossier cible pour le header.");
            }
        } 
        // CAS 3: Cible = Zone racine générale (#le-chat-plus-folders-list)
        else if (targetType === 'rootArea') {
            const isSourceFolder = elementType === 'folder';
            const sourceFolderId = isSourceFolder && sourceContainer ? await findFolderIdFromElement(sourceContainer) : null;

            // SOUS-CAS selon la SOURCE
            if (elementType === 'folder' && sourceFolderId) {
                // Dossier -> Racine (fin)
                console.log(`[DropHandler] Folder ${sourceFolderId} -> Root Area (end)`);
                await removeConversationFromFolder(sourceFolderId, elementId);
                await addStandaloneConversation(conversationData); // Ajout à la fin
                operationSuccess = true;
            } else if (elementType === 'mistral') {
                // Mistral -> Racine (fin)
                console.log(`[DropHandler] Mistral -> Root Area (end)`);
                await addStandaloneConversation(conversationData);
                operationSuccess = true;
            } else if (elementType === 'standalone') {
                // Racine -> Racine (réorganisation à la fin ? ou ignoré ?)
                // Actuellement, la réorganisation racine -> racine se fait via drop sur une autre conversation autonome (Cas 1)
                // On peut choisir d'ignorer un drop sur la zone vide si on vient de la racine.
                console.log("[DropHandler] Standalone -> Root Area ignoré (utiliser drop sur conv pour réorganiser).");
            }
        }

    } catch (error) {
        console.error("[DropHandler] Erreur lors de l'exécution du drop:", error);
        operationSuccess = false; // Assurer false en cas d'erreur
    }

    return operationSuccess;
} 