import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import {
  getStore,
  createStoreReview,
  listStoreReviews,
  StoreReviewWithUser,
  Store as StoreType,
} from "@/services/deliveryApi";
import { getFullRemoteUrl } from "@/services/mediaCache";

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

export default function StoreReviewsScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [store, setStore] = useState<StoreType | null>(null);
  const [reviews, setReviews] = useState<StoreReviewWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadStoreData = useCallback(async () => {
    if (!token || !storeId) return;
    try {
      const data = await getStore(token, storeId);
      setStore(data.store);
    } catch (err) {
      console.error("Failed to load store for reviews page:", err);
    }
  }, [token, storeId]);

  const loadReviews = useCallback(async () => {
    if (!token || !storeId) return;
    setReviewsLoading(true);
    try {
      const res = await listStoreReviews(token, storeId);
      setReviews(res.reviews || []);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  }, [token, storeId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadStoreData(), loadReviews()]);
      setLoading(false);
    }
    init();
  }, [loadStoreData, loadReviews]);

  const handleSubmitReview = async () => {
    if (!token || !storeId) return;
    if (userRating < 0 || userRating > 5) {
      Alert.alert("Erro", "Por favor, selecione uma nota de 0 a 5 estrelas.");
      return;
    }
    setSubmittingReview(true);
    try {
      await createStoreReview(token, storeId, userRating, userComment);
      Alert.alert("Sucesso", "Sua avaliação foi salva!");
      setUserComment("");
      await Promise.all([loadReviews(), loadStoreData()]);
    } catch (err) {
      console.error("Failed to submit review:", err);
      Alert.alert(
        "Erro",
        "Não foi possível salvar sua avaliação. Tente novamente.",
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back-outline" color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Avaliações
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {/* Store Score Card */}
          {store && (
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.summaryScoreSection}>
                <Text
                  style={[styles.summaryAverageText, { color: colors.text }]}
                >
                  {store.score && Number(store.ratings_count) > 0
                    ? Number(store.score).toFixed(1)
                    : "Novo"}
                </Text>
                <View style={{ flexDirection: "row", marginVertical: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <MaterialCommunityIcons
                      key={star}
                      size={16}
                      color="#F59E0B"
                      name={
                        store.score && star <= Math.round(Number(store.score))
                          ? "star"
                          : "star-outline"
                      }
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {store.ratings_count || 0}{" "}
                  {store.ratings_count === 1 ? "avaliação" : "avaliações"}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              <View style={styles.summaryMetaSection}>
                <Text
                  style={[styles.summaryMetaTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {store.name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  Sua opinião ajuda outros clientes e o estabelecimento a
                  melhorar!
                </Text>
              </View>
            </View>
          )}

          {/* Write a Review Section */}
          <View
            style={[
              styles.writeReviewContainer,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.writeReviewTitle, { color: colors.text }]}>
              Deixe sua avaliação
            </Text>

            <View style={styles.starSelectorRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() =>
                    setUserRating(userRating === 1 && star === 1 ? 0 : star)
                  }
                  activeOpacity={0.7}
                  style={{ padding: 6 }}
                >
                  <MaterialCommunityIcons
                    size={32}
                    color="#F59E0B"
                    name={star <= userRating ? "star" : "star-outline"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              {userRating === 0
                ? "0 estrelas - Péssimo"
                : userRating === 1
                  ? "1 estrela - Muito ruim"
                  : userRating === 2
                    ? "2 estrelas - Ruim"
                    : userRating === 3
                      ? "3 estrelas - Regular"
                      : userRating === 4
                        ? "4 estrelas - Muito bom"
                        : "5 estrelas - Excelente"}
            </Text>

            <TextInput
              style={[
                styles.commentInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Escreva um comentário sobre a sua experiência..."
              placeholderTextColor={colors.textSecondary}
              value={userComment}
              onChangeText={setUserComment}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.tint }]}
              onPress={handleSubmitReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Enviar Avaliação</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Other Reviews List */}
          <View style={styles.reviewsListSection}>
            <Text style={[styles.reviewsSectionTitle, { color: colors.text }]}>
              O que dizem os clientes
            </Text>

            {reviewsLoading ? (
              <ActivityIndicator
                color={colors.tint}
                size="large"
                style={{ marginVertical: 20 }}
              />
            ) : reviews.length === 0 ? (
              <Text
                style={[
                  styles.emptyReviewsText,
                  { color: colors.textSecondary },
                ]}
              >
                Nenhuma avaliação ainda. Seja o primeiro a avaliar!
              </Text>
            ) : (
              reviews.map((rev) => (
                <View
                  key={rev.id}
                  style={[
                    styles.reviewItemCard,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={styles.reviewItemHeader}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {rev.user_avatar ? (
                        <Image
                          source={{ uri: getFullRemoteUrl(rev.user_avatar) }}
                          style={styles.reviewUserAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.reviewUserAvatarPlaceholder,
                            { backgroundColor: colors.surface },
                          ]}
                        >
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontWeight: "bold",
                            }}
                          >
                            {(rev.user_name || "U")
                              .substring(0, 1)
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ marginLeft: 10 }}>
                        <Text
                          style={[
                            styles.reviewUserName,
                            { color: colors.text },
                          ]}
                        >
                          {rev.user_name}
                        </Text>
                        <View style={{ flexDirection: "row", marginTop: 2 }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <MaterialCommunityIcons
                              key={star}
                              size={12}
                              color="#F59E0B"
                              name={
                                star <= rev.rating ? "star" : "star-outline"
                              }
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {formatDate(rev.created_at)}
                    </Text>
                  </View>

                  {rev.comment && rev.comment.trim().length > 0 ? (
                    <Text
                      style={[styles.reviewCommentText, { color: colors.text }]}
                    >
                      {rev.comment}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  body: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  summaryScoreSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 16,
  },
  summaryAverageText: {
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 40,
  },
  summaryDivider: {
    width: 1,
    height: "80%",
    marginHorizontal: 4,
  },
  summaryMetaSection: {
    flex: 1,
    paddingLeft: 16,
  },
  summaryMetaTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  writeReviewContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  writeReviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  starSelectorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  reviewsListSection: {
    marginBottom: 40,
  },
  reviewsSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
  },
  emptyReviewsText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
  },
  reviewItemCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  reviewItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reviewUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewUserAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewCommentText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    paddingLeft: 46,
  },
});
