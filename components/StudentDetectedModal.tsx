import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  visible: boolean;
  plateNumber: string;
  studentName: string;
  onSwitchToStudentLog: () => void;
  onDismiss: () => void;
};

export function StudentDetectedModal({
  visible,
  plateNumber,
  studentName,
  onSwitchToStudentLog,
  onDismiss,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Warning Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="warning" size={32} color="#f5a623" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Student Detected</Text>

          {/* Plate info */}
          <Text style={styles.plateRow}>
            Plate number <Text style={styles.plateBold}>{plateNumber}</Text>
          </Text>

          {/* Student name */}
          <Text style={styles.studentName}>{studentName}</Text>

          {/* Warning pill */}
          <View style={styles.warningPill}>
            <Text style={styles.warningText}>
              Proceeding as visitor is blocked.
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.switchButton}
            onPress={onSwitchToStudentLog}
            activeOpacity={0.85}
          >
            <Text style={styles.switchButtonText}>
              Switch to Student Login Portal
            </Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheet: {
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
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff8ec",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14251b",
    marginBottom: 8,
    textAlign: "center",
  },
  plateRow: {
    fontSize: 14,
    color: "#607181",
    marginBottom: 4,
    textAlign: "center",
  },
  plateBold: {
    fontWeight: "900",
    color: "#1f2d3d",
    fontSize: 15,
    letterSpacing: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f2d3d",
    marginTop: 4,
    marginBottom: 16,
    textAlign: "center",
  },
  warningPill: {
    backgroundColor: "#fff4e0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  warningText: {
    color: "#c87a00",
    fontSize: 13,
    fontWeight: "700",
  },
  switchButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  switchButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  dismissButton: {
    paddingVertical: 10,
  },
  dismissText: {
    color: "#8f9ba7",
    fontSize: 13,
    fontWeight: "600",
  },
});
