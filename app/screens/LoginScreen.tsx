import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthService } from '../../services/authService';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Validation', 'Enter both username and password');
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
      router.push('/student');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#eef2f5" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topInfo}>
          <Text style={styles.pageLabel}>LOGIN</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.brandCircle}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>QCU Time-In/Time-Out System</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#5f6d7a" />
              <TextInput
                style={styles.input}
                placeholder="Email or Student ID"
                placeholderTextColor="#9aa5b1"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#5f6d7a" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9aa5b1"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.forgotButton} onPress={() => Alert.alert('Forgot Password', 'Feature coming soon')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>LOGIN</Text>}
          </TouchableOpacity>

          <View style={styles.testArea}>
            <Text style={styles.testTitle}>TEST CREDENTIALS</Text>
            <Text style={styles.testText}>Student: Student01 / 00000</Text>
            <Text style={styles.testText}>Guard: Guard01 / 00000</Text>
            <Text style={styles.testText}>Admin: admin01 / 00000</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eceff4',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  topInfo: {
    paddingBottom: 20,
  },
  pageLabel: {
    fontSize: 16,
    color: '#5f6d7a',
    letterSpacing: 1,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#2f3542',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  brandCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1f8e4d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2d3d',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6e7d8b',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e6ebf2',
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: 10,
    color: '#2d3a4b',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: '#3b8f54',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#1f8e4d',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  testArea: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eef4f2',
  },
  testTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5f6d7a',
    marginBottom: 8,
  },
  testText: {
    color: '#576371',
    fontSize: 13,
    marginBottom: 4,
  },
});
