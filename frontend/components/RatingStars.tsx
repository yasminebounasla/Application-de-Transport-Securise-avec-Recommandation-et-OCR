import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RatingStars({ 
  rating = 4.5, 
  disabled = false, 
  onPress = null,
  size = 18,
  showValue = true 
}) {

  // Fonction pour déterminer le type d'étoile
  const getStarType = (index) => {
    if (rating >= index + 1) return 'star'; // Étoile pleine
    if (rating >= index + 0.5) return 'star-half'; // Demi-étoile
    return 'star-outline'; // Étoile vide
  };

  
  const handlePress = (starIndex) => {
    if (!disabled && onPress) {
      onPress(starIndex + 1); // Rating de 1 à 5
    }
  };

  return (
    <View className='flex-row items-center'>

        {/* Afficher les étoiles  */}
      {[0, 1, 2, 3, 4].map((index) => {
        const StarWrapper = disabled || !onPress ? View : TouchableOpacity;
        
        return (
          <StarWrapper
            key={index}
            onPress={() => handlePress(index)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={getStarType(index)}
              size={size} 
              color={disabled ? "#9CA3AF" : "#F59E0B"} 
            />
          </StarWrapper>
        );
      })}
      
      {showValue && (
        <Text className="ml-1 text-sm text-gray-600">
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}