/**
 * UI component tests
 *
 * Tests the status dot indicator, state transitions, and error toasts.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  injectStatusDot,
  setDotStatus,
  completeSyncTransition,
  getDotStatus,
  showErrorToast,
  injectSyncButton,
} from '../../src/content/ui';

describe('ui', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('injectStatusDot', () => {
    it('creates a dot with correct id', () => {
      const onClick = vi.fn();
      const dot = injectStatusDot(onClick);

      expect(dot.id).toBe('g2o-dot');
      expect(document.getElementById('g2o-dot')).toBe(dot);
    });

    it('creates tooltip element', () => {
      injectStatusDot(vi.fn());

      const tooltip = document.getElementById('g2o-dot-tooltip');
      expect(tooltip).not.toBeNull();
      expect(tooltip?.textContent).toBe('Initializing...');
    });

    it('injects styles into document head', async () => {
      vi.resetModules();
      const { injectStatusDot: fresh } = await import('../../src/content/ui');

      document.body.innerHTML = '';
      document.head.innerHTML = '';

      fresh(vi.fn());

      const styleElement = document.getElementById('g2o-styles');
      expect(styleElement).not.toBeNull();
    });

    it('dot is appended to document body', () => {
      injectStatusDot(vi.fn());
      expect(document.body.querySelector('#g2o-dot')).not.toBeNull();
    });

    it('calls onClick when clicked in non-error state', () => {
      const onClick = vi.fn();
      injectStatusDot(onClick);

      setDotStatus('watching');
      document.getElementById('g2o-dot')?.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('shows error toast when clicked in error state', () => {
      const onClick = vi.fn();
      injectStatusDot(onClick);

      setDotStatus('error', 'Test error message');
      document.getElementById('g2o-dot')?.click();

      // Should show toast instead of calling onClick
      expect(onClick).not.toHaveBeenCalled();
      const toast = document.querySelector('.g2o-toast');
      expect(toast).not.toBeNull();
      expect(document.querySelector('.g2o-toast .message')?.textContent).toBe(
        'Test error message'
      );
    });

    it('removes existing dot before creating new one', () => {
      injectStatusDot(vi.fn());
      injectStatusDot(vi.fn());

      const dots = document.querySelectorAll('#g2o-dot');
      expect(dots.length).toBe(1);
    });

    it('starts in idle state', () => {
      injectStatusDot(vi.fn());
      expect(getDotStatus()).toBe('idle');
    });
  });

  describe('setDotStatus', () => {
    beforeEach(() => {
      injectStatusDot(vi.fn());
    });

    it('updates to watching state', () => {
      setDotStatus('watching');

      expect(getDotStatus()).toBe('watching');
      const dot = document.getElementById('g2o-dot');
      expect(dot?.style.background).toBe('rgb(59, 130, 246)'); // #3b82f6
    });

    it('adds pulse animation for syncing state', () => {
      setDotStatus('syncing');

      const dot = document.getElementById('g2o-dot');
      expect(dot?.classList.contains('syncing')).toBe(true);
    });

    it('removes pulse animation when leaving syncing state', () => {
      setDotStatus('syncing');
      setDotStatus('watching');

      const dot = document.getElementById('g2o-dot');
      expect(dot?.classList.contains('syncing')).toBe(false);
    });

    it('updates tooltip text', () => {
      setDotStatus('watching');

      const tooltip = document.getElementById('g2o-dot-tooltip');
      expect(tooltip?.textContent).toBe('Tracking');
    });

    it('sets error tooltip with click hint', () => {
      setDotStatus('error', 'Connection failed');

      const tooltip = document.getElementById('g2o-dot-tooltip');
      expect(tooltip?.textContent).toBe('Error — click for details');
    });

    it('does nothing when dot does not exist', () => {
      document.body.innerHTML = '';
      expect(() => setDotStatus('watching')).not.toThrow();
    });
  });

  describe('completeSyncTransition', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      injectStatusDot(vi.fn());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('transitions from syncing to synced to watching', () => {
      setDotStatus('syncing');

      // Simulate sync taking longer than min pulse duration
      vi.advanceTimersByTime(3000);
      completeSyncTransition();

      // Should immediately go to synced (min pulse already elapsed)
      vi.advanceTimersByTime(0);
      expect(getDotStatus()).toBe('synced');

      // After SYNCED_DISPLAY_MS, goes back to watching
      vi.advanceTimersByTime(1000);
      expect(getDotStatus()).toBe('watching');
    });

    it('waits for minimum pulse count if sync is fast', () => {
      setDotStatus('syncing');

      // Complete sync almost immediately
      completeSyncTransition();

      // Still syncing because min pulse hasn't elapsed
      expect(getDotStatus()).toBe('syncing');

      // After min pulse duration (3 * 800ms = 2400ms), transitions
      vi.advanceTimersByTime(2400);
      expect(getDotStatus()).toBe('synced');

      vi.advanceTimersByTime(1000);
      expect(getDotStatus()).toBe('watching');
    });
  });

  describe('showErrorToast', () => {
    it('creates toast with error message', () => {
      showErrorToast('Something went wrong');

      const toast = document.querySelector('.g2o-toast');
      expect(toast).not.toBeNull();
      expect(document.querySelector('.g2o-toast .message')?.textContent).toBe(
        'Something went wrong'
      );
    });

    it('removes existing toast before creating new one', () => {
      showErrorToast('First');
      showErrorToast('Second');

      const toasts = document.querySelectorAll('.g2o-toast');
      expect(toasts.length).toBe(1);
      expect(document.querySelector('.g2o-toast .message')?.textContent).toBe('Second');
    });

    it('close button removes toast', () => {
      showErrorToast('Test');

      const closeBtn = document.querySelector('.g2o-toast .close') as HTMLButtonElement;
      closeBtn?.click();

      expect(document.querySelector('.g2o-toast')).toBeNull();
    });

    it('escapes HTML in message to prevent XSS', () => {
      showErrorToast('<script>alert("xss")</script>');

      const message = document.querySelector('.g2o-toast .message');
      expect(message?.innerHTML).not.toContain('<script>');
      expect(message?.textContent).toContain('<script>');
    });
  });

  describe('legacy injectSyncButton', () => {
    it('creates a dot via legacy export', () => {
      const button = injectSyncButton(() => {});
      expect(button).toBeDefined();
      expect(button.id).toBe('g2o-dot');
    });
  });
});
