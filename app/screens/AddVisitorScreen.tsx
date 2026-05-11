import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { AuthService } from "../../services/authService";
import {
  Alert,
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

const VEHICLE_TYPES = ["Motorcycle", "Car", "Ebike", "Others"] as const;

export default function AddVisitorScreen() {
  const router = useRouter();
  const [visitorName, setVisitorName] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleVehicleTypePress = () => {
    Alert.alert("Vehicle Type", "Select a vehicle type", [
      ...VEHICLE_TYPES.map((type) => ({
        text: type,
        onPress: () => setVehicleType(type),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleAddVisitor = () => {
    if (
      !visitorName.trim() ||
      !vehiclePlateNumber.trim() ||
      !vehicleType.trim() ||
      !visitPurpose.trim()
    ) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setShowSuccess(true);
  };

  const handleSwitchToStudentLogin = async () => {
    const result = await AuthService.logout();
    if (!result.success) {
      Alert.alert("Error", result.message || "Logout failed");
      return;
    }
    setShowSuccess(false);
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <Text style={styles.headerTitle}>Add Visitor Profile</Text>
          <Text style={styles.headerSubtitle}>Record entry details</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentShell}>
          <View style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardLabel}>Visitor Information</Text>
                  <Text style={styles.cardTitle}>Add new visitor entry</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Visitor Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor="#9aa5b1"
                  value={visitorName}
                  onChangeText={setVisitorName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Vehicle Plate Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="E.G. ABC 1234"
                  placeholderTextColor="#9aa5b1"
                  autoCapitalize="characters"
                  value={vehiclePlateNumber}
                  onChangeText={setVehiclePlateNumber}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Vehicle Type</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={handleVehicleTypePress}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !vehicleType && styles.placeholderText,
                    ]}
                  >
                    {vehicleType || "Select vehicle type"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#96a0aa" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Purpose of Visit</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter purpose of visit"
                  placeholderTextColor="#9aa5b1"
                  value={visitPurpose}
                  onChangeText={setVisitPurpose}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleAddVisitor}
              activeOpacity={0.85}
            >
              <Text style={styles.submitButtonText}>Save and Log Time-In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showSuccess && (
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={56} color="#1f8e4d" />
            </View>
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successMessage}>
              Visitor {visitorName} has been saved and time-in logged.
            </Text>
            <View style={styles.successDetails}>
              <Text style={styles.detailLabel}>Vehicle Plate:</Text>
              <Text style={styles.detailValue}>{vehiclePlateNumber}</Text>
              <Text style={[styles.detailLabel, {marginTop: 8}]}>Vehicle Type:</Text>
              <Text style={styles.detailValue}>{vehicleType}</Text>
            </View>
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleSwitchToStudentLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.successButtonText}>Switch to Student Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.backLinkText}>Back to Guard Portal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  container: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
  },
  contentShell: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 14,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#e5ece7",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardInner: {
    backgroundColor: "#f8fbf9",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e4ede6",
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 18,
  },
  cardLabel: {
    color: "#1f8e4d",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cardTitle: {
    color: "#14251b",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    color: "#1f8e4d",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4ede6",
    paddingHorizontal: 12,
    backgroundColor: "#f8fbf9",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  selectInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4ede6",
    backgroundColor: "#f8fbf9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  placeholderText: {
    color: "#9aa5b1",
  },
  submitButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  successModal: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#dff3e7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14251b",
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: "#607181",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  successDetails: {
    width: "100%",
    backgroundColor: "#f8fbf9",
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1f8e4d",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  successButton: {
    width: "100%",
    backgroundColor: "#1f8e4d",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  successButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  backLinkText: {
    color: "#1f8e4d",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
