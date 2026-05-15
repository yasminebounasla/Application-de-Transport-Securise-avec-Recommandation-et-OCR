import { Stack, router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LocationProvider } from '../context/LocationContext';
import { RideProvider } from '../context/RideContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import NotifToast from '../components/NotifToast';
import '../global.css';
import ReminderModal from './shared/ReminderModel';

const REANIMATED_INLINE_STYLE_WARNING =
  "It looks like you might be using shared value's .value inside reanimated inline style.";

const reanimatedStacktraceEnabled =
  process.env.EXPO_PUBLIC_REANIMATED_STACKTRACE === '1' ||
  process.env.EXPO_PUBLIC_REANIMATED_STACKTRACE === 'true';

// Reanimated "strict" warnings can be noisy when coming from 3rd-party components.
// Default: keep warnings/errors, but disable strict-mode diagnostics like ".value inside inline style".
// Debug: set `EXPO_PUBLIC_REANIMATED_STACKTRACE=1` to enable strict + print a JS stack when this warning happens.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: reanimatedStacktraceEnabled,
});

if (__DEV__ && reanimatedStacktraceEnabled) {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    try {
      const first = args[0];
      if (typeof first === 'string' && first.includes(REANIMATED_INLINE_STYLE_WARNING)) {
        const stack = new Error('Reanimated warning stacktrace').stack;
        originalWarn(...args);
        if (stack) originalWarn(stack);
        return;
      }
    } catch {
      // fall through
    }
    originalWarn(...args);
  };
}

function ToastManager() {
  const { currentToast, hideToast } = useNotifications();
  const handlePress = () => {
    hideToast();
    router.push('/shared/NotificationsScreen' as any);
  };
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999 }} pointerEvents={currentToast ? 'box-none' : 'none'}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.95}>
        <NotifToast toast={currentToast} onHide={hideToast} />
      </TouchableOpacity>
    </View>
  );
}

function AppContent() {
const { initialLoading, loading, isAuthenticated } = useAuth();
  console.log('AppContent render — loading:', loading, 'isAuthenticated:', isAuthenticated);
if (initialLoading) return null;



  return (
    <NotificationProvider>
      <LocationProvider>
        <RideProvider>
          <SafeAreaProvider>
            <View style={{ flex: 1 }}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="splash" options={{ headerShown: false }} />
                <Stack.Screen name="home" options={{ headerShown: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="(driverTabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(passengerTabs)" options={{ headerShown: false }} />
                <Stack.Screen name="driver" options={{ headerShown: false }} />
                <Stack.Screen name="passenger" options={{ headerShown: false }} />
                <Stack.Screen name="shared/MapScreen" options={{ title: 'Map' }} />
                
              </Stack>
              <ToastManager />
              {isAuthenticated && <ReminderModal />}
            </View>
          </SafeAreaProvider>
        </RideProvider>
      </LocationProvider>
    </NotificationProvider>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
