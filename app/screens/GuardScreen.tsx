import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView } from "expo-camera";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    Animated,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    PanResponder,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { AlertAction, CustomAlert } from "../../components/CustomAlert";
import { LoaderComponent } from "../../components/LoaderComponent";
import { processGuardEntry } from "../../services/guardService";
import { AuthService } from "../../services/authService";
import { useAuth } from "../../services/authContext";
import { useGuardNotifications } from "../../hooks/useNotifications";
import { ScanNotificationStack } from "../../components/ScanNotificationBanner";
import { NotificationHistoryModal } from "../../components/NotificationHistoryModal";

type ScannedPayload = {
  app?: string;
  role?: string;
  studentId?: string;
  id?: string;
  username?: string;
  name?: string;
  plateNumber?: string | null;
  vehicleType?: string;
};

function parseScannedPayload(data: string): ScannedPayload | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ScannedPayload;
    }
  } catch {
    return null;
  }

  return null;
}

export default function GuardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [plate, setPlate] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const scannedPayload = scannedData ? parseScannedPayload(scannedData) : null;
  const [logoutLoading, setLogoutLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get notifications for this guard
  const { notifications, clearNotification } = useGuardNotifications(user?.id || null);

  // History modal state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: "info" | "warning" | "error" | "success";
    buttons: AlertAction[];
  }>({
    title: "",
    message: "",
    type: "info",
    buttons: [],
  });

  // PanResponder for swipe gesture detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate if there's significant horizontal movement and minimal vertical movement
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Detect left or right swipe (threshold of 50 pixels)
        const SWIPE_THRESHOLD = 50;
        if (gestureState.dx > SWIPE_THRESHOLD || gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe detected - show logout confirmation
          handleLogout();
        }
      },
    })
  ).current;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // Handle back button press and swipe gestures
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Show logout confirmation instead of exiting
        handleLogout();
        return true; // Prevent default back behavior
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => subscription.remove();
    }, [])
  );

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scannedData) return;
    setScannedData(data);

    const parsed = parseScannedPayload(data);

    // Validation: reject unparseable QR payloads
    if (!parsed) {
      setAlertConfig({
        title: "Invalid QR Code",
        message: "The scanned QR code could not be read. Please try again.",
        type: "error",
        buttons: [
          {
            text: "OK",
            onPress: () => {
              setAlertVisible(false);
              setScannedData(null);
            },
            style: "default",
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    // Support multiple roles — extract a unified user ID
    const userId = parsed.studentId || parsed.id;

    try {
      const result = await processGuardEntry({
        id: userId,
        name: parsed.name,
        role: parsed.role,
        plateNumber: parsed.plateNumber ?? undefined,
        vehicleType: parsed.vehicleType,
        method: "QR",
      }, user?.id);

      if (result.success) {
        const actionLabel =
          result.action === "TIMEIN"
            ? "TIME IN SUCCESSFUL"
            : "TIME OUT SUCCESSFUL";

        setAlertConfig({
          title: actionLabel,
          message: `${result.name}${parsed.role ? `\n(${parsed.role.toUpperCase()})` : ""}`,
          type: "success",
          buttons: [
            {
              text: "OK",
              onPress: () => {
                setAlertVisible(false);
                setScannedData(null); // Reset scanner for next scan
              },
              style: "default",
            },
          ],
        });
      } else {
        setAlertConfig({
          title: "Error",
          message: result.message || "An unknown error occurred.",
          type: "error",
          buttons: [
            {
              text: "OK",
              onPress: () => {
                setAlertVisible(false);
                setScannedData(null);
              },
              style: "default",
            },
          ],
        });
      }
      setAlertVisible(true);
    } catch {
      setAlertConfig({
        title: "Error",
        message: "Failed to process entry. Please check your connection.",
        type: "error",
        buttons: [
          {
            text: "OK",
            onPress: () => {
              setAlertVisible(false);
              setScannedData(null);
            },
            style: "default",
          },
        ],
      });
      setAlertVisible(true);
    }
  };

  const handleManualSubmit = async () => {
    const trimmedPlate = plate.trim();

    if (!trimmedPlate) {
      setAlertConfig({
        title: "Validation",
        message: "Please enter a plate number",
        type: "warning",
        buttons: [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    try {
      const result = await processGuardEntry({
        plateNumber: trimmedPlate.toUpperCase(),
        method: "MANUAL",
        role: "visitor",
      }, user?.id);

      if (result.success) {
        const actionLabel =
          result.action === "TIMEIN"
            ? `Vehicle ${trimmedPlate.toUpperCase()} ENTERED`
            : `Vehicle ${trimmedPlate.toUpperCase()} EXITED`;

        setAlertConfig({
          title:
            result.action === "TIMEIN" ? "ENTRY RECORDED" : "EXIT RECORDED",
          message: actionLabel,
          type: "success",
          buttons: [
            {
              text: "OK",
              onPress: () => setAlertVisible(false),
              style: "default",
            },
          ],
        });
      } else {
        setAlertConfig({
          title: "Error",
          message: result.message || "An unknown error occurred.",
          type: "error",
          buttons: [
            {
              text: "OK",
              onPress: () => setAlertVisible(false),
              style: "default",
            },
          ],
        });
      }
      setAlertVisible(true);
      setPlate("");
    } catch {
      setAlertConfig({
        title: "Error",
        message: "Failed to process entry. Please check your connection.",
        type: "error",
        buttons: [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      });
      setAlertVisible(true);
    }
  };

  const handleResetScanner = () => {
    setScannedData(null);
    setAlertConfig({
      title: "Scanner Reset",
      message: "The camera is ready for the next QR code.",
      type: "info",
      buttons: [
        {
          text: "OK",
          onPress: () => setAlertVisible(false),
          style: "default",
        },
      ],
    });
    setAlertVisible(true);
  };

  const handleLogout = async () => {
    setAlertConfig({
      title: "Logout Confirmation",
      message: "Are you sure you want to logout? You will need to sign in again.",
      type: "warning",
      buttons: [
        {
          text: "Cancel",
          onPress: () => setAlertVisible(false),
          style: "cancel",
        },
        {
          text: "Yes, Logout",
          onPress: async () => {
            setAlertVisible(false);
            try {
              setLogoutLoading(true);
              // Animate out before logout
              Animated.parallel([
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 400,
                  useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                  toValue: 0.8,
                  duration: 400,
                  useNativeDriver: true,
                }),
              ]).start(async () => {
                // Give loader time to render
                await new Promise((resolve) => setTimeout(resolve, 500));
                // Perform logout
                const result = await AuthService.logout();
                if (result.success) {
                  router.replace("/");
                } else {
                  setAlertConfig({
                    title: "Logout Error",
                    message: result.message || "Logout failed",
                    type: "error",
                    buttons: [
                      {
                        text: "OK",
                        onPress: () => setAlertVisible(false),
                        style: "default",
                      },
                    ],
                  });
                  setAlertVisible(true);
                  setLogoutLoading(false);
                  // Reset animations if logout failed
                  fadeAnim.setValue(1);
                  scaleAnim.setValue(1);
                }
              });
            } catch {
              setAlertConfig({
                title: "Error",
                message: "An error occurred during logout",
                type: "error",
                buttons: [
                  {
                    text: "OK",
                    onPress: () => setAlertVisible(false),
                    style: "default",
                  },
                ],
              });
              setAlertVisible(true);
              setLogoutLoading(false);
              // Reset animations on error
              fadeAnim.setValue(1);
              scaleAnim.setValue(1);
            }
          },
          style: "destructive",
        },
      ],
    });
    setAlertVisible(true);
  };

  const cameraStatusLabel =
    hasPermission === null ? "Waiting" : hasPermission ? "Ready" : "Denied";
  const cameraStatusText =
    hasPermission === true
      ? "Live camera access is active."
      : hasPermission === false
        ? "Enable camera access to scan QR codes."
        : "Requesting camera permission...";

  return (
    <SafeAreaView style={styles.safeArea} {...panResponder.panHandlers}>
      <LoaderComponent
        visible={logoutLoading}
        message="Logging out..."
        logoSize={100}
      />
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
      <ScanNotificationStack
        notifications={notifications}
        onDismiss={clearNotification}
        onGuard={true}
      />
      <StatusBar barStyle="light-content" backgroundColor="#1f8e4d" />
      <View style={styles.backgroundShapeTop} />
      <View style={styles.backgroundShapeBottom} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Guard Portal</Text>
          <Text style={styles.headerSubtitle}>Gate Scanner</Text>
        </View>
        <TouchableOpacity
          style={styles.activityButton}
          onPress={() => router.push({ pathname: "/guard-activity" })}
        >
          <Ionicons name="bar-chart-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.activityButton}
          onPress={() => setHistoryModalVisible(true)}
        >
          <Ionicons name="notifications-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.activityButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.contentShell,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.scannerCard}>
            <View style={styles.scannerCaptureArea}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardLabel}>Live Scanner</Text>
                  <Text style={styles.cardTitle}>
                    Point camera at student QR
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {cameraStatusLabel.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.scannerStage}>
                <View style={styles.scannerStageGlowTop} />
                <View style={styles.scannerStageGlowBottom} />
                <View style={styles.scannerFrame}>
                  {Platform.OS === "web" ? (
                    <View style={styles.scannerFallback}>
                      <Text style={styles.scannerFallbackText}>
                        Camera scanner not supported on web. Use manual plate
                        entry below.
                      </Text>
                    </View>
                  ) : hasPermission === null ? (
                    <View style={styles.scannerFallback}>
                      <Text style={styles.scannerFallbackText}>
                        Requesting camera permission...
                      </Text>
                    </View>
                  ) : hasPermission === false ? (
                    <View style={styles.scannerFallback}>
                      <Text style={styles.scannerFallbackText}>
                        Camera access denied
                      </Text>
                    </View>
                  ) : (
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={handleBarCodeScanned}
                    />
                  )}
                </View>
              </View>

              <Text style={styles.scanStatus}>
                {scannedData
                  ? `Last scanned: ${scannedPayload?.name ?? "QR code captured"}`
                  : cameraStatusText}
              </Text>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={handleResetScanner}
              >
                <Text style={styles.secondaryActionText}>Reset Scanner</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push({ pathname: "/add-visitor" })}
              >
                <Text style={styles.actionText}>
                  Register & Log Visitor Profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.manualCard}>
            <Text style={styles.cardLabel}>Manual Plate Entry</Text>
            <Text style={styles.manualHint}>
              Use this when the QR code is not working.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="E.G. ABC 1234"
              placeholderTextColor="#9aa5b1"
              value={plate}
              onChangeText={setPlate}
              autoCapitalize="characters"
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleManualSubmit}
            >
              <Text style={styles.submitText}>SUBMIT ENTRY</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      <NotificationHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        guardId={user?.id}
        isGuard={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef4ef",
  },
  backgroundShapeTop: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(31, 142, 77, 0.08)",
  },
  backgroundShapeBottom: {
    position: "absolute",
    bottom: 30,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(17, 65, 42, 0.05)",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  contentShell: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  header: {
    backgroundColor: "#1f8e4d",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: "row",
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
  activityButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#d6f0d9",
    marginTop: 4,
    fontSize: 13,
  },
  scannerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 32,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e5ece7",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  scannerCaptureArea: {
    backgroundColor: "#f8fbf9",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e4ede6",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  cardHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  cardLabel: {
    color: "#1f8e4d",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  cardTitle: {
    color: "#14251b",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  badge: {
    backgroundColor: "#dff3e7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    color: "#1f8e4d",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  scannerStage: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  scannerStageGlowTop: {
    position: "absolute",
    top: 0,
    right: 8,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(31, 142, 77, 0.08)",
  },
  scannerStageGlowBottom: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(22, 65, 41, 0.06)",
  },
  scannerFrame: {
    width: "100%",
    height: 280,
    borderRadius: 28,
    backgroundColor: "#0b0f0d",
    borderWidth: 1,
    borderColor: "#e3ebe4",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  scannerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  scannerFallbackText: {
    marginTop: 10,
    color: "#d5e8d9",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  scanStatus: {
    color: "#607181",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
  secondaryActionButton: {
    marginTop: 12,
    backgroundColor: "#f8fbf9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dce6de",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryActionText: {
    color: "#216b43",
    fontWeight: "800",
    fontSize: 14,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: "#1f8e4d",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  actionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  manualCard: {
    backgroundColor: "#ffffff",
    borderRadius: 32,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e5ece7",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  manualHint: {
    color: "#607181",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4ede6",
    paddingHorizontal: 14,
    backgroundColor: "#f8fbf9",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 18,
  },
  submitButton: {
    backgroundColor: "#d7f3dc",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitText: {
    color: "#1f8e4d",
    fontWeight: "800",
    fontSize: 15,
  },
});
