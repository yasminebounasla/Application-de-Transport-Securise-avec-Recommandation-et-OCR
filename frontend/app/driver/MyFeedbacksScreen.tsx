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
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header avec stats */}
      <View className="bg-white p-6 border-b border-gray-200">
        <Text className="text-3xl font-bold text-black mb-6">
          Mes Avis
        </Text>
        
        {/* Stats Card - Noir et Blanc */}
        <View className="bg-black p-6 rounded-2xl">
          <View className="items-center">
            <Text className="text-5xl font-bold text-white mb-3">
              {stats.averageRating.toFixed(1)}
            </Text>
            <RatingStars 
              rating={stats.averageRating} 
              size={28}
              showValue={false}
            />
            <Text className="text-sm text-gray-300 mt-3">
              {stats.totalFeedbacks} avis au total
            </Text>
          </View>
        </View>
      </View>

      {/* Liste des feedbacks */}
      <View className="p-4">
        {feedbacks.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Ionicons name="chatbubble-outline" size={64} color="#E5E7EB" />
            <Text className="text-gray-500 text-lg mt-4 font-semibold">
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
                className="bg-white border border-gray-200 p-5 rounded-xl mb-3"
              >
                {/* Header du feedback */}
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-black mb-2">
                      {feedback.trajet.passenger.prenom} {feedback.trajet.passenger.nom}
                    </Text>
                    <RatingStars 
                      rating={feedback.rating} 
                      size={18}
                      showValue={false}
                    />
                  </View>
                  <View className="bg-gray-100 px-3 py-1 rounded-full">
                    <Text className="text-xs text-gray-600 font-medium">
                      {formatDate(feedback.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Commentaire */}
                {feedback.comment && (
                  <View className="bg-gray-50 p-4 rounded-lg mb-3">
                    <Text className="text-gray-800 text-sm leading-5 italic">
                      "{feedback.comment}"
                    </Text>
                  </View>
                )}

                {/* Info du trajet */}
                <View className="flex-row items-center border-t border-gray-100 pt-3">
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text className="text-xs text-gray-600 ml-2 flex-1 font-medium" numberOfLines={1}>
                    {feedback.trajet.startAddress}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="#9CA3AF" className="mx-2" />
                  <Text className="text-xs text-gray-600 ml-2 flex-1 font-medium" numberOfLines={1}>
                    {feedback.trajet.endAddress}
                  </Text>
                </View>
              </View>
            ))}

            {/* Bouton charger plus - Noir et Blanc */}
            {pagination.hasNextPage && (
              <TouchableOpacity 
                onPress={loadMore}
                disabled={loadingMore}
                className="bg-black py-4 rounded-xl items-center mt-3 shadow-sm"
              >
                {loadingMore ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-base">
                      Charger plus d'avis
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">
                      Page {pagination.currentPage} / {pagination.totalPages}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Message fin de liste */}
            {!pagination.hasNextPage && feedbacks.length > 0 && (
              <View className="items-center py-8">
                <View className="h-px w-24 bg-gray-200 mb-3" />
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