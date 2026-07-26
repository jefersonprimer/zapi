import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system";
import {
  Smile,
  Film,
  Sticker as StickerIcon,
  Search,
} from "lucide-react-native";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { STICKER_PACKS, Sticker } from "@/constants/stickers";

interface ChatMediaSelectorProps {
  onEmojiSelected: (emojiObject: { emoji: string }) => void;
  onSendMedia: (media: {
    uri: string;
    name: string;
    type: "image" | "video" | "audio" | "document";
    mimeType: string;
  }) => void;
  height?: number;
}

type TabType = "emoji" | "gif" | "sticker";

const { width } = Dimensions.get("window");
const GIPHY_API_KEY = "dc6zaTOxFJmzC"; // Public beta key

export const ChatMediaSelector: React.FC<ChatMediaSelectorProps> = ({
  onEmojiSelected,
  onSendMedia,
  height = 300,
}) => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 16;
  const [activeTab, setActiveTab] = useState<TabType>("emoji");

  // GIF states
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifSearch, setGifSearch] = useState("");
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Sticker states
  const [activePackId, setActivePackId] = useState(STICKER_PACKS[0]?.id || "");
  const [downloading, setDownloading] = useState(false);

  // Load trending GIFs initially or on tab switch
  useEffect(() => {
    if (activeTab === "gif" && gifs.length === 0) {
      fetchGIFs("");
    }
  }, [activeTab]);

  const fetchGIFs = async (query: string) => {
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
  };

  const handleGifSearchSubmit = () => {
    fetchGIFs(gifSearch);
  };

  const handleSelectMedia = async (url: string, isSticker: boolean) => {
    if (downloading) return;
    try {
      setDownloading(true);
      // Clean filename
      const extension = isSticker ? "webp" : "gif";
      const filename = `${Date.now()}_${isSticker ? "sticker" : "giphy"}.${extension}`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(url, localUri);

      if (downloadResult.status === 200) {
        onSendMedia({
          uri: downloadResult.uri,
          name: filename,
          type: "image",
          mimeType: isSticker ? "image/webp" : "image/gif",
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

  const activePack = STICKER_PACKS.find((p) => p.id === activePackId);

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
      {/* Tabs Navigation Bar at the top (header) */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "emoji" && {
              borderBottomColor: colors.brandGreen,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("emoji")}
        >
          <Smile
            size={20}
            color={activeTab === "emoji" ? colors.brandGreen : colors.icon}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === "emoji" ? colors.brandGreen : colors.icon,
              },
            ]}
          >
            Emoji
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "gif" && {
              borderBottomColor: colors.brandGreen,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("gif")}
        >
          <Film
            size={20}
            color={activeTab === "gif" ? colors.brandGreen : colors.icon}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === "gif" ? colors.brandGreen : colors.icon },
            ]}
          >
            GIF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "sticker" && {
              borderBottomColor: colors.brandGreen,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("sticker")}
        >
          <StickerIcon
            size={20}
            color={activeTab === "sticker" ? colors.brandGreen : colors.icon}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === "sticker" ? colors.brandGreen : colors.icon,
              },
            ]}
          >
            Sticker
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Content Pane */}
      <View style={styles.contentPane}>
        {activeTab === "emoji" && (
          <EmojiKeyboard
            onEmojiSelected={onEmojiSelected}
            defaultHeight={height - 50}
            expandable={false}
            hideHeader={true}
            enableRecentlyUsed={true}
            categoryOrder={[
              "recently_used",
              "smileys_emotion",
              "people_body",
              "animals_nature",
              "food_drink",
              "travel_places",
              "activities",
              "objects",
              "symbols",
              "flags",
            ]}
            theme={{
              backdrop: "transparent",
              knob: colors.brandGreen,
              container: colors.surface,
              header: colors.text,
              skinTonesContainer: colors.surface,
              category: {
                icon: colors.icon,
                iconActive: colors.brandGreen,
                container: colors.surface,
                containerActive: colors.surface,
              },
              search: {
                text: colors.text,
                placeholder: colors.textSecondary,
                icon: colors.icon,
                background: colors.background,
              },
              emoji: {
                selected: colors.surface,
              },
            }}
          />
        )}

        {activeTab === "gif" && (
          <View style={styles.tabContent}>
            {/* Search bar */}
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Search
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
                      onPress={() => handleSelectMedia(gifUrl, false)}
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
        )}

        {activeTab === "sticker" && (
          <View style={styles.tabContent}>
            {/* Stickers Pack Selector */}
            <View
              style={[
                styles.packSelector,
                { borderBottomColor: colors.border },
              ]}
            >
              {STICKER_PACKS.map((pack) => (
                <TouchableOpacity
                  key={pack.id}
                  style={[
                    styles.packButton,
                    activePackId === pack.id && {
                      backgroundColor: colors.background,
                      borderBottomWidth: 2,
                      borderBottomColor: colors.brandGreen,
                    },
                  ]}
                  onPress={() => setActivePackId(pack.id)}
                >
                  <Text style={styles.packIcon}>{pack.icon}</Text>
                  <Text style={[styles.packName, { color: colors.text }]}>
                    {pack.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sticker Grid */}
            <FlatList
              data={activePack?.stickers || []}
              keyExtractor={(item) => item.id}
              numColumns={4}
              contentContainerStyle={styles.gridContent}
              renderItem={({ item }: { item: Sticker }) => (
                <TouchableOpacity
                  style={styles.stickerItem}
                  onPress={() => handleSelectMedia(item.url, true)}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={styles.stickerImage}
                    contentFit="contain"
                    cachePolicy="disk"
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Sending/Downloading Overlay */}
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  contentPane: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabBar: {
    height: 50,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 150,
  },
  // GIF Tab
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
  // Sticker Tab
  packSelector: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  packButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 4,
  },
  packIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  packName: {
    fontSize: 13,
    fontWeight: "600",
  },
  stickerItem: {
    flex: 1 / 4,
    aspectRatio: 1,
    margin: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  stickerImage: {
    width: "85%",
    height: "85%",
  },
  // Overlay
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
