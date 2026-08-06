import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  PanResponder,
} from "react-native";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { STICKER_PACKS, Sticker } from "@/constants/stickers";
import {
  getCustomStickersLocal,
  removeCustomStickerLocal,
  CustomStickerItem,
} from "@/services/database";
import { useStickerDrag } from "@/context/StickerDragContext";

interface StickerModalProps {
  onSendMedia: (media: {
    uri: string;
    name: string;
    type: "image" | "video" | "audio" | "document";
    mimeType: string;
  }) => void;
  onStickerSelected?: (stickerUrl: string) => void;
  height?: number;
}

interface StickerGestureItemProps {
  url: string;
  onPress: () => void;
  onLongPress?: () => void;
  startDragging: (url: string, x: number, y: number) => void;
  styles: any;
}

const StickerGestureItem: React.FC<StickerGestureItemProps> = ({
  url,
  onPress,
  onLongPress,
  startDragging,
  styles,
}) => {
  const isDragging = React.useRef(false);
  const touchStart = React.useRef({ x: 0, y: 0 });

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8;
      },
      onPanResponderGrant: (e) => {
        isDragging.current = false;
        touchStart.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        };
      },
      onPanResponderMove: (e, gestureState) => {
        if (!isDragging.current) {
          const dx = gestureState.dx;
          const dy = gestureState.dy;
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            isDragging.current = true;
          }
        }
        
        if (isDragging.current) {
          startDragging(url, e.nativeEvent.pageX, e.nativeEvent.pageY);
        }
      },
      onPanResponderRelease: () => {
        if (!isDragging.current) {
          onPress();
        }
        isDragging.current = false;
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
      },
    })
  ).current;

  return (
    <View style={styles.stickerItem} {...panResponder.panHandlers}>
      <Image
        source={{ uri: url }}
        style={styles.stickerImage}
        contentFit="contain"
        cachePolicy="disk"
      />
    </View>
  );
};

export const StickerModal: React.FC<StickerModalProps> = ({
  onSendMedia,
  onStickerSelected,
  height = 300,
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 16;

  const { startDragging } = useStickerDrag();

  const [activePackId, setActivePackId] = useState<string>("custom_sqlite");
  const [downloading, setDownloading] = useState(false);
  const [customStickers, setCustomStickers] = useState<CustomStickerItem[]>([]);

  const loadCustomStickers = useCallback(async () => {
    try {
      const stickers = await getCustomStickersLocal();
      setCustomStickers(stickers);
    } catch (err) {
      console.error("Error loading custom stickers from SQLite:", err);
    }
  }, []);

  useEffect(() => {
    loadCustomStickers();
  }, [loadCustomStickers]);

  const handleDeleteCustomSticker = (stickerId: string) => {
    Alert.alert(
      "Remover Figurinha",
      "Deseja remover esta figurinha salva?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await removeCustomStickerLocal(stickerId);
            loadCustomStickers();
          },
        },
      ]
    );
  };

  const handleSelectMedia = async (url: string) => {
    if (downloading) return;
    try {
      setDownloading(true);
      
      const filename = `${Date.now()}_sticker.webp`;

      if (url.startsWith("file://")) {
        onSendMedia({
          uri: url,
          name: filename,
          type: "image",
          mimeType: "image/webp",
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
          mimeType: "image/webp",
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
      <View style={styles.contentPane}>
        <View style={styles.tabContent}>
          <View
            style={[
              styles.packSelector,
              { borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.packButton,
                activePackId === "custom_sqlite" && {
                  backgroundColor: colors.background,
                  borderBottomWidth: 2,
                  borderBottomColor: colors.brandGreen,
                },
              ]}
              onPress={() => setActivePackId("custom_sqlite")}
            >
              <Text style={styles.packIcon}>⭐</Text>
              <Text style={[styles.packName, { color: colors.text }]}>
                Minhas ({customStickers.length})
              </Text>
            </TouchableOpacity>

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

          {activePackId === "custom_sqlite" ? (
            <FlatList
              data={customStickers}
              keyExtractor={(item) => item.id}
              numColumns={4}
              contentContainerStyle={styles.gridContent}
              renderItem={({ item }: { item: CustomStickerItem }) => (
                <StickerGestureItem
                  url={item.local_path || item.url}
                  onPress={() => {
                    if (onStickerSelected) {
                      onStickerSelected(item.local_path || item.url);
                      return;
                    }
                    handleSelectMedia(item.local_path || item.url);
                  }}
                  onLongPress={() => handleDeleteCustomSticker(item.id)}
                  startDragging={startDragging}
                  styles={styles}
                />
              )}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Ionicons name="images-outline" size={32} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
                    Nenhuma figurinha salva.{"\n"}Pesquise na web no chat para adicionar!
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={activePack?.stickers || []}
              keyExtractor={(item) => item.id}
              numColumns={4}
              contentContainerStyle={styles.gridContent}
              renderItem={({ item }: { item: Sticker }) => (
                <StickerGestureItem
                  url={item.url}
                  onPress={() => {
                    if (onStickerSelected) {
                      onStickerSelected(item.url);
                      return;
                    }
                    handleSelectMedia(item.url);
                  }}
                  startDragging={startDragging}
                  styles={styles}
                />
              )}
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
  gridContent: {
    padding: 4,
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
