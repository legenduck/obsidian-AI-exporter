/**
 * UI components for content script
 * Status dot indicator and toast notifications
 */

import { ERROR_TOAST_DURATION } from '../lib/constants';

// Status dot states
export type DotStatus = 'idle' | 'watching' | 'syncing' | 'synced' | 'error' | 'deleting' | 'excluded';

const DOT_COLORS: Record<DotStatus, string> = {
  idle: '#9ca3af',
  watching: '#3b82f6',
  syncing: '#3b82f6',
  synced: '#10b981',
  error: '#ef4444',
  deleting: '#f59e0b',
  excluded: '#eab308',
};

const DOT_TOOLTIPS: Record<DotStatus, string> = {
  idle: 'Initializing...',
  watching: 'Tracking',
  syncing: 'Syncing...',
  synced: 'Synced',
  error: 'Error — click for details',
  deleting: 'Deleting...',
  excluded: 'Excluded — click to resume',
};

/** Minimum pulse count during syncing before transition */
const MIN_PULSE_COUNT = 3;
/** Duration of each pulse cycle in ms */
const PULSE_DURATION = 800;
/** How long the green "synced" dot stays before returning to watching */
const SYNCED_DISPLAY_MS = 1000;
/** Long press duration to trigger session exclusion (ms) */
const LONG_PRESS_DURATION = 2000;

// CSS styles for UI components
const STYLES = `
  #g2o-dot {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 10000;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${DOT_COLORS.idle};
    border: none;
    padding: 0;
    cursor: pointer;
    transition: background 0.3s ease, box-shadow 0.3s ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }

  #g2o-dot:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transform: scale(1.2);
  }

  #g2o-dot.syncing {
    animation: g2o-pulse ${PULSE_DURATION}ms ease-in-out infinite;
  }

  #g2o-dot.deleting {
    animation: g2o-blink 500ms ease-in-out infinite;
  }

  @keyframes g2o-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  @keyframes g2o-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.15; }
  }

  #g2o-dot-tooltip {
    position: fixed;
    bottom: 36px;
    right: 10px;
    z-index: 10001;
    background: rgba(0,0,0,0.75);
    color: white;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  #g2o-dot:hover + #g2o-dot-tooltip,
  #g2o-dot-tooltip.visible {
    opacity: 1;
  }

  .g2o-toast {
    position: fixed;
    bottom: 40px;
    right: 16px;
    z-index: 10001;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    animation: g2o-slideIn 0.3s ease;
    max-width: 360px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  @keyframes g2o-slideIn {
    from { opacity: 0; transform: translateX(100px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .g2o-toast .message {
    flex: 1;
    line-height: 1.4;
  }

  .g2o-toast .close {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    margin-left: 4px;
  }

  .g2o-toast .close:hover {
    opacity: 1;
  }
`;

let styleInjected = false;
let currentToast: HTMLDivElement | null = null;
let currentStatus: DotStatus = 'idle';
let lastErrorMessage = '';
let syncStartTime = 0;
let syncedTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTriggered = false;

/**
 * Inject CSS styles into the page
 */
function injectStyles(): void {
  if (styleInjected) return;

  const style = document.createElement('style');
  style.id = 'g2o-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Create and inject the status dot indicator
 * @param onClick - Called on normal click (sync trigger)
 * @param onLongPress - Called after 2s long press (session exclusion)
 */
export function injectStatusDot(onClick: () => void, onLongPress?: () => void): HTMLButtonElement {
  injectStyles();

  // Remove existing dot if present
  const existing = document.getElementById('g2o-dot');
  if (existing) existing.remove();
  const existingTooltip = document.getElementById('g2o-dot-tooltip');
  if (existingTooltip) existingTooltip.remove();

  const dot = document.createElement('button');
  dot.id = 'g2o-dot';
  dot.setAttribute('aria-label', DOT_TOOLTIPS.idle);

  const tooltip = document.createElement('div');
  tooltip.id = 'g2o-dot-tooltip';
  tooltip.textContent = DOT_TOOLTIPS.idle;

  // Long press detection via pointer events
  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  dot.addEventListener('pointerdown', () => {
    if (currentStatus === 'excluded' || currentStatus === 'deleting') return;
    if (!onLongPress) return;

    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      longPressTimer = null;
      onLongPress();
    }, LONG_PRESS_DURATION);
  });

  dot.addEventListener('pointerup', cancelLongPress);
  dot.addEventListener('pointerleave', cancelLongPress);

  dot.addEventListener('click', () => {
    // Skip click if long press was triggered
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }

    if (currentStatus === 'error' && lastErrorMessage) {
      showErrorToast(lastErrorMessage);
    } else {
      onClick();
    }
  });

  document.body.appendChild(dot);
  document.body.appendChild(tooltip);

  currentStatus = 'idle';
  return dot;
}

