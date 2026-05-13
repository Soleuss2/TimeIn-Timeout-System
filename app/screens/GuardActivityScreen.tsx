import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { fetchGuardActivityLogs } from "../../services/guardService";

const DATE_OPTIONS = ["All Date", "Today", "Yesterday"] as const;
const ENTRY_OPTIONS = ["All Entry", "Student", "Faculty", "Staff", "Guard", "Guest"] as const;
const VEHICLE_OPTIONS = ["All Vehicles", "Car", "Motorcycle", "Ebike", "Others"] as const;

// ════════════════════════════════════════════════════════════════════════════════
// ALGORITHM: LEVENSHTEIN DISTANCE (Edit Distance / Fuzzy Matching)
// ════════════════════════════════════════════════════════════════════════════════
// 
// Purpose: Find typo-tolerant matches by calculating minimum edit distance
// 
// Algorithm:
//  - Dynamic Programming approach (DP table)
//  - Calculates minimum edits needed to transform string s1 into s2
//  - Allowed operations: insertion, deletion, substitution
//  - dp[i][j] = edit distance between s1[0..i-1] and s2[0..j-1]
// 
// Time Complexity: O(m × n) where m, n are string lengths
// Space Complexity: O(m × n) for DP table
// 
// Use Case: Search guard activity by name/plate with typo tolerance
// Example: "John" matches "Jon" with distance 1 (deletion)
// ════════════════════════════════════════════════════════════════════════════════
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[len1][len2];
}

