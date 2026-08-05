import { describe, it } from 'node:test';
import assert from 'node:assert';
import { realtimeService } from '../src/storage/realtime-service';
import { supabaseFileService } from '../src/storage/supabase-file-service';

describe('Phase 5 & 6: Realtime & Storage Service Suite', () => {
  it('RealtimeService registers subscriptions and dispatches broadcast events', async () => {
    let receivedPayload: any = null;
    const unsub = realtimeService.subscribe('NOTIFICATION', (payload) => {
      receivedPayload = payload;
    });

    realtimeService.broadcast('NOTIFICATION', { title: 'Realtime Notification Test' });

    assert.ok(receivedPayload);
    assert.strictEqual(receivedPayload.title, 'Realtime Notification Test');
    unsub();
  });

  it('SupabaseFileService uploads report content and generates download URLs', async () => {
    const res = await supabaseFileService.uploadReport('TestReport.json', '{"test": true}', 'JSON', 'application/json');
    assert.ok(res);
    assert.strictEqual(res.fileName, 'TestReport.json');
    assert.strictEqual(res.format, 'JSON');
    assert.ok(res.downloadUrl);
  });
});
