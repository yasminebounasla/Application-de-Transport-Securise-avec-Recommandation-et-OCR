import React from 'react';
import PropTypes from 'prop-types';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

/**
 * Composant de chargement
 * @param {Object} props
 * @param {string} props.message 
 * @param {'small'|'large'} props.size 
 */
export const LoadingSpinner = ({ message = 'Loading...', size = 'large' }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size={size} color="#000000" />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
};

LoadingSpinner.propTypes = {
  message: PropTypes.string,
  size: PropTypes.oneOf(['small', 'large']),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  message: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
  },
});