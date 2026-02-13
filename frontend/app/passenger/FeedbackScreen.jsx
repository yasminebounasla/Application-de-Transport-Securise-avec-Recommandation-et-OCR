import { View, Text, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import RatingStars from '../../components/RatingStars';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { submitFeedback } from '../../services/feedbackService';

export default function FeedbackScreen() {
  const { trajetId } = useLocalSearchParams();

  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    if (userRating === 0) {
      Alert.alert("Error", "Please select a rating");
      return;
    }

    try {
      await submitFeedback({
        trajetId: Number(trajetId),
        rating: userRating,
        comment: comment
      });

      Alert.alert("✅ Success", "Thank you for your feedback!");

      router.replace('/passenger/Home'); // évite retour arrière
    } catch (error) {
      Alert.alert("Error", "Failed to submit feedback");
    }
  };

  return (
    <View className="flex-1 items-center justify-center p-6 bg-white">
      <Text className="text-2xl font-bold mb-6">
        Rate Your Last Ride
      </Text>

      <RatingStars 
        rating={userRating} 
        onPress={setUserRating} 
      />

      <Text className="text-lg mt-6 mb-2">
        Leave a comment:
      </Text>

      <Input
        placeholder="Write your feedback here..."
        value={comment}
        onChangeText={setComment}
      />

      <Button 
        title="Submit Feedback" 
        onPress={handleSubmit}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}
