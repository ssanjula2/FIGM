"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRepository = void 0;
const repository_factory_1 = require("../storage/repository-factory");
class NotificationRepository {
    static get provider() {
        return repository_factory_1.RepositoryFactory.getStorageProvider();
    }
    static createNotification(userId, type, title, message) {
        return NotificationRepository.provider.createNotification({
            userId,
            type,
            title,
            message,
        });
    }
    static getNotifications(userId) {
        const notifications = NotificationRepository.provider.getNotifications(userId) || [];
        const unreadCount = notifications.filter((n) => !n.read).length;
        return { notifications, unreadCount };
    }
    static markAsRead(id) {
        NotificationRepository.provider.markNotificationRead(id);
    }
    static markAllAsRead(userId) {
        NotificationRepository.provider.markAllNotificationsRead(userId);
    }
    static clearNotifications(userId) {
        NotificationRepository.provider.clearNotifications(userId);
    }
}
exports.NotificationRepository = NotificationRepository;
//# sourceMappingURL=notification-repository.js.map