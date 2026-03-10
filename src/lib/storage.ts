/**
 * Chrome storage wrapper for extension settings
 *
 * Storage separation strategy (C-01):
 * - storage.local: Secure settings (API Key) - no cloud sync
 * - storage.sync: Non-sensitive settings - synced across devices
 */

import type {
  ExtensionSettings,
  SecureSettings,
  SyncSettings,
  TemplateOptions,
  OutputOptions,
} from './types';
import { DEFAULT_OBSIDIAN_PORT } from './constants';

const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  includeId: true,
  includeTitle: true,
  includeTags: true,
  includeSource: true,
  includeDates: true,
  includeMessageCount: true,
  messageFormat: 'callout',
  userCalloutType: 'QUESTION',
  assistantCalloutType: 'NOTE',
};

const DEFAULT_OUTPUT_OPTIONS: OutputOptions = {
  obsidian: true, // Default true for backward compatibility
  file: false,
  clipboard: false,
  json: false,
};

const DEFAULT_SECURE_SETTINGS: SecureSettings = {
  obsidianApiKey: '',
};

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  obsidianPort: DEFAULT_OBSIDIAN_PORT,
  vaultPath: 'AI/{platform}',
  templateOptions: DEFAULT_TEMPLATE_OPTIONS,
  outputOptions: DEFAULT_OUTPUT_OPTIONS,
  enableAutoScroll: false,
  enableAppendMode: false,
  enableToolContent: false,
  enableJsonTree: false,
  jsonOutputPath: 'AI/{platform}',
  enableAutoSync: false,
};

const DEFAULT_SETTINGS: ExtensionSettings = {
  ...DEFAULT_SECURE_SETTINGS,
  ...DEFAULT_SYNC_SETTINGS,
};

/**
 * Get extension settings from chrome.storage (local + sync)
 *
 * Retrieves secure settings from local storage and non-sensitive
 * settings from sync storage, combining them into a unified object.
 */
