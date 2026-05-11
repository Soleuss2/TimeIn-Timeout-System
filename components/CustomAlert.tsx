import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface AlertAction {
  text: string;
  onPress: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertAction[];
  type?: "info" | "warning" | "error" | "success";
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons,
  type = "info",
}) => {
  const [scaleValue] = useState(new Animated.Value(0.8));
  const [fadeValue] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 68,
          friction: 11,
        }),
        Animated.timing(fadeValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleValue, fadeValue]);

  const getIconName = () => {
    switch (type) {
      case "error":
        return "alert-circle";
      case "warning":
        return "warning";
      case "success":
        return "checkmark-circle";
      case "info":
      default:
        return "information-circle";
    }
  };

  const getIconColor = () => {
    switch (type) {
      case "error":
        return "#d32f2f";
      case "warning":
        return "#f57c00";
      case "success":
        return "#1f8e4d";
      case "info":
      default:
        return "#1976d2";
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case "error":
        return "#ffebee";
      case "warning":
        return "#fff3e0";
      case "success":
        return "#e8f5e9";
      case "info":
      default:
        return "#e3f2fd";
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        // Handle back button on Android
        const cancelButton = buttons.find((b) => b.style === "cancel");
        if (cancelButton) {
          cancelButton.onPress();
        }
      }}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: fadeValue,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleValue }],
              opacity: fadeValue,
            },
          ]}
        >
          <View
            style={[styles.alertBox, { backgroundColor: getAccentColor() }]}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Ionicons
                name={getIconName() as any}
                size={56}
                color={getIconColor()}
              />
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => {
                const isDestructive = button.style === "destructive";
                const isCancel = button.style === "cancel";

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isDestructive && styles.buttonDestructive,
                      isCancel && styles.buttonCancel,
                      buttons.length > 1 && index === 0 && styles.buttonLeft,
                      buttons.length > 1 &&
                        index === buttons.length - 1 &&
                        styles.buttonRight,
                    ]}
                    onPress={button.onPress}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isDestructive && styles.buttonDestructiveText,
                        isCancel && styles.buttonCancelText,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "85%",
    maxWidth: 420,
  },
  alertBox: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 15,
    fontWeight: "500",
    color: "#525252",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
  },
  buttonLeft: {
    marginRight: 4,
  },
  buttonRight: {
    marginLeft: 4,
  },
  buttonCancel: {
    backgroundColor: "#f5f5f5",
    borderColor: "#d0d0d0",
  },
  buttonDestructive: {
    backgroundColor: "#ffebee",
    borderColor: "#ef5350",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#424242",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  buttonCancelText: {
    color: "#666666",
  },
  buttonDestructiveText: {
    color: "#d32f2f",
  },
});
