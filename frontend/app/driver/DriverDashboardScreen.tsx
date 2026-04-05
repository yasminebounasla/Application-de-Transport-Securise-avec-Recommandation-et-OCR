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
import { MaterialIcons } from '@expo/vector-icons';
import api from '../../services/api';

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

type DonutTick = {
  key: string;
  color: string;
  angle: number;
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

function formatMoney(value: number) {
  return `${Math.round(value)} DZD`;
}

function LineChartCard({
  title,
  subtitle,
  points,
  valueKey,
  formatValue,
  lineColor,
}: {
  title: string;
  subtitle: string;
  points: MonthlyPoint[];
  valueKey: 'requests' | 'earnings';
  formatValue: (value: number) => string;
  lineColor: string;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, width - 72);
  const chartHeight = 170;
  const graphHeight = 110;
  const values = points.map((point) => point[valueKey]);
  const maxValue = Math.max(...values, 1);
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;

  const plotted = points.map((point, index) => {
    const value = point[valueKey];
    const x = index * stepX;
    const y = graphHeight - (value / maxValue) * graphHeight;
    return { ...point, value, x, y };
  });

  return (
    <View style={styles.graphCard}>
      <Text style={styles.graphTitle}>{title}</Text>
      <Text style={styles.graphSubtitle}>{subtitle}</Text>

      <View style={[styles.chartArea, { height: chartHeight }]}>
        {[0, 1, 2, 3].map((line) => (
          <View
            key={line}
            style={[
              styles.gridLine,
              { top: (graphHeight / 3) * line + 12 },
            ]}
          />
        ))}

        {plotted.slice(0, -1).map((point, index) => {
          const next = plotted[index + 1];
          const dx = next.x - point.x;
          const dy = next.y - point.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const centerX = point.x + dx / 2;
          const centerY = point.y + dy / 2;

          return (
            <View
              key={`${point.key}-segment`}
              style={[
                styles.lineSegment,
                {
                  width: length,
                  backgroundColor: lineColor,
                  left: centerX - length / 2 + 12,
                  top: centerY + 22,
                  transform: [{ rotateZ: `${angle}rad` }],
                },
              ]}
            />
          );
        })}

        {plotted.map((point) => (
          <View key={point.key}>
            <Text style={[styles.pointValue, { left: point.x - 8 }]}>{formatValue(point.value)}</Text>
            <View
              style={[
                styles.pointDot,
                {
                  left: point.x + 7,
                  top: point.y + 16,
                  backgroundColor: lineColor,
                },
              ]}
            />
            <Text style={[styles.pointLabel, { left: point.x - 18 }]}>{point.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PreferenceRing({
  preferences,
}: {
  preferences: PreferencePoint[];
}) {
  const total = preferences.reduce((sum, item) => sum + item.value, 0);
  const ringSegments = preferences.length > 0 ? preferences : [{ key: 'none', label: 'No preferences yet', value: 1, color: '#CBD5E1' }];
  const ringTicks = useMemo(() => {
    const tickCount = 180;
    let cursor = -90;
    const ticks: DonutTick[] = [];
    let assignedTicks = 0;
    const remaining = tickCount;

    ringSegments.forEach((item, index) => {
      const share = total > 0 ? item.value / total : 1 / ringSegments.length;
      const rawTicks = Math.max(8, Math.round(share * remaining));
      const safeTicks = index === ringSegments.length - 1
        ? Math.max(8, remaining - assignedTicks)
        : rawTicks;

      for (let step = 0; step < safeTicks; step += 1) {
        ticks.push({
          key: `${item.key}-${step}`,
          color: item.color,
          angle: cursor + step * (360 / tickCount),
        });
      }

      assignedTicks += safeTicks;
      cursor += safeTicks * (360 / tickCount);
    });

    return ticks;
  }, [ringSegments, total]);

  return (
    <View style={styles.prefCard}>
      <Text style={styles.graphTitle}>Passenger preferences</Text>
      <Text style={styles.graphSubtitle}>Most selected preferences from passengers who chose this driver</Text>

      <View style={styles.ringSection}>
        <View style={styles.ringOuter}>
          <View style={styles.ringSegmentsOverlay}>
            {ringTicks.map((tick) => (
              <View
                key={tick.key}
                style={[
                  styles.ringTickWrap,
                  { transform: [{ rotate: `${tick.angle}deg` }] },
                ]}
              >
                <View style={[styles.ringTick, { backgroundColor: tick.color }]} />
              </View>
            ))}
          </View>
          <View style={styles.ringInner}>
            <Text style={styles.ringCenterValue}>{total}</Text>
            <Text style={styles.ringCenterLabel}>Total prefs</Text>
          </View>
        </View>

        <View style={styles.preferenceLegend}>
          {ringSegments.map((item) => (
            <View key={item.key} style={styles.preferenceRow}>
              <View style={[styles.preferenceColor, { backgroundColor: item.color }]} />
              <Text style={styles.preferenceLabel}>{item.label}</Text>
              <Text style={styles.preferenceValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function DriverDashboardScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await api.get('/drivers/dashboard/analytics');
      setAnalytics(response?.data?.data || null);
    } catch (error) {
      console.error('Failed to load driver dashboard analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const chartPoints = useMemo(() => (analytics?.monthly || []).slice(-6), [analytics?.monthly]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(); }} tintColor="#111" />
      }
    >
      <View style={styles.headerCard}>
        <Text style={styles.headerEyebrow}>Driver business</Text>
        <Text style={styles.headerTitle}>Dashboard analytics</Text>
        <Text style={styles.headerText}>
          Follow your monthly requests, your earnings, and the preferences passengers most often bring with them.
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <MaterialIcons name="payments" size={18} color="#16A34A" />
          <Text style={styles.summaryValue}>{formatMoney(analytics?.summary.totalEarnings || 0)}</Text>
          <Text style={styles.summaryLabel}>Total earnings</Text>
        </View>
        <View style={styles.summaryCard}>
          <MaterialIcons name="directions-car" size={18} color="#2563EB" />
          <Text style={styles.summaryValue}>{analytics?.summary.completedTrips || 0}</Text>
          <Text style={styles.summaryLabel}>Completed trips</Text>
        </View>
      </View>

      <LineChartCard
        title="Trips requested per month"
        subtitle="Monthly requests sent or assigned to this driver"
        points={chartPoints}
        valueKey="requests"
        formatValue={(value) => String(value)}
        lineColor="#3B82F6"
      />

      <LineChartCard
        title="Money earned per month"
        subtitle="Monthly earnings from completed trips"
        points={chartPoints}
        valueKey="earnings"
        formatValue={(value) => `${Math.round(value)}`}
        lineColor="#F59E0B"
      />

      <PreferenceRing preferences={analytics?.preferences || []} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060B16',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#060B16',
  },
  headerCard: {
    backgroundColor: '#0B1220',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#182235',
  },
  headerEyebrow: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  headerText: {
    color: '#AAB6C8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#0B1220',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#182235',
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
  },
  summaryLabel: {
    color: '#8FA1B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  graphCard: {
    backgroundColor: '#060B16',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#182235',
  },
  graphTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  graphSubtitle: {
    color: '#8FA1B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  chartArea: {
    marginTop: 16,
    position: 'relative',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  gridLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderTopWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
  },
  pointDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#060B16',
  },
  pointValue: {
    position: 'absolute',
    top: 0,
    color: '#D8E0EA',
    fontSize: 11,
    fontWeight: '800',
    width: 48,
    textAlign: 'center',
  },
  pointLabel: {
    position: 'absolute',
    top: 144,
    color: '#8FA1B8',
    fontSize: 11,
    fontWeight: '700',
    width: 72,
    textAlign: 'center',
  },
  prefCard: {
    backgroundColor: '#060B16',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#182235',
  },
  ringSection: {
    alignItems: 'center',
    marginTop: 18,
  },
  ringOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringSegmentsOverlay: {
    position: 'absolute',
    inset: 0,
  },
  ringTickWrap: {
    position: 'absolute',
    top: 0,
    left: 90,
    width: 2,
    height: 180,
    alignItems: 'center',
  },
  ringTick: {
    marginTop: -8,
    width: 18,
    height: 18,
    borderRadius: 0,
  },
  ringInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#060B16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenterValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  ringCenterLabel: {
    color: '#8FA1B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  preferenceLegend: {
    width: '100%',
    marginTop: 22,
    gap: 10,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  preferenceLabel: {
    flex: 1,
    color: '#D8E0EA',
    fontSize: 14,
    fontWeight: '700',
  },
  preferenceValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
