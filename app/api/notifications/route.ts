import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { NotificationRepository } from '../../../src/engine/notification-repository';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_anonymous';

  const { notifications, unreadCount } = NotificationRepository.getNotifications(userId);

  return NextResponse.json({
    notifications,
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_anonymous';

  try {
    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      NotificationRepository.markAllAsRead(userId);
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (notificationId) {
      NotificationRepository.markAsRead(notificationId);
      return NextResponse.json({ message: 'Notification marked as read' });
    }

    return NextResponse.json({ error: 'notificationId or markAll required' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update notification';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_anonymous';

  NotificationRepository.clearNotifications(userId);
  return NextResponse.json({ message: 'Notifications cleared successfully' });
}
