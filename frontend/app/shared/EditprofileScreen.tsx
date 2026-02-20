import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import type { KeyboardTypeOptions } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ─────────────────────────────────────────────
// AUTO-DISMISS TOAST — no OK button needed
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// INPUT FIELD
// ─────────────────────────────────────────────
function InputField({
  label, icon, value, onChangeText,
  keyboardType = 'default' as KeyboardTypeOptions,
  placeholder, editable = true,
}: {
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
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder || label}
          placeholderTextColor="#BBB"
          editable={editable}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// TOGGLE FIELD
// ─────────────────────────────────────────────
function ToggleField({ label, icon, value, onValueChange }: {
  label: string; icon: IoniconsName; value: boolean; onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Ionicons name={icon} size={18} color="#555" style={{ marginRight: 10 }} />
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Switch value={!!value} onValueChange={onValueChange}
        trackColor={{ false: '#E5E7EB', true: '#111' }} thumbColor="#fff" />
    </View>
  );
}

// ─────────────────────────────────────────────
// GENDER — 'M' or 'F' only (Prisma expects this)
// ─────────────────────────────────────────────
function GenderSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>Gender</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
        {[{ key: 'M', label: 'Male' }, { key: 'F', label: 'Female' }].map(opt => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.genderBtn, value === opt.key && styles.genderBtnActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderBtnText, value === opt.key && styles.genderBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function EditProfileScreen() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const isDriver = role === 'driver';

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [nom, setNom]       = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail]   = useState('');
  const [numTel, setNumTel] = useState('');
  const [age, setAge]       = useState('');
  const [sexe, setSexe]     = useState('M'); // ✅ always 'M' or 'F'

  const [talkative, setTalkative]             = useState(false);
  const [radio_on, setRadioOn]               = useState(false);
  const [smoking_allowed, setSmokingAllowed] = useState(false);
  const [pets_allowed, setPetsAllowed]       = useState(false);
  const [car_big, setCarBig]                 = useState(false);
  const [works_morning, setWorksMorning]     = useState(false);
  const [works_afternoon, setWorksAfternoon] = useState(false);
  const [works_evening, setWorksEvening]     = useState(false);
  const [works_night, setWorksNight]         = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get(isDriver ? '/drivers/me' : '/passengers/me');
      const d   = res.data.data;

      setNom(d.nom || '');
      setPrenom(d.prenom || '');
      setEmail(d.email || '');
      setNumTel(d.numTel || '');
      setAge(d.age ? String(d.age) : '');

      // ✅ Normalize whatever comes from API → 'M' or 'F'
      const raw = (d.sexe || '').toString().trim().toUpperCase();
      setSexe(raw === 'F' || raw === 'FEMALE' ? 'F' : 'M');

      if (isDriver) {
        const p = d.preferences ?? d; // support both nested & flat
        setTalkative(!!p.talkative);
        setRadioOn(!!p.radio_on);
        setSmokingAllowed(!!p.smoking_allowed);
        setPetsAllowed(!!p.pets_allowed);
        setCarBig(!!p.car_big);
        setWorksMorning(!!p.works_morning);
        setWorksAfternoon(!!p.works_afternoon);
        setWorksEvening(!!p.works_evening);
        setWorksNight(!!p.works_night);
      }
    } catch (e) {
      console.error('load error:', e);
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
      // 1. Save personal info
      const profilePayload: Record<string, any> = {
        nom:    nom.trim(),
        prenom: prenom.trim(),
        numTel: numTel.trim(),
        age:    parseInt(age) || 0,
        sexe,
      };
      const profileEndpoint = isDriver ? '/drivers/profile' : '/passengers/profile';
      await api.put(profileEndpoint, profilePayload);

      // 2. Save driver preferences via dedicated route
      if (isDriver) {
        await api.put('/drivers/preferences', {
          talkative,
          radio_on,
          smoking_allowed,
          pets_allowed,
          car_big,
          works_morning,
          works_afternoon,
          works_evening,
          works_night,
        });
      }

        
        const updateUser = async (payload) => { 
            try {
             const userStr = await AsyncStorage.getItem('user');
    
                if (userStr) {
                 const u = JSON.parse(userStr);
      
                   await AsyncStorage.setItem('user', JSON.stringify({
                       ...u, 
                       nom: payload.nom, 
                       prenom: payload.prenom,
                    }));
      
                 console.log("User updated successfully!");
                }
            } catch (error) {
               console.error("Failed to update storage", error);
            }
        };

      // ✅ Auto-dismiss toast — no OK button, auto back after 2.2s
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        router.back();
      }, 2200);

    } catch (e: any) {
      console.error('save error:', e?.response?.data || e);
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

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Custom header — replaces the native bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Edit Profile</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => Alert.alert('Coming Soon', 'Photo upload will be available soon.')}
              activeOpacity={0.8}
            >
              <Ionicons name="person" size={44} color="#fff" />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          {/* Personal info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <InputField label="First name"   icon="person-outline"   value={prenom} onChangeText={setPrenom} placeholder="First name" />
            <InputField label="Last name"    icon="person-outline"   value={nom}    onChangeText={setNom}    placeholder="Last name" />
            <InputField label="Email"        icon="mail-outline"     value={email}  editable={false} />
            <InputField label="Phone number" icon="call-outline"     value={numTel} onChangeText={setNumTel} keyboardType="phone-pad" placeholder="+213..." />
            <InputField label="Age"          icon="calendar-outline" value={age}    onChangeText={setAge}    keyboardType="numeric" placeholder="Age" />
            <GenderSelector value={sexe} onChange={setSexe} />
          </View>

          {/* Driver preferences */}
          {isDriver && (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Preferences</Text>
                <ToggleField label="Talkative"       icon="chatbubbles-outline"   value={talkative}       onValueChange={setTalkative} />
                <ToggleField label="Radio On"        icon="musical-notes-outline" value={radio_on}        onValueChange={setRadioOn} />
                <ToggleField label="Smoking Allowed" icon="flame-outline"         value={smoking_allowed} onValueChange={setSmokingAllowed} />
                <ToggleField label="Pets Allowed"    icon="paw-outline"           value={pets_allowed}    onValueChange={setPetsAllowed} />
                <ToggleField label="Large Car"       icon="car-sport-outline"     value={car_big}         onValueChange={setCarBig} />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Working Hours</Text>
                <ToggleField label="Morning (6am–12pm)"   icon="sunny-outline"        value={works_morning}   onValueChange={setWorksMorning} />
                <ToggleField label="Afternoon (12pm–6pm)" icon="partly-sunny-outline" value={works_afternoon} onValueChange={setWorksAfternoon} />
                <ToggleField label="Evening (6pm–10pm)"   icon="moon-outline"         value={works_evening}   onValueChange={setWorksEvening} />
                <ToggleField label="Night (10pm–6am)"     icon="cloudy-night-outline" value={works_night}     onValueChange={setWorksNight} />
              </View>
            </>
          )}

          {/* Save button */}
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Save changes</Text>}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ Auto-dismiss toast — no OK button */}
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
  backBtn:       { padding: 6, marginRight: 8 },
  topBarTitle:   { flex: 1, fontSize: 18, fontWeight: '700', color: '#111' },
  saveQuick:     { paddingHorizontal: 12, paddingVertical: 6 },
  saveQuickText: { fontSize: 15, fontWeight: '700', color: '#111' },

  avatarSection: {
    alignItems: 'center', paddingTop: 32, paddingBottom: 24,
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

  fieldWrapper:  { marginBottom: 16 },
  fieldLabel:    { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, height: 50,
  },
  inputDisabled: { backgroundColor: '#F3F4F6', opacity: 0.7 },
  input:         { flex: 1, fontSize: 15, color: '#111' },

  genderBtn:           { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  genderBtnActive:     { backgroundColor: '#111', borderColor: '#111' },
  genderBtnText:       { fontSize: 14, fontWeight: '600', color: '#555' },
  genderBtnTextActive: { color: '#fff' },

  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  toggleLabel: { fontSize: 15, color: '#374151' },

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