import React, { useState, useEffect } from 'react';
import HeavyAnalytics from 'heavy-analytics-lib';

export function ReactBenchmark({ items, user, isModalOpen }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    window.addEventListener('scroll', () => console.log('Scrolling'));
  }, []);

  function handleExport(shouldTrack) {
    if (shouldTrack) {
      HeavyAnalytics.track('export');
    }
  }

  return (
    <div className="react-benchmark">
      <img src={user.avatar} alt="User Avatar" />

      <div onClick={() => handleExport(true)} className="export-btn">
        Export Analytics Data
      </div>

      <CustomDropdown options={items} />

      <div id="status" className="status-banner">
        {data.length} items loaded
      </div>

      {items.map(item => {
        const itemConfig = { theme: 'dark', margin: 10 };
        return <span key={item.id} style={itemConfig}>{item.name}</span>;
      })}

      {isModalOpen && (
        <Modal isOpen={isModalOpen} role="dialog" aria-label="Benchmark Modal">
          <p>Modal Content</p>
        </Modal>
      )}
    </div>
  );
}
