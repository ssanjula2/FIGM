import { DBNotification } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';

export class NotificationRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static createNotification(
    userId: string,
    type: 'SCAN_SUCCESS' | 'SCAN_FAILED' | 'AI_FINISHED' | 'EXPORT_FINISHED' | 'SECURITY_ALERT',
    title: string,
    message: string
  ): DBNotification {
    return NotificationRepository.provider.createNotification({
      userId,
      type,
      title,
      message,
    }) as DBNotification;
  }

  public static getNotifications(userId: string): { notifications: DBNotification[]; unreadCount: number } {
    const notifications = (NotificationRepository.provider.getNotifications(userId) as DBNotification[]) || [];
    const unreadCount = notifications.filter((n) => !n.read).length;
    return { notifications, unreadCount };
  }

  public static markAsRead(id: string): void {
    NotificationRepository.provider.markNotificationRead(id);
  }

  public static markAllAsRead(userId: string): void {
    NotificationRepository.provider.markAllNotificationsRead(userId);
  }

  public static clearNotifications(userId: string): void {
    NotificationRepository.provider.clearNotifications(userId);
  }
}
