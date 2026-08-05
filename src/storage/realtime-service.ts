export type RealtimeEventType = 'NOTIFICATION' | 'PROJECT_UPDATE' | 'SCAN_COMPLETE' | 'METRICS_UPDATE';

export class RealtimeService {
  private client: any = null;
  private channel: any = null;
  private listeners: Map<RealtimeEventType, Set<(payload: any) => void>> = new Map();

  constructor() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        this.client = createClient(url, key);
      } catch {
        this.client = null;
      }
    }
  }

  public subscribe(eventType: RealtimeEventType, callback: (payload: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    if (this.client && !this.channel) {
      try {
        this.channel = this.client
          .channel('figm-saas-realtime')
          .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
            this.notifyListeners(payload);
          })
          .subscribe();
      } catch {
        // Fallback to local broadcaster
      }
    }

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  public broadcast(eventType: RealtimeEventType, payload: any): void {
    const cbs = this.listeners.get(eventType);
    if (cbs) {
      cbs.forEach((cb) => cb(payload));
    }
  }

  private notifyListeners(payload: any): void {
    const table = payload.table;
    let type: RealtimeEventType = 'METRICS_UPDATE';

    if (table === 'notifications') type = 'NOTIFICATION';
    else if (table === 'projects') type = 'PROJECT_UPDATE';
    else if (table === 'scan_reports') type = 'SCAN_COMPLETE';

    this.broadcast(type, payload);
  }
}

export const realtimeService = new RealtimeService();
