import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { File } from "expo-file-system";
import {
  FileText,
  Images,
  Play,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import type { Attachment } from "@/components/AttachCameraButton";

const RECENT_LIMIT = 24;
const THUMB_GAP = 4;
const THUMB_COLS = 4;
const THUMB_SIZE =
  (Dimensions.get("window").width - 32 - THUMB_GAP * (THUMB_COLS - 1)) /
  THUMB_COLS;
const MEDIA_PERMISSIONS: MediaLibrary.GranularPermission[] = [
  "photo",
  "video",
];

interface AttachMediaSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
  onSelectMedia: (attachment: Attachment) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function guessMimeType(filename: string, mediaType: string): string {
  if (mediaType === "video") {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return "video/mp4";
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

function tryGetFileSize(uri: string): number | undefined {
  try {
    const file = new File(uri);
    if (file.exists && file.size > 0) return file.size;
  } catch {
    // Ignore — size is optional for validation
  }
  return undefined;
}

export function AttachMediaSheet({
  visible,
  onClose,
  onPickGallery,
  onPickDocument,
  onSelectMedia,
}: AttachMediaSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const loadRecentMedia = useCallback(async () => {
    if (Platform.OS === "web") return;

    setLoadingAssets(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: RECENT_LIMIT,
        mediaType: [
          MediaLibrary.MediaType.photo,
          MediaLibrary.MediaType.video,
        ],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setAssets(result.assets);
    } catch {
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  const checkAndLoad = useCallback(async () => {
    if (Platform.OS === "web") return;

    try {
      const current = await MediaLibrary.getPermissionsAsync(
        false,
        MEDIA_PERMISSIONS,
      );
      const granted =
        current.granted || current.accessPrivileges === "limited";
      setPermissionGranted(granted);

      if (granted) {
        await loadRecentMedia();
      } else {
        setAssets([]);
      }
    } catch {
      setPermissionGranted(false);
      setAssets([]);
    }
  }, [loadRecentMedia]);

  useEffect(() => {
    if (!visible) {
      setSelectingId(null);
      return;
    }
    checkAndLoad();
  }, [visible, checkAndLoad]);

  async function handleRequestPermission() {
    try {
      const result = await MediaLibrary.requestPermissionsAsync(
        false,
        MEDIA_PERMISSIONS,
      );
      const granted =
        result.granted || result.accessPrivileges === "limited";
      setPermissionGranted(granted);
      if (granted) {
        await loadRecentMedia();
      }
    } catch (err: any) {
      Alert.alert(
        "Permissão",
        err?.message || "Não foi possível solicitar acesso às fotos.",
      );
    }
  }

  async function handleSelectAsset(asset: MediaLibrary.Asset) {
    if (selectingId) return;
    setSelectingId(asset.id);

    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset, {
        shouldDownloadFromNetwork: true,
      });
      const uri = info.localUri || info.uri;
      if (!uri) {
        Alert.alert("Erro", "Não foi possível acessar este arquivo.");
        return;
      }

      const isVideo = asset.mediaType === MediaLibrary.MediaType.video;
      onSelectMedia({
        uri,
        name: asset.filename,
        type: isVideo ? "video" : "image",
        mimeType: guessMimeType(asset.filename, isVideo ? "video" : "image"),
        size: tryGetFileSize(uri),
        duration: isVideo ? Math.round(asset.duration) : undefined,
      });
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Erro ao selecionar mídia",
        err?.message || "Tente novamente.",
      );
    } finally {
      setSelectingId(null);
    }
  }

  function handleGallery() {
    onClose();
    // Defer so the sheet dismisses before the system picker opens
    requestAnimationFrame(() => onPickGallery());
  }

  function handleDocument() {
    onClose();
    requestAnimationFrame(() => onPickDocument());
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.menuBackground,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.handleRow}>
            <View
              style={[styles.handle, { backgroundColor: colors.border }]}
            />
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={12}
            >
              <X size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleGallery}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.tint + "18" },
                ]}
              >
                <Images size={22} color={colors.tint} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                Galeria
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleDocument}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.tint + "18" },
                ]}
              >
                <FileText size={22} color={colors.tint} />
              </View>
              <Text
                style={[styles.actionLabel, { color: colors.text }]}
                numberOfLines={1}
              >
                Documento
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Recentes
          </Text>

          {!permissionGranted ? (
            <View style={styles.permissionBox}>
              <Text
                style={[styles.permissionText, { color: colors.textSecondary }]}
              >
                Permita o acesso às fotos para ver as mídias recentes aqui.
              </Text>
              <TouchableOpacity
                style={[styles.permissionBtn, { backgroundColor: colors.tint }]}
                onPress={handleRequestPermission}
              >
                <Text style={styles.permissionBtnText}>Permitir acesso</Text>
              </TouchableOpacity>
            </View>
          ) : loadingAssets ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.tint} />
            </View>
          ) : assets.length === 0 ? (
            <Text
              style={[styles.emptyText, { color: colors.textSecondary }]}
            >
              Nenhuma mídia recente encontrada.
            </Text>
          ) : (
            <FlatList
              data={assets}
              keyExtractor={(item) => item.id}
              numColumns={THUMB_COLS}
              style={styles.gridList}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isVideo =
                  item.mediaType === MediaLibrary.MediaType.video;
                const isSelecting = selectingId === item.id;

                return (
                  <TouchableOpacity
                    style={styles.thumbWrap}
                    activeOpacity={0.8}
                    disabled={!!selectingId}
                    onPress={() => handleSelectAsset(item)}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                    {isVideo && (
                      <View style={styles.videoBadge}>
                        <Play size={10} color="#fff" fill="#fff" />
                        <Text style={styles.videoDuration}>
                          {formatDuration(item.duration)}
                        </Text>
                      </View>
                    )}
                    {isSelecting && (
                      <View style={styles.thumbOverlay}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: "70%",
  },
  handleRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    minHeight: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 28,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionItem: {
    alignItems: "center",
    gap: 8,
    minWidth: 80,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  permissionBox: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 12,
  },
  permissionText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  permissionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  gridList: {
    maxHeight: THUMB_SIZE * 3 + THUMB_GAP * 2,
  },
  grid: {
    paddingBottom: 4,
  },
  gridRow: {
    gap: THUMB_GAP,
    marginBottom: THUMB_GAP,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDuration: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