/**
 * Update the status dot to a new state
 */
export function setDotStatus(status: DotStatus, errorMessage?: string): void {
  const dot = document.getElementById('g2o-dot') as HTMLButtonElement | null;
  const tooltip = document.getElementById('g2o-dot-tooltip');
  if (!dot) return;

  // Clear synced timer if switching away
  if (syncedTimer && status !== 'synced') {
    clearTimeout(syncedTimer);
    syncedTimer = null;
  }

  currentStatus = status;
  dot.style.background = DOT_COLORS[status];

  // Manage animations
  dot.classList.remove('syncing', 'deleting');
  if (status === 'syncing') {
    dot.classList.add('syncing');
    syncStartTime = Date.now();
  } else if (status === 'deleting') {
    dot.classList.add('deleting');
  }

  // Update tooltip
  let tooltipText = DOT_TOOLTIPS[status];
  if (status === 'error' && errorMessage) {
    lastErrorMessage = errorMessage;
    tooltipText = 'Error — click for details';
  }
  if (tooltip) tooltip.textContent = tooltipText;
  dot.setAttribute('aria-label', tooltipText);
}

/**
 * Transition from syncing → synced → watching
 * Ensures minimum pulse count before transitioning
 */
export function completeSyncTransition(): void {
  const elapsed = Date.now() - syncStartTime;
  const minDuration = MIN_PULSE_COUNT * PULSE_DURATION;
  const remaining = Math.max(0, minDuration - elapsed);

  setTimeout(() => {
    setDotStatus('synced');
    syncedTimer = setTimeout(() => {
      setDotStatus('watching');
    }, SYNCED_DISPLAY_MS);
  }, remaining);
}

/**
 * Get current dot status (for testing)
 */
export function getDotStatus(): DotStatus {
  return currentStatus;
}

/**
 * Show error toast (only used for errors — click red dot to see)
 */
export function showErrorToast(error: string): void {
  injectStyles();

  if (currentToast) {
    currentToast.remove();
    currentToast = null;
  }

  const toast = document.createElement('div');
  toast.className = 'g2o-toast';
  currentToast = toast;

  const toastMessage = document.createElement('span');
  toastMessage.className = 'message';
  toastMessage.textContent = error;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => {
    toast.remove();
    currentToast = null;
  });

  toast.appendChild(toastMessage);
  toast.appendChild(closeBtn);
  document.body.appendChild(toast);

  if (ERROR_TOAST_DURATION > 0) {
    setTimeout(() => {
      toast.style.animation = 'g2o-slideIn 0.3s ease reverse';
      setTimeout(() => {
        toast.remove();
        if (currentToast === toast) currentToast = null;
      }, 300);
    }, ERROR_TOAST_DURATION);
  }
}

// Legacy exports kept for backward compatibility with displaySaveResults
export { showErrorToast as showWarningToast };
export function showSuccessToast(): void {
  /* no-op: success is shown via green dot */
}
export function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  _duration?: number
): void {
  if (type === 'error' || type === 'warning') {
    showErrorToast(message);
  }
  // success/info: no-op — status dot handles these
}

// Legacy exports for backward compatibility
export function injectSyncButton(onClick: () => void, onLongPress?: () => void): HTMLButtonElement {
  return injectStatusDot(onClick, onLongPress);
}
export function setButtonLoading(loading: boolean): void {
  if (loading) {
    setDotStatus('syncing');
  }
  // Don't set watching on false — completeSyncTransition handles it
}
