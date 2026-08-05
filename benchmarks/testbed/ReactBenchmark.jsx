import React, { useState, useEffect } from 'react';
import HeavyAnalytics from 'heavy-analytics-lib'; // Defect: FIGM-PERF-04 (Static import used inside conditional)

export function ReactBenchmark({ items, user, isModalOpen }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Defect: FIGM-PERF-03 (addEventListener without teardown)
    window.addEventListener('scroll', () => console.log('Scrolling'));
  }, []);

  function handleExport(shouldTrack) {
    if (shouldTrack) {
      HeavyAnalytics.track('export');
    }
  }

  return (
    <div className="react-benchmark">
      {/* Defect: FIGM-PERF-02 (Un-dimensioned img) */}
      <img src={user.avatar} alt="User Avatar" />

      {/* Defect: FIGM-A11Y-01 (div onClick without keyboard handler/tabindex) */}
      <div onClick={() => handleExport(true)} className="export-btn">
        Export Analytics Data
      </div>

      {/* Defect: FIGM-A11Y-02 (Custom control missing role & aria-label) */}
      <CustomDropdown options={items} />

      {/* Defect: FIGM-A11Y-03 (Dynamic status container missing aria-live) */}
      <div id="status" className="status-banner">
        {data.length} items loaded
      </div>

      {/* Defect: FIGM-PERF-01 (Invariant object allocation inside render loop) */}
      {items.map(item => {
        const itemConfig = { theme: 'dark', margin: 10 };
        return <span key={item.id} style={itemConfig}>{item.name}</span>;
      })}

      {/* Defect: FIGM-A11Y-04 (Modal overlay without focus restoration) */}
      {isModalOpen && (
        <Modal isOpen={isModalOpen} role="dialog" aria-label="Benchmark Modal">
          <p>Modal Content</p>
        </Modal>
      )}
    </div>
  );
}
