import { View, ScrollView, Text, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RatingStars from '../../components/RatingStars';
import { getDriverStats, getDriverFeedback } from '../../services/feedbackService';

export default function MyFeedbacksScreen() {

  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState({ averageRating: 0, totalFeedbacks: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false
  });

  // Charger les stats
  const loadStats = async () => {
    try {
      const response = await getDriverStats();
      setStats(response.data);

    } catch (error) {
      console.error("Erreur chargement stats:", error);
    }
  };


  // Charger les feedbacks
  const loadFeedbacks = async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await getDriverFeedback(page, 10);
      const newFeedbacks = response.data;
      
      if (append) {
        setFeedbacks(prev => [...prev, ...newFeedbacks]);
      } else {
        setFeedbacks(newFeedbacks);
      }

      setPagination(response.pagination);

    } catch (error) {
      console.error("Erreur chargement feedbacks:", error);
      Alert.alert("Erreur", "Impossible de charger les avis");
      
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  // Charger plus (pagination)
  const loadMore = () => {
    if (pagination.hasNextPage && !loadingMore) {
      loadFeedbacks(pagination.currentPage + 1, true);
    }
  };

  // Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    await loadFeedbacks(1);
  };

  // Initial load
  useEffect(() => {
    loadStats();
    loadFeedbacks(1);
  }, []);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header avec stats */}
      <View className="bg-white p-5 mb-2 shadow-sm">
        <Text className="text-2xl font-bold text-gray-800 mb-4">
          Mes Avis
        </Text>
        
        <View className="flex-row items-center justify-center bg-blue-50 p-4 rounded-2xl">
          <View className="items-center">
            <Text className="text-4xl font-bold text-blue-600 mb-2">
              {stats.averageRating.toFixed(1)}
            </Text>
            <RatingStars 
              rating={stats.averageRating} 
              size={24}
              showValue={false}
            />
            <Text className="text-sm text-gray-600 mt-2">
              {stats.totalFeedbacks} avis au total
            </Text>
          </View>
        </View>
      </View>

      {/* Liste des feedbacks */}
      <View className="p-4">
        {feedbacks.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-500 text-lg mt-4">
              Aucun avis pour l'instant
            </Text>
            <Text className="text-gray-400 text-sm mt-2">
              Vos avis apparaîtront ici
            </Text>
          </View>
        ) : (
          <>
            {feedbacks.map((feedback) => (
              <View 
                key={feedback.id} 
                className="bg-white p-4 rounded-xl mb-3 shadow-sm"
              >
                {/* Header du feedback */}
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-800 mb-1">
                      {feedback.trajet.passenger.prenom} {feedback.trajet.passenger.nom}
                    </Text>
                    <RatingStars 
                      rating={feedback.rating} 
                      size={16}
                      showValue={false}
                    />
                  </View>
                  <Text className="text-xs text-gray-500">
                    {formatDate(feedback.createdAt)}
                  </Text>
                </View>

                {/* Commentaire */}
                {feedback.comment && (
                  <Text className="text-gray-700 text-sm mb-3 leading-5">
                    "{feedback.comment}"
                  </Text>
                )}

                {/* Info du trajet */}
                <View className="flex-row items-center bg-gray-50 p-3 rounded-lg">
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text className="text-xs text-gray-600 ml-2 flex-1" numberOfLines={1}>
                    {feedback.trajet.startAddress}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />
                  <Text className="text-xs text-gray-600 ml-2 flex-1" numberOfLines={1}>
                    {feedback.trajet.endAddress}
                  </Text>
                </View>
              </View>
            ))}

            {/* Bouton charger plus */}
            {pagination.hasNextPage && (
              <TouchableOpacity 
                onPress={loadMore}
                disabled={loadingMore}
                className="bg-blue-500 py-3 rounded-xl items-center mt-2"
              >
                {loadingMore ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">
                    Charger plus ({pagination.currentPage} / {pagination.totalPages})
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Message fin de liste */}
            {!pagination.hasNextPage && feedbacks.length > 0 && (
              <View className="items-center py-6">
                <Text className="text-gray-400 text-sm">
                  Vous avez vu tous les avis
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}