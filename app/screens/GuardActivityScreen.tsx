import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import { MOCK_ACTIVITY_LOGS } from "../../services/mockData";
import type { ActivityLog } from "../../types";

const DATE_OPTIONS = ["All Date", "Today", "Yesterday"] as const;
const ENTRY_OPTIONS = ["All Entry", "Student", "Visitor"] as const;
const VEHICLE_OPTIONS = ["All Vehicles", "Motorcycle", "Car"] as const;

function getIconName(item: ActivityLog) {
  return item.studentId.startsWith("VIS") ? "bicycle" : "car-sport";
}

function getEntryLabel(item: ActivityLog) {
  return item.studentId.startsWith("VIS") ? "VISITOR" : "STUDENT";
}

function getStatusBadge(item: ActivityLog) {
  return !item.timeOut ? "ON CAMPUS" : null;
}

export default function GuardActivityScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] =
    useState<(typeof DATE_OPTIONS)[number]>("All Date");
  const [entryFilter, setEntryFilter] =
    useState<(typeof ENTRY_OPTIONS)[number]>("All Entry");
  const [vehicleFilter, setVehicleFilter] =
    useState<(typeof VEHICLE_OPTIONS)[number]>("All Vehicles");
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const filteredLogs = MOCK_ACTIVITY_LOGS.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.plate.toLowerCase().includes(search.toLowerCase()) ||
      item.studentId.toLowerCase().includes(search.toLowerCase());

    const matchesEntry =
      entryFilter === "All Entry" ||
      (entryFilter === "Student" && !item.studentId.startsWith("VIS")) ||
      (entryFilter === "Visitor" && item.studentId.startsWith("VIS"));

    const matchesVehicle =
      vehicleFilter === "All Vehicles" ||
      (vehicleFilter === "Motorcycle" && item.studentId.startsWith("VIS")) ||
      (vehicleFilter === "Car" && !item.studentId.startsWith("VIS"));

    return matchesSearch && matchesEntry && matchesVehicle;
  });

  const insideCount = MOCK_ACTIVITY_LOGS.filter((item) => !item.timeOut).length;
  const departedCount = MOCK_ACTIVITY_LOGS.length - insideCount;
  const totalCount = MOCK_ACTIVITY_LOGS.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {Platform.OS !== "web" && (
        <StatusBar barStyle="light-content" backgroundColor="#1f8e4d" />
      )}
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
          <Text style={styles.headerTitle}>Activity Dashboard</Text>
          <Text style={styles.headerSubtitle}>Gate Entry/Exit Log</Text>
        </View>
        <Ionicons name="bar-chart-outline" size={24} color="#fff" />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentShell}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="car-sport" size={24} color="#1f8e4d" />
              </View>
              <Text style={styles.statValue}>{totalCount}</Text>
              <Text style={styles.statLabel}>Total Entries</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="arrow-forward" size={24} color="#ff6b6b" />
              </View>
              <Text style={styles.statValue}>{insideCount}</Text>
              <Text style={styles.statLabel}>Currently On Campus</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="exit-outline" size={24} color="#ffa500" />
              </View>
              <Text style={styles.statValue}>{departedCount}</Text>
              <Text style={styles.statLabel}>Total Departed</Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchCard}>
            <Ionicons name="search-outline" size={18} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, plate, or ID"
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Filters */}
          <View style={styles.filterRow}>
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={styles.filterHeader}
                onPress={() =>
                  setExpandedFilter(expandedFilter === "date" ? null : "date")
                }
              >
                <Text style={styles.filterHeaderText}>{dateFilter}</Text>
                <Ionicons
                  name={
                    expandedFilter === "date" ? "chevron-up" : "chevron-down"
                  }
                  size={16}
                  color="#1f8e4d"
                />
              </TouchableOpacity>
              {expandedFilter === "date" && (
                <View style={styles.filterDropdown}>
                  {DATE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.filterOption,
                        dateFilter === option && styles.filterOptionActive,
                      ]}
                      onPress={() => {
                        setDateFilter(option);
                        setExpandedFilter(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          dateFilter === option &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={styles.filterHeader}
                onPress={() =>
                  setExpandedFilter(expandedFilter === "entry" ? null : "entry")
                }
              >
                <Text style={styles.filterHeaderText}>{entryFilter}</Text>
                <Ionicons
                  name={
                    expandedFilter === "entry" ? "chevron-up" : "chevron-down"
                  }
                  size={16}
                  color="#1f8e4d"
                />
              </TouchableOpacity>
              {expandedFilter === "entry" && (
                <View style={styles.filterDropdown}>
                  {ENTRY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.filterOption,
                        entryFilter === option && styles.filterOptionActive,
                      ]}
                      onPress={() => {
                        setEntryFilter(option);
                        setExpandedFilter(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          entryFilter === option &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={styles.filterHeader}
                onPress={() =>
                  setExpandedFilter(
                    expandedFilter === "vehicle" ? null : "vehicle",
                  )
                }
              >
                <Text style={styles.filterHeaderText}>{vehicleFilter}</Text>
                <Ionicons
                  name={
                    expandedFilter === "vehicle" ? "chevron-up" : "chevron-down"
                  }
                  size={16}
                  color="#1f8e4d"
                />
              </TouchableOpacity>
              {expandedFilter === "vehicle" && (
                <View style={styles.filterDropdown}>
                  {VEHICLE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.filterOption,
                        vehicleFilter === option && styles.filterOptionActive,
                      ]}
                      onPress={() => {
                        setVehicleFilter(option);
                        setExpandedFilter(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          vehicleFilter === option &&
                            styles.filterOptionTextActive,
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

          {/* Activity Table */}
          <View style={styles.logsCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnText, styles.columnId]}>
                ID NUMBER
              </Text>
              <Text style={[styles.columnText, styles.columnName]}>NAME</Text>
              <Text style={[styles.columnText, styles.columnVehicle]}>
                VEHICLE
              </Text>
              <Text style={[styles.columnText, styles.columnTimeIn]}>
                TIME-IN
              </Text>
              <Text style={[styles.columnText, styles.columnTimeOut]}>
                TIME-OUT
              </Text>
              <Text style={[styles.columnText, styles.columnDate]}>DATE</Text>
            </View>

            {filteredLogs.map((item: ActivityLog) => (
              <View key={item.id} style={styles.logItem}>
                <Text style={[styles.columnId, styles.logId]}>
                  {item.studentId}
                </Text>
                <View style={[styles.columnName]}>
                  <Text style={styles.logName}>{item.name}</Text>
                  <Text style={styles.logRole}>{getEntryLabel(item)}</Text>
                </View>
                <View style={[styles.columnVehicle]}>
                  <View style={styles.vehicleBadge}>
                    <Ionicons name={getIconName(item)} size={14} color="#fff" />
                  </View>
                  <Text style={styles.logPlate}>{item.plate}</Text>
                </View>
                <Text style={[styles.columnTimeIn, styles.logTime]}>
                  {item.timeIn}
                </Text>
                <View style={[styles.columnTimeOut]}>
                  {getStatusBadge(item) ? (
                    <Text style={styles.statusBadgeText}>
                      {getStatusBadge(item)}
                    </Text>
                  ) : (
                    <Text style={styles.timeOutText}>{item.timeOut}</Text>
                  )}
                </View>
                <Text style={[styles.columnDate, styles.logDate]}>
                  05/01/2026
                </Text>
              </View>
            ))}

            <Text style={styles.endText}>↡ End of records</Text>
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
    maxWidth: Platform.OS === "web" ? 1200 : 560,
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
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  statCard: {
    flex: Platform.OS === "web" ? 0 : 1,
    width: Platform.OS === "web" ? "calc(33.333% - 8px)" : "auto",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f0f5f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1f2d3d",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#8f9ba7",
    fontWeight: "700",
    textAlign: "center",
  },
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#333",
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 10,
  },
  filterContainer: {
    flex: 1,
  },
  filterHeader: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  filterHeaderText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
  },
  filterDropdown: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderTopWidth: 0,
    marginTop: -1,
    overflow: "hidden",
    zIndex: 9,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterOptionActive: {
    backgroundColor: "#eaf6ef",
  },
  filterOptionText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
  },
  filterOptionTextActive: {
    color: "#1f8e4d",
    fontWeight: "800",
  },
  logsCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 0,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
    backgroundColor: "#fbfcfd",
  },
  columnText: {
    color: "#8f9ba7",
    fontSize: Platform.OS === "web" ? 12 : 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  columnId: {
    flex: 1.2,
  },
  columnName: {
    flex: 1.5,
  },
  columnVehicle: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
  },
  columnTimeIn: {
    flex: 1,
    textAlign: "center",
  },
  columnTimeOut: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  columnDate: {
    flex: 0.9,
    textAlign: "right",
  },
  logItem: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "web" ? 16 : 14,
    alignItems: "center",
  },
  logId: {
    color: "#2d3a4b",
    fontWeight: "800",
    fontSize: Platform.OS === "web" ? 14 : 12,
  },
  logName: {
    color: "#1f2d3d",
    fontSize: Platform.OS === "web" ? 14 : 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  logRole: {
    color: "#8f9ba7",
    fontSize: 10,
    fontWeight: "700",
  },
  vehicleBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#1f8e4d",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  logPlate: {
    color: "#1f2d3d",
    fontSize: 13,
    fontWeight: "800",
  },
  logTime: {
    color: "#1f2d3d",
    fontSize: 12,
    fontWeight: "800",
  },
  timeOutText: {
    color: "#1f2d3d",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  logDate: {
    color: "#1f2d3d",
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadgeText: {
    backgroundColor: "#d4f4dd",
    color: "#1f8e4d",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  endText: {
    color: "#8f9ba7",
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    paddingVertical: 16,
  },
});
