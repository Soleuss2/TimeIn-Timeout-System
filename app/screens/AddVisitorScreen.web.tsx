import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
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
import { StudentDetectedModal } from "../../components/StudentDetectedModal";
import { AlertAction, CustomAlert } from "../../components/CustomAlert";
import { processGuardEntry } from "../../services/guardService";
import { AuthService } from "../../services/authService";
import { db } from "../../services/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

const VEHICLE_OPTIONS = ["Motorcycle", "EBike", "Cars"];

type DetectedStudent = {
  name: string;
  plate: string;
};

async function findStudentByPlate(
  plate: string,
): Promise<DetectedStudent | null> {
  if (!plate.trim()) return null;

  const normalised = plate.trim().toUpperCase();
  const collections = ["students", "faculty", "staff"];

  for (const col of collections) {
    const q = query(
      collection(db, col),
      where("plateNumber", "==", normalised),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return {
        name: data.name || data.fullName || "Unknown",
        plate: normalised,
      };
    }
  }
  return null;
}

export default function AddVisitorScreen() {
  const router = useRouter();

  const [visitorName, setVisitorName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingPlate, setCheckingPlate] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Student-detected modal
  const [detectedStudent, setDetectedStudent] =
    useState<DetectedStudent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Success modal
  const [successModal, setSuccessModal] = useState<{
    visible: boolean;
    action: "TIMEIN" | "TIMEOUT";
    name: string;
    plate: string;
  }>({ visible: false, action: "TIMEIN", name: "", plate: "" });

  // Custom alert
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
  const dropdownHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Card entrance
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

    // Button entrance (staggered)
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
  }, [cardSlide, cardOpacity, buttonSlide, buttonOpacity]);

  // Animate dropdown open/close
  useEffect(() => {
    Animated.timing(dropdownHeight, {
      toValue: dropdownOpen ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dropdownOpen, dropdownHeight]);

  const showAlert = (
    title: string,
    message: string,
    type: "info" | "warning" | "error" | "success",
    buttons: AlertAction[],
  ) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  // When guard finishes typing the plate, check if it belongs to a student
  const handlePlateBlur = async () => {
    if (!plateNumber.trim()) return;
    setCheckingPlate(true);
    try {
      const student = await findStudentByPlate(plateNumber);
      if (student) {
        setDetectedStudent(student);
        setModalVisible(true);
      }
    } catch {
      // Silently fail — guard can still proceed
    } finally {
      setCheckingPlate(false);
    }
  };

  const handleSubmit = async () => {
    if (!visitorName.trim() || !plateNumber.trim()) {
      showAlert(
        "Validation",
        "Visitor name and plate number are required.",
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
      const result = await processGuardEntry({
        name: visitorName.trim(),
        plateNumber: plateNumber.trim().toUpperCase(),
        role: "visitor",
        method: "MANUAL",
      });

      if (result.success) {
        setSuccessModal({
          visible: true,
          action: (result.action === "TIMEIN" ? "TIMEIN" : "TIMEOUT") as
            | "TIMEIN"
            | "TIMEOUT",
          name: visitorName.trim(),
          plate: plateNumber.trim().toUpperCase(),
        });
      } else {
        showAlert("Error", result.message || "Failed to log entry.", "error", [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
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

  const animatedDropdownStyle = {
    maxHeight: dropdownHeight.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 200],
    }),
    opacity: dropdownHeight,
    marginTop: dropdownHeight.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 6],
    }),
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />

      <StudentDetectedModal
        visible={modalVisible}
        plateNumber={detectedStudent?.plate ?? ""}
        studentName={detectedStudent?.name ?? ""}
        onSwitchToStudentLog={async () => {
          setModalVisible(false);
          await AuthService.logout();
          router.replace("/");
        }}
        onDismiss={() => setModalVisible(false)}
      />

      {Platform.OS !== "web" && (
        <StatusBar barStyle="dark-content" backgroundColor="#f2f5f3" />
      )}

      {/* ── Success Modal ── */}
      <Modal
        visible={successModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSuccessModal((s) => ({ ...s, visible: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successSheet}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={36} color="#1f8e4d" />
            </View>
            <Text style={styles.successTitle}>
              {successModal.action === "TIMEIN"
                ? "Time-In Logged!"
                : "Time-Out Logged!"}
            </Text>
            <Text style={styles.successName}>{successModal.name}</Text>
            <View style={styles.successPlatePill}>
              <Ionicons name="car-outline" size={14} color="#1f8e4d" />
              <Text style={styles.successPlateText}>{successModal.plate}</Text>
            </View>
            <Text style={styles.successHint}>
              {successModal.action === "TIMEIN"
                ? "Visitor entry has been recorded."
                : "Visitor exit has been recorded."}
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              activeOpacity={0.85}
              onPress={async () => {
                setSuccessModal((s) => ({ ...s, visible: false }));
                setVisitorName("");
                setPlateNumber("");
                setVehicleType("");
                setVisitPurpose("");
                await AuthService.logout();
                router.replace("/");
              }}
            >
              <Text style={styles.successButtonText}>
                Switch to Student Login Portal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              <Ionicons name="arrow-back" size={20} color="#1f2d3d" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Add Visitor Profile</Text>
              <Text style={styles.cardSubtitle}>Record entry details</Text>
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
              ]}
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#c0c9d0"
              value={visitorName}
              onChangeText={setVisitorName}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              returnKeyType="next"
            />
          </View>

          {/* Vehicle Plate Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>VEHICLE PLATE NUMBER</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  checkingPlate && styles.inputChecking,
                  focusedField === "plate" && styles.inputFocused,
                ]}
                placeholder="E.G. ABC 1234"
                placeholderTextColor="#c0c9d0"
                value={plateNumber}
                onChangeText={setPlateNumber}
                autoCapitalize="characters"
                onFocus={() => setFocusedField("plate")}
                onBlur={() => {
                  setFocusedField(null);
                  handlePlateBlur();
                }}
                returnKeyType="next"
              />
              {checkingPlate && (
                <ActivityIndicator
                  size="small"
                  color="#1f8e4d"
                  style={styles.inputSpinner}
                />
              )}
            </View>
          </View>

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
                size={16}
                color="#8f9ba7"
              />
            </TouchableOpacity>

            <Animated.View style={[styles.dropdown, animatedDropdownStyle]}>
              {VEHICLE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.dropdownOption,
                    vehicleType === opt && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    setVehicleType(opt);
                    setDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      vehicleType === opt && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
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
        </Animated.View>

        {/* ── Save button ── */}
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
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitText}>Save and Log Time-In</Text>
            )}
          </TouchableOpacity>
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
  container: {
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
  inputWrapper: {
    position: "relative",
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
  inputChecking: {
    borderColor: "#1f8e4d",
  },
  inputSpinner: {
    position: "absolute",
    right: 14,
    top: 16,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 14,
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
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // ── Vehicle type picker ──
  pickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonText: {
    fontSize: 15,
    color: "#1f2d3d",
    fontWeight: "600",
    flex: 1,
  },
  dropdown: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#eaeeec",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "hidden",
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f4f2",
  },
  dropdownOptionActive: {
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    marginHorizontal: 6,
    marginVertical: 3,
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    fontSize: 15,
    color: "#1f2d3d",
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
