import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, Animated, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { submitFeedback } from '../../services/feedbackService';

// ✅ Les étoiles sont gérées localement ici — pas besoin du composant RatingStars externe
const STAR_LABELS = ['', 'Mauvais', 'Passable', 'Bien', 'Très bien', 'Excellent'];

const StarRating = ({ rating, onPress }: { rating: number; onPress: (n: number) => void }) => {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onPress(star)}
          activeOpacity={0.7}
          style={styles.starBtn}
        >
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={42}
            color={star <= rating ? '#F59E0B' : '#D1D5DB'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function FeedbackScreen() {
  // ✅ trajetId récupéré depuis les query params
  // POURQUOI: NotificationContext.tsx navigue via
  //           router.push(`/passenger/feedbackScreen?trajetId=${data.rideId}`)
  //           donc useLocalSearchParams() récupère bien trajetId ici.
  const { trajetId } = useLocalSearchParams<{ trajetId: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Note requise', 'Merci de sélectionner une note avant de soumettre.');
      return;
    }
    setLoading(true);
    try {
      await submitFeedback({
        trajetId: Number(trajetId),
        rating,
        comment: comment.trim(),
      });
      setSubmitted(true);
      // Retour auto après 2s
      setTimeout(() => router.replace('../(passengerTabs)/PassengerHomeScreen'), 2000);
    } catch (error) {
      Alert.alert('Erreur', "Impossible de soumettre votre avis. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('../(passengerTabs)/PassengerHomeScreen');
  };

  // Écran de confirmation après soumission
  if (submitted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color="#22C55E" />
          </View>
          <Text style={styles.successTitle}>Merci !</Text>
          <Text style={styles.successSub}>Votre avis a été transmis au conducteur.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.container}>

        {/* Header foncé */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="flag" size={28} color="#F59E0B" />
          </View>
          <Text style={styles.headerTitle}>Trajet terminé</Text>
          <Text style={styles.headerSub}>Comment s'est passé votre trajet ?</Text>
        </View>

        {/* Card blanche */}
        <View style={styles.card}>

          {/* Étoiles */}
          <Text style={styles.sectionLabel}>Votre note</Text>
          <StarRating rating={rating} onPress={setRating} />

          {/* Label dynamique selon note */}
          <Text style={styles.ratingLabel}>
            {rating > 0 ? STAR_LABELS[rating] : 'Appuyez sur une étoile'}
          </Text>

          {/* Séparateur */}
          <View style={styles.separator} />

          {/* Commentaire */}
          <Text style={styles.sectionLabel}>Commentaire (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Dites-nous ce qui s'est bien ou moins bien passé..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{comment.length}/300</Text>

          {/* Boutons */}
          <TouchableOpacity
            style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || rating === 0}
            activeOpacity={0.85}
          >
            {loading ? (
              <Text style={styles.submitBtnText}>Envoi...</Text>
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Envoyer mon avis</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} activeOpacity={0.6} style={styles.skipBtn}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>

        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  starBtn: {
    padding: 4,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
    height: 22,
    marginBottom: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 110,
    lineHeight: 20,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 6,
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  skipBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  // Écran succès
  successContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(34,197,94,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  successSub: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});