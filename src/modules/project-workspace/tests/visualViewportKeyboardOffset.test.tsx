import assert from 'node:assert/strict';

import { cleanup, render } from '@testing-library/react';
import { afterEach, test } from 'vitest';

import {
  keyboardInsetPx,
  useVisualViewportKeyboardOffset,
} from '@/modules/project-workspace/hooks/useVisualViewportKeyboardOffset';

function OffsetProbe() {
  useVisualViewportKeyboardOffset();
  return null;
}

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--keyboard-height');
});

test('ignores the URL bar gap a mobile scroll reports as a viewport change', () => {
  assert.equal(keyboardInsetPx({ height: 720, offsetTop: 40 }, 800), 0);
});

test('counts a real keyboard after subtracting the top chrome offset', () => {
  assert.equal(keyboardInsetPx({ height: 450, offsetTop: 30 }, 800), 320);
});

test('a chrome resize does not inset the shell, and a keyboard does', () => {
  const listeners = new Set<() => void>();
  const viewport = {
    height: 800,
    offsetTop: 0,
    addEventListener: (_name: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_name: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
  const previousViewport = window.visualViewport;
  const previousHeight = window.innerHeight;
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

  try {
    render(<OffsetProbe />);
    assert.equal(document.documentElement.style.getPropertyValue('--keyboard-height'), '0px');

    viewport.height = 690;
    viewport.offsetTop = 50;
    listeners.forEach((listener) => listener());
    assert.equal(document.documentElement.style.getPropertyValue('--keyboard-height'), '0px');

    viewport.height = 430;
    viewport.offsetTop = 0;
    listeners.forEach((listener) => listener());
    assert.equal(document.documentElement.style.getPropertyValue('--keyboard-height'), '370px');
  } finally {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: previousViewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: previousHeight });
  }
});
