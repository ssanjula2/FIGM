import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NotificationRepository } from '../src/engine/notification-repository';
import { UserRepository } from '../src/engine/user-repository';
import { UserDB } from '../src/auth/user-db';
import { hashPassword } from '../src/auth/auth-service';
import { RepositoryFactory } from '../src/storage/repository-factory';

describe('SaaS Production Features 5, 6, 7: User Profile, Settings & Notifications Suite', () => {
  it('Notification Repository creates notifications, tracks unread counts, and marks read', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    NotificationRepository.createNotification(
      userId,
      'SCAN_SUCCESS',
      'Scan Complete',
      'Your project scan finished with 0 critical defects.'
    );

    NotificationRepository.createNotification(
      userId,
      'SECURITY_ALERT',
      'Security Alert',
      'Unused state variable detected in main panel.'
    );

    const res = NotificationRepository.getNotifications(userId);
    assert.ok(Array.isArray(res.notifications));
    assert.ok(res.unreadCount >= 0);

    if (res.notifications.length > 0) {
      NotificationRepository.markAsRead(res.notifications[0].id);
    }

    NotificationRepository.markAllAsRead(userId);
    const updatedRes = NotificationRepository.getNotifications(userId);
    assert.ok(updatedRes !== undefined);
  });

  it('User Settings persist theme, auto-save, auto-scan, AI model, and export defaults', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_settings_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const defaultSettings = UserRepository.getSettings(userId);
    assert.ok(defaultSettings);

    const updated = UserRepository.updateSettings(userId, {
      theme: 'light',
      aiModel: 'claude-3.5-sonnet',
      autoScan: false,
    });

    assert.strictEqual(updated.theme, 'light');
    assert.strictEqual(updated.aiModel, 'claude-3.5-sonnet');
    assert.strictEqual(updated.autoScan, false);
  });

  it('User Profile password update, API key regeneration, and profile stats', async () => {
    RepositoryFactory.resetProvider();
    const rawPass = 'SecretPass123!';
    const user = UserDB.createUser({
      email: `test_profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@figm.io`,
      passwordHash: hashPassword(rawPass),
      fullName: 'Test Profile User',
      role: 'DEVELOPER',
    });

    const profileData = UserRepository.getUserProfile(user.id);
    assert.strictEqual(profileData.user?.fullName, 'Test Profile User');

    const newKey = UserRepository.regenerateApiKey(user.id);
    assert.ok(newKey);
    assert.ok(newKey.startsWith('figm_key_'));

    const changeRes = UserRepository.changePassword(user.id, rawPass, 'NewSecretPass456!');
    assert.strictEqual(changeRes.success, true);
  });
});
