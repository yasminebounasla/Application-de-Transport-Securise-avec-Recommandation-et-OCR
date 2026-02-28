import { useNotifications } from '../../context/NotificationContext';
import { View, Text, TouchableOpacity } from 'react-native';


export default function HistoryScreen() {

  const { socket } = useNotifications();
  const testNotif = () => {
    if (socket && socket.connected) {
      console.log('✅ Socket connecté, id:', socket.id);
      alert('Socket connecté ! ID: ' + socket.id);
    } else {
      console.log('❌ Socket NON connecté');
      alert('Socket NON connecté !');
    }
  };
  return (
    <>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <TouchableOpacity onPress={testNotif} style={{ padding: 20, backgroundColor: 'blue', borderRadius: 10 }}>
        <Text style={{ color: 'white' }}>Tester Socket</Text>
      </TouchableOpacity>
    </View>
    </>
  );
}
