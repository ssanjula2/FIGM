"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeService = exports.RealtimeService = void 0;
class RealtimeService {
    client = null;
    channel = null;
    listeners = new Map();
    constructor() {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (url && key) {
            try {
                const { createClient } = require('@supabase/supabase-js');
                this.client = createClient(url, key);
            }
            catch {
                this.client = null;
            }
        }
    }
    subscribe(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(callback);
        if (this.client && !this.channel) {
            try {
                this.channel = this.client
                    .channel('figm-saas-realtime')
                    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    this.notifyListeners(payload);
                })
                    .subscribe();
            }
            catch {
                // Fallback to local broadcaster
            }
        }
        return () => {
            this.listeners.get(eventType)?.delete(callback);
        };
    }
    broadcast(eventType, payload) {
        const cbs = this.listeners.get(eventType);
        if (cbs) {
            cbs.forEach((cb) => cb(payload));
        }
    }
    notifyListeners(payload) {
        const table = payload.table;
        let type = 'METRICS_UPDATE';
        if (table === 'notifications')
            type = 'NOTIFICATION';
        else if (table === 'projects')
            type = 'PROJECT_UPDATE';
        else if (table === 'scan_reports')
            type = 'SCAN_COMPLETE';
        this.broadcast(type, payload);
    }
}
exports.RealtimeService = RealtimeService;
exports.realtimeService = new RealtimeService();
//# sourceMappingURL=realtime-service.js.map