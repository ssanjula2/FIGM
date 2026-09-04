import ChartEngine from 'chart-engine-lib';

export function initializeVanillaBenchmark(shouldRenderChart) {
  window.addEventListener('orientationchange', () => {
    console.log('Orientation changed');
  });

  if (shouldRenderChart) {
    ChartEngine.render();
  }
}
