// Clean: the resize listener is torn down in the returned cleanup function, paired by event
// type -- FIGM-PERF-03 must NOT fire.
export function setupResize(handleResize) {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}
