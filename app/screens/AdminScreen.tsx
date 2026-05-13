import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  Alert,
  Animated,
  GestureResponderEvent,
  PanResponder,
  BackHandler,
} from "react-native";
import { LoaderComponent } from "../../components/LoaderComponent";
import { CustomAlert, AlertAction } from "../../components/CustomAlert";
import { AuthService } from "../../services/authService";
import { AdminService, DirectoryUser } from "../../services/adminService";
import { useAuth } from "../../services/authContext";
import {
  Trie,
  DuplicateChecker,
  buildTrie,
  searchAndSort,
  SortOrder,
  filterAndSortAuditLogs,
} from "../../services/searchService";

type AdminScreenType = "overview" | "users" | "audit-logs" | "new-account";
export default function AdminScreen() {
  const router = useRouter();
  const authContext = useAuth();
  const adminId = authContext?.user?.id;

  const [logoutLoading, setLogoutLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Swipe gesture tracking for logout ────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const SWIPE_THRESHOLD = 50;
        if (gestureState.dx > SWIPE_THRESHOLD || gestureState.dx < -SWIPE_THRESHOLD) {
          handleLogout();
        }
      },
    })
  ).current;

  // Handle back button press and swipe gestures
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleLogout();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => subscription.remove();
    }, [])
  );
  // ─────────────────────────────────────────────────────────────────────────

  // ── Alert state (reused from campus parking access portal) ────────────────────────────
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
  // ─────────────────────────────────────────────────────────────────────────
  const [currentScreen, setCurrentScreen] =
    useState<AdminScreenType>("overview");
  const [userType, setUserType] = useState<
    "students" | "faculty" | "staff" | "guards"
  >("students");
  const [searchQuery, setSearchQuery] = useState("");



  const [newAccountRole, setNewAccountRole] = useState<
    "student" | "faculty" | "staff" | "guard"
  >("student");
  const [vehicleTypeDropdownOpen, setVehicleTypeDropdownOpen] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [students, setStudents] = useState<DirectoryUser[]>([]);
  const [faculty, setFaculty] = useState<DirectoryUser[]>([]);
  const [staff, setStaff] = useState<DirectoryUser[]>([]);
  const [guards, setGuards] = useState<DirectoryUser[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // ── Algorithm state ─────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState("firstName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const studentTrie = useRef<Trie>(new Trie());
  const facultyTrie = useRef<Trie>(new Trie());
  const staffTrie = useRef<Trie>(new Trie());
  const guardTrie = useRef<Trie>(new Trie());
  const duplicateChecker = useRef<DuplicateChecker>(new DuplicateChecker());
  // ─────────────────────────────────────────────────────────────────────────

  // ════════════════════════════════════════════════════════════════════════════════
  // ALGORITHM PIPELINE: COMBINED SEARCH (Trie + Levenshtein + Merge Sort)
  // ════════════════════════════════════════════════════════════════════════════════
  // 
  // This pipeline orchestrates 3 algorithms working together:
  // 
  // 1. TRIE (Prefix Search) - O(k) where k = prefix length
  //    - Instant prefix-based search as admin types
  //    - Returns matching records from Trie nodes
  // 
  // 2. LEVENSHTEIN FALLBACK - O(m × n) if Trie finds nothing
  //    - Fuzzy matching with threshold=2 edits
  //    - Handles typos and misspellings
  // 
  // 3. MERGE SORT - O(n log n)
  //    - Stable sorting of search results
  //    - Sorts by name, studentId, createdAt, status
  // 
  // Result: Fast + Forgiving + Organized results
  // ════════════════════════════════════════════════════════════════════════════════

  // Computed: run search + sort pipeline entirely in memory (no Firestore)
  const displayedStudents = useMemo(
    () =>
      searchAndSort(
        studentTrie.current,
        students,
        searchQuery,
        sortKey,
        sortOrder,
      ),
    [students, searchQuery, sortKey, sortOrder],
  );
  const displayedFaculty = useMemo(
    () =>
      searchAndSort(
        facultyTrie.current,
        faculty,
        searchQuery,
        sortKey,
        sortOrder,
      ),
    [faculty, searchQuery, sortKey, sortOrder],
  );
  const displayedStaff = useMemo(
    () =>
      searchAndSort(staffTrie.current, staff, searchQuery, sortKey, sortOrder),
    [staff, searchQuery, sortKey, sortOrder],
  );
  const displayedGuards = useMemo(
    () =>
      searchAndSort(guardTrie.current, guards, searchQuery, sortKey, sortOrder),
    [guards, searchQuery, sortKey, sortOrder],
  );

  const [newAccountData, setNewAccountData] = useState({
    firstName: "",
    lastName: "",
    suffix: "",
    middleName: "",
    email: "",
    studentId: "",
    employeeId: "",
    vehiclePlate: "",
    vehicleType: "Car",
    shift: "",
  });

  // ── Analytics state ────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [parkingHoursData, setParkingHoursData] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ── Audit log filters (guard-style dropdowns) ─────────────────
  const AUDIT_DATE_OPTIONS = ["All Date", "Today", "Yesterday"] as const;
  const AUDIT_ENTRY_OPTIONS = ["All Entry", "Student", "Faculty", "Staff", "Guard", "Guest"] as const;
  const AUDIT_VEHICLE_OPTIONS = ["All Vehicles", "Car", "Motorcycle", "Ebike", "Others"] as const;
  const [auditDateFilter, setAuditDateFilter] = useState<string>("All Date");
  const [auditEntryFilter, setAuditEntryFilter] = useState<string>("All Entry");
  const [auditVehicleFilter, setAuditVehicleFilter] = useState<string>("All Vehicles");
  const [auditExpandedFilter, setAuditExpandedFilter] = useState<string | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  // ─────────────────────────────────────────────────────────────────

  // ── User detail modal state ─────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [userDetailModalVisible, setUserDetailModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(false);
  const [editingUserData, setEditingUserData] = useState<any>({});
  const [updatingUser, setUpdatingUser] = useState(false);
  // ─────────────────────────────────────────────────────────────────

  const totalStudents = students.length;
  const totalFaculty = faculty.length;
  const totalStaff = staff.length;
  const totalGuards = guards.length;
  const vehiclesToday = vehiclesCount;

  // Fetch ALL users once — Trie + Hash Set are built from this
  useEffect(() => {
    if (currentScreen === "users" || currentScreen === "overview") {
      fetchUsers();
    }
  }, [currentScreen]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const [studentsData, facultyData, staffData, guardsData] =
        await Promise.all([
          AdminService.fetchStudents(), // no query — fetch all
          AdminService.fetchFaculty(),
          AdminService.fetchStaff(),
          AdminService.fetchGuards(),
        ]);
      setStudents(studentsData);
      setFaculty(facultyData);
      setStaff(staffData);
      setGuards(guardsData);

      // ── Build Trie indexes ─────────────────────────────────────────
      studentTrie.current = buildTrie(studentsData as any);
      facultyTrie.current = buildTrie(facultyData as any);
      staffTrie.current = buildTrie(staffData as any);
      guardTrie.current = buildTrie(guardsData as any);

      // ── Populate Hash Set for duplicate detection ──────────────────
      duplicateChecker.current.load([
        ...studentsData,
        ...facultyData,
        ...staffData,
        ...guardsData,
      ]);
    } catch (error) {
      console.error("Error fetching users:", error);
      setErrorMessage("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAnalyticsData = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const [logs, count, hoursData] = await Promise.all([
        AdminService.fetchAuditLogs(),
        AdminService.getTodayVehicleCount(),
        AdminService.getParkingHoursData(),
      ]);

      setAuditLogs(logs);
      setVehiclesCount(count);
      setParkingHoursData(hoursData);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      setErrorMessage("Failed to load analytics data");
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Fetch analytics data for overview and audit logs screens
  useEffect(() => {
    if (currentScreen === "overview" || currentScreen === "audit-logs") {
      void fetchAnalyticsData();
    }
  }, [currentScreen, fetchAnalyticsData]);

  // ── Reset modal state when modal closes ───────────────────────────────────
  useEffect(() => {
    if (!userDetailModalVisible) {
      setErrorMessage("");
      setSuccessMessage("");
      setEditingUser(false);
    }
  }, [userDetailModalVisible]);
  // ─────────────────────────────────────────────────────────────────────────

  // No debounce needed — search is now purely in-memory via Trie/Levenshtein
  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  // handleHeaderSwipeStart/End removed in favor of global PanResponder

  const handleLogout = () => {
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
                  router.replace("/");
                } else {
                  setLogoutLoading(false);
                  setAlertConfig({
                    title: "Logout Error",
                    message:
                      result.message || "Logout failed. Please try again.",
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
                  // Reset animations if logout failed
                  fadeAnim.setValue(1);
                  scaleAnim.setValue(1);
                }
              });
            } catch (error) {
              console.error("Logout error:", error);
              setLogoutLoading(false);
              setAlertConfig({
                title: "Error",
                message: "An error occurred during logout.",
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

  const handleNewAccountChange = (field: string, value: string) => {
    // Auto-format student ID: XX-XXXX
    if (field === "studentId") {
      // Remove non-numeric characters except dash
      let cleaned = value.replace(/[^0-9]/g, "");
      // Insert dash after 2 digits
      if (cleaned.length > 2) {
        cleaned = cleaned.slice(0, 2) + "-" + cleaned.slice(2);
      }
      // Limit to 7 chars (XX-XXXX)
      cleaned = cleaned.slice(0, 7);
      setNewAccountData((prev) => ({
        ...prev,
        studentId: cleaned,
      }));
    } else if (field === "employeeId") {
      // Auto-format employee ID based on role: XXX - 0000
      let cleaned = value.toUpperCase();
      let numbers = cleaned.replace(/[^0-9]/g, "").slice(0, 4);
      
      if (numbers.length > 0) {
        const rolePrefix = newAccountRole === "faculty" ? "FAC" : newAccountRole === "staff" ? "STF" : "GRD";
        setNewAccountData((prev) => ({
          ...prev,
          employeeId: `${rolePrefix} - ${numbers}`,
        }));
      } else {
        // If they cleared the numbers, just let them clear the field
        setNewAccountData((prev) => ({
          ...prev,
          employeeId: "",
        }));
      }
    } else if (field === "vehiclePlate") {
      // Auto-format vehicle plate: ABC 1234 (3 letters + 4 numbers)
      let cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      
      if (cleaned.length === 0) {
        setNewAccountData((prev) => ({
          ...prev,
          vehiclePlate: cleaned,
        }));
      } else {
        // Extract letters and numbers
        let letters = cleaned.replace(/[^A-Z]/g, "").slice(0, 3);
        let numbers = cleaned.replace(/[^0-9]/g, "").slice(0, 4);
        
        // Format as ABC 1234 (with space)
        const formatted = letters && numbers ? `${letters} ${numbers}` : letters;
        
        // Limit total to 8 chars (ABC 1234)
        cleaned = formatted.slice(0, 8);
        
        setNewAccountData((prev) => ({
          ...prev,
          vehiclePlate: cleaned,
        }));
      }
    } else {
      setNewAccountData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
    // Clear messages when typing
    setErrorMessage("");
    setSuccessMessage("");
  };

  const validateAccountForm = (): boolean => {
    const { firstName, lastName, email, studentId, employeeId } =
      newAccountData;

    if (!firstName.trim()) {
      setErrorMessage("First name is required");
      return false;
    }
    if (!lastName.trim()) {
      setErrorMessage("Last name is required");
      return false;
    }
    if (!email.trim()) {
      setErrorMessage("Email is required");
      return false;
    }
    if (!email.toLowerCase().endsWith("@gmail.com")) {
      setErrorMessage("Email must be a Gmail address (e.g. name@gmail.com)");
      return false;
    }

    // ── Hash Set duplicate checks (O(1)) ────────────────────────────────
    if (duplicateChecker.current.hasEmail(email)) {
      setErrorMessage("Email is already registered.");
      return false;
    }

    if (newAccountRole === "student") {
      if (!studentId.trim()) {
        setErrorMessage("Student ID is required");
        return false;
      }
      const studentIdRegex = /^\d{2}-\d{4}$/;
      if (!studentIdRegex.test(studentId)) {
        setErrorMessage("Student ID must be in format XX-XXXX (e.g. 23-1832)");
        return false;
      }
      if (duplicateChecker.current.hasStudentId(studentId)) {
        setErrorMessage("Student ID is already registered.");
        return false;
      }
    }

    if (
      newAccountRole === "faculty" ||
      newAccountRole === "staff" ||
      newAccountRole === "guard"
    ) {
      if (!employeeId.trim()) {
        setErrorMessage("Employee ID is required");
        return false;
      }

      // Validate employee ID format: XXX - 0000
      const rolePrefix = newAccountRole === "faculty" ? "FAC" : newAccountRole === "staff" ? "STF" : "GRD";
      const employeeIdRegex = /^[A-Z]{3} - \d{4}$/;
      
      if (!employeeIdRegex.test(employeeId)) {
        setErrorMessage(`Employee ID must be in format ${rolePrefix} - 0000 (e.g., ${rolePrefix} - 1234)`);
        return false;
      }

      // Validate the prefix matches the role
      const actualPrefix = employeeId.split(" - ")[0];
      if (actualPrefix !== rolePrefix) {
        setErrorMessage(`${newAccountRole.charAt(0).toUpperCase() + newAccountRole.slice(1)} Employee ID must start with ${rolePrefix}`);
        return false;
      }

      if (duplicateChecker.current.hasEmployeeId(employeeId)) {
        setErrorMessage("Employee ID is already registered.");
        return false;
      }
    }
    // ────────────────────────────────────────────────────────────────────

    // Validate vehicle plate (if provided) - format: ABC 1234
    if (newAccountData.vehiclePlate.trim()) {
      const plateRegex = /^[A-Z]{3} \d{4}$/;
      if (!plateRegex.test(newAccountData.vehiclePlate)) {
        setErrorMessage("Vehicle plate must be in format ABC 1234 (3 letters + 4 numbers)");
        return false;
      }

      // Check for duplicate plate
      if (duplicateChecker.current.hasVehiclePlate(newAccountData.vehiclePlate)) {
        setErrorMessage("Vehicle plate is already registered.");
        return false;
      }
    }

    // Validate vehicle type (must be selected if plate is provided)
    if (newAccountData.vehiclePlate.trim() && !newAccountData.vehicleType) {
      setErrorMessage("Vehicle type is required when a plate number is provided");
      return false;
    }

    // Validate that ebike doesn't have a plate
    if (newAccountData.vehicleType === "Ebike" && newAccountData.vehiclePlate.trim()) {
      setErrorMessage("E-bikes do not need a plate number");
      return false;
    }

    return true;
  };

  const handleCreateAccount = async () => {
    if (!adminId) {
      setErrorMessage("Admin ID not found. Please logout and login again.");
      return;
    }

    if (!validateAccountForm()) {
      return;
    }

    setCreatingAccount(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let response;

      if (newAccountRole === "student") {
        response = await AdminService.createStudentAccount({
          firstName: newAccountData.firstName,
          lastName: newAccountData.lastName,
          suffix: newAccountData.suffix,
          middleName: newAccountData.middleName,
          email: newAccountData.email,
          role: "student",
          studentId: newAccountData.studentId,
          vehiclePlate: newAccountData.vehiclePlate,
          vehicleType: newAccountData.vehicleType,
          adminId,
        });
      } else if (newAccountRole === "faculty" || newAccountRole === "staff") {
        response = await AdminService.createFacultyStaffAccount({
          firstName: newAccountData.firstName,
          lastName: newAccountData.lastName,
          suffix: newAccountData.suffix,
          middleName: newAccountData.middleName,
          email: newAccountData.email,
          role: newAccountRole,
          employeeId: newAccountData.employeeId,
          vehiclePlate: newAccountData.vehiclePlate,
          vehicleType: newAccountData.vehicleType,
          adminId,
        });
      } else {
        response = await AdminService.createGuardAccount({
          firstName: newAccountData.firstName,
          lastName: newAccountData.lastName,
          suffix: newAccountData.suffix,
          middleName: newAccountData.middleName,
          email: newAccountData.email,
          role: "guard",
          employeeId: newAccountData.employeeId,
          shift: newAccountData.shift,
          adminId,
        });
      }

      if (response.success) {
        setSuccessMessage(response.message);
        // Reset form
        setNewAccountData({
          firstName: "",
          lastName: "",
          suffix: "",
          middleName: "",
          email: "",
          studentId: "",
          employeeId: "",
          vehiclePlate: "",
          vehicleType: "Car",
          shift: "",
        });

        // Show alert
        Alert.alert(
          "Success",
          response.message + "\n\nAn email has been sent to the user.",
          [
            {
              text: "OK",
              onPress: () => {
                setCurrentScreen("users");
              },
            },
          ],
        );
      } else {
        setErrorMessage(response.message || "Failed to create account");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Error creating account");
    } finally {
      setCreatingAccount(false);
    }
  };

  const renderOverviewScreen = () => (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.welcome}>Welcome, Admin</Text>
      <Text style={styles.welcomeSub}>
        Here&apos;s the campus overview for today.
      </Text>

      <TouchableOpacity
        style={styles.overviewCard}
        activeOpacity={0.8}
        onPress={() => {
          setUserType("students");
          setCurrentScreen("users");
        }}
      >
        <Text style={styles.overviewTitle}>Total Registered Students</Text>
        <Text style={styles.overviewValue}>
          {totalStudents.toLocaleString()}
        </Text>
      </TouchableOpacity>

      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={styles.smallCard}
          activeOpacity={0.8}
          onPress={() => {
            setUserType("faculty");
            setCurrentScreen("users");
          }}
        >
          <Ionicons name="school" size={28} color="#1f8e4d" />
          <Text style={styles.smallCardLabel}>Total Faculty</Text>
          <Text style={styles.smallCardValue}>{totalFaculty}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.smallCard}
          activeOpacity={0.8}
          onPress={() => {
            setUserType("staff");
            setCurrentScreen("users");
          }}
        >
          <Ionicons name="briefcase" size={28} color="#1f8e4d" />
          <Text style={styles.smallCardLabel}>Total Staff</Text>
          <Text style={styles.smallCardValue}>{totalStaff}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={styles.smallCard}
          activeOpacity={0.8}
          onPress={() => {
            setUserType("guards");
            setCurrentScreen("users");
          }}
        >
          <Ionicons name="shield-checkmark" size={28} color="#1f8e4d" />
          <Text style={styles.smallCardLabel}>Active Guards</Text>
          <Text style={styles.smallCardValue}>{totalGuards}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.smallCard}
          activeOpacity={0.8}
          onPress={() => setShowChartModal(true)}
        >
          <Ionicons name="car" size={28} color="#1f8e4d" />
          <Text style={styles.smallCardLabel}>Vehicles Today</Text>
          <Text style={styles.smallCardValue}>{vehiclesToday}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.chartCard}
        activeOpacity={0.85}
        onPress={() => setShowChartModal(true)}
      >
        <Text style={styles.chartTitle}>Peak Parking Hours</Text>
        <Text style={styles.chartSubtitle}>Vehicle volume over time</Text>
        <View style={styles.chartBars}>
          {parkingHoursData.length > 0 ? (
            parkingHoursData.map((data, index) => (
              <View key={index} style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.min(data.height, 100)}%` },
                  ]}
                />
              </View>
            ))
          ) : (
            <>
              <View style={[styles.barWrapper, { height: 60 }]}>
                <View style={[styles.barPlaceholder, { height: "60%" }]} />
              </View>
              <View style={[styles.barWrapper, { height: 60 }]}>
                <View style={[styles.barPlaceholder, { height: "48%" }]} />
              </View>
              <View style={[styles.barWrapper, { height: 60 }]}>
                <View style={[styles.barPlaceholder, { height: "75%" }]} />
              </View>
              <View style={[styles.barWrapper, { height: 60 }]}>
                <View style={[styles.barPlaceholder, { height: "42%" }]} />
              </View>
              <View style={[styles.barWrapper, { height: 60 }]}>
                <View style={[styles.barPlaceholder, { height: "65%" }]} />
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderUsersScreen = () => {
    const displayed =
      userType === "students"
        ? displayedStudents
        : userType === "faculty"
          ? displayedFaculty
          : userType === "staff"
            ? displayedStaff
            : displayedGuards;

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Directory</Text>

        <View style={styles.searchBox}>
          <Ionicons
            name="search"
            size={18}
            color="#9ca3af"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or ID..."
            placeholderTextColor="#d1d5db"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, userType === "students" && styles.tabActive]}
            onPress={() => setUserType("students")}
          >
            <Text
              style={[
                styles.tabText,
                userType === "students" && styles.tabTextActive,
              ]}
            >
              {`Students (${students.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, userType === "faculty" && styles.tabActive]}
            onPress={() => setUserType("faculty")}
          >
            <Text
              style={[
                styles.tabText,
                userType === "faculty" && styles.tabTextActive,
              ]}
            >
              {`Faculty (${faculty.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, userType === "staff" && styles.tabActive]}
            onPress={() => setUserType("staff")}
          >
            <Text
              style={[
                styles.tabText,
                userType === "staff" && styles.tabTextActive,
              ]}
            >
              {`Staff (${staff.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, userType === "guards" && styles.tabActive]}
            onPress={() => setUserType("guards")}
          >
            <Text
              style={[
                styles.tabText,
                userType === "guards" && styles.tabTextActive,
              ]}
            >
              {`Guards (${guards.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Merge Sort controls ── */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {[
            { key: "firstName", label: "Name" },
            { key: "isActive", label: "Status" },
            { key: "createdAt", label: "Date" },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.sortBtn, sortKey === key && styles.sortBtnActive]}
              onPress={() => toggleSort(key)}
            >
              <Text
                style={[
                  styles.sortBtnText,
                  sortKey === key && styles.sortBtnTextActive,
                ]}
              >
                {`${label}${sortKey === key ? (sortOrder === "asc" ? " ↑" : " ↓") : ""}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Algorithm badge ── */}
        {searchQuery.length > 0 && (
          <View style={styles.algorithmBadge}>
            <Ionicons name="flash" size={12} color="#1f8e4d" />
            <Text style={styles.algorithmBadgeText}>
              {`${displayed.length} result${displayed.length !== 1 ? "s" : ""} · Trie + Levenshtein · Merge Sort`}
            </Text>
          </View>
        )}

        {loadingUsers ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {displayed.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userCard}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedUser(user as DirectoryUser);
                  setEditingUserData({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    studentId: user.studentId || "",
                    employeeId: user.employeeId || "",
                  });
                  setEditingUser(false);
                  setErrorMessage("");
                  setSuccessMessage("");
                  setUserDetailModalVisible(true);
                }}
              >
                <View style={styles.userInfo}>
                  <View style={styles.userAvatar}>
                    <Ionicons
                      name={
                        userType === "students"
                          ? "person"
                          : userType === "faculty"
                            ? "school"
                            : userType === "staff"
                              ? "briefcase"
                              : "shield"
                      }
                      size={24}
                      color="#6b7280"
                    />
                  </View>
                  <View style={styles.userDetails}>
                    <Text
                      style={styles.userName}
                    >{`${user.firstName} ${user.lastName}`}</Text>
                    <Text style={styles.userID}>
                      {userType === "students"
                        ? user.studentId
                        : user.employeeId}
                    </Text>
                    <Text
                      style={[
                        styles.userStatus,
                        { color: user.isActive ? "#10b981" : "#ef4444" },
                      ]}
                    >
                      {user.isActive ? "● ACTIVE" : "● PENDING"}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
              </TouchableOpacity>
            ))}
            {displayed.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name={
                    searchQuery
                      ? "search-outline"
                      : userType === "students"
                        ? "people-outline"
                        : userType === "faculty"
                          ? "school-outline"
                          : userType === "staff"
                            ? "briefcase-outline"
                            : "shield-outline"
                  }
                  size={48}
                  color="#d1d5db"
                />
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No matches for "${searchQuery}"`
                    : "No users found"}
                </Text>
                {searchQuery.length > 0 && (
                  <Text style={styles.emptySubText}>
                    Fuzzy search checked — no close matches
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={() => setCurrentScreen("new-account")}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    );
  };




  const renderAuditLogsScreen = () => {
    // ════════════════════════════════════════════════════════════════════════════════
    // ALGORITHM PIPELINE: AUDIT LOG FILTERING & SORTING
    // ════════════════════════════════════════════════════════════════════════════════
    // 
    // Combines 3 algorithms for efficient audit log processing:
    // 
    // 1. HASH SET DEDUPLICATOR - O(1) per log, O(n) total
    //    - Removes duplicate plate-timestamp entries
    //    - Prevents duplicate logs from overlapping date range queries
    // 
    // 2. MERGE SORT - O(n log n)
    //    - Stable sorting by timestamp (most recent first)
    //    - Preserves insertion order for equal timestamps
    // 
    // 3. TEXT FILTER - O(n × m) where m = query length
    //    - Searches plate, name, role fields for matches
    //    - Case-insensitive substring matching
    // 
    // Result: Deduplicated + Sorted + Filtered audit logs
    // ════════════════════════════════════════════════════════════════════════════════
    let filteredLogs = filterAndSortAuditLogs(
      auditLogs,
      searchQuery,
      "timestamp",
      "desc",
    );

    // Apply date filter
    if (auditDateFilter !== "All Date") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      filteredLogs = filteredLogs.filter((log: any) => {
        const logTime = log.timestamp?.getTime?.() || 0;
        if (auditDateFilter === "Today") return logTime >= todayStart.getTime();
        if (auditDateFilter === "Yesterday")
          return logTime >= yesterdayStart.getTime() && logTime < todayStart.getTime();
        return true;
      });
    }

    // Apply entry type filter
    if (auditEntryFilter !== "All Entry") {
      const targetRole = auditEntryFilter.toLowerCase();
      filteredLogs = filteredLogs.filter((log: any) => {
        const logRole = (log.role || "").toLowerCase();
        // "guest" in the dropdown matches both "guest" and "visitor" roles in the DB
        if (targetRole === "guest") return logRole === "visitor" || logRole === "guest";
        // "student" in the dropdown matches the "student" role in the audit log
        // (faculty/staff are mapped to "student" in fetchAuditLogs, but we check raw data too)
        return logRole === targetRole;
      });
    }

    // Apply vehicle type filter
    if (auditVehicleFilter !== "All Vehicles") {
      const knownTypes = ["car", "motorcycle", "ebike"];
      filteredLogs = filteredLogs.filter((log: any) => {
        const vType = (log.vehicleType || "").toLowerCase();
        if (auditVehicleFilter === "Others") {
          return !knownTypes.includes(vType);
        }
        return vType === auditVehicleFilter.toLowerCase();
      });
    }

    const displayedLogs = filteredLogs;

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Text style={styles.screenTitle}>Master Audit Logs</Text>
          <Text style={styles.screenSubtitle}>Campus-wide vehicle activity</Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons
            name="search"
            size={18}
            color="#9ca3af"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by plate, name, or role..."
            placeholderTextColor="#d1d5db"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* ── Guard-style dropdown filters ── */}
        <View style={styles.auditFilterRow}>
          {/* Date filter */}
          <View style={styles.auditFilterCol}>
            <TouchableOpacity
              style={[
                styles.auditFilterBtn,
                auditDateFilter !== "All Date" && styles.auditFilterBtnActive,
              ]}
              onPress={() =>
                setAuditExpandedFilter(auditExpandedFilter === "date" ? null : "date")
              }
            >
              <Ionicons name="calendar" size={14} color={auditDateFilter !== "All Date" ? "#1f8e4d" : "#6b7a8d"} />
              <Text
                style={[
                  styles.auditFilterBtnText,
                  auditDateFilter !== "All Date" && styles.auditFilterBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {auditDateFilter}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#8f9ba7" />
            </TouchableOpacity>
            {auditExpandedFilter === "date" && (
              <View style={styles.auditDropdown}>
                {AUDIT_DATE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.auditDropdownItem,
                      auditDateFilter === opt && styles.auditDropdownItemActive,
                    ]}
                    onPress={() => {
                      setAuditDateFilter(opt);
                      setAuditExpandedFilter(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.auditDropdownText,
                        auditDateFilter === opt && styles.auditDropdownTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Entry type filter */}
          <View style={styles.auditFilterCol}>
            <TouchableOpacity
              style={[
                styles.auditFilterBtn,
                auditEntryFilter !== "All Entry" && styles.auditFilterBtnActive,
              ]}
              onPress={() =>
                setAuditExpandedFilter(auditExpandedFilter === "entry" ? null : "entry")
              }
            >
              <Ionicons name="person" size={14} color={auditEntryFilter !== "All Entry" ? "#1f8e4d" : "#6b7a8d"} />
              <Text
                style={[
                  styles.auditFilterBtnText,
                  auditEntryFilter !== "All Entry" && styles.auditFilterBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {auditEntryFilter}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#8f9ba7" />
            </TouchableOpacity>
            {auditExpandedFilter === "entry" && (
              <View style={styles.auditDropdown}>
                {AUDIT_ENTRY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.auditDropdownItem,
                      auditEntryFilter === opt && styles.auditDropdownItemActive,
                    ]}
                    onPress={() => {
                      setAuditEntryFilter(opt);
                      setAuditExpandedFilter(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.auditDropdownText,
                        auditEntryFilter === opt && styles.auditDropdownTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Vehicle filter */}
          <View style={styles.auditFilterCol}>
            <TouchableOpacity
              style={[
                styles.auditFilterBtn,
                auditVehicleFilter !== "All Vehicles" && styles.auditFilterBtnActive,
              ]}
              onPress={() =>
                setAuditExpandedFilter(auditExpandedFilter === "vehicle" ? null : "vehicle")
              }
            >
              <Ionicons name="car" size={14} color={auditVehicleFilter !== "All Vehicles" ? "#1f8e4d" : "#6b7a8d"} />
              <Text
                style={[
                  styles.auditFilterBtnText,
                  auditVehicleFilter !== "All Vehicles" && styles.auditFilterBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {auditVehicleFilter}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#8f9ba7" />
            </TouchableOpacity>
            {auditExpandedFilter === "vehicle" && (
              <View style={styles.auditDropdown}>
                {AUDIT_VEHICLE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.auditDropdownItem,
                      auditVehicleFilter === opt && styles.auditDropdownItemActive,
                    ]}
                    onPress={() => {
                      setAuditVehicleFilter(opt);
                      setAuditExpandedFilter(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.auditDropdownText,
                        auditVehicleFilter === opt && styles.auditDropdownTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {errorMessage && (
          <View style={styles.errorAlert}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.errorAlertText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.auditLogsList}>
          {loadingAnalytics ? (
            <View style={styles.loadingContainer}>
              <LoaderComponent visible={true} message="Loading audit logs..." />
            </View>
          ) : displayedLogs.length > 0 ? (
            <>
              <Text style={styles.logsCountText}>
                Total entries: {displayedLogs.length}
              </Text>
              {displayedLogs.map((log) => (
                <TouchableOpacity
                  key={log.id}
                  style={styles.auditLogCard}
                  activeOpacity={0.7}
                  onPress={() => setSelectedAuditLog(log)}
                >
                  <View style={styles.auditLogIcon}>
                    <Ionicons
                      name={
                        log.type === "time_in" || log.type === "IN"
                          ? "arrow-down-outline"
                          : "arrow-up-outline"
                      }
                      size={20}
                      color={
                        log.type === "time_in" || log.type === "IN"
                          ? "#10b981"
                          : "#ef4444"
                      }
                    />
                  </View>
                  <View style={styles.auditLogContent}>
                    <View style={styles.auditLogHeader}>
                      <Text style={styles.auditLogPlate}>{log.plate}</Text>
                      <View
                        style={[
                          styles.auditLogStatusBadge,
                          {
                            backgroundColor:
                              log.type === "time_in" ? "#dbeafe" : "#fecaca",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.auditLogStatusText,
                            {
                              color:
                                log.type === "time_in" ? "#0369a1" : "#991b1b",
                            },
                          ]}
                        >
                          {log.type === "time_in" ? "CHECK IN" : "CHECK OUT"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.auditLogName}>{log.name}</Text>
                    <View style={styles.auditLogMetaRow}>
                      <Text style={styles.auditLogRole}>
                        {log.role.charAt(0).toUpperCase() + log.role.slice(1)}
                      </Text>
                      <Text style={styles.auditLogVehicle}>
                        • {log.vehicleType || "vehicle"}
                      </Text>
                    </View>
                    <Text style={styles.auditLogTime}>{log.time}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#c0c9d0" style={{ alignSelf: "center" }} />
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No logs found</Text>
              <Text style={styles.emptySubText}>
                {searchQuery
                  ? "No matching logs for your search"
                  : "No vehicle activity recorded for this period"}
              </Text>
            </View>
          )}
        </View>

        {/* ── Audit Log Detail Modal ── */}
        <Modal
          visible={!!selectedAuditLog}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedAuditLog(null)}
        >
          <View style={styles.detailModalOverlay}>
            <View style={styles.detailModalCard}>
              {selectedAuditLog && (
                <>
                  {/* Header */}
                  <View style={styles.detailModalHeader}>
                    <View
                      style={[
                        styles.detailModalBadge,
                        {
                          backgroundColor:
                            selectedAuditLog.type === "time_in"
                              ? "#dcfce7"
                              : "#fee2e2",
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          selectedAuditLog.type === "time_in"
                            ? "arrow-down-circle"
                            : "arrow-up-circle"
                        }
                        size={28}
                        color={
                          selectedAuditLog.type === "time_in"
                            ? "#16a34a"
                            : "#dc2626"
                        }
                      />
                      <Text
                        style={[
                          styles.detailModalBadgeText,
                          {
                            color:
                              selectedAuditLog.type === "time_in"
                                ? "#166534"
                                : "#991b1b",
                          },
                        ]}
                      >
                        {selectedAuditLog.type === "time_in"
                          ? "TIME IN"
                          : "TIME OUT"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedAuditLog(null)}
                      style={styles.detailModalClose}
                    >
                      <Ionicons name="close" size={22} color="#6b7a8d" />
                    </TouchableOpacity>
                  </View>

                  {/* Name */}
                  <Text style={styles.detailModalName}>
                    {selectedAuditLog.name}
                  </Text>

                  {/* Info Rows */}
                  <View style={styles.detailModalDivider} />

                  <View style={styles.detailModalRow}>
                    <View style={styles.detailModalRowIcon}>
                      <Ionicons name="person" size={16} color="#1f8e4d" />
                    </View>
                    <Text style={styles.detailModalLabel}>Role</Text>
                    <Text style={styles.detailModalValue}>
                      {selectedAuditLog.role.charAt(0).toUpperCase() +
                        selectedAuditLog.role.slice(1)}
                    </Text>
                  </View>

                  <View style={styles.detailModalRow}>
                    <View style={styles.detailModalRowIcon}>
                      <Ionicons name="card" size={16} color="#1f8e4d" />
                    </View>
                    <Text style={styles.detailModalLabel}>Plate Number</Text>
                    <Text style={styles.detailModalValue}>
                      {selectedAuditLog.plate}
                    </Text>
                  </View>

                  <View style={styles.detailModalRow}>
                    <View style={styles.detailModalRowIcon}>
                      <Ionicons name="car" size={16} color="#1f8e4d" />
                    </View>
                    <Text style={styles.detailModalLabel}>Vehicle Type</Text>
                    <Text style={styles.detailModalValue}>
                      {(selectedAuditLog.vehicleType || "N/A")
                        .charAt(0)
                        .toUpperCase() +
                        (selectedAuditLog.vehicleType || "N/A").slice(1)}
                    </Text>
                  </View>

                  <View style={styles.detailModalRow}>
                    <View style={styles.detailModalRowIcon}>
                      <Ionicons name="time" size={16} color="#1f8e4d" />
                    </View>
                    <Text style={styles.detailModalLabel}>Timestamp</Text>
                    <Text style={styles.detailModalValue}>
                      {selectedAuditLog.time}
                    </Text>
                  </View>

                  <View style={styles.detailModalRow}>
                    <View style={styles.detailModalRowIcon}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#1f8e4d"
                      />
                    </View>
                    <Text style={styles.detailModalLabel}>Status</Text>
                    <View
                      style={[
                        styles.detailModalStatusPill,
                        {
                          backgroundColor:
                            selectedAuditLog.type === "time_in"
                              ? "#dcfce7"
                              : "#fee2e2",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color:
                            selectedAuditLog.type === "time_in"
                              ? "#166534"
                              : "#991b1b",
                        }}
                      >
                        {selectedAuditLog.type === "time_in"
                          ? "CHECKED IN"
                          : "CHECKED OUT"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailModalDivider} />

                  <TouchableOpacity
                    style={styles.detailModalDismiss}
                    onPress={() => setSelectedAuditLog(null)}
                  >
                    <Text style={styles.detailModalDismissText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  };

  const renderNewAccountScreen = () => (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.backButton}>
        <TouchableOpacity onPress={() => setCurrentScreen("users")}>
          <Ionicons name="chevron-back" size={24} color="#1d2934" />
        </TouchableOpacity>
        <Text style={styles.newAccountTitle}>New Account</Text>
      </View>

      {/* Messages */}
      {!!errorMessage && (
        <View style={styles.errorAlert}>
          <View style={styles.alertContent}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.errorAlertText}>{errorMessage}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setErrorMessage("")}
            style={styles.alertCloseBtn}
          >
            <Ionicons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {!!successMessage && (
        <View style={styles.successAlert}>
          <View style={styles.alertContent}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.successAlertText}>{successMessage}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setSuccessMessage("")}
            style={styles.alertCloseBtn}
          >
            <Ionicons name="close" size={20} color="#10b981" />
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.roleSetupLabel}>ROLE SETUP</Text>
      <View style={styles.roleButtonsContainer}>
        <TouchableOpacity
          style={[
            styles.roleButton,
            newAccountRole === "student" && styles.roleButtonActive,
          ]}
          onPress={() => {
            setNewAccountRole("student");
            setVehicleTypeDropdownOpen(false);
          }}
          disabled={creatingAccount}
        >
          <Ionicons
            name="person"
            size={20}
            color={newAccountRole === "student" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[
              styles.roleButtonText,
              newAccountRole === "student" && styles.roleButtonTextActive,
            ]}
          >
            Student
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.roleButton,
            newAccountRole === "faculty" && styles.roleButtonActive,
          ]}
          onPress={() => {
            setNewAccountRole("faculty");
            setVehicleTypeDropdownOpen(false);
          }}
          disabled={creatingAccount}
        >
          <Ionicons
            name="school"
            size={20}
            color={newAccountRole === "faculty" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[
              styles.roleButtonText,
              newAccountRole === "faculty" && styles.roleButtonTextActive,
            ]}
          >
            Faculty
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.roleButton,
            newAccountRole === "staff" && styles.roleButtonActive,
          ]}
          onPress={() => {
            setNewAccountRole("staff");
            setVehicleTypeDropdownOpen(false);
          }}
          disabled={creatingAccount}
        >
          <Ionicons
            name="briefcase"
            size={20}
            color={newAccountRole === "staff" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[
              styles.roleButtonText,
              newAccountRole === "staff" && styles.roleButtonTextActive,
            ]}
          >
            Staff
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.roleButton,
            newAccountRole === "guard" && styles.roleButtonActive,
          ]}
          onPress={() => {
            setNewAccountRole("guard");
            setVehicleTypeDropdownOpen(false);
          }}
          disabled={creatingAccount}
        >
          <Ionicons
            name="shield"
            size={20}
            color={newAccountRole === "guard" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[
              styles.roleButtonText,
              newAccountRole === "guard" && styles.roleButtonTextActive,
            ]}
          >
            Guard
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.personalDetailsLabel}>PERSONAL DETAILS</Text>

      <Text style={styles.fieldLabel}>First Name *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Juan"
        placeholderTextColor="#d1d5db"
        editable={!creatingAccount}
        value={newAccountData.firstName}
        onChangeText={(value) => handleNewAccountChange("firstName", value)}
      />

      <Text style={styles.fieldLabel}>Last Name *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Dela Cruz"
        placeholderTextColor="#d1d5db"
        editable={!creatingAccount}
        value={newAccountData.lastName}
        onChangeText={(value) => handleNewAccountChange("lastName", value)}
      />

      <Text style={styles.fieldLabel}>
        {"Suffix "}
        <Text style={styles.fieldLabelOptional}>{"(Optional)"}</Text>
      </Text>
      <TextInput
        style={styles.textInput}
        placeholder="Jr., Sr., II, III, IV"
        placeholderTextColor="#d1d5db"
        editable={!creatingAccount}
        value={newAccountData.suffix}
        onChangeText={(value) => handleNewAccountChange("suffix", value)}
      />

      <Text style={styles.fieldLabel}>
        {"Middle Name "}
        <Text style={styles.fieldLabelOptional}>{"(Optional)"}</Text>
      </Text>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. Santos"
        placeholderTextColor="#d1d5db"
        editable={!creatingAccount}
        value={newAccountData.middleName}
        onChangeText={(value) => handleNewAccountChange("middleName", value)}
      />

      <Text style={styles.fieldLabel}>Email * (@gmail.com)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="name@gmail.com"
        placeholderTextColor="#d1d5db"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!creatingAccount}
        value={newAccountData.email}
        onChangeText={(value) => handleNewAccountChange("email", value)}
      />

      {newAccountRole === "student" ? (
        <>
          <Text style={styles.fieldLabel}>{"Student ID * (XX-XXXX)"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="23-1832"
            placeholderTextColor="#d1d5db"
            keyboardType="numeric"
            maxLength={7}
            editable={!creatingAccount}
            value={newAccountData.studentId}
            onChangeText={(value) => handleNewAccountChange("studentId", value)}
          />

          <Text style={styles.fieldLabel}>{"Vehicle Type"}</Text>
          <TouchableOpacity
            style={[
              styles.vehicleTypeDropdownBtn,
              vehicleTypeDropdownOpen && styles.vehicleTypeDropdownBtnActive,
            ]}
            onPress={() => setVehicleTypeDropdownOpen(!vehicleTypeDropdownOpen)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.vehicleTypeDropdownText,
                !newAccountData.vehicleType && { color: "#9ca3af" },
              ]}
            >
              {newAccountData.vehicleType || "Select vehicle type"}
            </Text>
            <Ionicons
              name={vehicleTypeDropdownOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8f9ba7"
            />
          </TouchableOpacity>

          {vehicleTypeDropdownOpen && (
            <View style={styles.vehicleTypeDropdownMenu}>
              {(["Car", "Motorcycle", "Ebike", "Others"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeDropdownItem,
                    newAccountData.vehicleType === type && styles.vehicleTypeDropdownItemActive,
                  ]}
                  onPress={() => {
                    handleNewAccountChange("vehicleType", type);
                    setVehicleTypeDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      type === "Car"
                        ? "car-outline"
                        : type === "Motorcycle"
                          ? "bicycle-outline"
                          : type === "Ebike"
                            ? "flash-outline"
                            : "pencil-outline"
                    }
                    size={16}
                    color={newAccountData.vehicleType === type ? "#1f8e4d" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeDropdownItemText,
                      newAccountData.vehicleType === type && styles.vehicleTypeDropdownItemTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {newAccountData.vehicleType === "Others" && (
            <TextInput
              style={styles.textInput}
              placeholder="Specify vehicle type..."
              placeholderTextColor="#d1d5db"
              editable={!creatingAccount}
              value={newAccountData.vehicleType === "Others" ? "" : newAccountData.vehicleType}
              onChangeText={(value) =>
                handleNewAccountChange("vehicleType", value || "Others")
              }
            />
          )}

          <Text style={styles.fieldLabel}>{"Vehicle Plate Number"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="ABC 1234"
            placeholderTextColor="#d1d5db"
            autoCapitalize="characters"
            editable={!creatingAccount}
            value={newAccountData.vehiclePlate}
            onChangeText={(value) =>
              handleNewAccountChange("vehiclePlate", value)
            }
          />
        </>
      ) : newAccountRole === "faculty" || newAccountRole === "staff" ? (
        <>
          <Text style={styles.fieldLabel}>{"Employee ID *"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={newAccountRole === "faculty" ? "FAC-1234" : "STF-1234"}
            placeholderTextColor="#d1d5db"
            editable={!creatingAccount}
            value={newAccountData.employeeId}
            onChangeText={(value) =>
              handleNewAccountChange("employeeId", value)
            }
          />

          <Text style={styles.fieldLabel}>{"Vehicle Type"}</Text>
          <TouchableOpacity
            style={[
              styles.vehicleTypeDropdownBtn,
              vehicleTypeDropdownOpen && styles.vehicleTypeDropdownBtnActive,
            ]}
            onPress={() => setVehicleTypeDropdownOpen(!vehicleTypeDropdownOpen)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.vehicleTypeDropdownText,
                !newAccountData.vehicleType && { color: "#9ca3af" },
              ]}
            >
              {newAccountData.vehicleType || "Select vehicle type"}
            </Text>
            <Ionicons
              name={vehicleTypeDropdownOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8f9ba7"
            />
          </TouchableOpacity>

          {vehicleTypeDropdownOpen && (
            <View style={styles.vehicleTypeDropdownMenu}>
              {(["Car", "Motorcycle", "Ebike", "Others"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeDropdownItem,
                    newAccountData.vehicleType === type && styles.vehicleTypeDropdownItemActive,
                  ]}
                  onPress={() => {
                    handleNewAccountChange("vehicleType", type);
                    setVehicleTypeDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      type === "Car"
                        ? "car-outline"
                        : type === "Motorcycle"
                          ? "bicycle-outline"
                          : type === "Ebike"
                            ? "flash-outline"
                            : "pencil-outline"
                    }
                    size={16}
                    color={newAccountData.vehicleType === type ? "#1f8e4d" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeDropdownItemText,
                      newAccountData.vehicleType === type && styles.vehicleTypeDropdownItemTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {newAccountData.vehicleType === "Others" && (
            <TextInput
              style={styles.textInput}
              placeholder="Specify vehicle type..."
              placeholderTextColor="#d1d5db"
              editable={!creatingAccount}
              value={newAccountData.vehicleType === "Others" ? "" : newAccountData.vehicleType}
              onChangeText={(value) =>
                handleNewAccountChange("vehicleType", value || "Others")
              }
            />
          )}

          <Text style={styles.fieldLabel}>{"Vehicle Plate Number"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="ABC 1234"
            placeholderTextColor="#d1d5db"
            autoCapitalize="characters"
            editable={!creatingAccount}
            value={newAccountData.vehiclePlate}
            onChangeText={(value) =>
              handleNewAccountChange("vehiclePlate", value)
            }
          />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>{"Employee ID *"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="GRD-1234"
            placeholderTextColor="#d1d5db"
            editable={!creatingAccount}
            value={newAccountData.employeeId}
            onChangeText={(value) =>
              handleNewAccountChange("employeeId", value)
            }
          />
        </>
      )}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color="#1f8e4d" />
        <Text style={styles.infoText}>
          An email verification link will be sent. User must verify their email
          and reset their password before the account becomes active.
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,
          creatingAccount && styles.createButtonDisabled,
        ]}
        onPress={handleCreateAccount}
        disabled={creatingAccount}
      >
        {creatingAccount ? (
          <>
            <Text style={styles.createButtonText}>Creating...</Text>
          </>
        ) : (
          <Text style={styles.createButtonText}>Create Account</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderUserDetailModal = () => {
    if (!selectedUser) return null;

    return (
      <Modal
        visible={userDetailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setUserDetailModalVisible(false);
          setEditingUser(false);
        }}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <LoaderComponent
            visible={updatingUser}
            message="Updating user..."
            logoSize={80}
          />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setUserDetailModalVisible(false);
                setEditingUser(false);
              }}
            >
              <Ionicons name="close" size={28} color="#1d2934" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>User Details</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* User Avatar Section */}
            <View style={styles.userDetailAvatarSection}>
              <View style={styles.userDetailAvatar}>
                <Ionicons
                  name={
                    userType === "students"
                      ? "person"
                      : userType === "faculty"
                        ? "school"
                        : userType === "staff"
                          ? "briefcase"
                          : "shield"
                  }
                  size={48}
                  color="#1f8e4d"
                />
              </View>
              <Text style={styles.userDetailName}>
                {`${selectedUser.firstName} ${selectedUser.lastName}`}
              </Text>
              <Text style={styles.userDetailRole}>
                {selectedUser.role?.toUpperCase()}
              </Text>
              <View
                style={[
                  styles.userStatusBadge,
                  {
                    backgroundColor: selectedUser.isActive ? "#dcfce7" : "#fee2e2",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.userStatusBadgeText,
                    { color: selectedUser.isActive ? "#15803d" : "#991b1b" },
                  ]}
                >
                  {selectedUser.isActive ? "ACTIVE" : "PENDING"}
                </Text>
              </View>
            </View>

            {/* User Details */}
            <View style={styles.userDetailSection}>
              <Text style={styles.userDetailSectionTitle}>Information</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{selectedUser.email}</Text>
              </View>

              {userType === "students" && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Student ID</Text>
                  <Text style={styles.detailValue}>
                    {selectedUser.studentId || "N/A"}
                  </Text>
                </View>
              )}

              {(userType === "faculty" ||
                userType === "staff" ||
                userType === "guards") && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employee ID</Text>
                  <Text style={styles.detailValue}>
                    {selectedUser.employeeId || "N/A"}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Joined</Text>
                <Text style={styles.detailValue}>
                  {selectedUser.createdAt
                    ? new Date(
                        selectedUser.createdAt as any,
                      ).toLocaleDateString()
                    : "N/A"}
                </Text>
              </View>
            </View>

            {/* Edit Section */}
            {editingUser && (
              <View style={styles.userDetailSection}>
                <Text style={styles.userDetailSectionTitle}>Edit Details</Text>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>First Name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editingUserData.firstName}
                    onChangeText={(value) =>
                      setEditingUserData({
                        ...editingUserData,
                        firstName: value,
                      })
                    }
                    placeholder="First Name"
                    placeholderTextColor="#d1d5db"
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Last Name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editingUserData.lastName}
                    onChangeText={(value) =>
                      setEditingUserData({
                        ...editingUserData,
                        lastName: value,
                      })
                    }
                    placeholder="Last Name"
                    placeholderTextColor="#d1d5db"
                  />
                </View>

                {userType === "students" ? (
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>Student ID</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editingUserData.studentId}
                      onChangeText={(value) => {
                        let cleaned = value.replace(/[^0-9]/g, "");
                        if (cleaned.length > 2) {
                          cleaned = cleaned.slice(0, 2) + "-" + cleaned.slice(2);
                        }
                        cleaned = cleaned.slice(0, 7);
                        setEditingUserData({
                          ...editingUserData,
                          studentId: cleaned,
                        });
                      }}
                      placeholder="Student ID"
                      placeholderTextColor="#d1d5db"
                    />
                  </View>
                ) : (
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>
                      {userType === "guards"
                        ? "Guard ID"
                        : userType === "faculty"
                          ? "Faculty ID"
                          : "Staff ID"}
                    </Text>
                    <TextInput
                      style={styles.editInput}
                      value={editingUserData.employeeId}
                      onChangeText={(value) => {
                        let cleaned = value.toUpperCase();
                        let numbers = cleaned.replace(/[^0-9]/g, "").slice(0, 4);
                        if (numbers.length === 0) {
                          setEditingUserData({
                            ...editingUserData,
                            employeeId: "",
                          });
                        } else {
                          const rolePrefix =
                            userType === "guards"
                              ? "GRD"
                              : userType === "faculty"
                                ? "FAC"
                                : "STF";
                          setEditingUserData({
                            ...editingUserData,
                            employeeId: `${rolePrefix} - ${numbers}`,
                          });
                        }
                      }}
                      placeholder="Employee ID"
                      placeholderTextColor="#d1d5db"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.userDetailActions}>
              {!editingUser ? (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setEditingUser(true);
                      setErrorMessage("");
                    }}
                  >
                    <Ionicons name="pencil" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: selectedUser.isActive
                          ? "#ef4444"
                          : "#10b981",
                      },
                    ]}
                    onPress={() => {
                      setAlertConfig({
                        title: selectedUser.isActive
                          ? "Deactivate User"
                          : "Activate User",
                        message: `Are you sure you want to ${selectedUser.isActive ? "deactivate" : "activate"} this user?`,
                        type: "warning",
                        buttons: [
                          {
                            text: "Cancel",
                            onPress: () => setAlertVisible(false),
                            style: "cancel",
                          },
                          {
                            text: selectedUser.isActive
                              ? "Deactivate"
                              : "Activate",
                            onPress: async () => {
                              setAlertVisible(false);
                              if (!adminId) {
                                setErrorMessage("Admin ID not found");
                                return;
                              }
                              setUpdatingUser(true);
                              try {
                                const response =
                                  await AdminService.toggleUserStatus(
                                    selectedUser.id,
                                    selectedUser.role,
                                    adminId,
                                  );
                                if (response.success) {
                                  setSuccessMessage(response.message);
                                  await fetchUsers();
                                  setUserDetailModalVisible(false);
                                } else {
                                  setErrorMessage(response.message);
                                }
                              } catch (error) {
                                console.error("Error toggling user status:", error);
                                setErrorMessage("Failed to toggle user status");
                              } finally {
                                setUpdatingUser(false);
                              }
                            },
                            style: "destructive",
                          },
                        ],
                      });
                      setAlertVisible(true);
                    }}
                  >
                    <Ionicons
                      name={selectedUser.isActive ? "ban" : "checkmark-circle"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.actionButtonText}>
                      {selectedUser.isActive ? "Deactivate" : "Activate"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    disabled={updatingUser}
                    onPress={async () => {
                      if (!editingUserData.firstName.trim()) {
                        setErrorMessage("First name is required");
                        return;
                      }
                      if (!editingUserData.lastName.trim()) {
                        setErrorMessage("Last name is required");
                        return;
                      }
                      if (!adminId) {
                        setErrorMessage("Admin ID not found");
                        return;
                      }

                      setUpdatingUser(true);
                      try {
                        const response = await AdminService.updateUserAccount(
                          selectedUser.id,
                          selectedUser.role,
                          {
                            firstName: editingUserData.firstName,
                            lastName: editingUserData.lastName,
                            studentId: editingUserData.studentId,
                            employeeId: editingUserData.employeeId,
                          },
                          adminId,
                        );
                        if (response.success) {
                          setSuccessMessage(response.message);
                          await fetchUsers();
                          setEditingUser(false);
                          setErrorMessage("");
                        } else {
                          setErrorMessage(response.message);
                        }
                      } catch (error) {
                        console.error("Error updating user:", error);
                        setErrorMessage("Failed to update user");
                      } finally {
                        setUpdatingUser(false);
                      }
                    }}
                  >
                    {updatingUser ? (
                      <Text style={styles.actionButtonText}>Saving...</Text>
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: "#6b7280" },
                    ]}
                    disabled={updatingUser}
                    onPress={() => {
                      setEditingUser(false);
                      setErrorMessage("");
                    }}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {errorMessage && (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorAlertText}>{errorMessage}</Text>
              </View>
            )}

            {successMessage && (
              <View style={styles.successAlert}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.successAlertText}>{successMessage}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderChartModal = () => {
    const maxCount =
      parkingHoursData.length > 0
        ? Math.max(...parkingHoursData.map((d) => d.count), 1)
        : 160;

    // Smart Y-axis scaling — use smaller increments for low data
    let yAxisMax;
    if (maxCount <= 10) {
      yAxisMax = 10;
    } else if (maxCount <= 50) {
      yAxisMax = Math.ceil(maxCount / 10) * 10; // Round to nearest 10
    } else {
      yAxisMax = Math.ceil(maxCount / 40) * 40; // Round to nearest 40
    }

    return (
      <Modal
        visible={showChartModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChartModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChartModal(false)}>
              <Ionicons name="close" size={28} color="#1d2934" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Peak Parking Hours</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              Vehicle volume over time today
            </Text>

            <View style={styles.expandedChartContainer}>
              <View style={styles.yAxisLabels}>
                {[
                  yAxisMax,
                  (yAxisMax * 3) / 4,
                  yAxisMax / 2,
                  yAxisMax / 4,
                  0,
                ].map((val, idx) => (
                  <Text key={idx} style={styles.yAxisLabel}>
                    {Math.round(val)}
                  </Text>
                ))}
              </View>

              <View style={styles.chartContent}>
                <View style={styles.expandedChartBars}>
                  {parkingHoursData.length > 0 ? (
                    parkingHoursData.map((data, index) => (
                      <View key={index} style={styles.expandedBarWrapper}>
                        <View
                          style={[
                            styles.expandedBar,
                            { height: `${Math.min(data.height, 100)}%` },
                          ]}
                        />
                        <Text style={styles.barCountLabel}>{data.count}</Text>
                      </View>
                    ))
                  ) : (
                    <>
                      <View style={styles.expandedBarWrapper}>
                        <View style={[styles.expandedBar, { height: "59%" }]} />
                      </View>
                      <View style={styles.expandedBarWrapper}>
                        <View style={[styles.expandedBar, { height: "46%" }]} />
                      </View>
                      <View style={styles.expandedBarWrapper}>
                        <View style={[styles.expandedBar, { height: "62%" }]} />
                      </View>
                      <View style={styles.expandedBarWrapper}>
                        <View style={[styles.expandedBar, { height: "40%" }]} />
                      </View>
                      <View style={styles.expandedBarWrapper}>
                        <View style={[styles.expandedBar, { height: "51%" }]} />
                      </View>
                      <View style={styles.expandedBarWrapper}>
                        <View style={[styles.expandedBar, { height: "75%" }]} />
                      </View>
                      <View style={styles.expandedBarWrapper}>
                        <View style={[styles.expandedBar, { height: "50%" }]} />
                      </View>
                    </>
                  )}
                </View>
                <View style={styles.xAxisLabels}>
                  {parkingHoursData.length > 0 ? (
                    parkingHoursData.map((data, idx) => (
                      <Text key={idx} style={styles.xAxisLabel}>
                        {data.hour}
                      </Text>
                    ))
                  ) : (
                    <>
                      <Text style={styles.xAxisLabel}>6 AM</Text>
                      <Text style={styles.xAxisLabel}>8 AM</Text>
                      <Text style={styles.xAxisLabel}>10 AM</Text>
                      <Text style={styles.xAxisLabel}>12 PM</Text>
                      <Text style={styles.xAxisLabel}>2 PM</Text>
                      <Text style={styles.xAxisLabel}>4 PM</Text>
                      <Text style={styles.xAxisLabel}>6 PM</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} {...panResponder.panHandlers}>
      <LoaderComponent
        visible={logoutLoading || creatingAccount || updatingUser}
        message={
          logoutLoading
            ? "Logging out..."
            : creatingAccount
              ? "Creating account..."
              : "Updating user..."
        }
        logoSize={100}
      />
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
      {Platform.OS !== "web" && (
        <StatusBar barStyle="light-content" backgroundColor="#1d2934" />
      )}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Admin Portal</Text>
          <Text style={styles.headerHint}>Swipe left to logout</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
          <Ionicons name="exit-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {currentScreen === "overview" && renderOverviewScreen()}
      {currentScreen === "users" && renderUsersScreen()}
      {currentScreen === "audit-logs" && renderAuditLogsScreen()}
      {currentScreen === "new-account" && renderNewAccountScreen()}

      {currentScreen !== "new-account" && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[
              styles.navButton,
              currentScreen === "overview" && styles.navButtonActive,
            ]}
            onPress={() => setCurrentScreen("overview")}
          >
            <Ionicons
              name="grid-outline"
              size={24}
              color={currentScreen === "overview" ? "#1f8e4d" : "#9ca3af"}
            />
            <Text
              style={[
                styles.navButtonText,
                currentScreen === "overview" && styles.navButtonTextActive,
              ]}
            >
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              currentScreen === "users" && styles.navButtonActive,
            ]}
            onPress={() => setCurrentScreen("users")}
          >
            <Ionicons
              name="people-outline"
              size={24}
              color={currentScreen === "users" ? "#1f8e4d" : "#9ca3af"}
            />
            <Text
              style={[
                styles.navButtonText,
                currentScreen === "users" && styles.navButtonTextActive,
              ]}
            >
              Users
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              currentScreen === "audit-logs" && styles.navButtonActive,
            ]}
            onPress={() => setCurrentScreen("audit-logs")}
          >
            <Ionicons
              name="document-outline"
              size={24}
              color={currentScreen === "audit-logs" ? "#1f8e4d" : "#9ca3af"}
            />
            <Text
              style={[
                styles.navButtonText,
                currentScreen === "audit-logs" && styles.navButtonTextActive,
              ]}
            >
              Audit Logs
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {renderUserDetailModal()}
      {renderChartModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  header: {
    backgroundColor: "#1d2934",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },
  headerSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginLeft: 0,
    marginBottom: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#2e3a4c",
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
  },
  headerHint: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 4,
    fontStyle: "italic",
  },
  container: {
    padding: 22,
    paddingBottom: 100,
  },
  welcome: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1d2934",
    marginBottom: 6,
  },
  welcomeSub: {
    fontSize: 14,
    color: "#6f7f93",
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1d2934",
    marginBottom: 20,
  },
  screenSubtitle: {
    fontSize: 12,
    color: "#6f7f93",
    marginBottom: 18,
  },
  overviewCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 5,
  },
  overviewTitle: {
    color: "#6f7f93",
    marginBottom: 10,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  overviewValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1d2934",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  smallCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    justifyContent: "center",
  },
  smallCardLabel: {
    color: "#6f7f93",
    fontSize: 12,
    marginTop: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  smallCardValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1d2934",
  },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  chartTitle: {
    color: "#1d2934",
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 15,
  },
  chartSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 14,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    height: 80,
    gap: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  bar: {
    width: "80%",
    borderRadius: 6,
    backgroundColor: "#1f8e4d",
    minHeight: 8,
  },
  barPlaceholder: {
    width: "100%",
    borderRadius: 6,
    backgroundColor: "#d1d5db",
    opacity: 0.5,
  },
  // Users Directory Styles
  searchBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1d2934",
    padding: 0,
  },
  tabsContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#1f8e4d",
    fontWeight: "700",
  },
  usersList: {
    marginBottom: 20,
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d2934",
    marginBottom: 4,
  },
  userID: {
    fontSize: 12,
    color: "#6f7f93",
    marginBottom: 2,
  },
  userStatus: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fab: {
    position: "absolute",
    bottom: 90,
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1f8e4d",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  // Algorithm styles
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
    flexWrap: "wrap",
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6f7f93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sortBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  sortBtnActive: {
    backgroundColor: "#1f8e4d",
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  sortBtnTextActive: {
    color: "#fff",
  },
  algorithmBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  algorithmBadgeText: {
    fontSize: 11,
    color: "#1f8e4d",
    fontWeight: "600",
  },
  emptySubText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 6,
    textAlign: "center",
  },
  // Audit Logs Styles
  dateRangeContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6f7f93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  dateInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
  },
  dateInputField: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#1d2934",
    fontWeight: "600",
  },
  dateInputLabel: {
    fontSize: 13,
    color: "#1d2934",
    fontWeight: "600",
  },
  dateSeparator: {
    color: "#d1d5db",
    fontSize: 18,
    fontWeight: "300",
    textAlign: "center",
    marginBottom: 20,
  },
  datePickersRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 16,
  },
  datePickerGroup: {
    flex: 1,
    gap: 8,
  },
  datePickerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6f7f93",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  datePickerButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1d2934",
  },
  timePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
  },
  timePickerButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f8e4d",
  },
  applyDateButton: {
    flexDirection: "row",
    backgroundColor: "#1f8e4d",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyDateButtonText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
  auditLogsList: {
    marginBottom: 20,
  },
  auditLogCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  auditLogIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  auditLogContent: {
    flex: 1,
  },
  auditLogPlate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1d2934",
    marginBottom: 4,
  },
  auditLogName: {
    fontSize: 12,
    color: "#1d2934",
    marginBottom: 2,
  },
  auditLogRole: {
    fontSize: 11,
    color: "#6f7f93",
    marginBottom: 2,
  },
  auditLogTime: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  dateHelperText: {
    fontSize: 10,
    color: "#9ca3af",
    marginBottom: 8,
    fontStyle: "italic",
  },
  logsCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6f7f93",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  auditLogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  auditLogStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  auditLogStatusText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  auditLogMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  auditLogVehicle: {
    fontSize: 11,
    color: "#6f7f93",
    marginLeft: 0,
  },
  // New Account Styles
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  newAccountTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1d2934",
    marginLeft: 12,
    flex: 1,
  },
  roleSetupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6f7f93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  roleButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  roleButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  roleButtonActive: {
    backgroundColor: "#1f8e4d",
    borderColor: "#1f8e4d",
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6f7f93",
    marginTop: 8,
  },
  roleButtonTextActive: {
    color: "#fff",
  },
  personalDetailsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6f7f93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1d2934",
    marginBottom: 8,
  },
  fieldLabelOptional: {
    fontSize: 12,
    fontWeight: "400",
    color: "#9ca3af",
  },
  vehicleTypeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  vehicleTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  vehicleTypeBtnActive: {
    backgroundColor: "#1f8e4d",
    borderColor: "#1f8e4d",
  },
  vehicleTypeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  vehicleTypeBtnTextActive: {
    color: "#fff",
  },
  vehicleTypeDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  vehicleTypeDropdownBtnActive: {
    borderColor: "#1f8e4d",
    backgroundColor: "#f0fdf4",
  },
  vehicleTypeDropdownText: {
    fontSize: 14,
    color: "#1d2934",
    fontWeight: "500",
    flex: 1,
  },
  vehicleTypeDropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  vehicleTypeDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  vehicleTypeDropdownItemActive: {
    backgroundColor: "#f0fdf4",
  },
  vehicleTypeDropdownItemText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4b5563",
    marginLeft: 10,
  },
  vehicleTypeDropdownItemTextActive: {
    color: "#1f8e4d",
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: "#1d2934",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  createButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  // Bottom Navigation
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  navButtonActive: {
    opacity: 1,
  },
  navButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 4,
  },
  navButtonTextActive: {
    color: "#1f8e4d",
    fontWeight: "700",
  },
  logoutButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "800",
  },
  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1d2934",
  },
  modalContent: {
    padding: 18,
    paddingBottom: 40,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6f7f93",
    marginBottom: 20,
    fontWeight: "500",
  },
  expandedChartContainer: {
    flexDirection: "row",
    height: 470,
    marginBottom: 20,
  },
  yAxisLabels: {
    justifyContent: "space-between",
    width: 45,
    paddingRight: 14,
    alignItems: "flex-end",
    paddingVertical: 8,
  },
  yAxisLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  chartContent: {
    flex: 1,
  },
  expandedChartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 450,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 8,
  },
  expandedBarWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  expandedBar: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#1f8e4d",
    minHeight: 12,
    maxWidth: 50,
  },
  barCountLabel: {
    fontSize: 11,
    color: "#1d2934",
    fontWeight: "700",
    marginTop: 8,
  },
  xAxisLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 14,
    paddingHorizontal: 12,
  },
  xAxisLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  // New alert and info styles
  errorAlert: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  errorAlertText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
  },
  successAlert: {
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  successAlertText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
  },
  alertCloseBtn: {
    padding: 4,
    marginLeft: 8,
  },
  infoBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#1f8e4d",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    color: "#065f46",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 12,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 12,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },

  // ── Audit log filter styles (guard-style dropdowns) ──
  auditFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    zIndex: 10,
    overflow: "visible" as const,
  },
  auditFilterCol: {
    flex: 1,
    position: "relative" as const,
    zIndex: 10,
    overflow: "visible" as const,
  },
  auditFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  auditFilterBtnActive: {
    borderColor: "#1f8e4d",
    backgroundColor: "#f0fdf4",
  },
  auditFilterBtnText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#6b7a8d",
  },
  auditFilterBtnTextActive: {
    color: "#1f8e4d",
  },
  auditDropdown: {
    position: "absolute" as const,
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 1000,
    overflow: "visible" as const,
    minWidth: 100,
  },
  auditDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  auditDropdownItemActive: {
    backgroundColor: "#f0fdf4",
  },
  auditDropdownText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#4b5563",
  },
  auditDropdownTextActive: {
    color: "#1f8e4d",
    fontWeight: "700" as const,
  },

  // ── Audit log detail modal styles ──
  detailModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  detailModalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  detailModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  detailModalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detailModalBadgeText: {
    fontSize: 14,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  detailModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  detailModalName: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: "#1a1a2e",
    marginBottom: 16,
  },
  detailModalDivider: {
    height: 1,
    backgroundColor: "#f0f0f5",
    marginVertical: 12,
  },
  detailModalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  detailModalRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailModalLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#6b7a8d",
  },
  detailModalValue: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#1a1a2e",
  },
  detailModalStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  detailModalDismiss: {
    backgroundColor: "#1f8e4d",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  detailModalDismissText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  // ── User Detail Modal Styles ─────────────────────────────────────────
  userDetailAvatarSection: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 20,
  },
  userDetailAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  userDetailName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1d2934",
    marginBottom: 4,
  },
  userDetailRole: {
    fontSize: 12,
    color: "#6f7f93",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: 12,
  },
  userStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  userStatusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  userDetailSection: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  userDetailSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d2934",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  detailRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  detailLabel: {
    fontSize: 12,
    color: "#6f7f93",
    fontWeight: "600",
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 15,
    color: "#1d2934",
    fontWeight: "500",
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1d2934",
    backgroundColor: "#fafbfc",
  },
  userDetailActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#1f8e4d",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
