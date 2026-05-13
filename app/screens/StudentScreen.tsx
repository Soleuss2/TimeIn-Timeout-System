import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { type ComponentType, useRef, useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  PanResponder,
  BackHandler,
} from "react-native";
import { AuthService, User } from "../../services/authService";
import { db } from "../../services/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { LoaderComponent } from "../../components/LoaderComponent";
import { CustomAlert, AlertAction } from "../../components/CustomAlert";
import { useUserNotifications } from "../../hooks/useNotifications";
import { ScanNotificationStack } from "../../components/ScanNotificationBanner";
import { NotificationHistoryModal } from "../../components/NotificationHistoryModal";

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

type StudentSearchParams = {
  studentId?: string | string[];
};

export default function StudentScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<StudentSearchParams>();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 700;
  const qrRef = useRef<any>(null);
  const [student, setStudent] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plateNumber, setPlateNumber] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

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

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const heroCardAnim = useRef(new Animated.Value(0)).current;
  const qrCardAnim = useRef(new Animated.Value(0)).current;
  const detailsAnim = useRef(new Animated.Value(0)).current;

  // Get notifications for this user
  const { notifications, clearNotification } = useUserNotifications(
    student?.id || null
  );

  // History modal state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  // Student details modal state
  const [studentDetailsModalVisible, setStudentDetailsModalVisible] = useState(false);

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

  // Fetch student data from Firebase
  useEffect(() => {
    const loadStudentData = async () => {
      try {
        // Get current logged-in user
        const currentUser = await AuthService.getCurrentUser();

        if (!currentUser) {
          setAlertConfig({
            title: "Error",
            message: "Please login again",
            type: "error",
            buttons: [
              {
                text: "OK",
                onPress: () => {
                  setAlertVisible(false);
                  router.push("/");
                },
                style: "default",
              },
            ],
          });
          setAlertVisible(true);
          return;
        }

        // If studentId is passed in params, verify it matches
        const paramId = Array.isArray(searchParams.studentId)
          ? searchParams.studentId[0]
          : searchParams.studentId;

        if (paramId && paramId !== currentUser.id) {
          setAlertConfig({
            title: "Error",
            message: "Unauthorized access",
            type: "error",
            buttons: [
              {
                text: "OK",
                onPress: () => {
                  setAlertVisible(false);
                  router.push("/");
                },
                style: "default",
              },
            ],
          });
          setAlertVisible(true);
          return;
        }

        setStudent(currentUser);

        // Fetch additional user data from Firestore based on their role
        const collectionName =
          currentUser.role === "student"
            ? "students"
            : currentUser.role === "faculty"
              ? "faculty"
              : currentUser.role === "staff"
                ? "staff"
                : "students"; // fallback to students

        const userDocRef = doc(db, collectionName, currentUser.id);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setPlateNumber(userData.plateNumber || null);
        }
      } catch {
        setAlertConfig({
          title: "Error",
          message: "Failed to load student data",
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
      } finally {
        setLoading(false);
        // Trigger animations after loading
        triggerAnimations();
      }
    };

    loadStudentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger smooth animations
  const triggerAnimations = () => {
    // Fade in and scale main content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered animations for cards
    Animated.sequence([
      Animated.timing(heroCardAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(qrCardAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(detailsAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const qrPayload = JSON.stringify({
    app: "QCU Parking System",
    role: student?.role || "student",
    studentId: student?.id,
    username: student?.email?.split("@")[0],
    name: student?.name,
    plateNumber: plateNumber,
    timestamp: new Date().toISOString(),
  });

  const handleLogout = async () => {
    setAlertConfig({
      title: "Logout Confirmation",
      message:
        "Are you sure you want to logout? You will need to sign in again.",
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
                  // Navigate to login screen
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
                  triggerAnimations();
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
              triggerAnimations();
            }
          },
          style: "destructive",
        },
      ],
    });
    setAlertVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f8e4d" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>Failed to load student data</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push("/")}
          >
            <Text style={styles.retryButtonText}>Go Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        onGuard={false}
      />
      {Platform.OS !== "web" && (
        <StatusBar barStyle="light-content" backgroundColor="#11412a" />
      )}
      <View style={styles.backgroundShapeTop} />
      <View style={styles.backgroundShapeBottom} />

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>User Portal</Text>
          <Text style={styles.headerSubtitle}>Access Pass</Text>
        </View>
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
      >
        <Animated.View
          style={[
            styles.contentShell,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideUpAnim }],
            },
          ]}
        >
          {/* Hero Card with animation */}
          <Animated.View
            style={[
              {
                opacity: heroCardAnim,
                transform: [
                  {
                    translateY: heroCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroDecorTop} />
              <View style={styles.heroDecorBottom} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>
                    Campus Parking Access Portal
                  </Text>
                  <Text style={styles.heroTitle}>Digital Access Pass</Text>
                  <Text style={styles.heroSubtitle}>
                    Your QR code is ready for guard verification at the campus
                    gate.
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Ionicons name="qr-code" size={28} color="#fff" />
                </View>
              </View>

              <View style={styles.heroPills}>
                <View style={styles.heroPill}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#1f8e4d"
                  />
                  <Text style={styles.heroPillText}>Active pass</Text>
                </View>
                <View style={styles.heroPillSecondary}>
                  <Ionicons name="car-outline" size={16} color="#fff" />
                  <Text style={styles.heroPillTextSecondary}>
                    {plateNumber ? "Vehicle linked" : "No vehicle set"}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* QR Card with animation */}
          <Animated.View
            style={[
              {
                opacity: qrCardAnim,
                transform: [
                  {
                    translateY: qrCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.qrCard}>
              <View
                style={styles.qrCaptureArea}
                id="student-qr-download-target"
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardLabel}>Scan-ready QR</Text>
                    <Text style={styles.cardTitle}>
                      Present at the entrance
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {student.role.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.qrStage}>
                  <View style={styles.qrStageGlowTop} />
                  <View style={styles.qrStageGlowBottom} />
                  <View style={styles.qrFrame}>
                    {QRCode ? (
                      <QRCode
                        value={qrPayload}
                        size={220}
                        getRef={(ref) => (qrRef.current = ref)}
                      />
                    ) : (
                      <View style={styles.qrFallback}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={28}
                          color="#216b43"
                        />
                        <Text style={styles.qrFallbackText}>
                          QR code unavailable
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentMeta}>
                  {student.studentId || student.id} · {student.email}
                </Text>

                <View style={styles.screenshotInstruction}>
                  <Ionicons name="camera-outline" size={18} color="#1f8e4d" />
                  <Text style={styles.screenshotText}>
                    Please take a screenshot for your access pass
                  </Text>
                </View>
              </View>
              </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.detailsRow,
              isCompactLayout && styles.detailsRowCompact,
              {
                opacity: detailsAnim,
                transform: [
                  {
                    translateY: detailsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setStudentDetailsModalVisible(true)}
            >
              <View
                style={[
                  styles.detailCard,
                  isCompactLayout && styles.detailCardCompact,
                ]}
              >
                <View style={styles.detailHeader}>
                  <Ionicons name="person-outline" size={18} color="#1f8e4d" />
                  <Text style={styles.detailTitle}>{student.role.charAt(0).toUpperCase() + student.role.slice(1)} Account</Text>
                </View>
                <Text style={styles.detailValue}>{student.name}</Text>
                <Text style={styles.detailMeta}>Email: {student.email}</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.detailCard,
                isCompactLayout && styles.detailCardCompact,
              ]}
            >
              <View style={styles.detailHeader}>
                <Ionicons name="car-outline" size={18} color="#1f8e4d" />
                <Text style={styles.detailTitle}>Registered Vehicle</Text>
              </View>
              <Text style={styles.detailValue}>
                {plateNumber ?? "No vehicle registered"}
              </Text>
              <Text style={styles.detailMeta}>
                {plateNumber
                  ? "Linked to your access pass"
                  : "Ask admin to add your vehicle"}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
      <Modal
        visible={studentDetailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStudentDetailsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setStudentDetailsModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Account Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.detailsContainer}>
              <View style={styles.detailsSection}>
                <View style={styles.detailsIconBox}>
                  <Ionicons name="person-circle" size={60} color="#1f8e4d" />
                </View>
                <Text style={styles.detailsName}>{student?.name}</Text>
                <Text style={styles.detailsRole}>{student?.role?.toUpperCase()}</Text>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailsItem}>
                  <View style={styles.detailsItemIcon}>
                    <Ionicons name="mail-outline" size={18} color="#1f8e4d" />
                  </View>
                  <View style={styles.detailsItemContent}>
                    <Text style={styles.detailsItemLabel}>Email</Text>
                    <Text style={styles.detailsItemValue}>{student?.email}</Text>
                  </View>
                </View>

                <View style={styles.detailsItem}>
                  <View style={styles.detailsItemIcon}>
                    <Ionicons name="card-outline" size={18} color="#1f8e4d" />
                  </View>
                  <View style={styles.detailsItemContent}>
                    <Text style={styles.detailsItemLabel}>Student ID</Text>
                    <Text style={styles.detailsItemValue}>{student?.studentId}</Text>
                  </View>
                </View>

                <View style={styles.detailsItem}>
                  <View style={styles.detailsItemIcon}>
                    <Ionicons name="car-outline" size={18} color="#1f8e4d" />
                  </View>
                  <View style={styles.detailsItemContent}>
                    <Text style={styles.detailsItemLabel}>Vehicle Plate</Text>
                    <Text style={styles.detailsItemValue}>
                      {plateNumber || "Not registered"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <NotificationHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        userId={student?.id}
        isGuard={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef4ef",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#1f8e4d",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: "#f44336",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#1f8e4d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
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
    backgroundColor: "#11412a",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
  },
  activityButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
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
    color: "#c8e6d0",
    marginTop: 4,
    fontSize: 13,
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
  heroCard: {
    backgroundColor: "#11412a",
    borderRadius: 32,
    padding: 24,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#0b1b12",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroDecorTop: {
    position: "absolute",
    top: -34,
    right: -44,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  heroDecorBottom: {
    position: "absolute",
    bottom: -52,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroCopy: {
    flex: 1,
    paddingRight: 16,
  },
  heroEyebrow: {
    color: "#b6f0c8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginBottom: 10,
  },
  heroSubtitle: {
    color: "#d5e8d9",
    fontSize: 14,
    lineHeight: 21,
  },
  heroBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroPills: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 20,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eaf7ef",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  heroPillSecondary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  heroPillText: {
    color: "#155332",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  heroPillTextSecondary: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  qrCard: {
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
  qrCaptureArea: {
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
  qrStage: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  qrStageGlowTop: {
    position: "absolute",
    top: 0,
    right: 8,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(31, 142, 77, 0.08)",
  },
  qrStageGlowBottom: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(22, 65, 41, 0.06)",
  },
  qrFrame: {
    width: 260,
    height: 260,
    borderRadius: 28,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3ebe4",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  qrFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  qrFallbackText: {
    marginTop: 10,
    color: "#216b43",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  studentName: {
    marginTop: 18,
    color: "#0f2818",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  studentMeta: {
    marginTop: 6,
    color: "#607181",
    fontSize: 13,
    textAlign: "center",
  },
  screenshotInstruction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    backgroundColor: "#f0f7f2",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1e7d8",
  },
  screenshotText: {
    color: "#1f8e4d",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 16,
    marginBottom: 20,
  },
  detailsRowCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5ece7",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 160,
    marginBottom: 12,
  },
  detailCardCompact: {
    flexBasis: "auto",
    width: "100%",
    minWidth: 0,
    marginBottom: 14,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailTitle: {
    marginLeft: 8,
    color: "#1f8e4d",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#0f2818",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 4,
  },
  detailMeta: {
    color: "#62707d",
    fontSize: 12,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#eef4ef",
  },
  modalHeader: {
    backgroundColor: "#11412a",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  detailsContainer: {
    maxWidth: 560,
    alignSelf: "center",
    width: "100%",
  },
  detailsSection: {
    alignItems: "center",
    marginBottom: 32,
    paddingVertical: 24,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e5ece7",
  },
  detailsIconBox: {
    marginBottom: 16,
  },
  detailsName: {
    color: "#0f2818",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  detailsRole: {
    color: "#1f8e4d",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  detailsGrid: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5ece7",
  },
  detailsItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f5f2",
  },
  detailsItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0f8f4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  detailsItemContent: {
    flex: 1,
  },
  detailsItemLabel: {
    color: "#62707d",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailsItemValue: {
    color: "#0f2818",
    fontSize: 15,
    fontWeight: "700",
  },
});
