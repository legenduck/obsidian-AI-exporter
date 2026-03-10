/**
 * Obsidian API handlers for background service worker
 *
 * Handles save, get, and connection test operations
 */

import { ObsidianApiClient } from '../lib/obsidian-api';
import { getErrorMessage } from '../lib/error-utils';
import { generateNoteContent } from '../lib/note-generator';
import { resolvePathTemplate, buildDateVariables, sanitizeFileName } from '../lib/path-utils';
import { lookupExistingFile, buildAppendContent } from '../lib/append-utils';
import { mergeTree } from '../lib/tree-builder';
import { treeToIndentMarkdown } from '../lib/tree-to-markdown';
import { trackSavedPaths, getSavedPaths, removeSavedPaths, addExcludedSession } from '../lib/storage';
import type { ExtensionSettings, ObsidianNote, SaveResponse, ConversationTree } from '../lib/types';

/**
 * Create an ObsidianApiClient if API key is configured.
 * Returns the client or an error object.
 */
export function createObsidianClient(
  settings: ExtensionSettings
): ObsidianApiClient | { error: string } {
  if (!settings.obsidianApiKey) {
    return { error: 'API key not configured' };
  }
  return new ObsidianApiClient(settings.obsidianPort, settings.obsidianApiKey);
}

/**
 * Type guard for client creation error
 */
export function isClientError(
  client: ObsidianApiClient | { error: string }
): client is { error: string } {
  return 'error' in client;
}

/**
 * Try to append new messages to an existing file.
 * Returns a SaveResponse on success, or null to fall through to overwrite.
 */
async function tryAppendMode(
  client: ObsidianApiClient,
  settings: ExtensionSettings,
  note: ObsidianNote,
  fullPath: string,
  resolvedPath: string,
  conversationId?: string
): Promise<SaveResponse | null> {
  if (!settings.enableAppendMode || note.frontmatter.type === 'deep-research') {
    return null;
  }

  try {
    const lookup = await lookupExistingFile(client, fullPath, resolvedPath, note);
    if (!lookup.found) return null;

    const appendResult = buildAppendContent(lookup.content, note, settings);
    if (appendResult !== null) {
      await client.putFile(lookup.path, appendResult.content);
      if (conversationId) {
        await trackSavedPaths(conversationId, { md: lookup.path });
      }
      return { success: true, isNewFile: false, messagesAppended: appendResult.messagesAppended };
    }
    return { success: true, isNewFile: false, messagesAppended: 0 };
  } catch (error) {
    console.warn('[G2O Background] Append mode failed, falling back to overwrite:', error);
    return null;
  }
}

/**
 * Save note to Obsidian vault
 *
 * When append mode is enabled and the file already exists,
 * only new messages are appended while preserving existing content.
 * Falls back to full overwrite if append fails.
 */
