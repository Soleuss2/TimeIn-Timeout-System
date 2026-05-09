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
  TouchableOpacity,
  View,
} from "react-native";
import { MOCK_ACTIVITY_LOGS } from "../../services/mockData";
import { LoaderComponent } from "../../components/LoaderComponent";
import { AuthService } from "../../services/authService";

export default function AdminScreen() {
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const totalStudents = 2450;
  const totalGuards = 12;
  const vehiclesToday = MOCK_ACTIVITY_LOGS.length;

  const handleLogout = async () => {
    setLogoutLoading(true);
    const result = await AuthService.logout();
    if (result.success) {
      router.replace("/");
    } else {
      setLogoutLoading(false);
      // Optional: Handle error
      router.replace("/"); // still force redirect
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoaderComponent
        visible={logoutLoading}
        message="Logging out..."
        logoSize={100}
      />
      {Platform.OS !== "web" && (
        <StatusBar barStyle="light-content" backgroundColor="#1d2934" />
      )}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => {}}>
          <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

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
            <Text style={styles.smallCardLabel}>Guards</Text>
            <Text style={styles.smallCardValue}>{totalGuards}</Text>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.smallCardLabel}>Vehicles Today</Text>
            <Text style={styles.smallCardValue}>{vehiclesToday}</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Peak Parking Hours</Text>
          <View style={styles.chartBars}>
            <View style={[styles.bar, { height: 94 }]} />
            <View style={[styles.bar, { height: 74 }]} />
            <View style={[styles.bar, { height: 100 }]} />
            <View style={[styles.bar, { height: 64 }]} />
            <View style={[styles.bar, { height: 82 }]} />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
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
  },
  smallCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginRight: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  smallCardLabel: {
    color: "#6f7f93",
    fontSize: 12,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
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
});
