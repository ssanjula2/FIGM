
import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { NotificationRepository } from '../../../src/engine/notification-repository';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = auth.user.userId;

  const { notifications, unreadCount } = await NotificationRepository.getNotifications(userId);

  return NextResponse.json({
    notifications,
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = auth.user.userId;

  try {
    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await NotificationRepository.markAllAsRead(userId);
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (notificationId) {
      const ok = await NotificationRepository.markAsRead(notificationId, userId);
      if (!ok) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }
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
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await NotificationRepository.clearNotifications(auth.user.userId);
  return NextResponse.json({ message: 'Notifications cleared successfully' });
}
