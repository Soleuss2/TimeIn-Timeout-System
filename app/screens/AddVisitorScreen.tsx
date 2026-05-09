import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColor } from "../../hooks/use-theme-color";

export default function AddVisitorScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");

  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");

  const handleAddVisitor = () => {
    if (
      !visitorName.trim() ||
      !visitorEmail.trim() ||
      !visitorPhone.trim() ||
      !visitPurpose.trim()
    ) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    Alert.alert("Success", "Visitor added successfully");
    setVisitorName("");
    setVisitorEmail("");
    setVisitorPhone("");
    setVisitPurpose("");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]}>Add Visitor</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>
              Visitor Name
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: textColor, borderColor: textColor },
              ]}
              placeholder="Enter visitor name"
              placeholderTextColor={`${textColor}80`}
              value={visitorName}
              onChangeText={setVisitorName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                { color: textColor, borderColor: textColor },
              ]}
              placeholder="Enter email address"
              placeholderTextColor={`${textColor}80`}
              keyboardType="email-address"
              value={visitorEmail}
              onChangeText={setVisitorEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>
              Phone Number
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: textColor, borderColor: textColor },
              ]}
              placeholder="Enter phone number"
              placeholderTextColor={`${textColor}80`}
              keyboardType="phone-pad"
              value={visitorPhone}
              onChangeText={setVisitorPhone}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>
              Purpose of Visit
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { color: textColor, borderColor: textColor },
              ]}
              placeholder="Enter purpose of visit"
              placeholderTextColor={`${textColor}80`}
              multiline
              numberOfLines={4}
              value={visitPurpose}
              onChangeText={setVisitPurpose}
            />
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleAddVisitor}
          >
            <Text style={styles.submitButtonText}>Add Visitor</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
