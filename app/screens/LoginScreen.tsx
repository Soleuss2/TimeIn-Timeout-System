import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { AuthService } from "../../services/authService";
import { LoaderComponent } from "../../components/LoaderComponent";
import { CustomAlert, AlertAction } from "../../components/CustomAlert";

export default function LoginScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  // Better breakpoints for all mobile devices
  const isExtraSmallScreen = width < 360; // Very small phones (iPhone SE)
  const isSmallScreen = width < 480; // Small phones (iPhone 12 mini, etc)
  const isMediumScreen = width >= 480 && width < 768; // Regular phones
  const isLargeScreen = width >= 768; // Tablets
  const isShortScreen = height < 600; // Short screens
  const isExtraTallScreen = height > 800; // Extra tall screens
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null,
  );
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: "info" | "warning" | "error" | "success";
    buttons: AlertAction[];
  }>({
    title: "",
    message: "",
    type: "info",
    buttons: [],
  });

  const handleLogin = async () => {
    // Reset error state
    setErrorMessage("");
    setAttemptsRemaining(null);

    if (!username || !password) {
      setErrorMessage("Please enter both username and password");
      return;
    }

    setLoading(true);
    const result = await AuthService.login(username, password);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.message);

      // Display attempts remaining if available
      if (
        result.attemptsRemaining !== undefined &&
        result.attemptsRemaining >= 0
      ) {
        setAttemptsRemaining(result.attemptsRemaining);
        if (result.attemptsRemaining > 0) {
          setAlertConfig({
            title: "Login Failed",
            message: `${result.message}\n\nAttempts remaining: ${result.attemptsRemaining}`,
            type: "error",
            buttons: [
              {
                text: "Try Again",
                onPress: () => setAlertVisible(false),
                style: "default",
              },
            ],
          });
        } else {
          setAlertConfig({
            title: "Account Locked",
            message: result.message,
            type: "error",
            buttons: [
              {
                text: "OK",
                onPress: () => setAlertVisible(false),
                style: "default",
              },
            ],
          });
        }
      } else {
        setAlertConfig({
          title: "Login Failed",
          message: result.message,
          type: "error",
          buttons: [
            {
              text: "Try Again",
              onPress: () => setAlertVisible(false),
              style: "default",
            },
          ],
        });
      }
      setAlertVisible(true);
      return;
    }

    const user = result.user;
    if (!user) {
      setErrorMessage("No user data available.");
      setAlertConfig({
        title: "Login Failed",
        message: "No user data available.",
        type: "error",
        buttons: [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    // Clear any error on successful login
    setErrorMessage("");
    setAttemptsRemaining(null);

    // Store user data in AsyncStorage for session persistence
    try {
      await AsyncStorage.setItem("user", JSON.stringify(user));
    } catch (error) {
      console.error("Failed to store user data in AsyncStorage:", error);
    }

    if (user.role === "admin") {
      router.push("/admin");
    } else if (user.role === "guard") {
      router.push("/guard");
    } else {
      router.push({
        pathname: "/student",
        params: { studentId: user.id },
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      setAlertConfig({
        title: "Input Required",
        message: "Please enter your email or ID to reset your password.",
        type: "warning",
        buttons: [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    setResetLoading(true);
    const result = await AuthService.sendPasswordReset(resetEmail);
    setResetLoading(false);

    if (result.success) {
      setResetSuccess(true);
      setAlertConfig({
        title: "Success",
        message: result.message,
        type: "success",
        buttons: [
          {
            text: "OK",
            onPress: () => {
              setAlertVisible(false);
              setResetPasswordModalVisible(false);
              setResetEmail("");
            },
            style: "default",
          },
        ],
      });
    } else {
      setAlertConfig({
        title: "Error",
        message: result.message,
        type: "error",
        buttons: [
          {
            text: "OK",
            onPress: () => setAlertVisible(false),
            style: "default",
          },
        ],
      });
    }
    setAlertVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoaderComponent
        visible={loading}
        message="Signing in..."
        logoSize={100}
      />
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
      {Platform.OS !== "web" && (
        <StatusBar barStyle="light-content" backgroundColor="#11412a" />
      )}
      <View style={styles.backgroundShapeTop} />
      <View style={styles.backgroundShapeBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            isExtraSmallScreen && styles.containerExtraSmall,
            isSmallScreen && styles.containerSmall,
            isMediumScreen && styles.containerMedium,
            isShortScreen && styles.containerShort,
            isExtraTallScreen && styles.containerExtraTall,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View
            style={[
              styles.contentShell,
              isExtraSmallScreen && { maxWidth: "100%", paddingHorizontal: 8 },
              isSmallScreen && { maxWidth: "100%", paddingHorizontal: 12 },
              isMediumScreen && { maxWidth: "95%" },
              isLargeScreen && { paddingHorizontal: 20 },
            ]}
          >
            <View
              style={[
                styles.heroCard,
                isExtraSmallScreen && { padding: 12, marginBottom: 10 },
                isSmallScreen && { padding: 16, marginBottom: 12 },
                isMediumScreen && { padding: 20, marginBottom: 16 },
                isShortScreen && { marginBottom: 8, padding: 12 },
                isExtraTallScreen && { marginBottom: 24, padding: 28 },
              ]}
            >
              <View
                style={[
                  styles.heroTopRow,
                  (isExtraSmallScreen || isSmallScreen) && { flexDirection: "column" },
                ]}
              >
                <View
                  style={[
                    styles.heroCopy,
                    isExtraSmallScreen && { paddingRight: 0, marginBottom: 10 },
                    isSmallScreen && { paddingRight: 0, marginBottom: 12 },
                    isMediumScreen && { marginBottom: 0 },
                  ]}
                >
                  <Text
                    style={[
                      styles.heroEyebrow,
                      isExtraSmallScreen && { fontSize: 9 },
                      isSmallScreen && { fontSize: 10 },
                      isLargeScreen && { fontSize: 13 },
                    ]}
                  >
                    Campus Access
                  </Text>
                  <Text
                    style={[
                      styles.heroTitle,
                      isExtraSmallScreen && { fontSize: 18, lineHeight: 22 },
                      isSmallScreen && { fontSize: 20, lineHeight: 26 },
                      isMediumScreen && { fontSize: 26, lineHeight: 32 },
                      isLargeScreen && { fontSize: 32, lineHeight: 38 },
                    ]}
                  >
                    QCU Parking Monitoring System
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroBadge,
                    isExtraSmallScreen && {
                      width: 70,
                      height: 70,
                      alignSelf: "flex-start",
                      marginLeft: 0,
                    },
                    isSmallScreen && {
                      width: 80,
                      height: 80,
                      alignSelf: "flex-start",
                      marginLeft: 0,
                    },
                    isMediumScreen && {
                      width: 100,
                      height: 100,
                      marginLeft: 0,
                    },
                    isLargeScreen && {
                      width: 120,
                      height: 120,
                    },
                  ]}
                >
                  <Image
                    source={require("../../assets/images/qcu-logo.jpg")}
                    style={styles.heroBadgeImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>

            <View
              style={[
                styles.formCard,
                isExtraSmallScreen && { padding: 12, marginBottom: 10 },
                isSmallScreen && { padding: 16, marginBottom: 12 },
                isMediumScreen && { padding: 20, marginBottom: 16 },
                isShortScreen && { marginBottom: 8, padding: 12 },
                isExtraTallScreen && { marginBottom: 24, padding: 28 },
              ]}
            >
              <View
                style={[
                  styles.formHeader,
                  isExtraSmallScreen && { marginBottom: 12 },
                  isSmallScreen && { marginBottom: 14 },
                  isMediumScreen && { marginBottom: 18 },
                  isLargeScreen && { marginBottom: 24 },
                ]}
              >
                <Text
                  style={[
                    styles.formLabel,
                    isExtraSmallScreen && { fontSize: 9 },
                    isSmallScreen && { fontSize: 10 },
                    isLargeScreen && { fontSize: 12 },
                  ]}
                >
                  Sign In
                </Text>
                <Text
                  style={[
                    styles.formTitle,
                    isExtraSmallScreen && { fontSize: 18 },
                    isSmallScreen && { fontSize: 20 },
                    isMediumScreen && { fontSize: 22 },
                    isLargeScreen && { fontSize: 28 },
                  ]}
                >
                  Welcome back
                </Text>
                <Text
                  style={[
                    styles.formSubtitle,
                    isExtraSmallScreen && { fontSize: 11 },
                    isSmallScreen && { fontSize: 12 },
                    isLargeScreen && { fontSize: 16 },
                  ]}
                >
                  Use your campus credentials to continue.
                </Text>
              </View>

              <View
                style={[
                  styles.formGroup,
                  isExtraSmallScreen && { marginBottom: 10 },
                  isSmallScreen && { marginBottom: 12 },
                  isMediumScreen && { marginBottom: 16 },
                  isLargeScreen && { marginBottom: 18 },
                ]}
              >
                <Text
                  style={[
                    styles.label,
                    isExtraSmallScreen && { fontSize: 11, marginBottom: 5 },
                    isSmallScreen && { fontSize: 12, marginBottom: 6 },
                    isLargeScreen && { fontSize: 14, marginBottom: 8 },
                  ]}
                >
                  Email, Student ID, or Employee ID
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    isExtraSmallScreen && { height: 44, paddingHorizontal: 8 },
                    isSmallScreen && { height: 48, paddingHorizontal: 10 },
                    isLargeScreen && { height: 56, paddingHorizontal: 16 },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={isExtraSmallScreen ? 14 : isSmallScreen ? 16 : 18}
                    color="#7d8a99"
                  />
                  <TextInput
                    style={[
                      styles.input,
                      isExtraSmallScreen && { fontSize: 13, marginHorizontal: 6 },
                      isSmallScreen && { fontSize: 14, marginHorizontal: 8 },
                      isLargeScreen && { fontSize: 16, marginHorizontal: 10 },
                    ]}
                    placeholder="Enter your email or ID"
                    placeholderTextColor="#b0b7c1"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View
                style={[
                  styles.formGroup,
                  isExtraSmallScreen && { marginBottom: 10 },
                  isSmallScreen && { marginBottom: 12 },
                  isMediumScreen && { marginBottom: 16 },
                  isLargeScreen && { marginBottom: 18 },
                ]}
              >
                <Text
                  style={[
                    styles.label,
                    isExtraSmallScreen && { fontSize: 11, marginBottom: 5 },
                    isSmallScreen && { fontSize: 12, marginBottom: 6 },
                    isLargeScreen && { fontSize: 14, marginBottom: 8 },
                  ]}
                >
                  Password
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    isExtraSmallScreen && { height: 44, paddingHorizontal: 8 },
                    isSmallScreen && { height: 48, paddingHorizontal: 10 },
                    isLargeScreen && { height: 56, paddingHorizontal: 16 },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={isExtraSmallScreen ? 14 : isSmallScreen ? 16 : 18}
                    color="#7d8a99"
                  />
                  <TextInput
                    style={[
                      styles.input,
                      isExtraSmallScreen && { fontSize: 13, marginHorizontal: 6 },
                      isSmallScreen && { fontSize: 14, marginHorizontal: 8 },
                      isLargeScreen && { fontSize: 16, marginHorizontal: 10 },
                    ]}
                    placeholder="Enter your password"
                    placeholderTextColor="#b0b7c1"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <Ionicons
                      name={showPassword ? "eye" : "eye-off"}
                      size={isExtraSmallScreen ? 14 : isSmallScreen ? 16 : 18}
                      color="#7d8a99"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error Message Display */}
              {errorMessage ? (
                <View
                  style={[
                    styles.errorContainer,
                    isExtraSmallScreen && { padding: 10, marginBottom: 12 },
                    isSmallScreen && { padding: 12, marginBottom: 14 },
                  ]}
                >
                  <Ionicons name="alert-circle" size={isSmallScreen ? 16 : 18} color="#d32f2f" />
                  <View style={styles.errorContent}>
                    <Text
                      style={[
                        styles.errorMessage,
                        isSmallScreen && { fontSize: 13 },
                      ]}
                    >
                      {errorMessage}
                    </Text>
                    {attemptsRemaining !== null && attemptsRemaining > 0 && (
                      <Text
                        style={[
                          styles.attemptsText,
                          isSmallScreen && { fontSize: 11 },
                        ]}
                      >
                        Attempts remaining: {attemptsRemaining}
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.forgotButton,
                  isExtraSmallScreen && { marginBottom: 12 },
                  isSmallScreen && { marginBottom: 14 },
                  isLargeScreen && { marginBottom: 24 },
                ]}
                onPress={() => {
                  setResetPasswordModalVisible(true);
                  setResetSuccess(false);
                }}
              >
                <Text
                  style={[
                    styles.forgotText,
                    isExtraSmallScreen && { fontSize: 11 },
                    isSmallScreen && { fontSize: 12 },
                    isLargeScreen && { fontSize: 14 },
                  ]}
                >
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  loading && styles.buttonDisabled,
                  isExtraSmallScreen && { height: 44 },
                  isSmallScreen && { height: 48 },
                  isLargeScreen && { height: 56 },
                ]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View
                    style={[
                      styles.buttonContent,
                      isSmallScreen && { flexDirection: "row" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isExtraSmallScreen && { fontSize: 12 },
                        isSmallScreen && { fontSize: 13 },
                        isLargeScreen && { fontSize: 16 },
                      ]}
                    >
                      SIGN IN
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={isExtraSmallScreen ? 12 : isSmallScreen ? 14 : 16}
                      color="#fff"
                      style={styles.buttonIcon}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.footer,
                isExtraSmallScreen && { marginTop: 0, paddingTop: 8 },
                isSmallScreen && { marginTop: 0, paddingTop: 12 },
                isLargeScreen && { marginTop: 2, paddingTop: 20 },
              ]}
            >
              <Text
                style={[
                  styles.footerText,
                  isExtraSmallScreen && { fontSize: 9 },
                  isSmallScreen && { fontSize: 10 },
                  isLargeScreen && { fontSize: 13 },
                ]}
              >
                © 2026 Quezon City University
              </Text>
              <Text
                style={[
                  styles.versionText,
                  isExtraSmallScreen && { fontSize: 8 },
                  isSmallScreen && { fontSize: 9 },
                  isLargeScreen && { fontSize: 12 },
                ]}
              >
                v1.0.0
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={resetPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.resetModalContainer,
              isExtraSmallScreen && { width: "95%", maxHeight: "95%", maxWidth: 300 },
              isSmallScreen && { width: "90%", maxHeight: "90%", maxWidth: 350 },
              isMediumScreen && { width: "80%", maxHeight: "85%", maxWidth: 450 },
              isLargeScreen && { width: "70%", maxHeight: "80%", maxWidth: 550 },
            ]}
          >
            <View style={styles.resetModalHeader}>
              <Text
                style={[
                  styles.resetModalTitle,
                  isExtraSmallScreen && { fontSize: 16 },
                  isSmallScreen && { fontSize: 18 },
                  isLargeScreen && { fontSize: 22 },
                ]}
              >
                Reset Password
              </Text>
              <TouchableOpacity
                onPress={() => setResetPasswordModalVisible(false)}
                style={styles.resetModalCloseButton}
              >
                <Ionicons
                  name="close"
                  size={isExtraSmallScreen ? 18 : isSmallScreen ? 20 : 24}
                  color="#333"
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[
                styles.resetModalContent,
                isExtraSmallScreen && { paddingHorizontal: 14, paddingVertical: 16 },
                isSmallScreen && { paddingHorizontal: 16, paddingVertical: 20 },
              ]}
            >
              {resetSuccess ? (
                <View style={styles.successContainer}>
                  <Ionicons
                    name="checkmark-circle"
                    size={isSmallScreen ? 50 : 60}
                    color="#1f8e4d"
                  />
                  <Text
                    style={[
                      styles.successTitle,
                      isSmallScreen && { fontSize: 18 },
                    ]}
                  >
                    Email Sent!
                  </Text>
                  <Text
                    style={[
                      styles.successMessage,
                      isSmallScreen && { fontSize: 13 },
                    ]}
                  >
                    Check your email for password reset instructions.
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={[
                      styles.resetLabel,
                      isExtraSmallScreen && { fontSize: 11 },
                      isSmallScreen && { fontSize: 12 },
                      isLargeScreen && { fontSize: 15 },
                    ]}
                  >
                    Enter your email or ID to receive a password reset link.
                  </Text>

                  <View
                    style={[
                      styles.resetInputGroup,
                      isExtraSmallScreen && { marginBottom: 12 },
                      isSmallScreen && { marginBottom: 14 },
                      isLargeScreen && { marginBottom: 20 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.resetInputLabel,
                        isExtraSmallScreen && { fontSize: 11 },
                        isSmallScreen && { fontSize: 12 },
                        isLargeScreen && { fontSize: 14 },
                      ]}
                    >
                      Email or ID
                    </Text>
                    <View
                      style={[
                        styles.resetInputWrapper,
                        isExtraSmallScreen && { paddingHorizontal: 8 },
                        isSmallScreen && { paddingHorizontal: 10 },
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={isExtraSmallScreen ? 14 : isSmallScreen ? 16 : 18}
                        color="#7d8a99"
                      />
                      <TextInput
                        style={[
                          styles.resetInput,
                          isExtraSmallScreen && { fontSize: 13, paddingVertical: 10 },
                          isSmallScreen && { fontSize: 14 },
                          isLargeScreen && { fontSize: 15 },
                        ]}
                        placeholder="Enter your email or student/employee ID"
                        placeholderTextColor="#b0b7c1"
                        value={resetEmail}
                        onChangeText={setResetEmail}
                        autoCapitalize="none"
                        editable={!resetLoading}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.resetButton,
                      resetLoading && styles.resetButtonDisabled,
                      isExtraSmallScreen && { paddingVertical: 10 },
                      isSmallScreen && { paddingVertical: 12 },
                      isLargeScreen && { paddingVertical: 14 },
                    ]}
                    onPress={handlePasswordReset}
                    disabled={resetLoading}
                    activeOpacity={0.85}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text
                        style={[
                          styles.resetButtonText,
                          isExtraSmallScreen && { fontSize: 12 },
                          isSmallScreen && { fontSize: 13 },
                          isLargeScreen && { fontSize: 16 },
                        ]}
                      >
                        Send Reset Link
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.resetCancelButton,
                      isExtraSmallScreen && { paddingVertical: 8 },
                      isSmallScreen && { paddingVertical: 10 },
                      isLargeScreen && { paddingVertical: 12 },
                    ]}
                    onPress={() => setResetPasswordModalVisible(false)}
                    disabled={resetLoading}
                  >
                    <Text
                      style={[
                        styles.resetCancelButtonText,
                        isExtraSmallScreen && { fontSize: 11 },
                        isSmallScreen && { fontSize: 12 },
                        isLargeScreen && { fontSize: 14 },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef4ef",
  },
  keyboardWrap: {
    flex: 1,
  },
  backgroundShapeTop: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(31, 142, 77, 0.08)",
    zIndex: 0,
  },
  backgroundShapeBottom: {
    position: "absolute",
    bottom: 30,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(17, 65, 42, 0.05)",
    zIndex: 0,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  containerExtraSmall: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 20,
  },
  containerSmall: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
  },
  containerMedium: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  containerShort: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  containerExtraTall: {
    paddingTop: 24,
    paddingBottom: 48,
  },
  contentShell: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  heroCard: {
    backgroundColor: "#11412a",
    borderRadius: 32,
    padding: 24,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#0b1b12",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroCopy: {
    flex: 1,
    paddingRight: 16,
  },
  heroEyebrow: {
    color: "#b6f0c8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginBottom: 10,
  },
  heroSubtitle: {
    color: "#d5e8d9",
    fontSize: 14,
    lineHeight: 21,
  },
  heroBadge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  heroBadgeImage: {
    width: "88%",
    height: "88%",
    borderRadius: 56,
  },
  heroPills: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 20,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eaf7ef",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  heroPillSecondary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  heroPillText: {
    color: "#155332",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  heroPillTextSecondary: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 32,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e5ece7",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  formHeader: {
    marginBottom: 24,
  },
  formLabel: {
    color: "#1f8e4d",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  formTitle: {
    color: "#0f2818",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  formSubtitle: {
    color: "#607181",
    fontSize: 14,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2d3a4b",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fbf9",
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e4ede6",
    height: 54,
  },
  input: {
    flex: 1,
    marginHorizontal: 10,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 20,
    paddingVertical: 8,
  },
  forgotText: {
    color: "#216b43",
    fontWeight: "700",
    fontSize: 13,
  },
  button: {
    backgroundColor: "#1f8e4d",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.8,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  footer: {
    alignItems: "center",
    marginTop: 2,
    paddingTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: "#7d8a99",
    fontWeight: "500",
  },
  versionText: {
    fontSize: 11,
    color: "#b0b7c1",
    marginTop: 4,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffebee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#d32f2f",
  },
  errorContent: {
    flex: 1,
    marginLeft: 12,
  },
  errorMessage: {
    color: "#d32f2f",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  attemptsText: {
    color: "#c62828",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  resetModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "85%",
    maxWidth: 420,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  resetModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5ece7",
  },
  resetModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f2818",
  },
  resetModalCloseButton: {
    padding: 8,
    marginRight: -8,
  },
  resetModalContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  resetLabel: {
    fontSize: 14,
    color: "#62707d",
    marginBottom: 20,
    lineHeight: 21,
  },
  resetInputGroup: {
    marginBottom: 20,
  },
  resetInputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f8e4d",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  resetInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5ece7",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8fbf9",
    minHeight: 48,
  },
  resetInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0f2818",
  },
  resetButton: {
    backgroundColor: "#1f8e4d",
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#1f8e4d",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  resetCancelButton: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e5ece7",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  resetCancelButtonText: {
    color: "#62707d",
    fontSize: 14,
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f8e4d",
    marginTop: 16,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: "#62707d",
    textAlign: "center",
    lineHeight: 21,
  },
});
