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
  ActivityIndicator,
} from "react-native";
import { MOCK_ACTIVITY_LOGS } from "../../services/mockData";
import { ActivityLog } from "../../types";

const DATE_OPTIONS = ["All Date", "Today", "Yesterday"] as const;
const ENTRY_OPTIONS = ["All Entry", "Student", "Visitor"] as const;
const VEHICLE_OPTIONS = ["All Vehicles", "Motorcycle", "Car"] as const;

export default function GuardActivityScreen() {
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
  const [loading] = useState(false);

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

  const totalVehicles = MOCK_ACTIVITY_LOGS.length;
  const insideCount = filteredLogs.filter((item) => !item.timeOut).length;
  const departedCount = filteredLogs.filter((item) => !!item.timeOut).length;

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
          <View style={styles.statCard}>
            <View style={styles.statCardIcon}>
              <Ionicons name="car-sport" size={20} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{totalVehicles}</Text>
            <Text style={styles.statLabel}>Total Vehicles</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardIcon}>
              <Ionicons name="location" size={20} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{insideCount}</Text>
            <Text style={styles.statLabel}>Inside Campus</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardIcon}>
              <Ionicons name="exit" size={20} color="#1f8e4d" />
            </View>
            <Text style={styles.statNumber}>{departedCount}</Text>
            <Text style={styles.statLabel}>Departed</Text>
          </View>
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
            placeholder="Search by plate number, name or ID..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filterBarRow}>
          <View style={styles.filterDropdownWrapper}>
            <TouchableOpacity
              style={styles.filterDropdown}
              onPress={() =>
                setExpandedFilter(expandedFilter === "date" ? null : "date")
              }
            >
              <Ionicons
                name="calendar"
                size={16}
                color="#1f8e4d"
                style={styles.filterIcon}
              />
              <Text style={styles.filterDropdownText}>{dateFilter}</Text>
              <Ionicons
                name={expandedFilter === "date" ? "chevron-up" : "chevron-down"}
                size={16}
                color="#666"
              />
            </TouchableOpacity>
            {expandedFilter === "date" && (
              <View style={styles.dropdownMenu}>
                {DATE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
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
              style={styles.filterDropdown}
              onPress={() =>
                setExpandedFilter(expandedFilter === "entry" ? null : "entry")
              }
            >
              <Ionicons
                name="person"
                size={16}
                color="#1f8e4d"
                style={styles.filterIcon}
              />
              <Text style={styles.filterDropdownText}>{entryFilter}</Text>
              <Ionicons
                name={
                  expandedFilter === "entry" ? "chevron-up" : "chevron-down"
                }
                size={16}
                color="#666"
              />
            </TouchableOpacity>
            {expandedFilter === "entry" && (
              <View style={styles.dropdownMenu}>
                {ENTRY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
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
              style={styles.filterDropdown}
              onPress={() =>
                setExpandedFilter(
                  expandedFilter === "vehicle" ? null : "vehicle",
                )
              }
            >
              <Ionicons
                name="car-sport"
                size={16}
                color="#1f8e4d"
                style={styles.filterIcon}
              />
              <Text style={styles.filterDropdownText}>{vehicleFilter}</Text>
              <Ionicons
                name={
                  expandedFilter === "vehicle" ? "chevron-up" : "chevron-down"
                }
                size={16}
                color="#666"
              />
            </TouchableOpacity>
            {expandedFilter === "vehicle" && (
              <View style={styles.dropdownMenu}>
                {VEHICLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
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
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text" size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>No activity records found</Text>
          </View>
        ) : (
          <>
            {Platform.OS === "web" ? (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableCellID]}>
                    ID NUMBER
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellName]}>
                    NAME
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellVehicle]}>
                    VEHICLE
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellTime]}>
                    TIME IN
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellTime]}>
                    TIME OUT
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellDate]}>
                    DATE
                  </Text>
                </View>
                {filteredLogs.map((item: ActivityLog, index: number) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellID]}>
                      {item.studentId}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellName]}>
                      {item.name}
                      <Text style={styles.entryTypeTag}>
                        {"\n"}
                        {item.studentId.startsWith("VIS")
                          ? "VISITOR"
                          : "STUDENT"}
                      </Text>
                    </Text>
                    <View style={[styles.tableCellVehicle, styles.vehicleCell]}>
                      <Ionicons
                        name={
                          item.studentId.startsWith("VIS")
                            ? "bicycle"
                            : "car-sport"
                        }
                        size={20}
                        color="#1f8e4d"
                      />
                      <Text style={styles.vehiclePlate}>{item.plate}</Text>
                    </View>
                    <Text style={[styles.tableCell, styles.tableCellTime]}>
                      {new Date(item.timeIn).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellTime]}>
                      {item.timeOut
                        ? new Date(item.timeOut).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "ON CAMPUS"}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellDate]}>
                      {new Date(item.timeIn).toLocaleDateString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.mobileListContainer}>
                <View style={styles.mobileListHeader}>
                  <Text style={styles.mobileHeaderLabel}>ID NUMBER</Text>
                  <Text style={[styles.mobileHeaderLabel, { flex: 2 }]}>
                    NAME
                  </Text>
                  <Text style={styles.mobileHeaderLabel}>VEHICLE</Text>
                </View>
                {filteredLogs.map((item: ActivityLog, index: number) => (
                  <View key={index} style={styles.mobileListItem}>
                    <Text style={styles.mobileItemID}>{item.studentId}</Text>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.mobileItemName}>{item.name}</Text>
                      <View style={styles.mobileItemTagContainer}>
                        <Ionicons
                          name={
                            item.studentId.startsWith("VIS")
                              ? "person-add"
                              : "person"
                          }
                          size={11}
                          color="#999"
                          style={{ marginRight: 2 }}
                        />
                        <Text style={styles.mobileItemTag}>
                          {item.studentId.startsWith("VIS")
                            ? "VISITOR"
                            : "STUDENT"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.mobileItemVehicle}>
                      <Ionicons
                        name={
                          item.studentId.startsWith("VIS")
                            ? "bicycle"
                            : "car-sport"
                        }
                        size={20}
                        color="#1f8e4d"
                      />
                      <Text style={styles.mobileItemPlate}>{item.plate}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={styles.endOfList}>
          {filteredLogs.length === 0
            ? ""
            : `End of records • ${filteredLogs.length} entries`}
        </Text>
      </ScrollView>
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
  },
  filterDropdownWrapper: {
    flex: 1,
  },
  filterDropdown: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 36,
    gap: 6,
  },
  filterIcon: {
    marginRight: 2,
  },
  filterDropdownText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 6,
    marginTop: 4,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 12,
    color: "#666",
  },
  dropdownItemActive: {
    color: "#1f8e4d",
    fontWeight: "600",
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
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
  mobileListContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  mobileListHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  mobileHeaderLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
  },
  mobileListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
    gap: 8,
  },
  mobileItemID: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    width: 60,
  },
  mobileItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  mobileItemTag: {
    fontSize: 10,
    color: "#999",
    fontWeight: "500",
  },
  mobileItemTagContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  mobileItemVehicle: {
    alignItems: "center",
    justifyContent: "center",
  },
  mobileItemPlate: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
    fontWeight: "500",
  },
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
    alignItems: "center",
  },
  tableCell: {
    fontSize: 12,
    color: "#333",
  },
  tableCellID: {
    width: 80,
    fontWeight: "600",
  },
  tableCellName: {
    flex: 1.2,
  },
  tableCellVehicle: {
    flex: 1,
  },
  tableCellTime: {
    width: 90,
  },
  tableCellDate: {
    width: 100,
  },
  vehicleCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vehiclePlate: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
  entryTypeTag: {
    fontSize: 10,
    color: "#999",
    fontWeight: "500",
  },
  endOfList: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginTop: 16,
    fontWeight: "500",
  },
});
