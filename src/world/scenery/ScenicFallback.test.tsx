import {
  Children,
  isValidElement,
  type ReactElement,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { HtmlProps } from '@react-three/drei/web/Html.js';
import { ScenicFallback } from './ScenicFallback';
import { SCENIC_FALLBACK_PLANS } from './scenicFallbackPlan';

// Inspect the inexpensive fallback's React tree without mounting WebGL or
// invoking Drei's portal. Native button handlers preserve keyboard activation.
function children(element: ReactElement<{ children?: React.ReactNode }>) {
  return Children.toArray(element.props.children).filter(isValidElement) as ReactElement[];
}

describe('scenery fallback retry', () => {
  it('offers no recovery action while loading or when no retry callback exists', () => {
    const retry = vi.fn();
    for (const state of ['loading', 'failed'] as const) {
      const result = ScenicFallback({
        id: 'northstar',
        state,
        onRetry: state === 'loading' ? retry : undefined,
      });
      expect(children(result).every((child) => child.type === 'mesh')).toBe(true);
    }
    expect(retry).not.toHaveBeenCalled();
  });

  it('offers a labeled native retry button only on failure without capturing scene gestures', () => {
    const retry = vi.fn();
    const result = ScenicFallback({ id: 'woodland', state: 'failed', onRetry: retry });
    const html = children(result).at(-1) as ReactElement<HtmlProps>;
    expect(html.props.occlude).toBe(true);
    expect(html.props.fullscreen).toBeUndefined();
    expect(html.props.style?.pointerEvents).toBe('none');
    const button = children(html)[0] as ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;
    expect(button.type).toBe('button');
    expect(button.props.type).toBe('button');
    expect(button.props['aria-label']).toBe(
      `Retry ${SCENIC_FALLBACK_PLANS.woodland.label} scenery`,
    );
    expect(button.props.style?.pointerEvents).toBe('auto');
    const stopPropagation = vi.fn();
    button.props.onPointerDown?.({ stopPropagation } as unknown as PointerEvent<HTMLButtonElement>);
    expect(retry).not.toHaveBeenCalled();
    button.props.onClick?.({ stopPropagation } as unknown as MouseEvent<HTMLButtonElement>);
    expect(retry).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('keeps all decorative meshes out of resident raycast picking', () => {
    for (const id of Object.keys(SCENIC_FALLBACK_PLANS) as (keyof typeof SCENIC_FALLBACK_PLANS)[]) {
      const result = ScenicFallback({ id, state: 'loading' });
      for (const mesh of children(result)) {
        const props = mesh.props as {
          raycast: (raycaster: unknown, intersections: unknown[]) => void;
          onClick?: unknown;
        };
        const intersections: unknown[] = [];
        props.raycast({}, intersections);
        expect(intersections).toEqual([]);
        expect(props.onClick).toBeUndefined();
      }
    }
  });
});
