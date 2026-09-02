'use client';

/**
 * Centralized/global state-management condition (docs/research/RQ1_EXPERIMENT_PROTOCOL.md,
 * Section A.2). One React Context holds every item's counter value, and every ItemCardGlobal
 * leaf reads/dispatches through it -- the minimal, dependency-free "global state" primitive
 * React itself ships, chosen deliberately over introducing Redux/Zustand/etc. solely to widen
 * the condition set (the protocol's own instruction: don't add libraries without justification).
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

interface GlobalStoreValue {
  counters: Record<number, number>;
  increment: (id: number) => void;
}

const GlobalStoreContext = createContext<GlobalStoreValue | null>(null);

export function GlobalStoreProvider({ itemIds, children }: { itemIds: number[]; children: React.ReactNode }) {
  const [counters, setCounters] = useState<Record<number, number>>(() =>
    Object.fromEntries(itemIds.map((id) => [id, 0]))
  );

  const increment = useCallback((id: number) => {
    setCounters((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const value = useMemo(() => ({ counters, increment }), [counters, increment]);

  return <GlobalStoreContext.Provider value={value}>{children}</GlobalStoreContext.Provider>;
}

export function useGlobalStore(): GlobalStoreValue {
  const ctx = useContext(GlobalStoreContext);
  if (!ctx) throw new Error('useGlobalStore must be used within a GlobalStoreProvider');
  return ctx;
}
