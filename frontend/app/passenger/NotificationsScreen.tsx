import { useNotifications } from '../../context/NotificationContext';
import { View, Text } from 'react-native';

export default function NotificationsScreen() {
    const { notifications } = useNotifications();
  return (
    <>
      <View style={{ position: 'absolute', top: 100, left: 20 }}>
        {notifications.map((notif, i) => (
            <View key={i} style={{ padding: 10, backgroundColor: '#fff', marginVertical: 5, borderRadius: 8 }}>
            <Text style={{ fontWeight: 'bold' }}>{notif.title}</Text>
            <Text>{notif.message}</Text>
            </View>
        ))}
       </View>
    </>
  );
}
