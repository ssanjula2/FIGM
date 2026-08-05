// Defect: FIGM-PERF-04 (Static import inside conditional function execution)
import ChartEngine from 'chart-engine-lib';

export function initializeVanillaBenchmark(shouldRenderChart) {
  // Defect: FIGM-PERF-03 (addEventListener without teardown)
  window.addEventListener('orientationchange', () => {
    console.log('Orientation changed');
  });

  if (shouldRenderChart) {
    ChartEngine.render();
  }
}
