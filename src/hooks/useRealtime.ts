import { useEffect, useState } from 'react';
import { realtimeService, RealtimeEventType } from '../storage/realtime-service';

export function useRealtime<T = any>(eventType: RealtimeEventType, initialData?: T) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe(eventType, (payload) => {
      setData(payload);
      setLastUpdated(new Date().toISOString());
    });

    return () => {
      unsubscribe();
    };
  }, [eventType]);

  return { data, lastUpdated };
}
