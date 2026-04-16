import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useRide } from "../../context/RideContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

type ActivityStats = {
  total: number;
  completed: number;
  accepted: number;
  cancelled: number;
  completionRate: number;
};

type DashboardSummary = {
  totalEarnings: number;
  completedTrips: number;
  acceptedTrips: number;
  cancelledTrips: number;
};

type DriverActivityItem = {
  rideId: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  startAddress?: string;
  endAddress?: string;
  depart?: string;
  destination?: string;
};

type WeekPoint = {
  key: string;
  label: string;
  total: number;
  completed: number;
};

type MonthDayPoint = {
  key: string;
  dayNumber?: number;
  total: number;
  completed: number;
  isPlaceholder: boolean;
  isPast: boolean;
  isBeforeAccount: boolean;
};

type WeekPeriod = {
  key: string;
  title: string;
  subtitle: string;
  total: number;
  completed: number;
  bestLabel: string;
  bestValue: number;
  points: WeekPoint[];
  hasProgress: boolean;
};

type MonthPeriod = {
  key: string;
  title: string;
  subtitle: string;
  total: number;
  completed: number;
  bestLabel: string;
  bestValue: number;
  points: MonthDayPoint[];
  monthLabel: string;
  hasProgress: boolean;
};

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function getShortDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}

function formatShortRangeDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const diff = next.getDay();
  next.setDate(next.getDate() - diff);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

// FIX: Use only createdAt to bucket rides — avoids new drivers seeing
// phantom activity caused by updatedAt falling in the current week.
function getRideActivityDate(ride: DriverActivityItem) {
  return ride.createdAt || null;
}

function buildWeekPeriods(
  rides: DriverActivityItem[],
  accountCreatedAt?: string | null,
): WeekPeriod[] {
  const today = startOfDay(new Date());
  const accountStart = accountCreatedAt
    ? startOfDay(new Date(accountCreatedAt))
    : today;
  const currentWeekStart = startOfWeek(today);
  const firstWeekStart = startOfWeek(accountStart);
  const totalWeeks = Math.max(
    1,
    Math.floor(
      (currentWeekStart.getTime() - firstWeekStart.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ) + 1,
  );

  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekStart = addDays(startOfWeek(today), -(7 * index));
    const weekEnd = addDays(weekStart, 6);

    const points = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(weekStart, dayIndex);
      return {
        key: date.toISOString().slice(0, 10),
        label: getShortDayLabel(date),
        total: 0,
        completed: 0,
      };
    });

    rides.forEach((ride) => {
      const activityDate = getRideActivityDate(ride);
      if (!activityDate) return;
      const key = new Date(activityDate).toISOString().slice(0, 10);
      const point = points.find((item) => item.key === key);
      if (!point) return;

      point.total += 1;
      if (ride.status === "COMPLETED") point.completed += 1;
    });

    const total = points.reduce((sum, point) => sum + point.total, 0);
    const completed = points.reduce((sum, point) => sum + point.completed, 0);
    const bestPoint = points.reduce(
      (best, point) => (point.total > best.total ? point : best),
      points[0],
    );
    const hasProgress = total > 0;

    return {
      key: `week-${index}`,
      title:
        index === 0
          ? "Last 7 days"
          : index === 1
            ? "1 week ago"
            : `${index} weeks ago`,
      subtitle: `${formatShortRangeDate(weekStart)} - ${formatShortRangeDate(weekEnd)}`,
      total,
      completed,
      bestLabel: hasProgress ? bestPoint.label : "-",
      bestValue: hasProgress ? bestPoint.total : 0,
      points,
      hasProgress,
    };
  });
}

