import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { AuthService } from '../../services/authService';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Validation', 'Please enter both username and password');
      return;
    }

    setLoading(true);
    const result = await AuthService.login(username, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login failed', result.message);
      return;
    }

    const user = result.user;
    if (!user) {
      Alert.alert('Login failed', 'No user data available.');
      return;
    }

    if (user.role === 'admin') {
      router.push('/admin');
    } else if (user.role === 'guard') {
      router.push('/guard');
    } else {
      router.push({
        pathname: '/student',
        params: { studentId: user.id },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#11412a" />
      <View style={styles.backgroundShapeTop} />
      <View style={styles.backgroundShapeBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.contentShell}>
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>Campus Access</Text>
                  <Text style={styles.heroTitle}>QCU Time-In/Time-Out</Text>
                  <Text style={styles.heroSubtitle}>
                    Sign in to access your student, guard, or admin portal.
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Image
                    source={require('../../assets/images/qcu-logo.jpg')}
                    style={styles.heroBadgeImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <View style={styles.heroPills}>
                <View style={styles.heroPill}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#1f8e4d" />
                  <Text style={styles.heroPillText}>Secure portal</Text>
                </View>
                <View style={styles.heroPillSecondary}>
                  <Ionicons name="phone-portrait-outline" size={16} color="#fff" />
                  <Text style={styles.heroPillTextSecondary}>Mobile ready</Text>
                </View>
              </View>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formLabel}>Sign In</Text>
                <Text style={styles.formTitle}>Welcome back</Text>
                <Text style={styles.formSubtitle}>
                  Use your campus credentials to continue.
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email or Student ID</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#7d8a99" />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your ID or email"
                    placeholderTextColor="#b0b7c1"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#7d8a99" />
                  <TextInput
                    style={styles.input}
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
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={18}
                      color="#7d8a99"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => Alert.alert('Password Recovery', 'Feature coming soon. Contact support.')}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>SIGN IN</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" style={styles.buttonIcon} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2024 Quezon City University</Text>
              <Text style={styles.versionText}>v1.0.0</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef4ef',
  },
  keyboardWrap: {
    flex: 1,
  },
  backgroundShapeTop: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(31, 142, 77, 0.08)',
  },
  backgroundShapeBottom: {
    position: 'absolute',
    bottom: 30,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(17, 65, 42, 0.05)',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  contentShell: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  heroCard: {
    backgroundColor: '#11412a',
    borderRadius: 32,
    padding: 24,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#0b1b12',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    paddingRight: 16,
  },
  heroEyebrow: {
    color: '#b6f0c8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginBottom: 10,
  },
  heroSubtitle: {
    color: '#d5e8d9',
    fontSize: 14,
    lineHeight: 21,
  },
  heroBadge: {
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBadgeImage: {
    width: '100%',
    height: '100%',
  },
  heroPills: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 20,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf7ef',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  heroPillSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  heroPillText: {
    color: '#155332',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  heroPillTextSecondary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 32,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e5ece7',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  formHeader: {
    marginBottom: 24,
  },
  formLabel: {
    color: '#1f8e4d',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  formTitle: {
    color: '#0f2818',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  formSubtitle: {
    color: '#607181',
    fontSize: 14,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2d3a4b',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fbf9',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e4ede6',
    height: 54,
  },
  input: {
    flex: 1,
    marginHorizontal: 10,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    paddingVertical: 8,
  },
  forgotText: {
    color: '#216b43',
    fontWeight: '700',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#1f8e4d',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#1f8e4d',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.8,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#7d8a99',
    fontWeight: '500',
  },
  versionText: {
    fontSize: 11,
    color: '#b0b7c1',
    marginTop: 4,
    fontWeight: '500',
  },
});