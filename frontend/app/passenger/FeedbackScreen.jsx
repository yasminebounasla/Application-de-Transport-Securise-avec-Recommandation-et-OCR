import {View,Text} from 'react-native';
import { useState } from 'react';
import RatingStars from '../../components/RatingStars';



export default function FeedbackScreen() {
    const [userRating, setUserRating] = useState(0);
  
  return (
    <View className="flex-1 items-center justify-center">
      <RatingStars 
        rating={userRating} 
        onPress={(value) => setUserRating(value)} 
        />
    </View>
  );
}
