import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { type ComponentType, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { AlertAction, CustomAlert } from "../../components/CustomAlert";
import { registerVisitor } from "../../services/guardService";

// ── QRCode (native-only, graceful fallback on web) ──
type QRCodeProps = {
  value: string;
  size: number;
  getRef?: (ref: any) => void;
};

let QRCode: ComponentType<QRCodeProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  QRCode = require("react-native-qrcode-svg").default;
} catch {
  QRCode = null;
}

export default function AddVisitorScreen() {
  const router = useRouter();

  // ── Form state ──
  const [visitorName, setVisitorName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownHeight = useRef(new Animated.Value(0)).current;

  const VEHICLE_OPTIONS = ["Motorcycle", "EBike", "Cars"];

  // ── Success state (QR view) ──
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState("");
  const [savedPurpose, setSavedPurpose] = useState("");
  const [savedPlate, setSavedPlate] = useState("");

  // ── Custom alert ──
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: "info" | "warning" | "error" | "success";
    buttons: AlertAction[];
  }>({ title: "", message: "", type: "info", buttons: [] });

  // ── Animations ──
  const cardSlide = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.9)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const runEntrance = () => {
    cardSlide.setValue(40);
    cardOpacity.setValue(0);
    buttonSlide.setValue(30);
    buttonOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(buttonSlide, {
        toValue: 0,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    runEntrance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate dropdown open/close
  useEffect(() => {
    Animated.timing(dropdownHeight, {
      toValue: dropdownOpen ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dropdownOpen, dropdownHeight]);

  const runSuccessEntrance = () => {
    successScale.setValue(0.9);
    successOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const showAlert = (
    title: string,
    message: string,
    type: "info" | "warning" | "error" | "success",
    buttons: AlertAction[],
  ) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  // ── Generate Guest Pass ──
  const handleGeneratePass = async () => {
    if (!visitorName.trim()) {
      showAlert(
        "Validation",
        "Visitor name is required.",
        "warning",
        [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      );
      return;
    }

    if (!visitPurpose.trim()) {
      showAlert(
        "Validation",
        "Purpose of visit is required.",
        "warning",
        [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      );
      return;
    }

    if (!vehicleType.trim()) {
      showAlert(
        "Validation",
        "Vehicle type is required.",
        "warning",
        [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      );
      return;
    }

    if (!plateNumber.trim()) {
      showAlert(
        "Validation",
        "Plate number is required.",
        "warning",
        [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerVisitor({
        name: visitorName.trim(),
        purpose: visitPurpose.trim(),
        plateNumber: plateNumber.trim().toUpperCase(),
        vehicleType: vehicleType.trim(),
      });

      if (result.success && result.visitorId) {
        // Save data for the success screen
        setSavedName(visitorName.trim());
        setSavedPurpose(visitPurpose.trim());
        setSavedPlate(plateNumber.trim().toUpperCase());
        setGeneratedId(result.visitorId);
        runSuccessEntrance(); // Note: vehicleType not persisted in current design
      } else {
        showAlert("Error", result.message || "Failed to register visitor.", "error", [
          { text: "OK", onPress: () => setAlertVisible(false), style: "default" },
        ]);
      }
    } catch {
      showAlert("Error", "Network error. Please try again.", "error", [
        { text: "OK", onPress: () => setAlertVisible(false), style: "default" },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset form to add another visitor ──
  const handleAddAnother = () => {
    setGeneratedId(null);
    setSavedName("");
    setSavedPurpose("");
    setSavedPlate("");
    setVisitorName("");
    setPlateNumber("");
    setVehicleType("");
    setVisitPurpose("");
    runEntrance();
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  SUCCESS VIEW — QR Code + Visitor Details
  // ══════════════════════════════════════════════════════════════════════════
  if (generatedId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== "web" && (
          <StatusBar barStyle="dark-content" backgroundColor="#f2f5f3" />
        )}
        <ScrollView
          contentContainerStyle={styles.successContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.successCard,
              {
                transform: [{ scale: successScale }],
                opacity: successOpacity,
              },
            ]}
          >
            {/* Success header */}
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#1f8e4d" />
            </View>
            <Text style={styles.successTitle}>Time-In Recorded!</Text>
            <Text style={styles.successSubtitle}>
              Guest pass created and visitor is now timed-in
            </Text>

            {/* Time-in badge */}
            <View style={styles.timeInBadge}>
              <Ionicons name="enter" size={14} color="#1f8e4d" />
              <Text style={styles.timeInBadgeText}>TIME-IN: Active</Text>
            </View>

            {/* QR Code — uses the same JSON format the guard scanner expects */}
            <View style={styles.qrContainer}>
              <Text style={styles.qrInstruction}>
                Show this QR code to the guest for time-out
              </Text>
              <View style={styles.qrFrame}>
                {QRCode ? (
                  <QRCode
                    value={JSON.stringify({
                      app: "QCU Parking System",
                      role: "guest",
                      studentId: generatedId,
                      name: savedName,
                      plateNumber: savedPlate || null,
                    })}
                    size={200}
                  />
                ) : (
                  <View style={styles.qrFallback}>
                    <Ionicons name="qr-code" size={120} color="#1f8e4d" />
                    <Text style={styles.qrFallbackText}>
                      QR Preview unavailable on web
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.qrIdPill}>
                <Text style={styles.qrIdText}>{generatedId}</Text>
              </View>
              <Text style={styles.qrHint}>
                Guest takes a photo of this QR code to scan at the gate when leaving
              </Text>
            </View>

            {/* Visitor details */}
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="person" size={16} color="#1f8e4d" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>NAME</Text>
                  <Text style={styles.detailValue}>{savedName}</Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="clipboard" size={16} color="#1f8e4d" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>PURPOSE</Text>
                  <Text style={styles.detailValue}>{savedPurpose}</Text>
                </View>
              </View>

              {savedPlate ? (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconWrap}>
                      <Ionicons name="car" size={16} color="#1f8e4d" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>PLATE NUMBER</Text>
                      <Text style={styles.detailValue}>{savedPlate}</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={styles.addAnotherButton}
              onPress={handleAddAnother}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.addAnotherText}>Add Another Visitor</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToGuardButton}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <Text style={styles.backToGuardText}>Back to Guard Portal</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FORM VIEW — Register New Visitor
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safeArea}>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />

      {Platform.OS !== "web" && (
        <StatusBar barStyle="dark-content" backgroundColor="#f2f5f3" />
      )}

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Card ── */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateY: cardSlide }],
              opacity: cardOpacity,
            },
          ]}
        >
          {/* Card header row */}
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#1f2d3d" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Add Visitor / Guest</Text>
              <Text style={styles.cardSubtitle}>
                Register a walk-in guest pass
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Visitor Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>VISITOR FULL NAME</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "name" && styles.inputFocused,
                focusedField === "name" && styles.inputFocused,
              ]}
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#c0c9d0"
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#c0c9d0"
              value={visitorName}
              onChangeText={setVisitorName}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              returnKeyType="next"
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              returnKeyType="next"
            />
          </View>

          {/* Purpose of Visit */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PURPOSE OF VISIT</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                focusedField === "purpose" && styles.inputFocused,
              ]}
              placeholder="e.g. Meeting, Delivery, Tour"
              placeholderTextColor="#c0c9d0"
              value={visitPurpose}
              onChangeText={setVisitPurpose}
              onFocus={() => setFocusedField("purpose")}
              onBlur={() => setFocusedField(null)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Vehicle Type — animated dropdown */}
          <View style={[styles.fieldGroup, { zIndex: 10 }]}>
            <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
            <TouchableOpacity
          {/* Vehicle Type — animated dropdown */}
          <View style={[styles.fieldGroup, { zIndex: 10 }]}>
            <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.pickerButton,
                dropdownOpen && styles.inputFocused,
              ]}
              onPress={() => setDropdownOpen((v) => !v)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  !vehicleType && { color: "#c0c9d0" },
                ]}
              >
                {vehicleType || "Select vehicle type"}
              </Text>
              <Ionicons
                name={dropdownOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#8f9ba7"
              />
            </TouchableOpacity>

            {/* Dropdown Menu */}
            <Animated.View
              style={[
                styles.dropdownMenu,
                {
                  maxHeight: dropdownHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 150],
                  }),
                  opacity: dropdownHeight,
                  marginTop: dropdownHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8],
                  }),
                },
              ]}
            >
              {VEHICLE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setVehicleType(option);
                    setDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="car-outline"
                    size={18}
                    color="#1f8e4d"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.dropdownItemText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PLATE NUMBER</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "plate" && styles.inputFocused,
              ]}
              placeholder="e.g. ABC 1234"
              placeholderTextColor="#c0c9d0"
              value={plateNumber}
              onChangeText={setPlateNumber}
              autoCapitalize="characters"
              onFocus={() => setFocusedField("plate")}
              onBlur={() => setFocusedField(null)}
              returnKeyType="done"
            />
          </View>
        </Animated.View>

        {/* ── Generate button ── */}
        <Animated.View
          style={{
            transform: [{ translateY: buttonSlide }],
            opacity: buttonOpacity,
          }}
        >
          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={handleGeneratePass}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.submitContent}>
                <Ionicons name="qr-code" size={22} color="#fff" />
                <Text style={styles.submitText}>Generate Guest Pass</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f5f3",
  },

  // ── Scroll container ──
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f5f3",
  },

  // ── Scroll container ──
  container: {
    backgroundColor: "#f2f5f3",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    flexGrow: 1,
    backgroundColor: "#f2f5f3",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    flexGrow: 1,
  },

  // ── White card ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardHeaderRow: {

  // ── White card ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#f2f5f3",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#f2f5f3",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#14251b",
    letterSpacing: -0.2,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#14251b",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#8f9ba7",
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: "#eef2f0",
    marginBottom: 22,
  },

  // ── Form fields ──
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8f9ba7",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  optionalTag: {
    fontSize: 10,
    fontWeight: "600",
    color: "#b8c3cc",
    fontStyle: "italic",
    textTransform: "none",
  },
  input: {
    backgroundColor: "#f6f8f7",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: "#1f2d3d",
    fontWeight: "600",
    borderWidth: 1.5,
    borderColor: "#eaeeec",
  },
  inputFocused: {
    borderColor: "#1f8e4d",
    backgroundColor: "#fff",
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 14,
  },

  // ── Picker button ──
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerButtonText: {
    fontSize: 15,
    color: "#1f2d3d",
    fontWeight: "600",
  },

  // ── Dropdown menu ──
  dropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#eaeeec",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f1",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#1f2d3d",
    fontWeight: "600",
  },

  // ── Submit button ──
  submitButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SUCCESS VIEW STYLES
  // ══════════════════════════════════════════════════════════════════════════
  successContainer: {
    backgroundColor: "#f2f5f3",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    flexGrow: 1,
    alignItems: "center",
  },
  successCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#e8f5ee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14251b",
    marginBottom: 4,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 13,
    color: "#8f9ba7",
    marginBottom: 16,
    textAlign: "center",
  },
  timeInBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e8f5ee",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
  },
  timeInBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1f8e4d",
    letterSpacing: 0.5,
  },
  qrInstruction: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2d3d",
    textAlign: "center",
    marginBottom: 14,
  },
  qrHint: {
    fontSize: 11,
    color: "#8f9ba7",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 10,
  },

  // ── QR Section ──
  qrContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  qrFrame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    backgroundColor: "#f8fbf9",
    borderWidth: 1,
    borderColor: "#e3ebe4",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 12,
  },
  qrFallback: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  qrFallbackText: {
    marginTop: 8,
    color: "#8f9ba7",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  qrIdPill: {
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  qrIdText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f8e4d",
    letterSpacing: 1.2,
  },

  // ── Details card ──
  detailsCard: {
    backgroundColor: "#f8fbf9",
    borderRadius: 18,
    padding: 18,
    width: "100%",
    borderWidth: 1,
    borderColor: "#e5ece7",
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#e4f4eb",
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8f9ba7",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2d3d",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#e5ece7",
    marginVertical: 12,
  },

  // ── Action buttons ──
  addAnotherButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 12,
  },
  addAnotherText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  backToGuardButton: {
    paddingVertical: 12,
  },
  backToGuardText: {
    color: "#8f9ba7",
    fontSize: 13,
    fontWeight: "600",
  },
  dropdownOptionTextActive: {
    color: "#1f8e4d",
    fontWeight: "800",
  },

  // ── Success modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  successSheet: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e8f5ee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14251b",
    marginBottom: 6,
    textAlign: "center",
  },
  successName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2d3d",
    marginBottom: 12,
    textAlign: "center",
  },
  successPlatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 14,
  },
  successPlateText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f8e4d",
    letterSpacing: 1,
  },
  successHint: {
    fontSize: 13,
    color: "#8f9ba7",
    textAlign: "center",
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  successButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