function buildMonthPeriods(
  rides: DriverActivityItem[],
  accountCreatedAt?: string | null,
): MonthPeriod[] {
  const today = startOfDay(new Date());
  const accountStart = accountCreatedAt
    ? startOfDay(new Date(accountCreatedAt))
    : today;
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const accountMonthStart = new Date(
    accountStart.getFullYear(),
    accountStart.getMonth(),
    1,
  );
  const totalMonths = Math.max(
    1,
    (currentMonthStart.getFullYear() - accountMonthStart.getFullYear()) * 12 +
      (currentMonthStart.getMonth() - accountMonthStart.getMonth()) +
      1,
  );

  return Array.from({ length: totalMonths }, (_, index) => {
    const monthStart = addMonths(
      new Date(today.getFullYear(), today.getMonth(), 1),
      -index,
    );
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (monthStart.getDay() + 6) % 7;
    const points: MonthDayPoint[] = [];

    for (let i = 0; i < offset; i += 1) {
      points.push({
        key: `empty-start-${index}-${i}`,
        total: 0,
        completed: 0,
        isPlaceholder: true,
        isPast: false,
        isBeforeAccount: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayDate = startOfDay(new Date(year, month, day));
      points.push({
        key: `${year}-${month + 1}-${day}`,
        dayNumber: day,
        total: 0,
        completed: 0,
        isPlaceholder: false,
        isPast: dayDate.getTime() < today.getTime(),
        isBeforeAccount: dayDate.getTime() < accountStart.getTime(),
      });
    }

    while (points.length % 7 !== 0) {
      points.push({
        key: `empty-end-${index}-${points.length}`,
        total: 0,
        completed: 0,
        isPlaceholder: true,
        isPast: false,
        isBeforeAccount: false,
      });
    }

    rides.forEach((ride) => {
      const activityDate = getRideActivityDate(ride);
      if (!activityDate) return;
      const parsed = new Date(activityDate);
      if (parsed.getFullYear() !== year || parsed.getMonth() !== month) return;

      const key = `${year}-${month + 1}-${parsed.getDate()}`;
      const point = points.find((item) => item.key === key);
      if (!point) return;

      point.total += 1;
      if (ride.status === "COMPLETED") point.completed += 1;
    });

    const realDays = points.filter(
      (point) => !point.isPlaceholder && !point.isBeforeAccount,
    );
    const total = realDays.reduce((sum, point) => sum + point.total, 0);
    const completed = realDays.reduce((sum, point) => sum + point.completed, 0);
    const bestPoint = realDays.reduce(
      (best, point) => (point.total > best.total ? point : best),
      realDays[0] || { dayNumber: 0, total: 0, completed: 0 },
    );
    const hasProgress = total > 0;

    return {
      key: `month-${index}`,
      title:
        index === 0
          ? "This month"
          : index === 1
            ? "1 month ago"
            : `${index} months ago`,
      subtitle: monthStart.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      total,
      completed,
      bestLabel:
        hasProgress && bestPoint.dayNumber ? `Day ${bestPoint.dayNumber}` : "-",
      bestValue: hasProgress ? bestPoint.total || 0 : 0,
      points,
      monthLabel: monthStart.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      hasProgress,
    };
  });
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <View style={styles.heroStat}>
      <View style={[styles.heroStatDot, { backgroundColor: accent }]} />
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function WeeklyBar({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const animatedHeight = useRef(new Animated.Value(10)).current;
  const targetHeight =
    maxValue > 0 ? Math.max(16, (value / maxValue) * 112) : 16;

  useEffect(() => {
    Animated.spring(animatedHeight, {
      toValue: targetHeight,
      friction: 7,
      tension: 46,
      useNativeDriver: false,
    }).start();
  }, [animatedHeight, targetHeight]);

  return (
    <View style={styles.weekBarCol}>
      <Text style={styles.weekBarValue}>{value}</Text>
      <View style={styles.weekBarTrack}>
        <Animated.View
          style={[
            styles.weekBarFill,
            { height: animatedHeight, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.weekBarLabel}>{label}</Text>
    </View>
  );
}

function CalendarDay({ item }: { item: MonthDayPoint }) {
  if (item.isPlaceholder) return <View style={styles.calendarCell} />;

  const hasCompleted = item.completed > 0;
  const hasActivity = item.total > 0;
  const showGrayPast = item.isPast || item.isBeforeAccount;

  return (
    <View style={styles.calendarCell}>
      <View
        style={[
          styles.calendarCircle,
          showGrayPast && styles.calendarCirclePast,
          hasCompleted && styles.calendarCircleCompleted,
          !hasCompleted && hasActivity && styles.calendarCircleActive,
        ]}>
        <Text
          style={[
            styles.calendarDayNumber,
            showGrayPast && styles.calendarDayNumberPast,
            (hasCompleted || hasActivity) && styles.calendarDayNumberColored,
          ]}>
          {item.dayNumber}
        </Text>
      </View>
    </View>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  variant = "light",
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  variant?: "light" | "dark" | "muted";
  onPress: () => void;
}) {
  const dark = variant === "dark";
  const muted = variant === "muted";

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[
        styles.actionCard,
        dark && styles.actionCardDark,
        muted && styles.actionCardMuted,
      ]}>
      <View
        style={[
          styles.actionIconWrap,
          dark && styles.actionIconWrapDark,
          muted && styles.actionIconWrapMuted,
        ]}>
        <MaterialIcons
          name={icon}
          size={20}
          color={dark ? "#fff" : muted ? "#8A6516" : "#111"}
        />
      </View>
      <View style={styles.actionTextWrap}>
        <Text
          style={[
            styles.actionTitle,
            dark && styles.actionTitleDark,
            muted && styles.actionTitleMuted,
          ]}>
          {title}
        </Text>
        <Text
          style={[
            styles.actionSubtitle,
            dark && styles.actionSubtitleDark,
            muted && styles.actionSubtitleMuted,
          ]}>
          {subtitle}
        </Text>
      </View>
      <MaterialIcons
        name='arrow-forward-ios'
        size={16}
        color={dark ? "#fff" : muted ? "#8A6516" : "#111"}
      />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();
  const { currentRide, getDriverActiveRide } = useRide();
  const [rides, setRides] = useState<DriverActivityItem[]>([]);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(
    (user as any)?.createdAt || null,
  );
  const [periodMode, setPeriodMode] = useState<"weeks" | "months">("weeks");
  const [displayIndex, setDisplayIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary>({
    totalEarnings: 0,
    completedTrips: 0,
    acceptedTrips: 0,
    cancelledTrips: 0,
  });
  const [activityStats, setActivityStats] = useState<ActivityStats>({
    total: 0,
    completed: 0,
    accepted: 0,
    cancelled: 0,
    completionRate: 0,
  });

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroLift = useRef(new Animated.Value(18)).current;
  const dashboardFade = useRef(new Animated.Value(0)).current;
  const dashboardLift = useRef(new Animated.Value(22)).current;
  const statusPulse = useRef(new Animated.Value(1)).current;
  const periodContentFade = useRef(new Animated.Value(1)).current;
  const periodListRef = useRef<FlatList<WeekPeriod | MonthPeriod> | null>(null);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await api.get(`/rides/activity/driver/${user.id}`);
      const driverRides = response?.data?.data || [];
      const completed = driverRides.filter(
        (ride: DriverActivityItem) => ride.status === "COMPLETED",
      ).length;
      const accepted = driverRides.filter((ride: DriverActivityItem) =>
        ["ACCEPTED", "IN_PROGRESS"].includes(ride.status),
      ).length;
      const cancelled = driverRides.filter((ride: DriverActivityItem) =>
        ["CANCELLED_BY_PASSENGER", "CANCELLED_BY_DRIVER"].includes(ride.status),
      ).length;
      const total = driverRides.length;
      const completionRate =
        total > 0 ? Math.round((completed / total) * 100) : 0;

      setRides(driverRides);
      setActivityStats({
        total,
        completed,
        accepted,
        cancelled,
        completionRate,
      });
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await logout();
        setRides([]);
        setActivityStats({
          total: 0,
          completed: 0,
          accepted: 0,
          cancelled: 0,
          completionRate: 0,
        });
        return;
      }

      console.error("Failed to load driver home activity stats:", error);
    }
  }, [logout, user?.id]);

  const loadDashboardSummary = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await api.get("/drivers/dashboard/analytics");
      const summary = response?.data?.data?.summary;
      if (summary) {
        setDashboardSummary(summary);
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await logout();
        setDashboardSummary({
          totalEarnings: 0,
          completedTrips: 0,
          acceptedTrips: 0,
          cancelledTrips: 0,
        });
        return;
      }

      console.error("Failed to load driver dashboard summary:", error);
    }
  }, [logout, user?.id]);

  const loadAccountCreatedAt = useCallback(async () => {
    if (!user?.id) return;
    if ((user as any)?.createdAt) {
      setAccountCreatedAt((user as any).createdAt);
      return;
    }

    try {
      const response = await api.get("/drivers/me");
      const driverData = response?.data?.data || response?.data || {};
      if (driverData?.createdAt) {
        setAccountCreatedAt(driverData.createdAt);
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await logout();
        setAccountCreatedAt(null);
        return;
      }

      console.error("Failed to load driver createdAt:", error);
    }
  }, [logout, user]);

  useFocusEffect(
    useCallback(() => {
      getDriverActiveRide();
      loadStats();
    }, [getDriverActiveRide, loadStats]),
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadDashboardSummary();
  }, [loadDashboardSummary]);

  useEffect(() => {
    loadAccountCreatedAt();
  }, [loadAccountCreatedAt]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(heroLift, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.spring(dashboardLift, {
            toValue: 0,
            friction: 8,
            tension: 48,
            useNativeDriver: true,
          }),
          Animated.timing(dashboardFade, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [dashboardFade, dashboardLift, heroFade, heroLift]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, {
          toValue: 1.18,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(statusPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [statusPulse]);

  const weekPeriods = useMemo(
    () => buildWeekPeriods(rides, accountCreatedAt),
    [accountCreatedAt, rides],
  );
  const monthPeriods = useMemo(
    () => buildMonthPeriods(rides, accountCreatedAt),
    [accountCreatedAt, rides],
  );
  const activePeriods = periodMode === "weeks" ? weekPeriods : monthPeriods;
  const displayPeriods = useMemo(
    () => [...activePeriods].reverse(),
    [activePeriods],
  );
  const latestIndex = Math.max(displayPeriods.length - 1, 0);
  const currentPeriod =
    displayPeriods[displayIndex] || displayPeriods[latestIndex];
  const pageWidth = Math.max(280, width - 68);

  useEffect(() => {
    setDisplayIndex(latestIndex);
  }, [latestIndex, periodMode]);

  useEffect(() => {
    periodListRef.current?.scrollToOffset({
      offset: latestIndex * pageWidth,
      animated: false,
    });
  }, [latestIndex, pageWidth, periodMode]);

  const animatePeriodInfo = useCallback(
    (nextIndex: number) => {
      periodContentFade.setValue(1);
      setDisplayIndex(nextIndex);
    },
    [periodContentFade],
  );

  const handlePeriodScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x / pageWidth,
      );
      if (nextIndex === displayIndex) return;
      animatePeriodInfo(nextIndex);
    },
    [animatePeriodInfo, displayIndex, pageWidth],
  );

  const switchMode = useCallback(
    (mode: "weeks" | "months") => {
      if (mode === periodMode) return;
      periodContentFade.setValue(1);
      setPeriodMode(mode);
    },
    [periodContentFade, periodMode],
  );

  const inProgressRide =
    currentRide && currentRide.status === "IN_PROGRESS" ? currentRide : null;
  const activeRide =
    currentRide && ["ACCEPTED", "IN_PROGRESS"].includes(currentRide.status)
      ? currentRide
      : null;

  const openInProgress = () => {
    if (!activeRide) return;
    router.push({
      pathname: "/driver/ActiveRideScreen",
      params: { trajetId: String(activeRide.id) },
    });
  };

  const driverName = user?.prenom || user?.firstName || "Driver";
  const periodCompletionPercent =
    currentPeriod && currentPeriod.total > 0
      ? Math.round((currentPeriod.completed / currentPeriod.total) * 100)
      : 0;
  const completedCount = currentPeriod?.completed || 0;
  const totalCount = currentPeriod?.total || 0;
  const progressState =
    totalCount === 0 || completedCount === 0
      ? "empty"
      : completedCount === totalCount
        ? "completed"
        : "activity";
  const progressTheme = {
    completed: {
      panel: "#ECFDF5",
      track: "#BBF7D0",
      fill: "#16A34A",
      value: "#166534",
      hint: "#166534",
      text: "You are finishing your rides well, keep the momentum going.",
    },
    activity: {
      panel: "#FFF7ED",
      track: "#FED7AA",
      fill: "#F59E0B",
      value: "#C2410C",
      hint: "#C2410C",
      text: "You are getting movement, one more push can turn it into completed trips.",
    },
    empty: {
      panel: "#F8FAFC",
      track: "#E5E7EB",
      fill: "#E5E7EB",
      value: "#94A3B8",
      hint: "#94A3B8",
      text: "A fresh ride can start this streak at any time.",
    },
  }[progressState];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadStats(),
        loadDashboardSummary(),
        loadAccountCreatedAt(),
        getDriverActiveRide(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    getDriverActiveRide,
    loadAccountCreatedAt,
    loadDashboardSummary,
    loadStats,
  ]);

  const openDriverDashboard = () => {
    router.push("/driver/DriverDashboardScreen" as any);
  };

  const isNewUser =
    accountCreatedAt &&
    (new Date().getTime() - new Date(accountCreatedAt).getTime()) /
      (1000 * 60 * 60) <
      1;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor='#111'
        />
      }>
      {/* ── HERO CARD: white background, dark text ── */}
      <Animated.View
        style={[{ opacity: heroFade, transform: [{ translateY: heroLift }] }]}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={openDriverDashboard}
          style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroContent}>
              <View style={styles.heroEyebrowRow}>
                <Text style={styles.eyebrow}>Driver dashboard</Text>
                <View style={styles.heroTapHint}>
                  <Text style={styles.heroTapHintText}>Tap to open</Text>
                  <MaterialIcons
                    name='arrow-forward'
                    size={14}
                    color='#F59E0B'
                  />
                </View>
              </View>
              <Text style={styles.heroTitle}>
                {isNewUser
                  ? `Welcome, ${driverName}`
                  : `Welcome back, ${driverName}`}
              </Text>
              <Text style={styles.heroSubtitle}>
                Track your rides, watch your performance, and jump back into
                work faster.
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <HeroStat
              label='Trips'
              value={activityStats.total}
              accent='#F59E0B'
            />
            <HeroStat
              label='Success'
              value={`${activityStats.completionRate}%`}
              accent='#8B5E3C'
            />
            <HeroStat
              label='Canceled'
              value={activityStats.cancelled}
              accent='#DC2626'
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.liveCard,
              activeRide ? styles.liveCardBusy : styles.liveCardIdle,
            ]}
            onPress={
              activeRide
                ? openInProgress
                : () => router.push("/(driverTabs)/MesTrajets" as any)
            }>
            <View style={styles.liveIconWrap}>
              <MaterialIcons
                name={activeRide ? "navigation" : "directions-car"}
                size={22}
                color='#111'
              />
            </View>
            <View style={styles.liveTextWrap}>
              <Text style={styles.liveTitle}>
                {activeRide
                  ? "Current trip ready to open"
                  : "No active trip right now"}
              </Text>
              <Text style={styles.liveSubtitle} numberOfLines={2}>
                {activeRide
                  ? `${activeRide.startAddress || activeRide.depart || "Departure"} -> ${activeRide.endAddress || activeRide.destination || "Destination"}`
                  : "Check incoming requests and keep your profile ready for the next trip."}
              </Text>
            </View>
            <MaterialIcons name='arrow-forward' size={20} color='#111' />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.dashboardCard,
          {
            opacity: dashboardFade,
            transform: [{ translateY: dashboardLift }],
          },
        ]}>
        <View style={styles.sectionHead}>
          <Animated.View style={{ flex: 1, opacity: periodContentFade }}>
            <Text style={styles.sectionTitle}>
              {currentPeriod?.title || "Recent activity"}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {currentPeriod?.subtitle || "Browse your driver activity"}
            </Text>
          </Animated.View>
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.modeChip,
                periodMode === "weeks" && styles.modeChipActive,
              ]}
              onPress={() => switchMode("weeks")}>
              <Text
                style={[
                  styles.modeChipText,
                  periodMode === "weeks" && styles.modeChipTextActive,
                ]}>
                Weeks
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.modeChip,
                periodMode === "months" && styles.modeChipActive,
              ]}
              onPress={() => switchMode("months")}>
              <Text
                style={[
                  styles.modeChipText,
                  periodMode === "months" && styles.modeChipTextActive,
                ]}>
                Months
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.swipeHint}>
          Swipe from left to right to go to older{" "}
          {periodMode === "weeks" ? "weeks" : "months"}.
        </Text>

        <Animated.View style={{ opacity: periodContentFade }}>
          <View style={styles.weekSummaryRow}>
            <View style={styles.weekSummaryCard}>
              <Text style={styles.weekSummaryEyebrow}>Best day</Text>
              <Text style={styles.weekSummaryValue}>
                {currentPeriod?.bestLabel || "-"}
              </Text>
              <Text style={styles.weekSummaryMeta}>
                {currentPeriod?.hasProgress
                  ? `${currentPeriod?.bestValue || 0} trips handled`
                  : "No progress yet"}
              </Text>
            </View>
            <View style={[styles.weekSummaryCard, styles.weekSummaryCardWarm]}>
              <Text style={styles.weekSummaryEyebrow}>
                {periodMode === "weeks" ? "Selected week" : "Selected month"}
              </Text>
              <Text style={styles.weekSummaryValue}>
                {currentPeriod?.total || 0}
              </Text>
              <Text style={styles.weekSummaryMeta}>total ride events</Text>
            </View>
          </View>
        </Animated.View>

        <FlatList
          ref={periodListRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={displayPeriods}
          keyExtractor={(item) => item.key}
          onMomentumScrollEnd={handlePeriodScrollEnd}
          getItemLayout={(_, index) => ({
            length: pageWidth,
            offset: pageWidth * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={[styles.periodPage, { width: pageWidth }]}>
              {periodMode === "weeks" ? (
                <View style={styles.chartWrap}>
                  {(item as WeekPeriod).points.map((point) => {
                    const maxValue = Math.max(
                      ...(item as WeekPeriod).points.map(
                        (entry) => entry.total,
                      ),
                      1,
                    );
                    return (
                      <WeeklyBar
                        key={point.key}
                        label={point.label}
                        value={point.total}
                        maxValue={maxValue}
                        color={
                          point.total === 0
                            ? "#D4D4D4"
                            : point.completed > 0
                              ? "#16A34A"
                              : "#F59E0B"
                        }
                      />
                    );
                  })}
                </View>
              ) : (
                <View style={styles.calendarWrap}>
                  <View style={styles.calendarWeekdayRow}>
                    {WEEKDAY_LETTERS.map((day, index) => (
                      <Text
                        key={`${day}-${index}`}
                        style={styles.calendarWeekdayText}>
                        {day}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.calendarGrid}>
                    {(item as MonthPeriod).points.map((point) => (
                      <CalendarDay key={point.key} item={point} />
                    ))}
                  </View>
                  <Text style={styles.calendarMonthLabel}>
                    {(item as MonthPeriod).monthLabel}
                  </Text>
                </View>
              )}
            </View>
          )}
        />

        <Animated.View style={{ opacity: periodContentFade }}>
          <View
            style={[
              styles.progressPanel,
              { backgroundColor: progressTheme.panel },
            ]}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                {periodMode === "weeks"
                  ? "Weekly completion rhythm"
                  : "Monthly completion rhythm"}
              </Text>
              <Text
                style={[styles.progressValue, { color: progressTheme.value }]}>
                {completedCount}/{Math.max(totalCount, 1)}
              </Text>
            </View>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: progressTheme.track },
              ]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(progressState === "empty" ? 0 : 10, periodCompletionPercent)}%`,
                    backgroundColor: progressTheme.fill,
                  },
                ]}
              />
            </View>
            <View style={styles.progressLegend}>
              <View style={styles.progressLegendRow}>
                <View
                  style={[
                    styles.progressLegendDot,
                    { backgroundColor: progressTheme.fill },
                  ]}
                />
                <Text
                  style={[
                    styles.progressLegendText,
                    { color: progressTheme.hint },
                  ]}>
                  {progressTheme.text}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      <View style={styles.earningsCard}>
        <View style={styles.earningsHeader}>
          <View>
            <Text style={styles.earningsTitle}>Total money earned</Text>
            <Text style={styles.earningsSubtitle}>
              From all completed trips
            </Text>
          </View>
          <View style={styles.earningsIconWrap}>
            <MaterialIcons name='payments' size={22} color='#16A34A' />
          </View>
        </View>
        <Text style={styles.earningsValue}>
          {Math.round(dashboardSummary.totalEarnings)} DZD
        </Text>
      </View>

      {/* ── QUICK ACTIONS: Profile setup removed ── */}
      <View style={styles.quickSection}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <Text style={styles.sectionSubtitle}>
          Shortcuts that drivers usually need most
        </Text>

        <ActionCard
          title='My feedbacks'
          subtitle='Open your ratings and passenger comments in one tap.'
          icon='star-rate'
          variant='muted'
          onPress={() => router.push("../driver/MyFeedbacksScreen")}
        />

        <ActionCard
          title={inProgressRide ? "Open live trip" : "View activity"}
          subtitle={
            inProgressRide
              ? "Jump back into navigation and ride details."
              : "Open requests, accepted rides, and completed history."
          }
          icon={inProgressRide ? "alt-route" : "history"}
          onPress={() =>
            inProgressRide
              ? openInProgress()
              : router.push("/(driverTabs)/Activity" as any)
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F7F5",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  // ── Hero card: now WHITE with dark text ──
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EFECE8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroContent: {
    flex: 1,
    paddingRight: 6,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eyebrow: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  heroTapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 6,
    marginLeft: "auto",
  },
  heroTapHintText: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: "#111", // dark text on white bg
    fontSize: 24,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "rgba(0,0,0,0.52)", // muted dark on white bg
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 240,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: 16,
  },
  heroStat: {
    flex: 1,
    backgroundColor: "#F5F5F5", // light surface on white card
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  heroStatDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  heroStatValue: {
    color: "#111", // dark on light surface
    fontSize: 22,
    fontWeight: "900",
  },
  heroStatLabel: {
    marginTop: 4,
    color: "rgba(0,0,0,0.5)",
    fontSize: 12,
    fontWeight: "700",
  },
  liveCard: {
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  liveCardBusy: {
    backgroundColor: "#FFF7ED",
  },
  liveCardIdle: {
    backgroundColor: "#EFECE8", // idle live card: dark chip inside white hero
  },
  liveIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E5E7EB" ,
    alignItems: "center",
    justifyContent: "center",
  },
  liveTextWrap: {
    flex: 1,
  },
  liveTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },
  liveSubtitle: {
    color: "rgba(0,0,0,0.52)",
    fontSize: 12,
    lineHeight: 17,
  },
  dashboardCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EFECE8",
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 19,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#666",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  modeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F5",
    borderRadius: 999,
    padding: 4,
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modeChipActive: {
    backgroundColor: "#111",
  },
  modeChipText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "900",
  },
  modeChipTextActive: {
    color: "#fff",
  },
  swipeHint: {
    marginTop: 12,
    color: "",
    fontSize: 12,
    fontWeight: "700",
  },
  weekSummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  weekSummaryCard: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: 18,
    padding: 12,
  },
  weekSummaryCardWarm: {
    backgroundColor: "#FFF7ED",
  },
  weekSummaryEyebrow: {
    color: "#666",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekSummaryValue: {
    color: "#111",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  weekSummaryMeta: {
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  periodPage: {
    paddingTop: 18,
    paddingRight: 8,
  },
  chartWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
    paddingBottom: 8,
  },
  weekBarCol: {
    flex: 1,
    alignItems: "center",
  },
  weekBarValue: {
    color: "#111",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
  },
  weekBarTrack: {
    width: "100%",
    height: 120,
    backgroundColor: "#F4F4F4",
    borderRadius: 18,
    justifyContent: "flex-end",
    overflow: "hidden",
    padding: 6,
  },
  weekBarFill: {
    width: "100%",
    borderRadius: 14,
    minHeight: 18,
  },
  weekBarLabel: {
    marginTop: 10,
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarWrap: {
    paddingTop: 2,
  },
  calendarWeekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  calendarWeekdayText: {
    width: "14.285%",
    textAlign: "center",
    color: "#7A7A7A",
    fontSize: 11,
    fontWeight: "800",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.285%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  calendarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCirclePast: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  calendarCircleActive: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F59E0B",
  },
  calendarCircleCompleted: {
    backgroundColor: "#DCFCE7",
    borderColor: "#16A34A",
  },
  calendarDayNumber: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "800",
  },
  calendarDayNumberPast: {
    color: "#6B7280",
  },
  calendarDayNumberColored: {
    color: "#111",
  },
  calendarMonthLabel: {
    marginTop: 6,
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  progressPanel: {
    marginTop: 20,
    backgroundColor: "#FFF7ED",
    borderRadius: 20,
    padding: 14,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressTitle: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },
  progressValue: {
    color: "#C2410C",
    fontSize: 13,
    fontWeight: "900",
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#FED7AA",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#F59E0B",
  },
  progressLegend: {
    marginTop: 10,
    gap: 8,
  },
  progressLegendRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  progressLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 3,
  },
  progressLegendText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  quickSection: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EFECE8",
  },
  earningsCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EFECE8",
    marginBottom: 8,
  },
  earningsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  earningsTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "900",
  },
  earningsSubtitle: {
    marginTop: 4,
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
  },
  earningsIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  earningsValue: {
    color: "#111",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 18,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  actionCardDark: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  actionCardMuted: {
    backgroundColor: "#FFF7E6",
    borderColor: "#F3DFC2",
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFE4B5",
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconWrapDark: {
    backgroundColor: "rgba(245,158,11,0.22)",
  },
  actionIconWrapMuted: {
    backgroundColor: "#F7D98A",
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },
  actionTitleDark: {
    color: "#fff",
  },
  actionTitleMuted: {
    color: "#1F2937",
  },
  actionSubtitle: {
    marginTop: 4,
    color: "#666",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  actionSubtitleDark: {
    color: "rgba(255,255,255,0.72)",
  },
  actionSubtitleMuted: {
    color: "#6B7280",
  },
});
