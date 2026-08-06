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

const CURATED_GIFS = [
  {
    id: "cat_jam",
    title: "Cat Jam",
    url: "https://i.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif",
  },
  {
    id: "popcorn_cat",
    title: "Eating Popcorn",
    url: "https://i.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif",
  },
  {
    id: "doge",
    title: "Doge",
    url: "https://i.giphy.com/media/10t50vhNu7Wvja/giphy.gif",
  },
  {
    id: "cute_panda",
    title: "Cute Panda",
    url: "https://i.giphy.com/media/13CoXDiaCcC2qc/giphy.gif",
  },
  {
    id: "happy_fox",
    title: "Happy Fox",
    url: "https://i.giphy.com/media/3o7qDQ4kc0JfyCg1a0/giphy.gif",
  },
  {
    id: "sleeping_koala",
    title: "Sleeping Koala",
    url: "https://i.giphy.com/media/12P3yf5CtsWyvC/giphy.gif",
  },
  {
    id: "pepe_cool",
    title: "Pepe Cool",
    url: "https://i.giphy.com/media/X8M4L3N4P1vF2jDQc6/giphy.gif",
  },
  {
    id: "popcat",
    title: "Pop Cat",
    url: "https://i.giphy.com/media/3orif2uE4Zc1QPy7Qc/giphy.gif",
  },
  {
    id: "shrug",
    title: "Shrug",
    url: "https://i.giphy.com/media/l3q2Lz5yuEFUXXefC/giphy.gif",
  },
  {
    id: "facepalm",
    title: "Facepalm",
    url: "https://i.giphy.com/media/3og0INyMDTk59TNW9i/giphy.gif",
  },
  {
    id: "fine",
    title: "This is fine",
    url: "https://i.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif",
  },
  {
    id: "mindblown",
    title: "Mindblown",
    url: "https://i.giphy.com/media/26ufdipGbF56nn9hm/giphy.gif",
  },
];

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
      const tenorApiKey = process.env.EXPO_PUBLIC_TENOR_API_KEY;
      const giphyApiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY || GIPHY_API_KEY;

      if (tenorApiKey) {
        // Fetch from Tenor API if key is available
        const endpoint = query
          ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${tenorApiKey}&limit=24`
          : `https://tenor.googleapis.com/v2/featured?key=${tenorApiKey}&limit=24`;

        const response = await fetch(endpoint);
        const json = await response.json();
        if (json.results && json.results.length > 0) {
          const formatted = json.results.map((item: any) => ({
            id: item.id,
            title: item.title || "GIF",
            images: {
              fixed_width: { url: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url },
              original: { url: item.media_formats?.gif?.url }
            }
          }));
          setGifs(formatted);
          return;
        }
      }

      // Fetch from Giphy
      const endpoint = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&limit=24&rating=g`;

      const response = await fetch(endpoint);
      const json = await response.json();
      if (json.data && json.data.length > 0) {
        setGifs(json.data);
      } else {
        throw new Error("Giphy API returned empty or failed");
      }
    } catch (error) {
      console.log("Error fetching GIFs online, falling back to curated list:", error);
      setGifs(CURATED_GIFS.map(g => ({
        id: g.id,
        title: g.title,
        images: {
          fixed_width: { url: g.url },
          original: { url: g.url }
        }
      })));
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
