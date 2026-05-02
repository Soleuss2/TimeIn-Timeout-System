import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MOCK_ACTIVITY_LOGS } from '../../services/mockData';

export default function GuardScreen() {
  const router = useRouter();
  const [plate, setPlate] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedData) return;
    setScannedData(data);
    Alert.alert('Scanned QR code', data);
  };

  const scanStatus = scannedData
    ? `Last scanned: ${scannedData}`
    : 'Point the camera at the student QR code';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1f8e4d" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scanner</Text>
          <Text style={styles.headerSubtitle}>Ready to scan student entry</Text>
        </View>
        <Ionicons name="scan-outline" size={28} color="#fff" />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{MOCK_ACTIVITY_LOGS.length}</Text>
            <Text style={styles.statLabel}>Total Vehicles</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Inside Campus</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>Departed</Text>
          </View>
        </View>

        <View style={styles.scannerCard}>
          {hasPermission === null ? (
            <View style={styles.scannerFrame}>
              <Text style={styles.scannerLabel}>Requesting camera permission...</Text>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.scannerFrame}>
              <Text style={styles.scannerLabel}>Camera access denied</Text>
            </View>
          ) : (
            <View style={styles.scannerFrame}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarCodeScanned}
              />
            </View>
          )}
          <Text style={styles.scanStatus}>{scanStatus}</Text>
        </View>

        <View style={styles.manualCard}>
          <Text style={styles.cardLabel}>Manual Plate Entry</Text>
          <TextInput
            style={styles.input}
            placeholder="E.G. ABC 1234"
            placeholderTextColor="#9aa5b1"
            value={plate}
            onChangeText={setPlate}
          />
          <TouchableOpacity style={styles.submitButton} onPress={() => setPlate('')}>
            <Text style={styles.submitText}>SUBMIT ENTRY</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/activity')}>
          <Text style={styles.actionText}>Register & Log Visitor Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef3f6',
  },
  header: {
    backgroundColor: '#1f8e4d',
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#d6f0d9',
    marginTop: 4,
    fontSize: 13,
  },
  container: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    color: '#1f8e4d',
    fontWeight: '800',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#7b8a98',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scannerCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  scannerFrame: {
    height: 220,
    borderRadius: 22,
    backgroundColor: '#1f8e4d',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scannerLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scanStatus: {
    marginTop: 16,
    color: '#2d3a4b',
    fontWeight: '600',
  },
  manualCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 22,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 5,
  },
  cardLabel: {
    color: '#2d3a4b',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dce3eb',
    paddingHorizontal: 16,
    marginBottom: 18,
    backgroundColor: '#f8fafc',
    color: '#2d3a4b',
  },
  submitButton: {
    backgroundColor: '#d7f3dc',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    color: '#1f8e4d',
    fontWeight: '800',
  },
  actionButton: {
    backgroundColor: '#1f8e4d',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
  },
});
