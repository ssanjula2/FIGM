import { DBNotification } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';

export class NotificationRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async createNotification(
    userId: string,
    type: 'SCAN_SUCCESS' | 'SCAN_FAILED' | 'AI_FINISHED' | 'EXPORT_FINISHED' | 'SECURITY_ALERT',
    title: string,
    message: string
  ): Promise<DBNotification> {
    return NotificationRepository.provider.createNotification({
      userId,
      type,
      title,
      message,
    }) as Promise<DBNotification>;
  }

  public static async getNotifications(userId: string): Promise<{ notifications: DBNotification[]; unreadCount: number }> {
    const notifications = ((await NotificationRepository.provider.getNotifications(userId)) as DBNotification[]) || [];
    const unreadCount = notifications.filter((n) => !n.read).length;
    return { notifications, unreadCount };
  }

  public static async markAsRead(id: string): Promise<void> {
    await NotificationRepository.provider.markNotificationRead(id);
  }

  public static async markAllAsRead(userId: string): Promise<void> {
    await NotificationRepository.provider.markAllNotificationsRead(userId);
  }

  public static async clearNotifications(userId: string): Promise<void> {
    await NotificationRepository.provider.clearNotifications(userId);
  }
}
