import { useEffect, useState } from "react";
import {
  ScanNotification,
  subscribeToUserNotifications,
  subscribeToGuardNotifications,
  markNotificationAsRead,
} from "../services/notificationService";

/**
 * Hook for guard to listen to their own scan notifications
 */
export const useGuardNotifications = (guardId: string | null) => {
  const [notifications, setNotifications] = useState<ScanNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!guardId) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    // Subscribe to guard's notifications
    const unsubscribe = subscribeToGuardNotifications(guardId, (newNotifications) => {
      setNotifications(newNotifications);
      setLoading(false);
    });

    // Cleanup subscription
    return () => {
      unsubscribe();
    };
  }, [guardId]);

  const clearNotification = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const clearAllNotifications = async () => {
    for (const notification of notifications) {
      if (notification.id) {
        await markNotificationAsRead(notification.id);
      }
    }
    setNotifications([]);
  };

  return {
    notifications,
    loading,
    clearNotification,
    clearAllNotifications,
  };
};

/**
 * Hook for users/students to listen for scan notifications
 */
export const useUserNotifications = (userId: string | null) => {
  const [notifications, setNotifications] = useState<ScanNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    // Subscribe to user's notifications
    const unsubscribe = subscribeToUserNotifications(userId, (newNotifications) => {
      setNotifications(newNotifications);
      setLoading(false);
    });

    // Cleanup subscription
    return () => {
      unsubscribe();
    };
  }, [userId]);

  const clearNotification = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const clearAllNotifications = async () => {
    for (const notification of notifications) {
      if (notification.id) {
        await markNotificationAsRead(notification.id);
      }
    }
    setNotifications([]);
  };

  return {
    notifications,
    loading,
    clearNotification,
    clearAllNotifications,
  };
};
