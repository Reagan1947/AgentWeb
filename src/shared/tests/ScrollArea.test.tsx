import assert from 'node:assert/strict';

import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { test } from 'vitest';

import { ScrollArea } from '@/shared/ui/ScrollArea';

/**
 * The sidebar overlay thumb is positioned from the viewport's scroll metrics.
 * jsdom does not lay out, so the test installs those metrics directly and checks
 * the thumb the list would draw.
 */

const setBox = (element: HTMLElement, width: number, height: number, scrollHeight = height) => {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
};

test('keeps the native scrollbar when the overlay thumb is not requested', () => {
  const { container } = render(
    <ScrollArea>
      <p>Files</p>
    </ScrollArea>,
  );

  assert.equal(container.querySelector('[data-overlay-thumb]'), null);
  assert.equal(container.querySelector('.scrollbar-hide'), null);
});

test('sizes the overlay thumb from the overflow and moves it with the scroll position', () => {
  const ref = createRef<HTMLDivElement>();
  const { container } = render(
    <ScrollArea ref={ref} overlayScrollbar>
      <p>Projects</p>
    </ScrollArea>,
  );

  const viewport = ref.current;
  const thumb = container.querySelector('[data-overlay-thumb]');
  const track = thumb?.parentElement;
  assert.ok(viewport);
  assert.ok(thumb instanceof HTMLElement);
  assert.ok(track instanceof HTMLElement);

  setBox(viewport, 280, 200, 800);
  setBox(track, 10, 200);

  fireEvent.scroll(viewport);

  // 200 / 800 of a 200px track is 50px, which is above the 28px minimum.
  assert.equal(thumb.style.height, '50px');
  assert.equal(thumb.style.transform, 'translate3d(0, 0px, 0)');
  assert.equal(thumb.className.includes('hidden'), false);
  assert.equal(track.className.includes('z-10'), true, 'the thumb paints above sticky rows');
  assert.match(viewport.className, /\bz-0\b/);
  assert.match(viewport.className, /\bpr-3\b/, 'rows leave a gutter for the overlay thumb');

  viewport.scrollTop = 300;
  fireEvent.scroll(viewport);

  // Halfway through 600px of overflow lands the thumb halfway along its travel.
  assert.equal(thumb.style.transform, 'translate3d(0, 75px, 0)');
});

test('dragging the overlay thumb scrolls the sidebar list', () => {
  const ref = createRef<HTMLDivElement>();
  const { container } = render(
    <ScrollArea ref={ref} overlayScrollbar>
      <p>Projects</p>
    </ScrollArea>,
  );

  const viewport = ref.current;
  const thumb = container.querySelector('[data-overlay-thumb]');
  const track = thumb?.parentElement;
  assert.ok(viewport);
  assert.ok(thumb instanceof HTMLElement);
  assert.ok(track instanceof HTMLElement);

  setBox(viewport, 280, 200, 800);
  setBox(track, 10, 200);
  fireEvent.scroll(viewport);

  // jsdom has no PointerEvent. A MouseEvent dispatched under the pointer
  // event name still carries clientY, which is all the drag handler reads.
  const pointer = (type: string, clientY: number) => {
    thumb.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY }));
  };
  pointer('pointerdown', 10);
  pointer('pointermove', 40);

  // 30px of drag across 150px of travel covers 120px of the 600px overflow.
  assert.equal(viewport.scrollTop, 120);
});

test('fades only the scroll edges that are clipping rows', () => {
  const ref = createRef<HTMLDivElement>();
  const { container } = render(
    <ScrollArea ref={ref} overlayScrollbar edgeFade>
      <p>Projects</p>
    </ScrollArea>,
  );

  const viewport = ref.current;
  const thumb = container.querySelector('[data-overlay-thumb]');
  const track = thumb?.parentElement;
  assert.ok(viewport);
  assert.ok(track instanceof HTMLElement);

  setBox(viewport, 280, 200, 800);
  setBox(track, 10, 200);
  fireEvent.scroll(viewport);

  const top = container.querySelector('[data-scroll-edge="top"]');
  const bottom = container.querySelector('[data-scroll-edge="bottom"]');
  assert.ok(top instanceof HTMLElement);
  assert.ok(bottom instanceof HTMLElement);
  assert.equal(top.getAttribute('data-active'), 'false');
  assert.equal(bottom.getAttribute('data-active'), 'true');

  viewport.scrollTop = 300;
  fireEvent.scroll(viewport);
  assert.equal(top.getAttribute('data-active'), 'true');
  assert.equal(bottom.getAttribute('data-active'), 'true');

  viewport.scrollTop = 600;
  fireEvent.scroll(viewport);
  assert.equal(top.getAttribute('data-active'), 'true');
  assert.equal(bottom.getAttribute('data-active'), 'false');
});