// ── Helpers ──────────────────────────────────────────────────────────────
function formatTimestamp(ts: any): string {
  if (!ts) return "--";
  // Firebase Timestamp object
  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  // Already a string or Date
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(ts: any): string {
  if (!ts) return "--";
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function isToday(ts: any): boolean {
  if (!ts) return false;
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isYesterday(ts: any): boolean {
  if (!ts) return false;
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

export default function GuardActivityScreen() {
  const router = useRouter();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<(typeof DATE_OPTIONS)[number]>(
    "Today",
  );
  const [entryFilter, setEntryFilter] = useState<
    (typeof ENTRY_OPTIONS)[number]
  >(ENTRY_OPTIONS[0]);
  const [vehicleFilter, setVehicleFilter] = useState<
    (typeof VEHICLE_OPTIONS)[number]
  >(VEHICLE_OPTIONS[0]);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [statFilter, setStatFilter] = useState<"all" | "inside" | "departed">("all");

  // Fetch real data on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchGuardActivityLogs();
        if (mounted) setLogs(data);
      } catch {
        // Silent fail – empty list is shown
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Smart Filtering (useMemo) ──────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return logs.filter((item) => {
      // Smart search: includes OR Levenshtein distance <= 2
      const itemName = (item.name || "").toLowerCase();
      const itemPlate = (item.plateNumber || "").toLowerCase();
      const itemId = (item.id || "").toLowerCase();
      const itemProfileId = (item.profileId || "").toLowerCase(); // studentId, facultyId, staffId

      const matchesSearch =
        q.length === 0 ||
        itemName.includes(q) ||
        itemPlate.includes(q) ||
        itemId.includes(q) ||
        itemProfileId.includes(q) ||
        levenshteinDistance(q, itemName) <= 2 ||
        levenshteinDistance(q, itemPlate) <= 2;

      // Entry role filter
      const role = (item.role || "visitor").toLowerCase();
      let matchesEntry = true;
      if (entryFilter !== "All Entry") {
        const target = entryFilter.toLowerCase();
        if (target === "guest") {
          matchesEntry = role === "guest" || role === "visitor";
        } else {
          matchesEntry = role === target;
        }
      }

      // Vehicle type filter
      let matchesVehicle = true;
      if (vehicleFilter !== "All Vehicles") {
        const knownTypes = ["car", "motorcycle", "ebike"];
        const vType = (item.vehicleType || "").toLowerCase().trim();
        // If vType is empty, it shouldn't match specific vehicle filters
        if (!vType) {
          matchesVehicle = false;
        } else if (vehicleFilter === "Others") {
          matchesVehicle = !knownTypes.includes(vType);
        } else {
          matchesVehicle = vType === vehicleFilter.toLowerCase();
        }
      }

      // Date filter
      let matchesDate = true;
      if (dateFilter === "Today") {
        matchesDate = isToday(item.timeIn);
      } else if (dateFilter === "Yesterday") {
        matchesDate = isYesterday(item.timeIn);
      }

      // Stat filter
      let matchesStat = true;
      if (statFilter === "inside") {
        matchesStat = item.status === "IN";
      } else if (statFilter === "departed") {
        matchesStat = item.status === "OUT";
      }

      return matchesSearch && matchesEntry && matchesVehicle && matchesDate && matchesStat;
    });
  }, [logs, search, entryFilter, vehicleFilter, dateFilter, statFilter]);

  // ── Stats from real data (TODAY ONLY) ─────────────────────────────────
  const todayLogs = logs.filter((item) => isToday(item.timeIn));
  const totalVehicles = todayLogs.length;
  const insideCount = todayLogs.filter((item) => item.status === "IN").length;
  const departedCount = todayLogs.filter((item) => item.status === "OUT").length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {Platform.OS !== "web" && (
        <StatusBar barStyle="light-content" backgroundColor="#1f8e4d" />
      )}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Logs</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[
              styles.statCard,
              statFilter === "all" && styles.statCardActive,
            ]}
            onPress={() => setStatFilter("all")}
            activeOpacity={0.7}
          >
            <View style={styles.statCardIcon}>
              <Ionicons name="car-sport" size={20} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{totalVehicles}</Text>
            <Text style={styles.statLabel}>Total Vehicles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.statCard,
              statFilter === "inside" && styles.statCardActive,
            ]}
            onPress={() => setStatFilter("inside")}
            activeOpacity={0.7}
          >
            <View style={styles.statCardIcon}>
              <Ionicons name="location" size={20} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{insideCount}</Text>
            <Text style={styles.statLabel}>Inside Campus</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.statCard,
              statFilter === "departed" && styles.statCardActive,
            ]}
            onPress={() => setStatFilter("departed")}
            activeOpacity={0.7}
          >
            <View style={styles.statCardIcon}>
              <Ionicons name="exit" size={20} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{departedCount}</Text>
            <Text style={styles.statLabel}>Departed</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <Ionicons
            name="search"
            size={20}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student ID, plate, name..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filterBarRow}>
          <View style={styles.filterDropdownWrapper}>
            <TouchableOpacity
              style={[
                styles.filterDropdownBtn,
                dateFilter !== "All Date" && styles.filterDropdownBtnActive,
              ]}
              onPress={() =>
                setExpandedFilter(expandedFilter === "date" ? null : "date")
              }
            >
              <Ionicons
                name="calendar"
                size={14}
                color={dateFilter !== "All Date" ? "#1f8e4d" : "#6b7a8d"}
              />
              <Text
                style={[
                  styles.filterDropdownText,
                  dateFilter !== "All Date" && styles.filterDropdownTextActive,
                ]}
                numberOfLines={1}
              >
                {dateFilter}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#8f9ba7" />
            </TouchableOpacity>
            {expandedFilter === "date" && (
              <View style={styles.dropdownMenu}>
                {DATE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownItem,
                      dateFilter === option && styles.dropdownItemHighlight,
                    ]}
                    onPress={() => {
                      setDateFilter(option);
                      setExpandedFilter(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        dateFilter === option && styles.dropdownItemActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.filterDropdownWrapper}>
            <TouchableOpacity
              style={[
                styles.filterDropdownBtn,
                entryFilter !== "All Entry" && styles.filterDropdownBtnActive,
              ]}
              onPress={() =>
                setExpandedFilter(expandedFilter === "entry" ? null : "entry")
              }
            >
              <Ionicons
                name="person"
                size={14}
                color={entryFilter !== "All Entry" ? "#1f8e4d" : "#6b7a8d"}
              />
              <Text
                style={[
                  styles.filterDropdownText,
                  entryFilter !== "All Entry" && styles.filterDropdownTextActive,
                ]}
                numberOfLines={1}
              >
                {entryFilter}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#8f9ba7" />
            </TouchableOpacity>
            {expandedFilter === "entry" && (
              <View style={styles.dropdownMenu}>
                {ENTRY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownItem,
                      entryFilter === option && styles.dropdownItemHighlight,
                    ]}
                    onPress={() => {
                      setEntryFilter(option);
                      setExpandedFilter(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        entryFilter === option && styles.dropdownItemActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.filterDropdownWrapper}>
            <TouchableOpacity
              style={[
                styles.filterDropdownBtn,
                vehicleFilter !== "All Vehicles" && styles.filterDropdownBtnActive,
              ]}
              onPress={() =>
                setExpandedFilter(
                  expandedFilter === "vehicle" ? null : "vehicle",
                )
              }
            >
              <Ionicons
                name="car"
                size={14}
                color={vehicleFilter !== "All Vehicles" ? "#1f8e4d" : "#6b7a8d"}
              />
              <Text
                style={[
                  styles.filterDropdownText,
                  vehicleFilter !== "All Vehicles" && styles.filterDropdownTextActive,
                ]}
                numberOfLines={1}
              >
                {vehicleFilter}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#8f9ba7" />
            </TouchableOpacity>
            {expandedFilter === "vehicle" && (
              <View style={styles.dropdownMenu}>
                {VEHICLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownItem,
                      vehicleFilter === option && styles.dropdownItemHighlight,
                    ]}
                    onPress={() => {
                      setVehicleFilter(option);
                      setExpandedFilter(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        vehicleFilter === option && styles.dropdownItemActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#1f8e4d" />
            <Text style={styles.loaderText}>Loading activity logs...</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text" size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>
              No activity records found
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.logsCountText}>
              Total entries: {filteredLogs.length}
            </Text>
            {filteredLogs.map((item: any, index: number) => (
              <TouchableOpacity
                key={item.docId || index}
                style={styles.logCard}
                activeOpacity={0.7}
                onPress={() => setSelectedLog(item)}
              >
                <View style={styles.logCardIcon}>
                  <Ionicons
                    name={
                      item.status === "IN"
                        ? "arrow-down-outline"
                        : "arrow-up-outline"
                    }
                    size={20}
                    color={item.status === "IN" ? "#10b981" : "#ef4444"}
                  />
                </View>
                <View style={styles.logCardContent}>
                  <View style={styles.logCardHeader}>
                    <Text style={styles.logCardPlate}>
                      {item.plateNumber || "N/A"}
                    </Text>
                    <View
                      style={[
                        styles.logCardBadge,
                        {
                          backgroundColor:
                            item.status === "IN" ? "#dcfce7" : "#fee2e2",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.logCardBadgeText,
                          {
                            color:
                              item.status === "IN" ? "#166534" : "#991b1b",
                          },
                        ]}
                      >
                        {item.status === "IN" ? "ON CAMPUS" : "DEPARTED"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.logCardName}>
                    {item.name || "Unknown"}
                  </Text>
                  <View style={styles.logCardMetaRow}>
                    <Text style={styles.logCardRole}>
                      {(item.role || "visitor").charAt(0).toUpperCase() +
                        (item.role || "visitor").slice(1)}
                    </Text>
                    <Text style={styles.logCardVehicle}>
                      • {(item.vehicleType || "vehicle").charAt(0).toUpperCase() + (item.vehicleType || "vehicle").slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.logCardTime}>
                    {formatTimestamp(item.timeIn)} • {formatDate(item.timeIn)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#c0c9d0"
                  style={{ alignSelf: "center" }}
                />
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.endOfList}>
          {filteredLogs.length === 0
            ? ""
            : `End of records \u2022 ${filteredLogs.length} entries`}
        </Text>
      </ScrollView>

      {/* ── Log Detail Modal ── */}
      <Modal
        visible={!!selectedLog}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalCard}>
            {selectedLog && (
              <>
                {/* Header */}
                <View style={styles.detailModalHeader}>
                  <View
                    style={[
                      styles.detailModalBadge,
                      {
                        backgroundColor:
                          selectedLog.status === "IN" ? "#dcfce7" : "#fee2e2",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedLog.status === "IN"
                          ? "arrow-down-circle"
                          : "arrow-up-circle"
                      }
                      size={28}
                      color={
                        selectedLog.status === "IN" ? "#16a34a" : "#dc2626"
                      }
                    />
                    <Text
                      style={[
                        styles.detailModalBadgeText,
                        {
                          color:
                            selectedLog.status === "IN"
                              ? "#166534"
                              : "#991b1b",
                        },
                      ]}
                    >
                      {selectedLog.status === "IN"
                        ? "ON CAMPUS"
                        : "DEPARTED"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedLog(null)}
                    style={styles.detailModalClose}
                  >
                    <Ionicons name="close" size={22} color="#6b7a8d" />
                  </TouchableOpacity>
                </View>

                {/* Name */}
                <Text style={styles.detailModalName}>
                  {selectedLog.name || "Unknown"}
                </Text>

                <View style={styles.detailModalDivider} />

                {/* Info Rows */}
                <View style={styles.detailModalRow}>
                  <View style={styles.detailModalRowIcon}>
                    <Ionicons name="finger-print" size={16} color="#1f8e4d" />
                  </View>
                  <Text style={styles.detailModalLabel}>ID Number</Text>
                  <Text style={styles.detailModalValue}>
                    {selectedLog.id || "N/A"}
                  </Text>
                </View>

                <View style={styles.detailModalRow}>
                  <View style={styles.detailModalRowIcon}>
                    <Ionicons name="person" size={16} color="#1f8e4d" />
                  </View>
                  <Text style={styles.detailModalLabel}>Role</Text>
                  <Text style={styles.detailModalValue}>
                    {(selectedLog.role || "visitor")
                      .charAt(0)
                      .toUpperCase() +
                      (selectedLog.role || "visitor").slice(1)}
                  </Text>
                </View>

                <View style={styles.detailModalRow}>
                  <View style={styles.detailModalRowIcon}>
                    <Ionicons name="card" size={16} color="#1f8e4d" />
                  </View>
                  <Text style={styles.detailModalLabel}>Plate Number</Text>
                  <Text style={styles.detailModalValue}>
                    {selectedLog.plateNumber || "N/A"}
                  </Text>
                </View>

                <View style={styles.detailModalRow}>
                  <View style={styles.detailModalRowIcon}>
                    <Ionicons name="car" size={16} color="#1f8e4d" />
                  </View>
                  <Text style={styles.detailModalLabel}>Vehicle Type</Text>
                  <Text style={styles.detailModalValue}>
                    {(selectedLog.vehicleType || "N/A")
                      .charAt(0)
                      .toUpperCase() +
                      (selectedLog.vehicleType || "N/A").slice(1)}
                  </Text>
                </View>

                <View style={styles.detailModalRow}>
                  <View style={styles.detailModalRowIcon}>
                    <Ionicons name="enter" size={16} color="#1f8e4d" />
                  </View>
                  <Text style={styles.detailModalLabel}>Time In</Text>
                  <Text style={styles.detailModalValue}>
                    {formatTimestamp(selectedLog.timeIn)}
                  </Text>
                </View>

                <View style={styles.detailModalRow}>
                  <View style={styles.detailModalRowIcon}>
                    <Ionicons name="exit" size={16} color="#e53935" />
                  </View>
                  <Text style={styles.detailModalLabel}>Time Out</Text>
                  <Text style={styles.detailModalValue}>
                    {selectedLog.timeOut
                      ? formatTimestamp(selectedLog.timeOut)
                      : "—"}
                  </Text>
                </View>

                <View style={styles.detailModalRow}>
                  <View style={styles.detailModalRowIcon}>
                    <Ionicons name="calendar" size={16} color="#1f8e4d" />
                  </View>
                  <Text style={styles.detailModalLabel}>Date</Text>
                  <Text style={styles.detailModalValue}>
                    {formatDate(selectedLog.timeIn)}
                  </Text>
                </View>

                <View style={styles.detailModalDivider} />

                <TouchableOpacity
                  style={styles.detailModalDismiss}
                  onPress={() => setSelectedLog(null)}
                >
                  <Text style={styles.detailModalDismissText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#1f8e4d",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statCardActive: {
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
    borderColor: "#1f8e4d",
  },
  statCardIcon: {
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f8e4d",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  filterBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
    zIndex: 100,
    position: "relative",
  },
  filterDropdownWrapper: {
    flex: 1,
    zIndex: 100,
  },
  filterDropdownBtn: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  filterDropdownBtnActive: {
    borderColor: "#1f8e4d",
    backgroundColor: "#f0fdf4",
  },
  filterDropdownText: {
    fontSize: 11,
    color: "#6b7a8d",
    fontWeight: "700",
    flex: 1,
  },
  filterDropdownTextActive: {
    color: "#1f8e4d",
  },
  dropdownMenu: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemHighlight: {
    backgroundColor: "#f0fdf4",
  },
  dropdownItemText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  dropdownItemActive: {
    color: "#1f8e4d",
    fontWeight: "700",
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },

  // ── Log card styles ──
  logsCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f8e4d",
    marginBottom: 10,
  },
  logCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f8f9fb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logCardContent: {
    flex: 1,
  },
  logCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  logCardPlate: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1a1a2e",
  },
  logCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  logCardBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  logCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 3,
  },
  logCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  logCardRole: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9ca3af",
  },
  logCardVehicle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9ca3af",
    marginLeft: 4,
  },
  logCardTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1f8e4d",
  },
  endOfList: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginTop: 16,
    fontWeight: "500",
  },

  // ── Detail modal styles ──
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
});
