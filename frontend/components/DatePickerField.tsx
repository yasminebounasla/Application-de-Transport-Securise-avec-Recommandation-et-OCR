import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  value?: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  error?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

const parseYMD = (s?: string) => {
  if (!s) return new Date();
  const parts = s.split('-');
  if (parts.length !== 3) return new Date(s);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
};

const formatYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function DatePickerField({ value, onChange, placeholder = 'YYYY-MM-DD', icon = 'calendar-outline', error, minimumDate, maximumDate }: Props) {
  const [show, setShow] = useState(false);

  const display = value ? parseYMD(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : placeholder;

  const onChangeNative = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      onChange(formatYMD(selectedDate));
    }
  };

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShow(true)}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: error ? '#EF4444' : '#E5E7EB', paddingHorizontal: 14, height: 50 }}>
        <Ionicons name={icon} size={18} color={error ? '#EF4444' : '#888'} style={{ marginRight: 10 }} />
        <Text style={{ flex: 1, color: value ? '#111' : '#BBB', fontSize: 15 }}>{display}</Text>
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={value ? parseYMD(value) : new Date(1990, 0, 1)}
          mode='date'
          display='calendar'
          onChange={onChangeNative}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType='fade' visible={show} onRequestClose={() => setShow(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShow(false)}>
            <Pressable style={{ width: '86%', backgroundColor: '#fff', borderRadius: 12, padding: 12 }} onPress={() => {}}>
              <DateTimePicker
                value={value ? parseYMD(value) : new Date(1990, 0, 1)}
                mode='date'
                display='spinner'
                onChange={(_e, d) => { if (d) onChange(formatYMD(d)); }}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                style={{ width: '100%' }}
              />
              <TouchableOpacity onPress={() => setShow(false)} style={{ marginTop: 12, backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

    </View>
  );
}