export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const [localResult, syncResult] = await Promise.all([
      chrome.storage.local.get('secureSettings'),
      chrome.storage.sync.get('settings'),
    ]);

    return {
      obsidianApiKey:
        localResult.secureSettings?.obsidianApiKey ?? DEFAULT_SECURE_SETTINGS.obsidianApiKey,
      obsidianPort: syncResult.settings?.obsidianPort ?? DEFAULT_SYNC_SETTINGS.obsidianPort,
      vaultPath: syncResult.settings?.vaultPath ?? DEFAULT_SYNC_SETTINGS.vaultPath,
      templateOptions: {
        ...DEFAULT_TEMPLATE_OPTIONS,
        ...syncResult.settings?.templateOptions,
      },
      outputOptions: {
        ...DEFAULT_OUTPUT_OPTIONS,
        ...syncResult.settings?.outputOptions,
      },
      enableAutoScroll:
        syncResult.settings?.enableAutoScroll ?? DEFAULT_SYNC_SETTINGS.enableAutoScroll,
      enableAppendMode:
        syncResult.settings?.enableAppendMode ?? DEFAULT_SYNC_SETTINGS.enableAppendMode,
      enableToolContent:
        syncResult.settings?.enableToolContent ?? DEFAULT_SYNC_SETTINGS.enableToolContent,
      enableJsonTree:
        syncResult.settings?.enableJsonTree ?? DEFAULT_SYNC_SETTINGS.enableJsonTree,
      jsonOutputPath:
        syncResult.settings?.jsonOutputPath ?? DEFAULT_SYNC_SETTINGS.jsonOutputPath,
      enableAutoSync:
        syncResult.settings?.enableAutoSync ?? DEFAULT_SYNC_SETTINGS.enableAutoSync,
    };
  } catch (error) {
    console.error('[G2O] Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save extension settings to chrome.storage
 *
 * Separates secure settings (API Key) to local storage
 * and non-sensitive settings to sync storage.
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  try {
    // Read sync storage once upfront (replaces separate getSettings() + sync.get calls)
    const syncResult = await chrome.storage.sync.get('settings');
    const currentSync = syncResult.settings ?? {};

    // Save secure data to local storage
    if (settings.obsidianApiKey !== undefined) {
      await chrome.storage.local.set({
        secureSettings: { obsidianApiKey: settings.obsidianApiKey },
      });
    }

    // Save non-sensitive data to sync storage
    const syncData: Partial<SyncSettings> = {};
    if (settings.obsidianPort !== undefined) {
      syncData.obsidianPort = settings.obsidianPort;
    }
    if (settings.vaultPath !== undefined) {
      syncData.vaultPath = settings.vaultPath;
    }
    if (settings.templateOptions !== undefined) {
      syncData.templateOptions = {
        ...DEFAULT_TEMPLATE_OPTIONS,
        ...currentSync.templateOptions,
        ...settings.templateOptions,
      };
    }
    if (settings.outputOptions !== undefined) {
      syncData.outputOptions = {
        ...DEFAULT_OUTPUT_OPTIONS,
        ...currentSync.outputOptions,
        ...settings.outputOptions,
      };
    }
    if (settings.enableAutoScroll !== undefined) {
      syncData.enableAutoScroll = settings.enableAutoScroll;
    }
    if (settings.enableAppendMode !== undefined) {
      syncData.enableAppendMode = settings.enableAppendMode;
    }
    if (settings.enableToolContent !== undefined) {
      syncData.enableToolContent = settings.enableToolContent;
    }
    if (settings.enableJsonTree !== undefined) {
      syncData.enableJsonTree = settings.enableJsonTree;
    }
    if (settings.jsonOutputPath !== undefined) {
      syncData.jsonOutputPath = settings.jsonOutputPath;
    }
    if (settings.enableAutoSync !== undefined) {
      syncData.enableAutoSync = settings.enableAutoSync;
    }

    if (Object.keys(syncData).length > 0) {
      await chrome.storage.sync.set({
        settings: { ...currentSync, ...syncData },
      });
    }
  } catch (error) {
    console.error('[G2O] Failed to save settings:', error);
    throw error;
  }
}

/**
 * Migrate settings from old format (sync only) to new format (local + sync)
 *
 * Transaction-safe migration:
 * 1. Write to local storage first
 * 2. Verify write success
 * 3. Remove from sync only after verification
 * 4. On failure, keep sync intact (no data loss)
 *
 * Should be called on service worker startup.
 */
// ========== Saved File Paths (per conversation) ==========

/**
 * Tracked file paths for a conversation.
 * Used to locate files for deletion when a session is excluded.
 */
export interface SavedFilePaths {
  md?: string;
  json?: string;
  llm?: string;
}

const PATHS_KEY_PREFIX = 'paths:';

/**
 * Track saved file paths for a conversation.
 * Merges with existing paths (md may be saved separately from json/llm).
 */
export async function trackSavedPaths(
  conversationId: string,
  paths: Partial<SavedFilePaths>
): Promise<void> {
  const key = `${PATHS_KEY_PREFIX}${conversationId}`;
  const result = await chrome.storage.local.get(key);
  const existing: SavedFilePaths = result[key] ?? {};
  await chrome.storage.local.set({ [key]: { ...existing, ...paths } });
}

/**
 * Get saved file paths for a conversation.
 */
export async function getSavedPaths(conversationId: string): Promise<SavedFilePaths | null> {
  const key = `${PATHS_KEY_PREFIX}${conversationId}`;
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

/**
 * Remove saved file paths for a conversation.
 */
export async function removeSavedPaths(conversationId: string): Promise<void> {
  const key = `${PATHS_KEY_PREFIX}${conversationId}`;
  await chrome.storage.local.remove(key);
}

// ========== Excluded Sessions ==========

const EXCLUDED_SESSIONS_KEY = 'excludedSessions';

/**
 * Add a conversation to the excluded sessions list.
 * Excluded sessions are not tracked even on revisit.
 */
export async function addExcludedSession(conversationId: string): Promise<void> {
  const result = await chrome.storage.local.get(EXCLUDED_SESSIONS_KEY);
  const sessions: string[] = result[EXCLUDED_SESSIONS_KEY] ?? [];
  if (!sessions.includes(conversationId)) {
    sessions.push(conversationId);
    await chrome.storage.local.set({ [EXCLUDED_SESSIONS_KEY]: sessions });
  }
}

/**
 * Remove a conversation from the excluded sessions list.
 */
export async function removeExcludedSession(conversationId: string): Promise<void> {
  const result = await chrome.storage.local.get(EXCLUDED_SESSIONS_KEY);
  const sessions: string[] = result[EXCLUDED_SESSIONS_KEY] ?? [];
  const filtered = sessions.filter(id => id !== conversationId);
  await chrome.storage.local.set({ [EXCLUDED_SESSIONS_KEY]: filtered });
}

/**
 * Check if a conversation is in the excluded sessions list.
 */
export async function isSessionExcluded(conversationId: string): Promise<boolean> {
  const result = await chrome.storage.local.get(EXCLUDED_SESSIONS_KEY);
  const sessions: string[] = result[EXCLUDED_SESSIONS_KEY] ?? [];
  return sessions.includes(conversationId);
}

// ========== Settings Migration ==========

export async function migrateSettings(): Promise<void> {
  try {
    const syncResult = await chrome.storage.sync.get('settings');
    if (syncResult.settings?.obsidianApiKey) {
      const apiKey = syncResult.settings.obsidianApiKey;

      // Step 1: Write to local storage
      await chrome.storage.local.set({
        secureSettings: { obsidianApiKey: apiKey },
      });

      // Step 2: Verify write success
      const verifyResult = await chrome.storage.local.get('secureSettings');
      if (verifyResult.secureSettings?.obsidianApiKey !== apiKey) {
        throw new Error('Migration verification failed');
      }

      // Step 3: Remove from sync (only after verified write)
      const { obsidianApiKey: _removed, ...rest } = syncResult.settings;
      void _removed; // Intentionally unused - extracted to exclude from rest
      await chrome.storage.sync.set({ settings: rest });

      console.info('[G2O] Settings migrated to secure storage');
    }
  } catch (error) {
    // On migration failure, keep sync intact and retry on next startup
    console.error('[G2O] Migration failed, will retry on next startup:', error);
    // Don't throw - existing functionality should continue working
  }
}
