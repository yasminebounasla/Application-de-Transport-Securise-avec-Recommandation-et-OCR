import { View, Text, Modal, TouchableOpacity, Alert, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useState } from 'react';
import { BlurView } from 'expo-blur';
import RatingStars from './RatingStars';
import Button from './Button';
import { submitFeedback } from '../services/feedbackService';

export default function FeedbackModal({ visible, trajetId, onClose }) {
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (userRating === 0) {
      Alert.alert("Error", "Please select a rating");
      return;
    }

    setLoading(true);
    try {
      await submitFeedback({
        trajetId: Number(trajetId),
        rating: userRating,
        comment: comment.trim()
      });

      Alert.alert(
        "Success", 
        "Thank you for your feedback!",
        [{ 
          text: 'OK', 
          onPress: () => {
            setUserRating(0);
            setComment('');
            onClose(); // Ferme le modal 
          }
        }]
      );

    } catch (error) {
      const errorMsg = error.response?.data?.message || "Failed to submit feedback";
      Alert.alert("Error", errorMsg);

    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Blur Background */}
      <BlurView intensity={90} style={styles.blurContainer} tint="light">
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            {/* Modal Card */}
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.title}>Rate Your Ride</Text>
                  <Text style={styles.subtitle}>How was your experience?</Text>
                </View>

                {/* Rating */}
                <View style={styles.ratingContainer}>
                  <RatingStars 
                    rating={userRating} 
                    onPress={setUserRating}
                    size={40}
                  />
                  {userRating > 0 && (
                    <Text style={styles.ratingText}>
                      {userRating} / 5 stars
                    </Text>
                  )}
                </View>

                {/* Comment */}
                <Text style={styles.label}>Comment (optional):</Text>
                <TextInput
                  placeholder="Share your experience..."
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={4}
                  style={styles.input}
                />

                {/* Buttons */}
                <Button 
                  title={loading ? "Submitting..." : "Submit Feedback"} 
                  onPress={handleSubmit}
                  disabled={loading || userRating === 0}
                  style={styles.submitButton}
                />
                
                <TouchableOpacity 
                  onPress={onClose}
                  style={styles.skipButton}
                >
                  <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  input: {
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitButton: {
    marginBottom: 12,
  },
  skipButton: {
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  skipText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});