import { AuthProvider } from "../services/authContext";
import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="student" />
        <Stack.Screen name="guard" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="guest" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="guard-activity" />
        <Stack.Screen name="add-visitor" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" />
      </Stack>
    </AuthProvider>
  );
}
