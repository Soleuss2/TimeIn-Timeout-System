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
import { LoaderComponent } from "../../components/LoaderComponent";

export default function GuestScreen() {
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleBackToLogin = () => {
    setLogoutLoading(true);
    setTimeout(() => {
      router.replace("/");
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoaderComponent
        visible={logoutLoading}
        message="Redirecting..."
        logoSize={100}
      />
      {Platform.OS !== "web" && (
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Guest Access</Text>
        <Text style={styles.subtitle}>
          You have limited access in guest mode.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Available actions</Text>
          <Text style={styles.cardText}>• View activity log</Text>
          <Text style={styles.cardText}>• Read announcements</Text>
          <Text style={styles.cardText}>• Contact support</Text>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push("/activity")}
        >
          <Text style={styles.actionText}>View Activity Log</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleBackToLogin}
        >
          <Text style={styles.logoutText}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2d3436",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#636e72",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#00b894",
  },
  cardText: {
    fontSize: 14,
    color: "#2d3436",
    marginBottom: 6,
  },
  actionButton: {
    backgroundColor: "#fd79a8",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#dfe6e9",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: {
    color: "#636e72",
    fontWeight: "700",
  },
});
