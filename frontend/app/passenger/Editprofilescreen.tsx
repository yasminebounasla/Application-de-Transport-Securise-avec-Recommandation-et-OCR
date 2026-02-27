import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import type { KeyboardTypeOptions } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── TOAST ──
function Toast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text style={styles.toastText}>Changes saved!</Text>
    </Animated.View>
  );
}

// ── INPUT FIELD ──
function InputField({ label, icon, value, onChangeText, keyboardType = 'default' as KeyboardTypeOptions, placeholder, editable = true }: {
  label: string; icon: IoniconsName; value: string;
  onChangeText?: (t: string) => void; keyboardType?: KeyboardTypeOptions;
  placeholder?: string; editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, !editable && styles.inputDisabled]}>
        <Ionicons name={icon} size={18} color="#888" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.input} value={value} onChangeText={onChangeText}
          keyboardType={keyboardType} placeholder={placeholder || label}
          placeholderTextColor="#BBB" editable={editable}
        />
      </View>
    </View>
  );
}

// ── MAIN ──
export default function Editprofilescreen() {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [nom, setNom]       = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail]   = useState('');
  const [numTel, setNumTel] = useState('');
  const [age, setAge]       = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/passengers/me');
      const d = res.data.data;
      setNom(d.nom || '');
      setPrenom(d.prenom || '');
      setEmail(d.email || '');
      setNumTel(d.numTel || '');
      setAge(d.age ? String(d.age) : '');
    } catch (e) {
      Alert.alert('Error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim() || !numTel.trim()) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/passengers/profile', {
        nom: nom.trim(), prenom: prenom.trim(),
        numTel: numTel.trim(), age: parseInt(age) || 0,
      });

      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        await AsyncStorage.setItem('user', JSON.stringify({ ...u, nom, prenom }));
      }

      setShowToast(true);
      setTimeout(() => { setShowToast(false); router.back(); }, 2200);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarCircle}
              onPress={() => Alert.alert('Coming Soon', 'Photo upload will be available soon.')}
              activeOpacity={0.8}>
              <Ionicons name="person" size={44} color="#fff" />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          {/* Personal info — no gender */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <InputField label="First name"   icon="person-outline"   value={prenom} onChangeText={setPrenom} placeholder="First name" />
            <InputField label="Last name"    icon="person-outline"   value={nom}    onChangeText={setNom}    placeholder="Last name" />
            <InputField label="Email"        icon="mail-outline"     value={email}  editable={false} />
            <InputField label="Phone number" icon="call-outline"     value={numTel} onChangeText={setNumTel} keyboardType="phone-pad" />
            <InputField label="Age"          icon="calendar-outline" value={age}    onChangeText={setAge}    keyboardType="numeric" />
          </View>

          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Save changes</Text>}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      <Toast visible={showToast} />
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 54 : 18,
    paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn:     { padding: 6, marginRight: 8 },
  topBarTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111' },

  avatarSection: {
    alignItems: 'center', paddingTop: 28, paddingBottom: 20,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 16,
  },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#444',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  avatarHint: { marginTop: 10, fontSize: 13, color: '#999' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16,
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 16, letterSpacing: 0.2 },

  fieldWrapper: { marginBottom: 16 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, height: 50,
  },
  inputDisabled: { backgroundColor: '#F3F4F6', opacity: 0.7 },
  input:         { flex: 1, fontSize: 15, color: '#111' },

  saveBtn:         { backgroundColor: '#000', height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { backgroundColor: '#999' },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  toast: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});