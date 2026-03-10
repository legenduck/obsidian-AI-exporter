/**
 * Background Service Worker
 * Handles HTTP communication with Obsidian REST API
 */

import { getErrorMessage } from '../lib/error-utils';
import { getSettings, migrateSettings } from '../lib/storage';
import { validateSender, validateMessageContent } from './validation';
import { handleSave, handleGetFile, handleTestConnection, handleSaveJsonTree, handleGetJsonTree, handleDeleteSession } from './obsidian-handlers';
import { handleMultiOutput } from './output-handlers';
import type { ExtensionMessage } from '../lib/types';

// Run settings migration on service worker startup (C-01)
// Note: top-level await not available in service workers, use .catch() for error handling
migrateSettings().catch(error => {
  console.error('[G2O Background] Settings migration failed:', error);
});

/**
 * Handle incoming messages from content script and popup
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // Ignore messages targeted at offscreen document
    // These are handled by the offscreen document's own listener
    if (
      message &&
      typeof message === 'object' &&
      'target' in message &&
      message.target === 'offscreen'
    ) {
      return false;
    }

    // Sender validation (M-02)
    if (!validateSender(sender)) {
      console.warn('[G2O Background] Rejected message from unauthorized sender');
      sendResponse({ success: false, error: 'Unauthorized' });
      return false;
    }

    // Message content validation (M-02)
    if (!validateMessageContent(message)) {
      console.warn('[G2O Background] Invalid message content');
      sendResponse({ success: false, error: 'Invalid message content' });
      return false;
    }

    handleMessage(message)
      .then(response => {
        try {
          sendResponse(response);
        } catch {
          /* sender disconnected */
        }
      })
      .catch(error => {
        console.error('[G2O Background] Error handling message:', error);
        try {
          sendResponse({ success: false, error: getErrorMessage(error) });
        } catch {
          /* sender disconnected */
        }
      });
    return true; // Indicates async response
  }
);

/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  const settings = await getSettings();

  switch (message.action) {
    case 'saveToObsidian':
      return handleSave(settings, message.data);

    case 'saveToOutputs':
      return handleMultiOutput(message.data, message.outputs, settings, message.conversationId);

    case 'getExistingFile':
      return handleGetFile(settings, message.fileName, message.vaultPath);

    case 'testConnection':
      return handleTestConnection(settings);

    case 'getSettings':
      return settings;

    case 'saveJsonTree':
      return handleSaveJsonTree(settings, message.tree, message.vaultPath);

    case 'getJsonTree':
      return handleGetJsonTree(settings, message.conversationId, message.vaultPath);

    case 'deleteSession':
      return handleDeleteSession(settings, message.conversationId);

    default:
      return { success: false, error: 'Unknown action' };
  }
}

// Keep-alive: periodic alarm prevents Chrome from terminating the service worker
const KEEPALIVE_ALARM = 'g2o-keepalive';
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === KEEPALIVE_ALARM) {
    console.debug('[G2O Background] Keep-alive tick');
  }
});

// Log when service worker starts
console.info('[G2O Background] Service worker started');
