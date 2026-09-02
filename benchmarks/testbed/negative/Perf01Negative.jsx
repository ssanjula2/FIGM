// Clean: the config object is hoisted to module scope as a frozen constant, not re-allocated on
// every iteration -- FIGM-PERF-01 must NOT fire.
const DEFAULT_CONFIG = Object.freeze({ theme: 'dark', padding: 10 });

export function renderList(items) {
  return items.map((item) => transform(item, DEFAULT_CONFIG));
}

function transform(item, config) {
  return { ...item, ...config };
}
