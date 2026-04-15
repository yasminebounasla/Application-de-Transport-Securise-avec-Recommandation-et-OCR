import React, { useState, useEffect, useRef } from "react";
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
  Image,
} from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyboardTypeOptions } from "react-native";
import { useCallback } from "react";
import api, { API_URL } from "../../services/api";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type Tab = "personal" | "preferences" | "vehicle" | "zone";

// ── TOAST ──
function Toast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1600),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Ionicons name='checkmark-circle' size={18} color='#fff' />
      <Text style={styles.toastText}>Changes saved!</Text>
    </Animated.View>
  );
}

// ── INPUT FIELD ──
function InputField({
  label,
  icon,
  value,
  onChangeText,
  keyboardType = "default" as KeyboardTypeOptions,
  placeholder,
  editable = true,
  error,
}: {
  label: string;
  icon: IoniconsName;
  value: string;
  onChangeText?: (t: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  editable?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, !editable && styles.inputDisabled, !!error && { borderColor: '#EF4444', borderWidth: 1 }]}>
        <Ionicons
          name={icon}
          size={18}
          color={error ? '#EF4444' : '#888'}
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder || label}
          placeholderTextColor='#BBB'
          editable={editable}
        />
      </View>
      {!!error && <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

// ── TOGGLE FIELD ──
function ToggleField({
  label,
  icon,
  value,
  onValueChange,
}: {
  label: string;
  icon: IoniconsName;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <Ionicons
          name={icon}
          size={18}
          color='#555'
          style={{ marginRight: 10 }}
        />
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E5E7EB", true: "#111" }}
        thumbColor='#fff'
      />
    </View>
  );
}

// ── GENDER SELECTOR ──
function GenderSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>Gender</Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
        {[
          { key: "M", label: "Male" },
          { key: "F", label: "Female" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.genderBtn,
              value === opt.key && styles.genderBtnActive,
            ]}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.genderBtnText,
                value === opt.key && styles.genderBtnTextActive,
              ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── MAIN ──
export default function EditProfileScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Personal
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [numTel, setNumTel] = useState("");
  const [age, setAge] = useState("");
  const [sexe, setSexe] = useState("M");

  // Validation errors
  const [errors, setErrors] = useState({ numTel: '', age: '' });

  // Preferences
  const [talkative, setTalkative] = useState(false);
  const [radio_on, setRadioOn] = useState(false);
  const [smoking_allowed, setSmokingAllowed] = useState(false);
  const [pets_allowed, setPetsAllowed] = useState(false);
  const [car_big, setCarBig] = useState(false);
  const [works_morning, setWorksMorning] = useState(false);
  const [works_afternoon, setWorksAfternoon] = useState(false);
  const [works_evening, setWorksEvening] = useState(false);
  const [works_night, setWorksNight] = useState(false);

  // Zone
  const [workZoneAddress, setWorkZoneAddress] = useState("");
  const [wilaya, setWilaya] = useState("");

  //selfie
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // ── Refresh work zone quand on revient de MapScreen ──
  useFocusEffect(
    useCallback(() => {
      setShowToast(false); // ← reset toast quand on revient
      if (activeTab === "zone") {
        loadZone();
      }
    }, [activeTab]),
  );

  const loadData = async () => {
    try {
      const res = await api.get("/drivers/me");
      const d = res.data.data;
      setNom(d.nom || "");
      setPrenom(d.prenom || "");
      setEmail(d.email || "");
      setNumTel(d.numTel || "");
      setAge(d.age ? String(d.age) : "");
      const raw = (d.sexe || "").toString().trim().toUpperCase();
      setSexe(raw === "F" ? "F" : "M");
      setDriverId(d.id);
      try {
        const selfieRes = await api.get(`/verification/driver/${d.id}/selfie`);
        console.log('🖼️ SELFIE STATUS:', selfieRes.status);
        console.log('🖼️ SELFIE DATA:', JSON.stringify(selfieRes.data).substring(0, 100));
        if (selfieRes.data.success) {
          setSelfieUrl(selfieRes.data.image);
        }
      } catch (e: any) {
        console.log('❌ SELFIE ERROR STATUS:', e?.response?.status);
        console.log('❌ SELFIE ERROR DATA:', JSON.stringify(e?.response?.data));
      }
      const p = d.preferences ?? d;
      setTalkative(!!p.talkative);
      setRadioOn(!!p.radio_on);
      setSmokingAllowed(!!p.smoking_allowed);
      setPetsAllowed(!!p.pets_allowed);
      setCarBig(!!p.car_big);
      setWorksMorning(!!p.works_morning);
      setWorksAfternoon(!!p.works_afternoon);
      setWorksEvening(!!p.works_evening);
      setWorksNight(!!p.works_night);
      setWorkZoneAddress(d.workZoneAddress || "");
      setWilaya(d.wilaya || "");
    } catch (e) {
      Alert.alert("Error", "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const loadZone = async () => {
    try {
      const res = await api.get("/drivers/me");
      const d = res.data.data;
      setWorkZoneAddress(d.workZoneAddress || "");
      setWilaya(d.wilaya || "");
    } catch (e) {}
  };

  const updateUserInStorage = async () => {
    try {
      const userStr = await AsyncStorage.getItem("user");
      if (userStr) {
        const u = JSON.parse(userStr);
        await AsyncStorage.setItem(
          "user",
          JSON.stringify({ ...u, nom, prenom }),
        );
      }
    } catch (e) {}
  };

  // ── Phone validation ──
  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setNumTel(digits);
    if (digits.length === 0) setErrors(e => ({ ...e, numTel: '' }));
    else if (!digits.startsWith('0')) setErrors(e => ({ ...e, numTel: 'Phone number must start with 0' }));
    else if (digits.length !== 10) setErrors(e => ({ ...e, numTel: 'Phone number must be 10 digits' }));
    else setErrors(e => ({ ...e, numTel: '' }));
  };

  // ── Age validation ──
  const handleAgeChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setAge(digits);
    const num = parseInt(digits);
    if (digits.length === 0) setErrors(e => ({ ...e, age: '' }));
    else if (num < 18) setErrors(e => ({ ...e, age: 'Age must be at least 18' }));
    else if (num > 100) setErrors(e => ({ ...e, age: 'Age must not exceed 100' }));
    else setErrors(e => ({ ...e, age: '' }));
  };

  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim() || !numTel.trim()) {
      Alert.alert("Validation", "Please fill in all required fields.");
      return;
    }
    if (errors.numTel || errors.age) {
      Alert.alert('Validation', 'Please fix the errors before saving.');
      return;
    }
    setSaving(true);
    try {
      await api.put("/drivers/profile", {
        nom: nom.trim(),
        prenom: prenom.trim(),
        numTel: numTel.trim(),
        age: parseInt(age) || 0,
        sexe,
      });
      await api.put("/drivers/preferences", {
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
      await updateUserInStorage();
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        router.back();
      }, 2200);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}>
        <ActivityIndicator size='large' color='#000' />
      </View>
    );
  }

  const tabs: { key: Tab; label: string; icon: IoniconsName }[] = [
    { key: "personal", label: "Personal", icon: "person-outline" },
    { key: "preferences", label: "Preferences", icon: "options-outline" },
    { key: "zone", label: "Zone", icon: "location-outline" },
    { key: "vehicle", label: "Vehicle", icon: "car-outline" },
  ];

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#F9FAFB" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabItem,
                activeTab === tab.key && styles.tabItemActive,
              ]}
              activeOpacity={0.8}>
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? "#111" : "#999"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
          {/* ── PERSONAL TAB ── */}
          {activeTab === "personal" && (
            <>
              <View style={styles.avatarSection}>
                <TouchableOpacity
                  style={styles.avatarCircle}
                  activeOpacity={0.8}>
                  {selfieUrl ? (
                    <Image
                      source={{ uri: selfieUrl }}
                      style={{ width: 88, height: 88, borderRadius: 44 }}
                      onError={() => setSelfieUrl(null)}
                    />
                  ) : (
                    <Ionicons name='person' size={44} color='#fff' />
                  )}
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Tap to change photo</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <InputField
                  label='First name'
                  icon='person-outline'
                  value={prenom}
                  onChangeText={setPrenom}
                  placeholder='First name'
                />
                <InputField
                  label='Last name'
                  icon='person-outline'
                  value={nom}
                  onChangeText={setNom}
                  placeholder='Last name'
                />
                <InputField
                  label='Email'
                  icon='mail-outline'
                  value={email}
                  editable={false}
                />
                <InputField
                  label='Phone number'
                  icon='call-outline'
                  value={numTel}
                  onChangeText={handlePhoneChange}
                  keyboardType='phone-pad'
                  error={errors.numTel}
                />
                <InputField
                  label='Age'
                  icon='calendar-outline'
                  value={age}
                  onChangeText={handleAgeChange}
                  keyboardType='numeric'
                  error={errors.age}
                />
                <GenderSelector value={sexe} onChange={setSexe} />
              </View>

              <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}>
                  {saving ? (
                    <ActivityIndicator size='small' color='#fff' />
                  ) : (
                    <Text style={styles.saveBtnText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── PREFERENCES TAB ── */}
          {activeTab === "preferences" && (
            <>
              <View style={[styles.card, { marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>Ride Style</Text>
                <ToggleField
                  label='Talkative'
                  icon='chatbubbles-outline'
                  value={talkative}
                  onValueChange={setTalkative}
                />
                <ToggleField
                  label='Radio On'
                  icon='musical-notes-outline'
                  value={radio_on}
                  onValueChange={setRadioOn}
                />
                <ToggleField
                  label='Smoking Allowed'
                  icon='flame-outline'
                  value={smoking_allowed}
                  onValueChange={setSmokingAllowed}
                />
                <ToggleField
                  label='Pets Allowed'
                  icon='paw-outline'
                  value={pets_allowed}
                  onValueChange={setPetsAllowed}
                />
                <ToggleField
                  label='Large Car'
                  icon='car-sport-outline'
                  value={car_big}
                  onValueChange={setCarBig}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Working Hours</Text>
                <ToggleField
                  label='Morning (6am–12pm)'
                  icon='sunny-outline'
                  value={works_morning}
                  onValueChange={setWorksMorning}
                />
                <ToggleField
                  label='Afternoon (12pm–6pm)'
                  icon='partly-sunny-outline'
                  value={works_afternoon}
                  onValueChange={setWorksAfternoon}
                />
                <ToggleField
                  label='Evening (6pm–10pm)'
                  icon='moon-outline'
                  value={works_evening}
                  onValueChange={setWorksEvening}
                />
                <ToggleField
                  label='Night (10pm–6am)'
                  icon='cloudy-night-outline'
                  value={works_night}
                  onValueChange={setWorksNight}
                />
              </View>

              <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}>
                  {saving ? (
                    <ActivityIndicator size='small' color='#fff' />
                  ) : (
                    <Text style={styles.saveBtnText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── ZONE TAB ── */}
          {activeTab === "zone" && (
            <View style={{ marginTop: 20 }}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Work Zone</Text>
                <Text style={styles.zoneHint}>
                  Your work zone determines which passengers can find you. Only
                  your wilaya is visible to passengers — never your exact
                  location.
                </Text>

                {/* Adresse actuelle */}
                <View style={styles.zoneCurrentBox}>
                  <View style={styles.zoneIconWrap}>
                    <Ionicons name='location' size={20} color='#294190' />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneCurrentLabel}>Current zone</Text>
                    <Text style={styles.zoneCurrentValue}>
                      {workZoneAddress || wilaya || "Not set yet"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Options de mise à jour */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Update Zone</Text>

                {/* GPS */}
                <TouchableOpacity
                  style={styles.zoneOptionRow}
                  onPress={async () => {
                    try {
                      const Location = require("expo-location");
                      const { status } =
                        await Location.requestForegroundPermissionsAsync();
                      if (status !== "granted") {
                        Alert.alert(
                          "Permission denied",
                          "Location permission is required.",
                        );
                        return;
                      }
                      const loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                      });
                      await api.patch("/drivers/profile/location", {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                      });
                      await loadZone();
                      setShowToast(true);
                      setTimeout(() => setShowToast(false), 2200);
                    } catch (e: any) {
                      Alert.alert(
                        "Error",
                        e.response?.data?.message ||
                          "Failed to update location.",
                      );
                    }
                  }}
                  activeOpacity={0.8}>
                  <View style={styles.zoneOptionIcon}>
                    <Ionicons name='locate' size={20} color='#fff' />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneOptionTitle}>
                      Use current location
                    </Text>
                    <Text style={styles.zoneOptionSub}>
                      Quick — uses your GPS right now
                    </Text>
                  </View>
                  <Ionicons name='chevron-forward' size={18} color='#CCC' />
                </TouchableOpacity>

                <View style={styles.optionDivider} />

                {/* Map */}
                <TouchableOpacity
                  style={styles.zoneOptionRow}
                  onPress={() =>
                    router.push({
                      pathname: "/shared/MapScreen",
                      params: { selectionType: "work_zone" },
                    })
                  }
                  activeOpacity={0.8}>
                  <View
                    style={[
                      styles.zoneOptionIcon,
                      { backgroundColor: "#111" },
                    ]}>
                    <Ionicons name='map-outline' size={20} color='#fff' />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneOptionTitle}>Set on map</Text>
                    <Text style={styles.zoneOptionSub}>
                      Pin your exact work area manually
                    </Text>
                  </View>
                  <Ionicons name='chevron-forward' size={18} color='#CCC' />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── VEHICLE TAB ── */}
          {activeTab === "vehicle" && (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 80,
              }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}>
                <Ionicons name='car-outline' size={40} color='#999' />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: "#111",
                  marginBottom: 8,
                }}>
                Coming Soon
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#888",
                  textAlign: "center",
                  paddingHorizontal: 40,
                }}>
                Vehicle management will be available in a future update.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast visible={showToast} />
    </>
  );
}
// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  topBarTitle: { fontSize: 17, fontWeight: "800", color: "#111" },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: { borderBottomColor: "#111" },
  tabLabel: { fontSize: 12, color: "#999", fontWeight: "600" },
  tabLabelActive: { color: "#111" },

  avatarSection: { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#294190",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarHint: { fontSize: 12, color: "#999", marginTop: 8 },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111",
    marginBottom: 14,
  },

  fieldWrapper: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  inputDisabled: { backgroundColor: "#F3F4F6", opacity: 0.7 },
  input: { flex: 1, fontSize: 15, color: "#111" },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  toggleLabel: { fontSize: 14, color: "#111", fontWeight: "500" },

  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  genderBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  genderBtnText: { fontSize: 14, fontWeight: "600", color: "#666" },
  genderBtnTextActive: { color: "#fff" },

  saveBtn: {
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Zone tab
  zoneHint: {
    fontSize: 13,
    color: "#888",
    lineHeight: 19,
    marginBottom: 16,
  },
  zoneCurrentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
  },
  zoneIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#294190",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneCurrentLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#294190",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  zoneCurrentValue: { fontSize: 14, fontWeight: "600", color: "#111" },

  zoneOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  zoneOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#294190",
    alignItems: "center",
    justifyContent: "center",
  },
  zoneOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    marginBottom: 2,
  },
  zoneOptionSub: { fontSize: 12, color: "#888" },
  optionDivider: { height: 1, backgroundColor: "#F5F5F5", marginVertical: 4 },

  toast: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
