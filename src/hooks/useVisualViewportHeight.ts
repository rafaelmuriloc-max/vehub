import { useEffect, useState } from 'react';

/**
 * Returns the current visual viewport height in pixels.
 * On iOS, window.innerHeight does NOT shrink when the on-screen keyboard
 * appears, but window.visualViewport.height does. Using this value as the
 * container height keeps headers/footers visible while typing.
 */
export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const update = () => {
      setHeight(vv?.height ?? window.innerHeight);
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

  return height;
}