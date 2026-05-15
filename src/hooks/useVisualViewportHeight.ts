import { useEffect, useState } from 'react';

/**
 * Returns the current visual viewport height in pixels.
 * On iOS, window.innerHeight does NOT shrink when the on-screen keyboard
 * appears, but window.visualViewport.height does. Using this value as the
 * container height keeps headers/footers visible while typing.
 */
export interface VisualViewportState {
  height: number;
  offsetTop: number;
}

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => {
    if (typeof window === 'undefined') return { height: 0, offsetTop: 0 };
    return {
      height: window.visualViewport?.height ?? window.innerHeight,
      offsetTop: window.visualViewport?.offsetTop ?? 0,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const update = () => {
      setState({
        height: vv?.height ?? window.innerHeight,
        offsetTop: vv?.offsetTop ?? 0,
      });
    };
    update();
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return state;
}

/** Backwards-compatible helper returning only the height. */
export function useVisualViewportHeight(): number {
  return useVisualViewport().height;
}