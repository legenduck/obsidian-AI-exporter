/**
 * Auto-sync module
 * Uses MutationObserver to detect two sync trigger points:
 * 1. User sends a message (new message element added)
 * 2. AI finishes responding (text streaming stops for debounce period)
 */

/**
 * Selectors for new message turn elements (trigger: user sent a message)
 */
const MESSAGE_TURN_SELECTORS = [
  // Claude
  '[data-testid^="chat-message"]',
  '.font-claude-response',
  // Gemini
  '.conversation-container',
  'model-response',
  'user-query',
  // ChatGPT
  'article[data-testid^="conversation-turn"]',
  '[data-message-id]',
  // Perplexity
  '[class*="ThreadMessage"]',
];

/**
 * Selectors for AI response content areas (trigger: streaming text changes)
 * When characterData mutations stop within these containers → response complete
 */
const RESPONSE_CONTENT_SELECTORS = [
  // Claude
  '.font-claude-response',
  // Gemini
  '.markdown.markdown-main-panel',
  'model-response',
  // ChatGPT
  '[data-message-author-role="assistant"]',
  // Perplexity
  '[class*="ThreadMessage"]',
];

/**
 * Check if mutations indicate a sync-worthy event:
 * 1. New message turn element added (user sent message)
 * 2. Text content changed inside an AI response area (streaming)
 */
function isMessageRelatedMutation(mutations: readonly MutationRecord[]): boolean {
  for (const mutation of mutations) {
    // Case 1: New message element added (user sent a message)
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        for (const selector of MESSAGE_TURN_SELECTORS) {
          if (node.matches(selector) || node.querySelector(selector)) {
            return true;
          }
        }
      }
    }

    // Case 2: Text content changed inside a response container (AI streaming)
    // The debounce timer naturally detects "streaming complete" —
    // mutations keep resetting the timer; when streaming stops, timer fires.
    if (mutation.type === 'characterData' || mutation.type === 'childList') {
      const target =
        mutation.target instanceof HTMLElement
          ? mutation.target
          : mutation.target.parentElement;
      if (target) {
        for (const selector of RESPONSE_CONTENT_SELECTORS) {
          if (target.closest(selector)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Start auto-sync by observing DOM changes in the conversation container.
 * Triggers on two events:
 * 1. User sends a message (new element added)
 * 2. AI finishes responding (text stops streaming for debounceMs)
 *
 * @param syncFn - The sync function to call
 * @param debounceMs - Milliseconds to wait after last mutation before syncing
 * @param observationRoot - The DOM element to observe
 * @returns Cleanup function to stop observing
 */
export function startAutoSync(
  syncFn: () => Promise<void>,
  debounceMs: number,
  observationRoot: Element
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let syncing = false;
  let pendingSync = false;

  const debouncedSync = async (): Promise<void> => {
    if (syncing) {
      pendingSync = true;
      return;
    }
    syncing = true;
    try {
      do {
        pendingSync = false;
        try {
          await syncFn();
        } catch (error) {
          const msg = error instanceof Error ? error.message : '';
          if (msg.includes('Extension context invalidated')) {
            console.warn('[G2O Auto-sync] Extension reloaded, stopping auto-sync');
            observer.disconnect();
            if (timer) clearTimeout(timer);
            return;
          }
          console.warn('[G2O Auto-sync] Sync error:', error);
        }
      } while (pendingSync);
    } finally {
      syncing = false;
    }
  };

  const observer = new MutationObserver(mutations => {
    if (!isMessageRelatedMutation(mutations)) return;

    // Reset debounce — sync fires only when mutations stop
    if (timer) clearTimeout(timer);
    timer = setTimeout(debouncedSync, debounceMs);
  });

  observer.observe(observationRoot, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  console.info('[G2O] Auto-sync started');

  return () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
    console.info('[G2O] Auto-sync stopped');
  };
}
