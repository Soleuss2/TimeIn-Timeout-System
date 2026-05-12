import React, { useEffect, useRef } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScanNotification } from "../services/notificationService";

interface ScanNotificationBannerProps {
  notification: ScanNotification;
  onDismiss: () => void;
  autoHideDuration?: number;
  onGuard?: boolean; // If true, show "Guard verified scan" message
}

export const ScanNotificationBanner: React.FC<ScanNotificationBannerProps> = ({
  notification,
  onDismiss,
  autoHideDuration = 4000,
  onGuard = false,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss timer
    const timer = setTimeout(() => {
      animateOut();
    }, autoHideDuration);

    return () => clearTimeout(timer);
  }, [autoHideDuration, slideAnim, opacityAnim]);

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const isTimeIn = notification.action === "TIMEIN";
  const backgroundColor = isTimeIn ? "#4CAF50" : "#FF9800"; // Green for Time In, Orange for Time Out
  const icon = isTimeIn ? "log-in" : "log-out";

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === "ios" ? -120 : -100, 0],
  });

  const actionText = onGuard
    ? `${notification.userName} - ${notification.action === "TIMEIN" ? "TIME IN" : "TIME OUT"}`
    : `You've been ${isTimeIn ? "SCANNED IN" : "SCANNED OUT"}`;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={[styles.banner, { backgroundColor }]}>
        <View style={styles.contentContainer}>
          <Ionicons
            name={icon}
            size={24}
            color="white"
            style={styles.icon}
          />
          <View style={styles.textContainer}>
            <Text style={styles.mainText}>{actionText}</Text>
            {notification.method === "MANUAL" && notification.plateNumber && (
              <Text style={styles.subText}>Plate: {notification.plateNumber}</Text>
            )}
            {notification.userRole && (
              <Text style={styles.roleText}>
                Role: {notification.userRole.toUpperCase()}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={animateOut}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

interface ScanNotificationStackProps {
  notifications: ScanNotification[];
  onDismiss: (id: string) => void;
  onGuard?: boolean;
}

/**
 * Stack of notifications that displays multiple notifications
 */
export const ScanNotificationStack: React.FC<ScanNotificationStackProps> = ({
  notifications,
  onDismiss,
  onGuard = false,
}) => {
  if (notifications.length === 0) return null;

  return (
    <View style={styles.stack}>
      {notifications.map((notification, index) => (
        <View key={notification.id || index} style={[styles.stackItem, { marginTop: index * 10 }]}>
          <ScanNotificationBanner
            notification={notification}
            onDismiss={() => notification.id && onDismiss(notification.id)}
            autoHideDuration={4000}
            onGuard={onGuard}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  mainText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 2,
  },
  subText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
  },
  roleText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
  stack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  stackItem: {
    marginBottom: 8,
  },
});
