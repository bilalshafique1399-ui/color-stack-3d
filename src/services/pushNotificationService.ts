export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermission(): PushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestPushPermission(): Promise<{
  granted: boolean;
  status: PushPermissionStatus;
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      status: 'unsupported',
      message: 'In-app smart alerts enabled (OS push notifications not supported in this WebView).',
    };
  }

  try {
    const result = await window.Notification.requestPermission();
    if (result === 'granted') {
      return {
        granted: true,
        status: 'granted',
        message: 'Push Notifications Enabled! We will alert you when Spins & Mystery Boxes are ready.',
      };
    }
    return {
      granted: false,
      status: result,
      message:
        result === 'denied'
          ? 'Browser notifications blocked in site settings — In-App Smart Alerts will still notify you.'
          : 'Notification permission dismissed.',
    };
  } catch {
    return {
      granted: false,
      status: getNotificationPermission(),
      message: 'In-app smart alerts enabled for Spin, Mystery Box & Friend Battles.',
    };
  }
}

export async function sendDeviceNotification(
  title: string,
  body: string,
  tag: string = 'cs3d-alert',
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/favicon-32x32.png',
          tag,
        });
        return true;
      }
    }
  } catch {
    // Fallback to standard Notification constructor below
  }

  try {
    const notif = new window.Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
    });
    notif.onclick = () => {
      try {
        window.focus();
        notif.close();
      } catch {
        // ignore
      }
    };
    return true;
  } catch {
    return false;
  }
}
