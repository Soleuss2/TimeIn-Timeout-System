import React, { type ComponentType } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

let QRCode: ComponentType<{ value: string; size: number }> | null = null;
if (Platform.OS !== 'web') {
  try {
    QRCode = require('react-native-qrcode-svg').default;
  } catch (e) {
    QRCode = null;
  }
}

export default function StudentScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1f8e4d" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Access Portal</Text>
        <Text style={styles.headerSubtitle}>Ready to scan at the gate.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.qrCard}>
          {QRCode ? (
            <QRCode value="Student QR Code" size={190} />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>QR Code</Text>
            </View>
          )}

          <TouchableOpacity style={styles.downloadButton} onPress={() => {}}>
            <Text style={styles.downloadText}>Download QR</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoLabel}>STUDENT</Text>
              <Text style={styles.infoValue}>Juan Dela Cruz</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoLabel}>ID NUMBER</Text>
              <Text style={styles.infoValue}>2023-10045</Text>
            </View>
            <View>
              <Text style={styles.infoLabel}>VEHICLE</Text>
              <Text style={styles.infoValue}>ABC 1234</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => router.push('/') }>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef1f4',
  },
  header: {
    backgroundColor: '#1f8e4d',
    padding: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  headerSubtitle: {
    color: '#d3f0d8',
    fontSize: 14,
  },
  container: {
    padding: 24,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  qrPlaceholder: {
    width: 190,
    height: 190,
    borderRadius: 18,
    backgroundColor: '#f5f7fb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrPlaceholderText: {
    color: '#6b7a8b',
    fontWeight: '700',
  },
  downloadButton: {
    marginTop: 18,
    backgroundColor: '#f1f5f7',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  downloadText: {
    color: '#2d3a4b',
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  infoLabel: {
    color: '#8a98a7',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoValue: {
    color: '#2d3a4b',
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#eef1f4',
    marginVertical: 4,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dce3e8',
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#2d3a4b',
    fontWeight: '700',
  },
});