export async function handleSave(
  settings: ExtensionSettings,
  note: ObsidianNote,
  conversationId?: string
): Promise<SaveResponse> {
  const client = createObsidianClient(settings);
  if (isClientError(client)) {
    return { success: false, error: client.error };
  }

  try {
    // Resolve template variables (e.g., {platform} → gemini, {year} → 2026) and construct full path
    const resolvedPath = resolvePathTemplate(settings.vaultPath, {
      platform: note.frontmatter.source,
      ...buildDateVariables(new Date()),
      title: sanitizeFileName(note.frontmatter.title || 'untitled'),
      sessionId: note.frontmatter.id || '',
    });
    const fullPath = resolvedPath.length > 0 ? `${resolvedPath}/${note.fileName}` : note.fileName;

    const appendResult = await tryAppendMode(client, settings, note, fullPath, resolvedPath, conversationId);
    if (appendResult) return appendResult;

    const existingContent = await client.getFile(fullPath);
    const isNewFile = existingContent === null;
    const content = generateNoteContent(note, settings);
    await client.putFile(fullPath, content);

    if (conversationId) {
      await trackSavedPaths(conversationId, { md: fullPath });
    }

    return { success: true, isNewFile };
  } catch (error) {
    console.error('[G2O Background] Save failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Get existing file content from Obsidian
 */
export async function handleGetFile(
  settings: ExtensionSettings,
  fileName: string,
  vaultPath?: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const client = createObsidianClient(settings);
  if (isClientError(client)) {
    return { success: false, error: client.error };
  }

  try {
    const path = vaultPath ? `${vaultPath}/${fileName}` : fileName;
    const content = await client.getFile(path);

    if (content === null) {
      return { success: true, content: undefined };
    }

    return { success: true, content };
  } catch (error) {
    console.error('[G2O Background] Get file failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Save JSON tree to Obsidian vault
 *
 * Merges incoming tree with existing tree (if present) to accumulate branches.
 * Also generates an LLM-optimized indent markdown alongside the JSON.
 */
export async function handleSaveJsonTree(
  settings: ExtensionSettings,
  tree: ConversationTree,
  vaultPath: string
): Promise<SaveResponse> {
  const client = createObsidianClient(settings);
  if (isClientError(client)) {
    return { success: false, error: client.error };
  }

  try {
    const resolvedPath = resolvePathTemplate(vaultPath, {
      platform: tree.source,
      ...buildDateVariables(new Date()),
      title: sanitizeFileName(tree.title || 'untitled'),
      sessionId: tree.id || '',
    });
    const jsonFileName = `${tree.id}.json`;
    const llmFileName = `${tree.id}.llm.md`;
    const jsonPath = resolvedPath.length > 0 ? `${resolvedPath}/.json/${jsonFileName}` : `.json/${jsonFileName}`;
    const llmPath = resolvedPath.length > 0 ? `${resolvedPath}/.llm/${llmFileName}` : `.llm/${llmFileName}`;

    // Load existing tree and merge
    const existing = await client.getJSONFile<ConversationTree>(jsonPath);
    const finalTree = existing ? mergeTree(existing, tree) : tree;

    // Save JSON tree
    await client.putJSONFile(jsonPath, finalTree);

    // Generate and save LLM indent markdown
    const llmContent = treeToIndentMarkdown(finalTree);
    await client.putFile(llmPath, llmContent);

    await trackSavedPaths(tree.id, { json: jsonPath, llm: llmPath });
    console.info(`[G2O Background] JSON tree saved: ${jsonPath}`);
    return { success: true, isNewFile: existing === null };
  } catch (error) {
    console.error('[G2O Background] JSON tree save failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Get existing JSON tree from Obsidian vault
 */
export async function handleGetJsonTree(
  settings: ExtensionSettings,
  conversationId: string,
  vaultPath: string
): Promise<{ success: boolean; tree?: ConversationTree; error?: string }> {
  const client = createObsidianClient(settings);
  if (isClientError(client)) {
    return { success: false, error: client.error };
  }

  try {
    const jsonPath = vaultPath ? `${vaultPath}/${conversationId}.json` : `${conversationId}.json`;
    const tree = await client.getJSONFile<ConversationTree>(jsonPath);
    return { success: true, tree: tree ?? undefined };
  } catch (error) {
    console.error('[G2O Background] JSON tree get failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Delete all files for a conversation and mark it as excluded.
 * Deletes md, json, and llm files tracked via trackSavedPaths().
 */
export async function handleDeleteSession(
  settings: ExtensionSettings,
  conversationId: string
): Promise<SaveResponse> {
  const client = createObsidianClient(settings);
  if (isClientError(client)) {
    return { success: false, error: client.error };
  }

  try {
    const paths = await getSavedPaths(conversationId);
    const deleted: string[] = [];

    if (paths) {
      const filesToDelete = [paths.md, paths.json, paths.llm].filter(Boolean) as string[];
      for (const filePath of filesToDelete) {
        const wasDeleted = await client.deleteFile(filePath);
        if (wasDeleted) deleted.push(filePath);
      }
      await removeSavedPaths(conversationId);
    }

    await addExcludedSession(conversationId);
    console.info(`[G2O Background] Session excluded: ${conversationId}, deleted ${deleted.length} file(s)`);
    return { success: true };
  } catch (error) {
    // Still mark as excluded even if deletion fails
    await addExcludedSession(conversationId);
    console.error('[G2O Background] Delete session failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Test connection to Obsidian REST API
 */
export async function handleTestConnection(
  settings: ExtensionSettings
): Promise<{ success: boolean; error?: string }> {
  const client = createObsidianClient(settings);
  if (isClientError(client)) {
    return { success: false, error: client.error };
  }

  try {
    const result = await client.testConnection();

    if (!result.reachable) {
      return {
        success: false,
        error: result.error ?? 'Cannot reach Obsidian. Is it running?',
      };
    }

    if (!result.authenticated) {
      return {
        success: false,
        error: result.error ?? 'Invalid API key. Please check your settings.',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[G2O Background] Test connection failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
