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
import { ActivityLog } from "../../types";

const DATE_OPTIONS = ["All Date", "Today", "Yesterday"] as const;
const ENTRY_OPTIONS = ["All Entry", "Student", "Visitor"] as const;
const VEHICLE_OPTIONS = ["All Vehicles", "Motorcycle", "Car"] as const;

export default function ActivityScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<(typeof DATE_OPTIONS)[number]>(
    DATE_OPTIONS[0],
  );
  const [entryFilter, setEntryFilter] = useState<
    (typeof ENTRY_OPTIONS)[number]
  >(ENTRY_OPTIONS[0]);
  const [vehicleFilter, setVehicleFilter] = useState<
    (typeof VEHICLE_OPTIONS)[number]
  >(VEHICLE_OPTIONS[0]);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const filteredLogs = MOCK_ACTIVITY_LOGS.filter((item: ActivityLog) => {
    const matchesSearch =
      search.length === 0 ||
      item.studentId.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.plate.toLowerCase().includes(search.toLowerCase());

    const role = item.studentId.startsWith("VIS") ? "Visitor" : "Student";
    const matchesEntry =
      entryFilter === ENTRY_OPTIONS[0] || role === entryFilter;
    const matchesVehicle =
      vehicleFilter === VEHICLE_OPTIONS[0] ||
      (vehicleFilter === "Motorcycle"
        ? item.plate.includes("XYZ")
        : !item.plate.includes("XYZ"));

    return matchesSearch && matchesEntry && matchesVehicle;
  });

  const insideCount = MOCK_ACTIVITY_LOGS.filter((item) => !item.timeOut).length;
  const departedCount = MOCK_ACTIVITY_LOGS.length - insideCount;

  const getIconName = (item: ActivityLog) =>
    item.studentId.startsWith("VIS") ? "bicycle" : "car-sport";

  const getEntryLabel = (item: ActivityLog) =>
    item.studentId.startsWith("VIS") ? "VISITOR" : "STUDENT";

  const getStatusBadge = (item: ActivityLog) =>
    !item.timeOut ? "ON CAMPUS" : null;

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
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="car-sport" size={18} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{MOCK_ACTIVITY_LOGS.length}</Text>
            <Text style={styles.statLabel}>Total Vehicles</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="location-outline" size={18} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{insideCount}</Text>
            <Text style={styles.statLabel}>Inside Campus</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="exit-outline" size={18} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{departedCount}</Text>
            <Text style={styles.statLabel}>Departed</Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search" size={18} color="#8f9ba7" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="Search by plate number, name or ID..."
            placeholderTextColor="#8f9ba7"
          />
        </View>

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
                name={expandedFilter === "date" ? "chevron-up" : "chevron-down"}
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
                        dateFilter === option && styles.filterOptionTextActive,
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
                        entryFilter === option && styles.filterOptionTextActive,
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

        <View style={styles.logsCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.columnText, styles.columnId]}>ID NUMBER</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef4ef",
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
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginRight: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#eaf6ef",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2d3d",
    marginBottom: 6,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 11,
    color: "#7b8a98",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: "#2d3a4b",
    fontSize: 14,
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
    fontSize: 10,
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
    paddingVertical: 14,
    alignItems: "center",
  },
  logData: {
    justifyContent: "center",
  },
  logId: {
    color: "#2d3a4b",
    fontWeight: "800",
    fontSize: 12,
  },
  logNameRow: {
    marginBottom: 8,
  },
  logName: {
    color: "#1f2d3d",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  logRole: {
    color: "#8f9ba7",
    fontSize: 10,
    fontWeight: "700",
  },
  logVehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
  logTimesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logTimeLabel: {
    color: "#8f9ba7",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 2,
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
  logDateSection: {
    alignItems: "flex-end",
  },
  logDate: {
    color: "#1f2d3d",
    fontSize: 12,
    fontWeight: "700",
  },
  statusRow: {
    marginTop: 8,
  },
  statusBadge: {
    backgroundColor: "#d4f4dd",
    color: "#1f8e4d",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
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
