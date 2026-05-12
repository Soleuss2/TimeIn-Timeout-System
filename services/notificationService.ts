import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

export interface ScanNotification {
  id?: string;
  guardId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: "TIMEIN" | "TIMEOUT";
  method: "QR" | "MANUAL";
  timestamp?: Timestamp;
  isRead: boolean;
  plateNumber?: string | null;
}

/**
 * Creates a notification when a guard successfully scans a user
 * This notification will be visible to both the guard and the scanned user
 */
export const createScanNotification = async (
  guardId: string,
  scannedData: {
    userId: string;
    userName: string;
    userRole: string;
    action: "TIMEIN" | "TIMEOUT";
    method: "QR" | "MANUAL";
    plateNumber?: string | null;
  }
): Promise<{ success: boolean; notificationId?: string; message?: string }> => {
  try {
    const notificationsRef = collection(db, "ScanNotifications");

    const notification: Omit<ScanNotification, "id"> = {
      guardId,
      userId: scannedData.userId,
      userName: scannedData.userName,
      userRole: scannedData.userRole,
      action: scannedData.action,
      method: scannedData.method,
      timestamp: serverTimestamp(),
      isRead: false,
      plateNumber: scannedData.plateNumber || null,
    };

    const docRef = await addDoc(notificationsRef, notification);

    // Auto-delete notification after 30 seconds (for transient feedback)
    setTimeout(() => {
      markNotificationAsRead(docRef.id);
    }, 30000);

    return {
      success: true,
      notificationId: docRef.id,
    };
  } catch (error) {
    console.error("Error creating scan notification:", error);
    return {
      success: false,
      message: "Failed to create notification",
    };
  }
};

/**
 * Mark a notification as read (can be used for cleanup)
 */
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const notificationRef = doc(db, "ScanNotifications", notificationId);
    await updateDoc(notificationRef, { isRead: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

/**
 * Listen for notifications for a specific user (student/visitor)
 * Called from StudentScreen to show when they've been scanned
 */
export const subscribeToUserNotifications = (
  userId: string,
  callback: (notifications: ScanNotification[]) => void
): (() => void) => {
  try {
    const notificationsRef = collection(db, "ScanNotifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      where("isRead", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: ScanNotification[] = [];
      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as ScanNotification);
      });
      callback(notifications);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to user notifications:", error);
    return () => {};
  }
};

/**
 * Listen for notifications for a specific guard
 * Called from GuardScreen to show scan confirmations
 */
export const subscribeToGuardNotifications = (
  guardId: string,
  callback: (notifications: ScanNotification[]) => void
): (() => void) => {
  try {
    const notificationsRef = collection(db, "ScanNotifications");
    const q = query(
      notificationsRef,
      where("guardId", "==", guardId),
      where("isRead", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: ScanNotification[] = [];
      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as ScanNotification);
      });
      callback(notifications);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to guard notifications:", error);
    return () => {};
  }
};

/**
 * Clear old notifications (cleanup function)
 */
export const clearOldNotifications = async (olderThanMinutes: number = 5) => {
  try {
    const notificationsRef = collection(db, "ScanNotifications");
    const fiveMinutesAgo = new Date(Date.now() - olderThanMinutes * 60000);

    const q = query(
      notificationsRef,
      where("isRead", "==", true),
      where("timestamp", "<=", Timestamp.fromDate(fiveMinutesAgo))
    );

    // Note: Firestore doesn't support batch delete in a query
    // This is left for future implementation with cloud functions or admin SDK
  } catch (error) {
    console.error("Error clearing old notifications:", error);
  }
};

/**
 * Fetch notification history for a specific user (student/visitor)
 * Returns all notifications (read and unread) for the user, sorted by most recent first
 * 
 * Note: Requires composite index on ScanNotifications (userId, timestamp)
 * If index is not ready, will fall back to client-side sorting
 */
export const fetchUserNotificationHistory = async (
  userId: string,
  limitCount: number = 50
): Promise<ScanNotification[]> => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const notificationsRef = collection(db, "ScanNotifications");
    
    // Try the optimized query first (requires index)
    try {
      const q = query(
        notificationsRef,
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const notifications: ScanNotification[] = [];

      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as ScanNotification);
      });

      return notifications;
    } catch (indexError) {
      // If index doesn't exist, fall back to client-side sorting
      console.warn("Composite index not ready, using client-side sorting:", indexError);
      
      const q = query(
        notificationsRef,
        where("userId", "==", userId)
      );
      
      const snapshot = await getDocs(q);
      const notifications: ScanNotification[] = [];

      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as ScanNotification);
      });

      // Sort client-side by timestamp descending
      notifications.sort((a, b) => {
        const aTime = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0;
        const bTime = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0;
        return bTime - aTime;
      });

      return notifications.slice(0, limitCount);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching user notification history:", errorMessage, error);
    throw error; // Re-throw to allow component to handle it
  }
};

/**
 * Fetch notification history for a specific guard
 * Returns all notifications (read and unread) for the guard, sorted by most recent first
 * 
 * Note: Requires composite index on ScanNotifications (guardId, timestamp)
 * If index is not ready, will fall back to client-side sorting
 */
export const fetchGuardNotificationHistory = async (
  guardId: string,
  limitCount: number = 50
): Promise<ScanNotification[]> => {
  try {
    if (!guardId) {
      throw new Error("Guard ID is required");
    }

    const notificationsRef = collection(db, "ScanNotifications");
    
    // Try the optimized query first (requires index)
    try {
      const q = query(
        notificationsRef,
        where("guardId", "==", guardId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const notifications: ScanNotification[] = [];

      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as ScanNotification);
      });

      return notifications;
    } catch (indexError) {
      // If index doesn't exist, fall back to client-side sorting
      console.warn("Composite index not ready, using client-side sorting:", indexError);
      
      const q = query(
        notificationsRef,
        where("guardId", "==", guardId)
      );

      const snapshot = await getDocs(q);
      const notifications: ScanNotification[] = [];

      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as ScanNotification);
      });

      // Sort client-side by timestamp descending
      notifications.sort((a, b) => {
        const aTime = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0;
        const bTime = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0;
        return bTime - aTime;
      });

      return notifications.slice(0, limitCount);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching guard notification history:", errorMessage, error);
    throw error; // Re-throw to allow component to handle it
  }
};
