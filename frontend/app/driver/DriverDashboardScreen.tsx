import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {
  Path,
  Polyline,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
} from 'react-native-svg';
import api from '../../services/api';

// ─── Types ────────────────────────────────────────────────────
type MonthlyPoint = {
  key: string;
  label: string;
  requests: number;
  earnings: number;
};

type PreferencePoint = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type AnalyticsResponse = {
  summary: {
    totalEarnings: number;
    completedTrips: number;
    acceptedTrips: number;
    cancelledTrips: number;
  };
  monthly: MonthlyPoint[];
  preferences: PreferencePoint[];
};

// ─── Helpers ──────────────────────────────────────────────────
function formatMoney(v: number) {
  return `${Math.round(v).toLocaleString()} DZD`;
}

// ─── Custom SVG Icons ─────────────────────────────────────────
function IconMoney({ size = 20, color = '#16A34A' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <Path
        d="M12 7v1m0 8v1M9.5 10.5c0-.83.67-1.5 1.5-1.5h2a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h2c.83 0 1.5-.67 1.5-1.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconCar({ size = 20, color = '#2563EB' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Path
        d="M3 13h18v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z"
        stroke={color}
        strokeWidth="1.5"
      />
      <Circle cx="7.5" cy="17" r="1.5" fill={color} />
      <Circle cx="16.5" cy="17" r="1.5" fill={color} />
    </Svg>
  );
}

// ─── Line Chart ───────────────────────────────────────────────
function LineChartCard({
  title,
  subtitle,
  points,
  valueKey,
  lineColor,
  gradientId,
  accentBg,
  dotColor,
}: {
  title: string;
  subtitle: string;
  points: MonthlyPoint[];
  valueKey: 'requests' | 'earnings';
  lineColor: string;
  gradientId: string;
  accentBg: string;
  dotColor: string;
}) {
  const { width } = useWindowDimensions();
  const chartW = width - 64;
  const chartH = 100;
  const PAD_X = 10;
  const PAD_Y = 10;

  if (!points.length) return null;

  const values = points.map(p => p[valueKey]);
  const max = Math.max(...values, 1);
  const stepX =
    points.length > 1 ? (chartW - PAD_X * 2) / (points.length - 1) : chartW;

  const pts = points.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: chartH - PAD_Y - (p[valueKey] / max) * (chartH - PAD_Y * 2),
    label: p.label,
  }));

  const linePointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');

  const areaPath =
    `M${pts[0].x},${pts[0].y} ` +
    pts
      .slice(1)
      .map(p => `L${p.x},${p.y}`)
      .join(' ') +
    ` L${pts[pts.length - 1].x},${chartH} L${pts[0].x},${chartH} Z`;

  return (
    <View style={[styles.card, { backgroundColor: accentBg }]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{subtitle}</Text>

      <Svg
        width={chartW}
        height={chartH + 4}
        style={{ marginTop: 12 }}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {[0, 1, 2].map(i => (
          <Line
            key={i}
            x1={0}
            y1={PAD_Y + (i * (chartH - PAD_Y * 2)) / 2}
            x2={chartW}
            y2={PAD_Y + (i * (chartH - PAD_Y * 2)) / 2}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <Polyline
          points={linePointsStr}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={4} fill="white" />
            <Circle cx={p.x} cy={p.y} r={2.5} fill={dotColor} />
          </React.Fragment>
        ))}
      </Svg>

      {/* X-axis labels */}
      <View style={styles.axisRow}>
        {pts.map((p, i) => (
          <Text key={i} style={styles.axisLabel}>
            {points[i].label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Preference Bars ──────────────────────────────────────────
function PreferenceBars({
  preferences,
}: {
  preferences: PreferencePoint[];
}) {
  const total = preferences.reduce((s, i) => s + i.value, 0);
  if (!preferences.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: '#F5F3FF' }]}>
      <Text style={styles.cardTitle}>Passenger preferences</Text>
      <Text style={styles.cardSub}>Most selected by passengers</Text>

      <View style={{ marginTop: 16, gap: 12 }}>
        {preferences.map(p => {
          const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
          return (
            <View key={p.key}>
              <View style={styles.prefHeader}>
                <View style={styles.prefLabelRow}>
                  <View
                    style={[styles.prefDot, { backgroundColor: p.color }]}
                  />
                  <Text style={styles.prefName}>{p.label}</Text>
                </View>
                <Text style={styles.prefCount}>{p.value}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: p.color,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function DriverDashboardScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/drivers/dashboard/analytics');
      setAnalytics(res?.data?.data ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chartPoints = useMemo(
    () => (analytics?.monthly ?? []).slice(-6),
    [analytics]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      {/* ── Header ── */}
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Driver business</Text>
        <Text style={styles.headerTitle}>Dashboard analytics</Text>
        <Text style={styles.headerSub}>
          Track your earnings, trips and passenger behavior.
        </Text>
      </View>

      {/* ── Summary cards ── */}
      <View style={styles.row}>
        <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
          <View style={[styles.iconWrap, { backgroundColor: '#D1FAE5' }]}>
            <IconMoney size={18} color="#16A34A" />
          </View>
          <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
            {formatMoney(analytics?.summary.totalEarnings ?? 0)}
          </Text>
          <Text style={styles.summaryLabel}>Total earnings</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
          <View style={[styles.iconWrap, { backgroundColor: '#DBEAFE' }]}>
            <IconCar size={18} color="#2563EB" />
          </View>
          <Text style={[styles.summaryValue, { color: '#2563EB' }]}>
            {analytics?.summary.completedTrips ?? 0}
          </Text>
          <Text style={styles.summaryLabel}>Completed trips</Text>
        </View>
      </View>

      {/* ── Charts ── */}
      <LineChartCard
        title="Trips per month"
        subtitle="Requests over last 6 months"
        points={chartPoints}
        valueKey="requests"
        lineColor="#3B82F6"
        dotColor="#3B82F6"
        gradientId="blueGrad"
        accentBg="#EFF6FF"
      />

      <LineChartCard
        title="Earnings per month"
        subtitle="Revenue trend"
        points={chartPoints}
        valueKey="earnings"
        lineColor="#F59E0B"
        dotColor="#F59E0B"
        gradientId="amberGrad"
        accentBg="#FFFBEB"
      />

      {/* ── Preferences ── */}
      <PreferenceBars preferences={analytics?.preferences ?? []} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  // Header
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 0.5,
    borderColor: '#EEEEEE',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
    marginTop: 3,
  },
  headerSub: {
    fontSize: 13,
    color: '#888888',
    marginTop: 5,
    lineHeight: 18,
  },

  // Summary row
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
  },

  // Chart card
  card: {
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  cardSub: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  axisLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },

  // Preferences
  prefHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  prefLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  prefDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  prefName: {
    fontSize: 13,
    color: '#333333',
  },
  prefCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444444',
  },
  barTrack: {
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 3,
  },
  barFill: {
    height: 5,
    borderRadius: 3,
  },
});
