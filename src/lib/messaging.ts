/**
 * Chrome Runtime Messaging utility
 * Promise-based wrapper for chrome.runtime.sendMessage
 * Includes retry logic for transient service worker failures
 */

import type {
  ConversationTree,
  ExtensionMessage,
  ExtensionSettings,
  SaveResponse,
  MultiOutputResponse,
} from './types';

/**
 * Message response type mapping
 */
interface MessageResponseMap {
  getSettings: ExtensionSettings;
  testConnection: { success: boolean; error?: string };
  saveToObsidian: SaveResponse;
  saveToOutputs: MultiOutputResponse;
  getExistingFile: string | null;
  saveJsonTree: SaveResponse;
  getJsonTree: { success: boolean; tree?: ConversationTree; error?: string };
  deleteSession: SaveResponse;
}

/** Maximum number of retry attempts for transient failures */
const MAX_RETRIES = 1;

/** Delay between retry attempts (ms) — gives SW time to wake up */
const RETRY_DELAY_MS = 200;

/**
 * Check if an error is permanent (no point retrying)
 */
function isPermanentError(msg: string): boolean {
  return (
    msg.includes('Extension context invalidated') || msg.includes('Extension not found')
  );
}

/**
 * Internal: send a raw message with retry on transient errors.
 * Returns unknown — caller is responsible for type assertion.
 */
function sendRawWithRetry(message: ExtensionMessage, attempt: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Guard: extension context may be invalidated after rebuild/reload
    if (!chrome.runtime?.id) {
      reject(new Error('Extension context invalidated. Please refresh the page.'));
      return;
    }

    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message ?? 'Unknown error';

        // Retry transient errors (SW may be waking up)
        if (attempt < MAX_RETRIES && !isPermanentError(errorMsg)) {
          setTimeout(() => {
            sendRawWithRetry(message, attempt + 1).then(resolve, reject);
          }, RETRY_DELAY_MS);
          return;
        }

        reject(new Error(errorMsg));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Type-safe message sending with retry for transient SW failures
 *
 * Design Decision: Runtime validation is intentionally omitted here because:
 * 1. Messages originate from and are handled within the same extension
 * 2. The background service worker (src/background/index.ts) performs
 *    comprehensive validation via validateMessageContent() before processing
 * 3. Adding redundant validation would impact performance without security benefit
 *
 * The type assertion below is safe under these controlled conditions.
 */
export function sendMessage<K extends keyof MessageResponseMap>(
  message: ExtensionMessage & { action: K }
): Promise<MessageResponseMap[K]> {
  // Type assertion is safe: background validates all messages before responding
  // See: src/background/index.ts validateMessageContent()
  return sendRawWithRetry(message, 0) as Promise<MessageResponseMap[K]>;
}
