import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Modal, Animated, Alert, TouchableWithoutFeedback, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { submitFeedback } from '../services/feedbackService';

const STAR_LABELS = ['', 'Mauvais', 'Passable', 'Bien', 'Très bien', 'Excellent'];

const StarRating = ({ rating, onPress }: { rating: number; onPress: (n: number) => void }) => (
  <View style={styles.starsRow}>
    {[1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity key={star} onPress={() => onPress(star)} activeOpacity={0.7} style={styles.starBtn}>
        <Ionicons
          name={star <= rating ? 'star' : 'star-outline'}
          size={42}
          color={star <= rating ? '#F59E0B' : '#D1D5DB'}
        />
      </TouchableOpacity>
    ))}
  </View>
);

type Props = {
  visible: boolean;
  trajetId: number | null;
  onClose: () => void;
};

export default function FeedbackModal({ visible, trajetId, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setRating(0);
    setComment('');
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Note requise', 'Merci de sélectionner une note avant de soumettre.');
      return;
    }
    if (!trajetId) return;
    setLoading(true);
    try {
      await submitFeedback({ trajetId, rating, comment: comment.trim() });
      setSubmitted(true);
      setTimeout(() => handleClose(), 2000);
    } catch (error) {
      Alert.alert('Erreur', "Impossible de soumettre votre avis. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      {/* Overlay sombre - tap pour fermer */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.modalContainer}>

        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Bouton fermer */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <Ionicons name="close" size={22} color="#64748B" />
        </TouchableOpacity>

        {submitted ? (
          /* ── Écran succès ── */
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            </View>
            <Text style={styles.successTitle}>Merci !</Text>
            <Text style={styles.successSub}>Votre avis a été transmis au conducteur.</Text>
          </View>
        ) : (
          /* ── Formulaire ── */
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="flag" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.headerTitle}>Trajet terminé</Text>
              <Text style={styles.headerSub}>Comment s'est passé votre trajet ?</Text>
            </View>

            {/* Étoiles */}
            <Text style={styles.sectionLabel}>Votre note</Text>
            <StarRating rating={rating} onPress={setRating} />
            <Text style={styles.ratingLabel}>
              {rating > 0 ? STAR_LABELS[rating] : 'Appuyez sur une étoile'}
            </Text>

            <View style={styles.separator} />

            {/* Commentaire */}
            <Text style={styles.sectionLabel}>Commentaire (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Dites-nous ce qui s'est bien ou moins bien passé..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
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

            <TouchableOpacity onPress={handleClose} activeOpacity={0.6} style={styles.skipBtn}>
              <Text style={styles.skipText}>Passer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    // Positionné en bas
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Ombre
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  starBtn: { padding: 4 },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
    height: 22,
    marginBottom: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 90,
    lineHeight: 20,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 4,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
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
    marginTop: 14,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  // Succès
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34,197,94,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
  },
  successSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});