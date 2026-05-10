import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  FlatList,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { MOCK_ACTIVITY_LOGS } from "../../services/mockData";
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
} from "../../services/searchService";

type AdminScreenType = "overview" | "users" | "audit-logs" | "new-account";

const { height: screenHeight } = Dimensions.get("window");

export default function AdminScreen() {
  const router = useRouter();
  const authContext = useAuth();
  const adminId = authContext?.user?.id;

  const [logoutLoading, setLogoutLoading] = useState(false);

  // ── Alert state (reused from student portal) ────────────────────────────
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
  const [userType, setUserType] = useState<"students" | "guards">("students");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("Oct 24, 00:00");
  const [dateTo, setDateTo] = useState("Oct 24, 23:59");
  const [newAccountRole, setNewAccountRole] = useState<"student" | "guard">(
    "student",
  );
  const [showChartModal, setShowChartModal] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [students, setStudents] = useState<DirectoryUser[]>([]);
  const [guards, setGuards] = useState<DirectoryUser[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // ── Algorithm state ─────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState("firstName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const studentTrie = useRef<Trie>(new Trie());
  const guardTrie = useRef<Trie>(new Trie());
  const duplicateChecker = useRef<DuplicateChecker>(new DuplicateChecker());
  // ─────────────────────────────────────────────────────────────────────────

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

  const totalStudents = students.length;
  const totalGuards = guards.length;
  const vehiclesToday = 342;

  // Fetch ALL users once — Trie + Hash Set are built from this
  useEffect(() => {
    if (currentScreen === "users") {
      fetchUsers();
    }
  }, [currentScreen]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const [studentsData, guardsData] = await Promise.all([
        AdminService.fetchStudents(), // no query — fetch all
        AdminService.fetchGuards(),
      ]);
      setStudents(studentsData);
      setGuards(guardsData);

      // ── Build Trie indexes ─────────────────────────────────────────
      studentTrie.current = buildTrie(studentsData as any);
      guardTrie.current = buildTrie(guardsData as any);

      // ── Populate Hash Set for duplicate detection ──────────────────
      duplicateChecker.current.load([...studentsData, ...guardsData]);
    } catch (error) {
      console.error("Error fetching users:", error);
      setErrorMessage("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // No debounce needed — search is now purely in-memory via Trie/Levenshtein
  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  // Mock audit logs (keep for now)
  const mockAuditLogs = [
    {
      id: "1",
      plate: "ABC-123",
      type: "IN",
      name: "Juan Dela Cruz",
      role: "Student",
      time: "07:30 AM • Main Gate",
    },
    {
      id: "2",
      plate: "XYZ-987",
      type: "IN",
      name: "Maria Clara",
      role: "Visitor",
      time: "08:15 AM • Sum Gate",
    },
    {
      id: "3",
      plate: "DEF-456",
      type: "OUT",
      name: "Jose Rizal",
      role: "Student",
      time: "09:00 AM • Main Gate",
    },
    {
      id: "4",
      plate: "GHI-789",
      type: "IN",
      name: "Andres Bonifacio",
      role: "Student",
      time: "08:45 AM • Main Gate",
    },
  ];

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
              const result = await AuthService.logout();
              if (result.success) {
                router.replace("/");
              } else {
                setLogoutLoading(false);
                setAlertConfig({
                  title: "Logout Error",
                  message: result.message || "Logout failed. Please try again.",
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
            } catch (error) {
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
            }
          },
          style: "destructive",
        },
      ],
    });
    setAlertVisible(true);
  };

  const getStatusColor = (status: string) => {
    return status === "ACTIVE" ? "#10b981" : "#ef4444";
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

    if (newAccountRole === "guard") {
      if (!employeeId.trim()) {
        setErrorMessage("Employee ID is required");
        return false;
      }
      if (duplicateChecker.current.hasEmployeeId(employeeId)) {
        setErrorMessage("Employee ID is already registered.");
        return false;
      }
    }
    // ────────────────────────────────────────────────────────────────────

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
        Here's the campus overview for today.
      </Text>

      <View style={styles.overviewCard}>
        <Text style={styles.overviewTitle}>Total Registered Students</Text>
        <Text style={styles.overviewValue}>
          {totalStudents.toLocaleString()}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.smallCard}>
          <Ionicons name="shield-checkmark" size={28} color="#1f8e4d" />
          <Text style={styles.smallCardLabel}>Active Guards</Text>
          <Text style={styles.smallCardValue}>{totalGuards}</Text>
        </View>
        <View style={styles.smallCard}>
          <Ionicons name="car" size={28} color="#1f8e4d" />
          <Text style={styles.smallCardLabel}>Vehicles Today</Text>
          <Text style={styles.smallCardValue}>{vehiclesToday}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.chartCard}
        activeOpacity={0.9}
        onPress={() => setShowChartModal(true)}
      >
        <Text style={styles.chartTitle}>Peak Parking Hours</Text>
        <Text style={styles.chartSubtitle}>Vehicle volume over time</Text>
        <View style={styles.chartBars}>
          <View style={[styles.bar, { height: 94 }]} />
          <View style={[styles.bar, { height: 74 }]} />
          <View style={[styles.bar, { height: 100 }]} />
          <View style={[styles.bar, { height: 64 }]} />
          <View style={[styles.bar, { height: 82 }]} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderUsersScreen = () => {
    const displayed =
      userType === "students" ? displayedStudents : displayedGuards;
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
              <TouchableOpacity key={user.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={styles.userAvatar}>
                    <Ionicons
                      name={userType === "students" ? "person" : "shield"}
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

  const renderAuditLogsScreen = () => (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>Master Audit Logs</Text>
      <Text style={styles.screenSubtitle}>Campus-wide vehicle activity</Text>

      <View style={styles.dateRangeContainer}>
        <Text style={styles.dateLabel}>DATE & TIME RANGE QUERY</Text>
        <View style={styles.dateInputsRow}>
          <View style={styles.dateInput}>
            <Text style={styles.dateInputLabel}>{dateFrom}</Text>
          </View>
          <Text style={styles.dateSeparator}>-</Text>
          <View style={styles.dateInput}>
            <Text style={styles.dateInputLabel}>{dateTo}</Text>
          </View>
        </View>
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

      <View style={styles.auditLogsList}>
        {mockAuditLogs.map((log) => (
          <View key={log.id} style={styles.auditLogCard}>
            <View style={styles.auditLogIcon}>
              <Ionicons
                name={
                  log.type === "IN" ? "arrow-down-outline" : "arrow-up-outline"
                }
                size={20}
                color={log.type === "IN" ? "#10b981" : "#ef4444"}
              />
            </View>
            <View style={styles.auditLogContent}>
              <Text style={styles.auditLogPlate}>{log.plate}</Text>
              <Text style={styles.auditLogName}>{log.name}</Text>
              <Text style={styles.auditLogRole}>{log.role}</Text>
              <Text style={styles.auditLogTime}>{log.time}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

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
          <Ionicons name="alert-circle" size={18} color="#ef4444" />
          <Text style={styles.errorAlertText}>{errorMessage}</Text>
        </View>
      )}

      {!!successMessage && (
        <View style={styles.successAlert}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={styles.successAlertText}>{successMessage}</Text>
        </View>
      )}

      <Text style={styles.roleSetupLabel}>ROLE SETUP</Text>
      <View style={styles.roleButtonsContainer}>
        <TouchableOpacity
          style={[
            styles.roleButton,
            newAccountRole === "student" && styles.roleButtonActive,
          ]}
          onPress={() => setNewAccountRole("student")}
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
            newAccountRole === "guard" && styles.roleButtonActive,
          ]}
          onPress={() => setNewAccountRole("guard")}
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
          <View style={styles.vehicleTypeRow}>
            {(["Car", "Motorcycle", "Ebike", "Others"] as const).map((type) => {
              const isOthers = type === "Others";
              const isActive = isOthers
                ? !["Car", "Motorcycle", "Ebike"].includes(
                    newAccountData.vehicleType,
                  )
                : newAccountData.vehicleType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeBtn,
                    isActive && styles.vehicleTypeBtnActive,
                  ]}
                  onPress={() => {
                    if (!creatingAccount) {
                      handleNewAccountChange(
                        "vehicleType",
                        isOthers ? "Others" : type,
                      );
                    }
                  }}
                  disabled={creatingAccount}
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
                    size={14}
                    color={isActive ? "#fff" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeBtnText,
                      isActive && styles.vehicleTypeBtnTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!["Car", "Motorcycle", "Ebike"].includes(
            newAccountData.vehicleType,
          ) && (
            <TextInput
              style={[styles.textInput, { marginTop: -8 }]}
              placeholder="Specify vehicle type..."
              placeholderTextColor="#d1d5db"
              editable={!creatingAccount}
              value={
                newAccountData.vehicleType === "Others"
                  ? ""
                  : newAccountData.vehicleType
              }
              onChangeText={(value) =>
                handleNewAccountChange("vehicleType", value || "Others")
              }
            />
          )}

          <Text style={styles.fieldLabel}>{"Vehicle Plate Number"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="ABC-123"
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
            placeholder="GRD-001"
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

  const renderChartModal = () => (
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
          <Text style={styles.modalSubtitle}>Vehicle volume over time</Text>

          <View style={styles.expandedChartContainer}>
            <View style={styles.yAxisLabels}>
              <Text style={styles.yAxisLabel}>160</Text>
              <Text style={styles.yAxisLabel}>120</Text>
              <Text style={styles.yAxisLabel}>80</Text>
              <Text style={styles.yAxisLabel}>40</Text>
              <Text style={styles.yAxisLabel}>0</Text>
            </View>

            <View style={styles.chartContent}>
              <View style={styles.expandedChartBars}>
                <View style={[styles.expandedBar, { height: "59%" }]} />
                <View style={[styles.expandedBar, { height: "46%" }]} />
                <View style={[styles.expandedBar, { height: "62%" }]} />
                <View style={[styles.expandedBar, { height: "40%" }]} />
                <View style={[styles.expandedBar, { height: "51%" }]} />
                <View style={[styles.expandedBar, { height: "75%" }]} />
                <View style={[styles.expandedBar, { height: "50%" }]} />
              </View>
              <View style={styles.xAxisLabels}>
                <Text style={styles.xAxisLabel}>6 AM</Text>
                <Text style={styles.xAxisLabel}>8 AM</Text>
                <Text style={styles.xAxisLabel}>10 AM</Text>
                <Text style={styles.xAxisLabel}>12 PM</Text>
                <Text style={styles.xAxisLabel}>2 PM</Text>
                <Text style={styles.xAxisLabel}>4 PM</Text>
                <Text style={styles.xAxisLabel}>6 PM</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
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
      {Platform.OS !== "web" && (
        <StatusBar barStyle="light-content" backgroundColor="#1d2934" />
      )}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <Text style={styles.headerSubtitle}>System Management</Text>
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
    borderRadius: 28,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 5,
    marginBottom: 20,
  },
  chartTitle: {
    color: "#1d2934",
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 16,
  },
  chartSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 18,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
  },
  bar: {
    width: 28,
    borderRadius: 14,
    backgroundColor: "#1f8e4d",
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
  },
  dateInput: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
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
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1d2934",
  },
  modalContent: {
    padding: 22,
    paddingBottom: 40,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6f7f93",
    marginBottom: 24,
  },
  expandedChartContainer: {
    flexDirection: "row",
    height: 320,
    marginBottom: 20,
  },
  yAxisLabels: {
    justifyContent: "space-between",
    width: 40,
    paddingRight: 12,
    alignItems: "flex-end",
  },
  yAxisLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
  },
  chartContent: {
    flex: 1,
  },
  expandedChartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 280,
    backgroundColor: "#f3f4f6",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  expandedBar: {
    width: "12%",
    borderRadius: 10,
    backgroundColor: "#1d2934",
  },
  xAxisLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  xAxisLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    width: "12%",
    textAlign: "center",
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
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
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
});
