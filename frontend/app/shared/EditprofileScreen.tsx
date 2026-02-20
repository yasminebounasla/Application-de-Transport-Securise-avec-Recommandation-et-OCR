import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

function SectionTitle({ children }) {
  return (
    <Text style={styles.sectionTitle}>{children}</Text>
  );
}

import type { KeyboardTypeOptions } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function InputField({ label, icon, value, onChangeText, keyboardType = 'default', placeholder, editable = true }: {
  label: string;
  icon: IoniconsName;
  value: string;
  onChangeText?: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  editable?: boolean;
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

function ToggleField({ label, icon, value, onValueChange }: {
  label: string;
  icon: IoniconsName;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Ionicons name={icon} size={18} color="#555" style={{ marginRight: 10 }} />
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E7EB', true: '#111' }}
        thumbColor="#fff"
      />
    </View>
  );
}

function GenderSelector({ value, onChange }) {
  const options = ['male', 'female'];
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>Gender</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.genderBtn,
              value === opt && styles.genderBtnActive,
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderBtnText, value === opt && styles.genderBtnTextActive]}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
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
  const { role } = useLocalSearchParams();
  const isDriver = role === 'driver';

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // ── Common fields ──────────────────────────
  const [nom, setNom]       = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail]   = useState('');
  const [numTel, setNumTel] = useState('');
  const [age, setAge]       = useState('');
  const [sexe, setSexe]     = useState('male');

  // ── Driver-only preferences ────────────────
  const [talkative, setTalkative]             = useState(false);
  const [radio_on, setRadioOn]               = useState(false);
  const [smoking_allowed, setSmokingAllowed] = useState(false);
  const [pets_allowed, setPetsAllowed]       = useState(false);
  const [car_big, setCarBig]                 = useState(false);
  const [works_morning, setWorksMorning]     = useState(false);
  const [works_afternoon, setWorksAfternoon] = useState(false);
  const [works_evening, setWorksEvening]     = useState(false);
  const [works_night, setWorksNight]         = useState(false);

  // ── Load ───────────────────────────────────
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const endpoint = isDriver ? '/drivers/me' : '/passengers/me';
      const response = await api.get(endpoint);
      const d = response.data.data;

      setNom(d.nom || '');
      setPrenom(d.prenom || '');
      setEmail(d.email || '');
      setNumTel(d.numTel || '');
      setAge(d.age ? String(d.age) : '');
      setSexe(d.sexe || 'male');

      if (isDriver) {
        const p = d.preferences || d;
        setTalkative(p.talkative       || false);
        setRadioOn(p.radio_on          || false);
        setSmokingAllowed(p.smoking_allowed || false);
        setPetsAllowed(p.pets_allowed   || false);
        setCarBig(p.car_big             || false);
        setWorksMorning(p.works_morning     || false);
        setWorksAfternoon(p.works_afternoon || false);
        setWorksEvening(p.works_evening     || false);
        setWorksNight(p.works_night         || false);
      }
    } catch (e) {
      console.error('EditProfile load error:', e);
      Alert.alert('Error', 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  // ── Save ───────────────────────────────────
  const handleSave = async () => {
    // Basic validation
    if (!nom.trim() || !prenom.trim() || !numTel.trim()) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = isDriver ? '/drivers/profile' : '/passengers/profile';

      const payload: any = {
        nom:    nom.trim(),
        prenom: prenom.trim(),
        numTel: numTel.trim(),
        age:    parseInt(age) || 0,
        sexe,
      };

      if (isDriver) {
        payload.talkative       = talkative;
        payload.radio_on        = radio_on;
        payload.smoking_allowed = smoking_allowed;
        payload.pets_allowed    = pets_allowed;
        payload.car_big         = car_big;
        payload.works_morning   = works_morning;
        payload.works_afternoon = works_afternoon;
        payload.works_evening   = works_evening;
        payload.works_night     = works_night;
      }

      await api.put(endpoint, payload);

      // Update AsyncStorage user cache
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
        await AsyncStorage.setItem('user', JSON.stringify({
          ...userData,
          nom:    payload.nom,
          prenom: payload.prenom,
        }));
      }

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error('EditProfile save error:', e);
      const msg = e?.response?.data?.message || 'Failed to update profile.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading...</Text>
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
        {/* Custom header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 54 : 16,
          paddingBottom: 14, paddingHorizontal: 16,
          borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>Edit Profile</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── AVATAR SECTION ── */}
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

          {/* ── PERSONAL INFO ── */}
          <View style={styles.card}>
            <SectionTitle>Personal Information</SectionTitle>

            <InputField
              label="First name"
              icon="person-outline"
              value={prenom}
              onChangeText={setPrenom}
              placeholder="First name"
            />
            <InputField
              label="Last name"
              icon="person-outline"
              value={nom}
              onChangeText={setNom}
              placeholder="Last name"
            />
            <InputField
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="Email"
              editable={false} // email usually not editable
            />
            <InputField
              label="Phone number"
              icon="call-outline"
              value={numTel}
              onChangeText={setNumTel}
              keyboardType="phone-pad"
              placeholder="+213..."
            />
            <InputField
              label="Age"
              icon="calendar-outline"
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              placeholder="Age"
            />
            <GenderSelector value={sexe} onChange={setSexe} />
          </View>

          {/* ── DRIVER PREFERENCES ── */}
          {isDriver && (
            <>
              <View style={styles.card}>
                <SectionTitle>Preferences</SectionTitle>
                <ToggleField label="Talkative"       icon="chatbubbles-outline"    value={talkative}       onValueChange={setTalkative} />
                <ToggleField label="Radio On"        icon="musical-notes-outline"  value={radio_on}        onValueChange={setRadioOn} />
                <ToggleField label="Smoking Allowed" icon="flame-outline"          value={smoking_allowed} onValueChange={setSmokingAllowed} />
                <ToggleField label="Pets Allowed"    icon="paw-outline"            value={pets_allowed}    onValueChange={setPetsAllowed} />
                <ToggleField label="Large Car"       icon="car-sport-outline"      value={car_big}         onValueChange={setCarBig} />
              </View>

              <View style={styles.card}>
                <SectionTitle>Working Hours</SectionTitle>
                <ToggleField label="Morning (6am–12pm)"   icon="sunny-outline"         value={works_morning}   onValueChange={setWorksMorning} />
                <ToggleField label="Afternoon (12pm–6pm)" icon="partly-sunny-outline"  value={works_afternoon} onValueChange={setWorksAfternoon} />
                <ToggleField label="Evening (6pm–10pm)"   icon="moon-outline"          value={works_evening}   onValueChange={setWorksEvening} />
                <ToggleField label="Night (10pm–6am)"     icon="cloudy-night-outline"  value={works_night}     onValueChange={setWorksNight} />
              </View>
            </>
          )}

          {/* ── SAVE BUTTON ── */}
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#444',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarHint: {
    marginTop: 10,
    fontSize: 13,
    color: '#999',
  },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    marginBottom: 16,
    letterSpacing: 0.2,
  },

  fieldWrapper: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 50,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },

  genderBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  genderBtnActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  genderBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  genderBtnTextActive: {
    color: '#fff',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  toggleLabel: {
    fontSize: 15,
    color: '#374151',
  },

  saveBtn: {
    backgroundColor: '#000',
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#999',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});