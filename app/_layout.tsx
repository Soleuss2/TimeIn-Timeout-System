import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { AuthService } from "../services/authService";
import { User } from "../services/authService";
import { AuthProvider } from "../services/authContext";

// Define which roles can access which routes
const ROLE_ACCESS: Record<string, string[]> = {
  student: ["student"],
  guard: ["guard", "guard-activity", "add-visitor"],
  admin: ["admin", "activity", "add-visitor"],
};

// All routes that require a logged-in user
const PROTECTED_ROUTES = [
  "student",
  "guard",
  "admin",
  "activity",
  "add-visitor",
  "guard-activity",
];

export default function RootLayout() {
  const segments = useSegments();
  const [user, setUser] = useState<User | null>(null);
  // true = we haven't heard back from Firebase yet
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Subscribe to Firebase auth state — this is the single source of truth.
    // We intentionally do NOT pre-load from AsyncStorage here because
    // that cache can be stale (e.g. user logged out from another tab,
    // or the old logout button never cleared it).
    const unsubscribe = AuthService.onAuthStateChange(async (firebaseUser) => {
      setUser(firebaseUser);
      // Keep cache in sync for faster loads on the NEXT app start,
      // but never trust it as the gate-keeper.
      if (firebaseUser) {
        await AsyncStorage.setItem("user", JSON.stringify(firebaseUser));
      } else {
        await AsyncStorage.removeItem("user");
      }
      setIsAuthReady(true);
    });

    return () => {
      // Clean up the listener when the layout unmounts
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ──────────────────────────────────────────────
  // While Firebase hasn't responded yet, show a loading screen.
  // This BLOCKS the protected page from ever rendering.
  // ──────────────────────────────────────────────
  if (!isAuthReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1f8e4d" />
        <Text style={styles.loadingText}>Verifying session…</Text>
      </View>
    );
  }

  // ──────────────────────────────────────────────
  // Auth is ready — now decide if the current route is allowed.
  // ──────────────────────────────────────────────
  const currentRoute = segments[0] as string | undefined;
  const isProtectedRoute =
    currentRoute && PROTECTED_ROUTES.includes(currentRoute);

  // CASE 1: Not logged in + trying to access a protected page → go to login
  if (isProtectedRoute && !user) {
    return <Redirect href="/" />;
  }

  // CASE 2: Logged in + trying to access a page their role doesn't allow
  if (isProtectedRoute && user) {
    const allowedRoutes = ROLE_ACCESS[user.role] || [];
    if (!allowedRoutes.includes(currentRoute)) {
      console.warn(
        `🚫 Unauthorized: role "${user.role}" cannot access "/${currentRoute}"`,
      );
      // Send them to their correct portal
      if (user.role === "admin") {
        return <Redirect href="/admin" />;
      } else if (user.role === "guard") {
        return <Redirect href="/guard" />;
      } else {
        return <Redirect href="/student" />;
      }
    }
  }

  // CASE 3: Everything checks out — render normally
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="student"
          options={{
            title: "Student Portal",
            headerBackTitle: "Back",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="guard"
          options={{
            title: "Guard Portal",
            headerBackTitle: "Back",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            title: "Admin Panel",
            headerBackTitle: "Back",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="activity"
          options={{
            title: "Activity Log",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="guest"
          options={{
            title: "Guest Mode",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="add-visitor"
          options={{
            title: "Add Visitor",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="guard-activity"
          options={{
            title: "Guard Activity",
            headerBackTitle: "Back",
          }}
        />
      </Stack>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef4ef",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#1f8e4d",
    fontWeight: "600",
  },
});
