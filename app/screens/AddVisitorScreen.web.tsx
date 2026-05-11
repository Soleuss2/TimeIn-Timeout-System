import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import styles from "../../assets/styles/AddVisitorScreen.web.module.css";
import { AuthService } from "../../services/authService";

const VEHICLE_TYPES = ["Motorcycle", "Car", "Ebike", "Others"] as const;

export default function AddVisitorScreen() {
  const router = useRouter();
  const [visitorName, setVisitorName] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddVisitor = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !visitorName.trim() ||
      !vehiclePlateNumber.trim() ||
      !vehicleType.trim() ||
      !visitPurpose.trim()
    ) {
      window.alert("Please fill in all fields");
      return;
    }
    setShowSuccess(true);
  };

  const handleSwitchToStudentLogin = async () => {
    const result = await AuthService.logout();
    if (!result.success) {
      window.alert(result.message || "Logout failed");
      return;
    }
    setShowSuccess(false);
    router.replace("/");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <div className={styles.page}>
        <div className={styles.backgroundShapeTop} />
        <div className={styles.backgroundShapeBottom} />

        <div className={styles.header}>
          <button
            className={styles.backButton}
            onClick={() => router.back()}
            type="button"
            aria-label="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </button>
          <div className={styles.headerCopy}>
            <h1 className={styles.headerTitle}>Add Visitor Profile</h1>
            <p className={styles.headerSubtitle}>Record entry details</p>
          </div>
        </div>

        <div className={styles.container}>
          <div className={styles.contentShell}>
          <div className={styles.card}>
            <div className={styles.cardInner}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.cardLabel}>Visitor Information</p>
                  <h2 className={styles.cardTitle}>Add new visitor entry</h2>
                </div>
              </div>

              <form className={styles.form} onSubmit={handleAddVisitor}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Visitor Full Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Juan Dela Cruz"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Vehicle Plate Number</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="E.G. ABC 1234"
                    autoCapitalize="characters"
                    value={vehiclePlateNumber}
                    onChange={(e) => setVehiclePlateNumber(e.target.value)}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Vehicle Type</label>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                    >
                      <option value="" disabled>
                        Select vehicle type
                      </option>
                      {VEHICLE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Purpose of Visit</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Enter purpose of visit"
                    value={visitPurpose}
                    onChange={(e) => setVisitPurpose(e.target.value)}
                  />
                </div>

                <button type="submit" className={styles.submitButton}>
                  Save and Log Time-In
                </button>
              </form>
            </div>
          </div>
        </div>
        </div>
      </div>

      {showSuccess && (
        <div className={styles.successOverlay}>
          <div className={styles.successModal}>
            <div className={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={56} color="#1f8e4d" />
            </div>
            <h2 className={styles.successTitle}>Success!</h2>
            <p className={styles.successMessage}>
              Visitor {visitorName} has been saved and time-in logged.
            </p>
            <div className={styles.successDetails}>
              <div className={styles.detailGroup}>
                <p className={styles.detailLabel}>Vehicle Plate:</p>
                <p className={styles.detailValue}>{vehiclePlateNumber}</p>
              </div>
              <div className={styles.detailGroup}>
                <p className={styles.detailLabel}>Vehicle Type:</p>
                <p className={styles.detailValue}>{vehicleType}</p>
              </div>
            </div>
            <button
              className={styles.successButton}
              onClick={handleSwitchToStudentLogin}
              type="button"
            >
              Switch to Student Login
            </button>
            <button
              className={styles.backLinkButton}
              onClick={() => router.back()}
              type="button"
            >
              Back to Guard Portal
            </button>
          </div>
        </div>
      )}
    </>
  );
}
