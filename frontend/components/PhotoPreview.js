import React from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import  Button from './Button';

/**
 * Composant de preview photo
 * @param {Object} props
 * @param {string} props.imageUri - URI de l'image
 * @param {Function} props.onRetake - Callback pour reprendre la photo
 * @param {Function} props.onConfirm - Callback pour confirmer
 * @param {string} props.title - Titre de l'écran
 */
export const PhotoPreview = ({
  imageUri,
  onRetake,
  onConfirm,
  title = 'Preview',
}) => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onRetake} style={styles.closeButton}>
          <MaterialIcons name="close" size={28} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.closeButton} />
      </View>

      {/* Image preview */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Retake"
          onPress={onRetake}
          variant="outline"
          style={styles.button}
        />
        <Button
          title="Use Photo"
          onPress={onConfirm}
          variant="primary"
          style={styles.button}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  button: {
    flex: 1,
  },
});