import { useEffect, useState } from 'react';
import { HUD_IDLE_DELAY, hudIsIdle } from './shell';

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** True after `delay` ms without pointer, wheel, touch, or key input anywhere in the window. */
export function useHudIdle(delay = HUD_IDLE_DELAY) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let last = Date.now();
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, Math.max(16, delay - (Date.now() - last) + 10));
    };
    const check = () => {
      if (hudIsIdle(last, Date.now(), delay)) setIdle(true);
      else schedule();
    };
    const wake = () => {
      last = Date.now();
      setIdle(false);
      schedule();
    };
    for (const name of WAKE_EVENTS) window.addEventListener(name, wake, { passive: true });
    schedule();
    return () => {
      window.clearTimeout(timer);
      for (const name of WAKE_EVENTS) window.removeEventListener(name, wake);
    };
  }, [delay]);
  return idle;
}
