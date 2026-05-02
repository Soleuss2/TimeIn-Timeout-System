import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { MOCK_ACTIVITY_LOGS } from '../../services/mockData';
import { ActivityLog } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const DATE_OPTIONS = ['All Date', 'Today', 'Yesterday'];
const ENTRY_OPTIONS = ['All Entry', 'Student', 'Visitor'];
const VEHICLE_OPTIONS = ['All Vehicles', 'Motorcycle', 'Car'];

export default function ActivityScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(DATE_OPTIONS[0]);
  const [entryFilter, setEntryFilter] = useState(ENTRY_OPTIONS[0]);
  const [vehicleFilter, setVehicleFilter] = useState(VEHICLE_OPTIONS[0]);

  const filteredLogs = MOCK_ACTIVITY_LOGS.filter((item: ActivityLog) => {
    const matchesSearch =
      search.length === 0 ||
      item.studentId.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.plate.toLowerCase().includes(search.toLowerCase());

    const role = item.studentId.startsWith('VIS') ? 'Visitor' : 'Student';
    const matchesEntry = entryFilter === ENTRY_OPTIONS[0] || role === entryFilter;
    const matchesVehicle =
      vehicleFilter === VEHICLE_OPTIONS[0] ||
      (vehicleFilter === 'Motorcycle' ? item.plate.includes('XYZ') : !item.plate.includes('XYZ'));

    return matchesSearch && matchesEntry && matchesVehicle;
  });

  const insideCount = MOCK_ACTIVITY_LOGS.filter((item) => !item.timeOut).length;
  const departedCount = MOCK_ACTIVITY_LOGS.length - insideCount;

  const getIconName = (item: ActivityLog) =>
    item.studentId.startsWith('VIS') ? 'bicycle' : 'car-sport';

  const getEntryLabel = (item: ActivityLog) =>
    item.studentId.startsWith('VIS') ? 'VISITOR' : 'STUDENT';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1f8e4d" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Logs</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}><Ionicons name="car-sport" size={18} color="#1f8e4d" /></View>
            <Text style={styles.statNumber}>{MOCK_ACTIVITY_LOGS.length}</Text>
            <Text style={styles.statLabel}>Total Vehicles</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}><Ionicons name="location-outline" size={18} color="#1f8e4d" /></View>
            <Text style={styles.statNumber}>{insideCount}</Text>
            <Text style={styles.statLabel}>Inside Campus</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}><Ionicons name="exit-outline" size={18} color="#1f8e4d" /></View>
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
          {[DATE_OPTIONS, ENTRY_OPTIONS, VEHICLE_OPTIONS].map((options, index) => {
            const selected = [dateFilter, entryFilter, vehicleFilter][index];
            return (
              <TouchableOpacity
                key={options[0]}
                style={styles.filterBox}
                onPress={() => {
                  if (index === 0) setDateFilter(options[(options.indexOf(selected) + 1) % options.length]);
                  if (index === 1) setEntryFilter(options[(options.indexOf(selected) + 1) % options.length]);
                  if (index === 2) setVehicleFilter(options[(options.indexOf(selected) + 1) % options.length]);
                }}
              >
                <Text style={styles.filterText}>{selected}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.columnText, styles.columnId]}>ID NUMBER</Text>
          <Text style={[styles.columnText, styles.columnName]}>NAME</Text>
          <Text style={[styles.columnText, styles.columnVehicle]}>VEHICLE</Text>
        </View>

        {filteredLogs.map((item: ActivityLog) => (
          <View key={item.id} style={styles.logItem}>
            <Text style={styles.logId}>{item.studentId}</Text>
            <View style={styles.logNameRow}>
              <Text style={styles.logName}>{item.name}</Text>
              <Text style={styles.logRole}>{getEntryLabel(item)}</Text>
            </View>
            <View style={styles.logVehicleRow}>
              <View style={styles.vehicleBadge}>
                <Ionicons name={getIconName(item)} size={16} color="#fff" />
              </View>
              <Text style={styles.logPlate}>{item.plate}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.endText}>↡ End of records</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eff4f6',
  },
  header: {
    backgroundColor: '#1f8e4d',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#eaf6ef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f8e4d',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#7b8a98',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#2d3a4b',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  filterBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterText: {
    color: '#2d3a4b',
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  columnText: {
    color: '#8f9ba7',
    fontSize: 11,
    fontWeight: '700',
  },
  columnId: {
    flex: 2,
  },
  columnName: {
    flex: 3,
  },
  columnVehicle: {
    flex: 2,
    textAlign: 'right',
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  logId: {
    color: '#2d3a4b',
    fontWeight: '800',
    marginBottom: 8,
  },
  logNameRow: {
    marginBottom: 14,
  },
  logName: {
    color: '#1f2d3d',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  logRole: {
    color: '#8f9ba7',
    fontSize: 11,
    fontWeight: '700',
  },
  logVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#1f8e4d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logPlate: {
    color: '#1f2d3d',
    fontSize: 14,
    fontWeight: '800',
  },
  endText: {
    color: '#8f9ba7',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 12,
  },
});
