import { readable } from 'svelte/store';

const MOBILE_BREAKPOINT = 768;

export const isMobile = readable(false, (set) => {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const onChange = () => set(window.innerWidth < MOBILE_BREAKPOINT);
  mql.addEventListener('change', onChange);
  set(window.innerWidth < MOBILE_BREAKPOINT);
  return () => mql.removeEventListener('change', onChange);
});
