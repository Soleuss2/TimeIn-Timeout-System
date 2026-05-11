import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CustomAlert, AlertAction } from "../../components/CustomAlert";
import { AuthService } from "../../services/authService";

type ScannedPayload = {
  app?: string;
  role?: string;
  studentId?: string;
  username?: string;
  name?: string;
  plateNumber?: string | null;
};

function parseScannedPayload(data: string): ScannedPayload | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ScannedPayload;
    }
  } catch (error) {
    return null;
  }

  return null;
}

export default function GuardScreen() {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const scannedPayload = scannedData ? parseScannedPayload(scannedData) : null;

  const handleLogout = async () => {
    await AuthService.logout();
    router.push("/");
  };

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

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedData) return;
    setScannedData(data);
    const parsed = parseScannedPayload(data);

    setAlertConfig({
      title: "QR Code Scanned",
      message: parsed?.name
        ? `${parsed.name}${parsed.studentId ? `\n${parsed.studentId}` : ""}`
        : data,
      type: "success",
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

  const handleManualSubmit = () => {
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

    setAlertConfig({
      title: "Entry Saved",
      message: `Plate ${trimmedPlate.toUpperCase()} has been recorded.`,
      type: "success",
      buttons: [
        {
          text: "OK",
          onPress: () => setAlertVisible(false),
          style: "default",
        },
      ],
    });
    setAlertVisible(true);
    setPlate("");
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

  const cameraStatusLabel =
    hasPermission === null ? "Waiting" : hasPermission ? "Ready" : "Denied";
  const cameraStatusText =
    hasPermission === true
      ? "Live camera access is active."
      : hasPermission === false
        ? "Enable camera access to scan QR codes."
        : "Requesting camera permission...";

  return (
    <SafeAreaView style={styles.safeArea}>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
      <StatusBar barStyle="light-content" backgroundColor="#1f8e4d" />
      <View style={styles.backgroundShapeTop} />
      <View style={styles.backgroundShapeBottom} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Guard Portal</Text>
          <Text style={styles.headerSubtitle}>Gate Scanner</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.activityButton}
            onPress={() => router.push({ pathname: "/guard-activity" })}
          >
            <Ionicons name="bar-chart-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentShell}>
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
              Use this when a visitor arrives without a QR pass.
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
        </View>
      </ScrollView>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
