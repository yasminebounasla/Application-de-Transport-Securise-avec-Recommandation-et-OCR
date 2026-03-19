import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useRide } from '../../../context/RideContext';

// ── HELPERS ───────────────────────────────────────────────────────────────────
const formatDuration = (min: number) => {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};

const FALLBACK = '—';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  COMPLETED:              { label: 'Completed',          bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle' },
  PENDING:                { label: 'Pending',            bg: '#DBEAFE', color: '#1E40AF', icon: 'time'             },
  ACCEPTED:               { label: 'Accepted',           bg: '#DCFCE7', color: '#166534', icon: 'checkmark-circle' },
  IN_PROGRESS:            { label: 'In progress',        bg: '#FEF9C3', color: '#854D0E', icon: 'car-outline'      },
  CANCELLED_BY_PASSENGER: { label: 'Cancelled by you',   bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle'     },
  CANCELLED_BY_DRIVER:    { label: 'Cancelled by driver',bg: '#FFEDD5', color: '#9A3412', icon: 'close-circle'     },
};

// ── AVATAR ────────────────────────────────────────────────────────────────────
function getAvatarColor(sexe?: string) {
  const val = (sexe ?? '').toLowerCase().trim();
  if (val === 'f' || val === 'female' || val === 'femme' || val === 'woman')
    return { bg: '#fad0e2', text: '#BE185D' };
  return { bg: '#d3e4fa', text: '#1B72DA' };
}

function Avatar({ prenom, nom, sexe, size = 52 }: { prenom?: string; nom?: string; sexe?: string; size?: number }) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?';
  const colors   = getAvatarColor(sexe);
  return (
    <View style={[d.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg }]}>
      <Text style={[d.avatarText, { color: colors.text, fontSize: size * 0.3 }]}>{initials}</Text>
    </View>
  );
}

