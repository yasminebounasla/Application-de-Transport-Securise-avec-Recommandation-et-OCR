import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  COUNTRY_PHONE_OPTIONS,
  getCountryPhoneOption,
} from "../utils/phoneNumber";

type Props = {
  value: string;
  onChange: (countryCode: string) => void;
  hasError?: boolean;
};

export default function CountryCodePicker({
  value,
  onChange,
  hasError = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const selectedCountry = useMemo(() => getCountryPhoneOption(value), [value]);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.trigger, hasError && styles.triggerError]}
        onPress={() => setVisible(true)}>
        <Text style={styles.flag}>{selectedCountry.flag}</Text>
        <Text style={styles.code} numberOfLines={1}>
          {selectedCountry.dialCode}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>Choose country code</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <MaterialIcons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={COUNTRY_PHONE_OPTIONS}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCountry.code;
                return (
                  <TouchableOpacity
                    style={[styles.item, isSelected && styles.itemSelected]}
                    onPress={() => {
                      onChange(item.code);
                      setVisible(false);
                    }}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemFlag}>{item.flag}</Text>
                      <View>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemCode}>{item.dialCode}</Text>
                      </View>
                    </View>
                    {isSelected ? (
                      <MaterialIcons name="check-circle" size={20} color="#111827" />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 124,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  triggerError: {
    borderColor: "#F87171",
  },
  flag: {
    fontSize: 18,
  },
  code: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  item: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
  },
  itemSelected: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemFlag: {
    fontSize: 20,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  itemCode: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
  },
});
