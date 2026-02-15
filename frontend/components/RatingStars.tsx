import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export default function RatingStars({ 
  rating = 0,          
  disabled = false, 
  onPress = null,
  size = 18,
  showValue = true,
  readonly = false     
}) {
  
  const isInteractive = !readonly && !disabled && onPress;
  
  const handlePress = (starIndex) => {
    if (isInteractive) {
      onPress(starIndex + 1);
    }
  };
  
  const getStarType = (index) => {
    if (rating >= index + 1) return 'star'; // Étoile pleine
    if (rating >= index + 0.5) return 'star-half'; // Demi-étoile
    return 'star-outline'; // Étoile vide
  };

  const StarWrapper = isInteractive ? TouchableOpacity : View;
  
  return (
    <View className='flex-row items-center'>
      {[0, 1, 2, 3, 4].map((index) => (
        <StarWrapper
          key={index}
          onPress={() => handlePress(index)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={getStarType(index)}
            size={size} 
            color={isInteractive || !readonly ? "#F59E0B" : "#9CA3AF"} 
          />
        </StarWrapper>
      ))}
      
      {showValue && (
        <Text className="ml-1 text-sm text-gray-600">
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}