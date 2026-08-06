import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";

const GIPHY_API_KEY = "dc6zaTOxFJmzC"; // Public beta key

interface GifModalProps {
  onSendMedia: (media: {
    uri: string;
    name: string;
    type: "image" | "video" | "audio" | "document";
    mimeType: string;
  }) => void;
  height?: number;
}

export const GifModal: React.FC<GifModalProps> = ({
  onSendMedia,
  height = 300,
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 16;

  const [gifs, setGifs] = useState<any[]>([]);
  const [gifSearch, setGifSearch] = useState("");
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchGIFs = useCallback(async (query: string) => {
    setLoadingGifs(true);
    try {
      const endpoint = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`;

      const response = await fetch(endpoint);
      const json = await response.json();
      if (json.data) {
        setGifs(json.data);
      }
    } catch (error) {
      console.error("Error fetching GIFs from Giphy:", error);
    } finally {
      setLoadingGifs(false);
    }
  }, []);

  useEffect(() => {
    if (gifs.length === 0) {
      fetchGIFs("");
    }
  }, [gifs.length, fetchGIFs]);

  const handleGifSearchSubmit = () => {
    fetchGIFs(gifSearch);
  };

  const handleSelectMedia = async (url: string) => {
    if (downloading) return;
    try {
      setDownloading(true);
      
      const filename = `${Date.now()}_giphy.gif`;

      if (url.startsWith("file://")) {
        onSendMedia({
          uri: url,
          name: filename,
          type: "image",
          mimeType: "image/gif",
        });
        return;
      }

      const localUri = `${FileSystem.cacheDirectory}${filename}`;
      const downloadResult = await FileSystem.downloadAsync(url, localUri);

      if (downloadResult.status === 200) {
        onSendMedia({
          uri: downloadResult.uri,
          name: filename,
          type: "image",
          mimeType: "image/gif",
        });
      } else {
        Alert.alert("Erro", "Não foi possível carregar a imagem do servidor.");
      }
    } catch (err) {
      console.error("Error downloading media file:", err);
      Alert.alert("Erro", "Falha ao processar o arquivo de mídia.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          height: height + bottomPadding,
          paddingBottom: bottomPadding,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View style={styles.contentPane}>
        <View style={styles.tabContent}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Pesquisar GIPHY..."
              placeholderTextColor={colors.textSecondary}
              value={gifSearch}
              onChangeText={setGifSearch}
              onSubmitEditing={handleGifSearchSubmit}
              returnKeyType="search"
            />
          </View>

          {loadingGifs ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.brandGreen} />
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={(item) => item.id}
              numColumns={3}
              contentContainerStyle={styles.gridContent}
              renderItem={({ item }) => {
                const gifUrl =
                  item.images?.fixed_width?.url || item.images?.original?.url;
                return (
                  <TouchableOpacity
                    style={styles.gifItem}
                    onPress={() => handleSelectMedia(gifUrl)}
                  >
                    <Image
                      source={{ uri: gifUrl }}
                      style={styles.gifImage}
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Text style={{ color: colors.textSecondary }}>
                    Nenhum GIF encontrado
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>

      {downloading && (
        <View
          style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
        >
          <View
            style={[styles.overlayBox, { backgroundColor: colors.surface }]}
          >
            <ActivityIndicator size="small" color={colors.brandGreen} />
            <Text style={[styles.overlayText, { color: colors.text }]}>
              Processando mídia...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    flexDirection: "column",
    width: "100%",
    maxHeight: "34%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  contentPane: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 150,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 8,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  gridContent: {
    padding: 4,
  },
  gifItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  gifImage: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
  },
  overlayBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  overlayText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "500",
  },
});
