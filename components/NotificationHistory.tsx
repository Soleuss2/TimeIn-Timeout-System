import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  ListRenderItem,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ScanNotification,
  fetchUserNotificationHistory,
  fetchGuardNotificationHistory,
} from "../services/notificationService";

interface NotificationHistoryProps {
  userId?: string;
  guardId?: string;
  isGuard?: boolean;
  maxItems?: number;
  onClose?: () => void;
}

export const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  userId,
  guardId,
  isGuard = false,
  maxItems = 50,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<ScanNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        let history: ScanNotification[] = [];

        if (isGuard && guardId) {
          history = await fetchGuardNotificationHistory(guardId, maxItems);
        } else if (!isGuard && userId) {
          history = await fetchUserNotificationHistory(userId, maxItems);
        } else {
          setError("No user or guard ID provided");
          setLoading(false);
          return;
        }

        setNotifications(history);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load notification history";
        setError(errorMessage);
        console.error("Error loading notification history:", error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [userId, guardId, isGuard, maxItems]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "Unknown";

    try {
      const date =
        timestamp.toDate instanceof Function
          ? timestamp.toDate()
          : new Date(timestamp);

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  const renderNotification: ListRenderItem<ScanNotification> = ({
    item,
    index,
  }) => {
    const isTimeIn = item.action === "TIMEIN";
    const backgroundColor = isTimeIn ? "#E8F5E9" : "#FFF3E0";
    const borderColor = isTimeIn ? "#4CAF50" : "#FF9800";
    const icon = isTimeIn ? "log-in" : "log-out";
    const iconColor = isTimeIn ? "#4CAF50" : "#FF9800";

    return (
      <View key={item.id || index} style={[styles.notificationItem, { borderLeftColor: borderColor, backgroundColor }]}>
        <View style={styles.notificationIconContainer}>
          <View
            style={[
              styles.notificationIconBg,
              { backgroundColor: iconColor },
            ]}
          >
            <Ionicons name={icon} size={16} color="white" />
          </View>
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationAction}>
              {isTimeIn ? "TIME IN" : "TIME OUT"}
            </Text>
            <Text style={styles.notificationTime}>
              {formatDate(item.timestamp)}
            </Text>
          </View>

          <Text style={styles.notificationName}>{item.userName}</Text>

          {item.userRole && (
            <Text style={styles.notificationRole}>
              Role: {item.userRole}
            </Text>
          )}

          {item.method === "MANUAL" && item.plateNumber ? (
            <Text style={styles.notificationPlate}>
              Plate: {item.plateNumber}
            </Text>
          ) : (
            <Text style={styles.notificationMethod}>
              Method: {item.method === "QR" ? "QR Code" : "Manual"}
            </Text>
          )}

          {item.isRead && (
            <View style={styles.readBadge}>
              <Text style={styles.readBadgeText}>Read</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#1f8e4d" />
          <Text style={styles.loaderText}>Loading notification history...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification History</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>Error Loading Notifications</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          {onClose && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
              }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            {isGuard
              ? "Your scan notifications will appear here"
              : "You will be notified when scanned by a guard"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification History</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id || Math.random().toString()}
        scrollEnabled={true}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Showing {notifications.length} notification
          {notifications.length !== 1 ? "s" : ""}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#1f8e4d",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  notificationItem: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationIconContainer: {
    marginRight: 12,
    justifyContent: "center",
  },
  notificationIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationAction: {
    fontWeight: "600",
    fontSize: 14,
    color: "#333",
  },
  notificationTime: {
    fontSize: 12,
    color: "#888",
  },
  notificationName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#222",
    marginBottom: 2,
  },
  notificationRole: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  notificationPlate: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  notificationMethod: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  readBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  readBadgeText: {
    fontSize: 11,
    color: "#666",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 12,
    color: "#666",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#888",
    marginTop: 8,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f44336",
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 13,
    color: "#888",
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#1f8e4d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f0f0f0",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  footerText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});