// ── INFO ROW ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, iconLib = 'ionicons' }: {
  icon: string; label: string; value: string; iconLib?: string;
}) {
  return (
    <View style={d.infoRow}>
      <View style={d.infoIcon}>
        {iconLib === 'material'
          ? <MaterialCommunityIcons name={icon as any} size={16} color="#9CA3AF" />
          : <Ionicons name={icon as any} size={16} color="#9CA3AF" />
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={d.infoLabel}>{label}</Text>
        <Text style={d.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── SECTION ───────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={d.section}>
      <Text style={d.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── SCREEN ────────────────────────────────────────────────────────────────────
export default function RideDetailsScreen() {
  const { user }                   = useAuth();
  const { acceptRide, rejectRide } = useRide();
  const { rideId }                 = useLocalSearchParams<{ rideId?: string }>();
  const id = useMemo(() => (rideId ? Number.parseInt(String(rideId), 10) : NaN), [rideId]);

  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState('');
  const [ride,                setRide]                = useState<any | null>(null);
  const [durationLabel,       setDurationLabel]       = useState<string>('...');
  const [cancelLoading,       setCancelLoading]       = useState(false);
  const [driverActionLoading, setDriverActionLoading] = useState<'accept' | 'reject' | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!Number.isFinite(id)) { setError('Invalid ID.'); setLoading(false); return; }
      try {
        setLoading(true); setError('');
        const res = await api.get(`/ridesDem/${id}`);
        setRide(res?.data?.data || null);
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Unable to load ride.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    let mounted = true;
    const { startLat, startLng, endLat, endLng } = ride || {};
    const coords = [startLat, startLng, endLat, endLng].map(Number);
    if (!coords.every(Number.isFinite)) { setDurationLabel(FALLBACK); return; }
    (async () => {
      try {
        const res = await api.post('/ride/estimate', {
          start: { latitude: coords[0], longitude: coords[1] },
          end:   { latitude: coords[2], longitude: coords[3] },
        });
        const min = Number(res?.data?.durationMin);
        if (mounted) setDurationLabel(Number.isFinite(min) ? formatDuration(min) : FALLBACK);
      } catch { if (mounted) setDurationLabel(FALLBACK); }
    })();
    return () => { mounted = false; };
  }, [ride?.startLat, ride?.startLng, ride?.endLat, ride?.endLng]);

  const isPassenger = user?.role === 'passenger';
  const isDriver    = user?.role === 'driver';
  const contact     = isPassenger ? ride?.driver : ride?.passenger;
  const rawStatus   = ride?.status || '';
  const cfg         = STATUS_CONFIG[rawStatus] || { label: rawStatus, bg: '#F3F4F6', color: '#6B7280', icon: 'ellipse' };

  const statusLabel = (() => {
    if (rawStatus === 'CANCELLED_BY_DRIVER')    return isPassenger ? 'Cancelled by driver' : 'Cancelled by you';
    if (rawStatus === 'CANCELLED_BY_PASSENGER') return isPassenger ? 'Cancelled by you'    : 'Cancelled by passenger';
    return cfg.label;
  })();

  const dateLabel    = ride?.dateDepart  ? new Date(ride.dateDepart).toLocaleDateString('en-GB',  { day: '2-digit', month: 'long', year: 'numeric' }) : FALLBACK;
  const createdLabel = ride?.createdAt   ? new Date(ride.createdAt).toLocaleString('en-GB')   : FALLBACK;
  const doneLabel    = ride?.completedAt ? new Date(ride.completedAt).toLocaleString('en-GB')  : FALLBACK;
  const start        = ride?.startAddress || ride?.depart      || FALLBACK;
  const end          = ride?.endAddress   || ride?.destination || FALLBACK;
  const price        = typeof ride?.prix === 'number' ? ride.prix : Number(ride?.prix) || 0;
  const contactName  = contact ? `${contact.prenom || ''} ${contact.nom || ''}`.trim() : FALLBACK;
  const contactPhone = contact?.numTel ? String(contact.numTel) : FALLBACK;

  const canCancel = isPassenger && ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(rawStatus);
  const canReview = isDriver    && rawStatus === 'PENDING';

  const handleCancel = () => {
    Alert.alert('Cancel ride?', 'The ride will be marked as cancelled.', [
      { text: 'Back', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: async () => {
        try {
          setCancelLoading(true);
          const res = await api.put(`/ridesDem/${id}/cancel`);
          setRide(res?.data?.data || null);
          Alert.alert('Done', 'Ride cancelled.');
        } catch (e: any) {
          Alert.alert('Error', e?.response?.data?.message || 'Unable to cancel.');
        } finally { setCancelLoading(false); }
      }},
    ]);
  };

  const handleDriverAction = (action: 'accept' | 'reject') => {
    const isAccept = action === 'accept';
    Alert.alert(
      isAccept ? 'Accept ride?' : 'Reject ride?',
      isAccept ? 'This ride will be assigned to you.' : 'This ride will be rejected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isAccept ? 'Accept' : 'Reject', style: isAccept ? 'default' : 'destructive', onPress: async () => {
          try {
            setDriverActionLoading(action);
            const updated = isAccept ? await acceptRide(id) : await rejectRide(id);
            setRide(updated || null);
            Alert.alert('Done', isAccept ? 'Ride accepted.' : 'Ride rejected.');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || `Failed to ${isAccept ? 'accept' : 'reject'}.`);
          } finally { setDriverActionLoading(null); }
        }},
      ]
    );
  };

  if (loading) return (
    <View style={d.center}>
      <Stack.Screen options={{ title: 'Details' }} />
      <ActivityIndicator size="large" color="#111" />
      <Text style={d.centerText}>Loading...</Text>
    </View>
  );

  if (error || !ride) return (
    <View style={d.center}>
      <Stack.Screen options={{ title: 'Details' }} />
      <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
      <Text style={d.errorMsg}>{error || 'Ride not found.'}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={d.container}>
      <Stack.Screen options={{ title: 'Ride details' }} />

      {/* ── HERO ── */}
      <View style={d.hero}>
        <View style={d.heroLeft}>
          <Avatar prenom={contact?.prenom} nom={contact?.nom} sexe={contact?.sexe} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={d.heroName} numberOfLines={1}>{contactName}</Text>
            <Text style={d.heroRole}>{isPassenger ? 'Driver' : 'Passenger'}</Text>
            {contactPhone !== FALLBACK && (
              <Text style={d.heroPhone}>{contactPhone}</Text>
            )}
          </View>
        </View>
        <View style={[d.statusChip, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
          <Text style={[d.statusChipText, { color: cfg.color }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* ── PRIX ── */}
      <View style={d.priceBar}>
        <Ionicons name="cash-outline" size={18} color="#065F46" />
        <Text style={d.priceLabel}>Price</Text>
        <Text style={d.priceValue}>{price.toFixed(2)} DA</Text>
      </View>

      {/* ── ROUTE ── */}
      <Section title="Route">
        <View style={d.routeBox}>
          <View style={d.routeRow}>
            <View style={[d.dot, { backgroundColor: '#22C55E' }]} />
            <View style={{ flex: 1 }}>
              <Text style={d.routeSmall}>From</Text>
              <Text style={d.routeAddr}>{start}</Text>
            </View>
          </View>
          <View style={d.routeLine} />
          <View style={d.routeRow}>
            <View style={[d.dot, { backgroundColor: '#EF4444' }]} />
            <View style={{ flex: 1 }}>
              <Text style={d.routeSmall}>To</Text>
              <Text style={d.routeAddr}>{end}</Text>
            </View>
          </View>
        </View>
      </Section>

      {/* ── INFOS ── */}
      <Section title="Details">
        <InfoRow icon="calendar-outline"  label="Date"           value={dateLabel}                          />
        <InfoRow icon="time-outline"      label="Time"           value={ride?.heureDepart || FALLBACK}      />
        <InfoRow icon="people-outline"    label="Seats"          value={String(ride?.placesDispo ?? FALLBACK)} />
        <InfoRow icon="timer-outline"     label="Est. duration"  value={durationLabel}                      />
      </Section>

      {/* ── TIMESTAMPS ── */}
      <Section title="Timeline">
        <InfoRow icon="add-circle-outline" label="Created"   value={createdLabel} />
        {(rawStatus === 'IN_PROGRESS' || rawStatus === 'COMPLETED') && (
          <InfoRow icon="play-circle-outline" label="Started" value={`${ride?.dateDepart ? new Date(ride.dateDepart).toLocaleDateString('en-GB') : ''} ${ride?.heureDepart || ''}`.trim() || FALLBACK} />
        )}
        {rawStatus === 'COMPLETED' && (
          <InfoRow icon="flag-outline" label="Completed" value={doneLabel} />
        )}
      </Section>

      {/* ── CANCEL (passager) ── */}
      {canCancel && (
        <View style={d.cancelBlock}>
          <Text style={d.cancelHint}>Need to cancel? You can cancel this ride below.</Text>
          <TouchableOpacity
            style={[d.btnCancel, cancelLoading && d.btnDisabled]}
            onPress={handleCancel}
            disabled={cancelLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={d.btnCancelText}>{cancelLoading ? 'Cancelling...' : 'Cancel this ride'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ACTIONS DRIVER ── */}
      {canReview && (
        <View style={d.driverActions}>
          <TouchableOpacity
            style={[d.btnOutline, !!driverActionLoading && d.btnDisabled]}
            onPress={() => handleDriverAction('reject')}
            disabled={!!driverActionLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color="#111" />
            <Text style={d.btnOutlineText}>{driverActionLoading === 'reject' ? 'Rejecting...' : 'Reject'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[d.btnPrimary, !!driverActionLoading && d.btnDisabled]}
            onPress={() => handleDriverAction('accept')}
            disabled={!!driverActionLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={d.btnPrimaryText}>{driverActionLoading === 'accept' ? 'Accepting...' : 'Accept'}</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const d = StyleSheet.create({
  container: { padding: 16, paddingBottom: 36, backgroundColor: '#F5F5F5', gap: 12 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, backgroundColor: '#F5F5F5' },
  centerText:{ color: '#666', fontSize: 14, fontWeight: '600' },
  errorMsg:  { color: '#B42318', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 8 },

  hero:      { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  heroLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar:    { alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontWeight: '800' },
  heroName:  { fontSize: 16, fontWeight: '800', color: '#111' },
  heroRole:  { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  heroPhone: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginTop: 1 },
  statusChip:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  priceBar:  { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  priceLabel:{ fontSize: 14, fontWeight: '600', color: '#065F46', flex: 1 },
  priceValue:{ fontSize: 18, fontWeight: '800', color: '#065F46' },

  section:     { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  infoIcon:  { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 1 },
  infoValue: { fontSize: 14, color: '#111', fontWeight: '600' },

  routeBox:  { gap: 4 },
  routeRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine: { width: 2, height: 16, backgroundColor: '#E5E7EB', marginLeft: 4, marginVertical: 2 },
  routeSmall:{ fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  routeAddr: { fontSize: 14, color: '#111', fontWeight: '600' },

  // Cancel block — discret, pas rouge agressif
  cancelBlock: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#F3F4F6', gap: 12,
  },
  cancelHint:    { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  btnCancel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  btnCancelText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  btnDisabled:   { opacity: 0.6 },

  driverActions:  { flexDirection: 'row', gap: 12 },
  btnOutline:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 2, borderColor: '#111', borderRadius: 14, paddingVertical: 15 },
  btnOutlineText: { color: '#111', fontSize: 14, fontWeight: '700' },
  btnPrimary:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#111', borderRadius: 14, paddingVertical: 15 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});