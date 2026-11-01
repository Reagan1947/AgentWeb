import { useEffect } from 'react';

/**
 * Shorter than this, the visual viewport moved because the mobile browser
 * chrome showed or hid during a scroll, not because a keyboard opened.
 * Applying that gap as a bottom inset resizes the chat pane mid-gesture.
 */
const MIN_KEYBOARD_INSET_PX = 150;

/**
 * How far the on-screen keyboard covers the layout viewport.
 * `offsetTop` is the gap above the visual viewport (URL bar); counting it as
 * keyboard insets the shell from the bottom while the reader is scrolling.
 */
export function keyboardInsetPx(
  viewport: { height: number; offsetTop: number },
  layoutHeight: number,
): number {
  const obscured = layoutHeight - viewport.height - viewport.offsetTop;
  if (obscured < MIN_KEYBOARD_INSET_PX) return 0;
  return Math.round(obscured);
}

/** Keeps the fixed workspace shell above the virtual keyboard in iOS Safari. */
export function useVisualViewportKeyboardOffset() {
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return undefined;
    }

    let applied = -1;
    const updateKeyboardHeight = () => {
      const keyboardHeight = keyboardInsetPx(visualViewport, window.innerHeight);
      if (keyboardHeight === applied) return;
      applied = keyboardHeight;
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    };

    updateKeyboardHeight();
    visualViewport.addEventListener('resize', updateKeyboardHeight);
    return () => visualViewport.removeEventListener('resize', updateKeyboardHeight);
  }, []);
}
