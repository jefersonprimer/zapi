import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  Keyboard,
  ActivityIndicator,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import * as FileSystem from "expo-file-system/legacy";
import { BrowserMediaActionsModal } from "./BrowserMediaActionsModal";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

interface WebSearchBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSendMedia: (media: {
    uri: string;
    name: string;
    type: "image" | "video";
    mimeType: string;
    size?: number;
  }) => void;
  onSendLink?: (url: string) => void;
}

export function WebSearchBottomSheet({
  visible,
  onClose,
  onSendMedia,
  onSendLink,
}: WebSearchBottomSheetProps) {
  const { colors, isDark } = useAppTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentUrl, setCurrentUrl] = useState("https://www.google.com");
  const [loading, setLoading] = useState(false);
  const [mediaModalState, setMediaModalState] = useState<{
    visible: boolean;
    mediaType: "image" | "video" | null;
    src: string | null;
  }>({
    visible: false,
    mediaType: null,
    src: null,
  });
  const webViewRef = useRef<WebView>(null);

  // Bottom Sheet height state and animation
  const minHeight = SCREEN_HEIGHT * 0.55;
  const maxHeight = SCREEN_HEIGHT * 0.92;
  const initialHeight = SCREEN_HEIGHT * 0.7;
  const [sheetHeight, setSheetHeight] = useState(initialHeight);
  const animatedHeight = useRef(new Animated.Value(initialHeight)).current;

  // Dragging state inside React Native
  const [dragMedia, setDragMedia] = useState<{
    type: "image" | "video" | "link";
    src: string;
    pageUrl?: string;
    linkUrl?: string;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  // Use a ref to keep track of the drag state synchronously to prevent duplicate sends during asynchronous state updates
  const dragMediaRef = useRef<{
    type: "image" | "video" | "link";
    src: string;
    pageUrl?: string;
    linkUrl?: string;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  const [downloading, setDownloading] = useState(false);

  // Reset/Animate opening
  useEffect(() => {
    if (visible) {
      animatedHeight.setValue(0);
      Animated.spring(animatedHeight, {
        toValue: sheetHeight,
        tension: 100,
        friction: 10,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  // PanResponder to handle sheet resizing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        // Dragging the handle down/up. Dragging up means decreasing dy (negative value), which increases height.
        const newHeight = sheetHeight - gestureState.dy;
        if (newHeight >= minHeight && newHeight <= maxHeight) {
          animatedHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const finalHeight = sheetHeight - gestureState.dy;
        if (finalHeight < minHeight) {
          // Close sheet if dragged down too much
          onClose();
        } else {
          const clamped = Math.max(minHeight, Math.min(maxHeight, finalHeight));
          setSheetHeight(clamped);
          animatedHeight.setValue(clamped);
        }
      },
    }),
  ).current;

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    const query = encodeURIComponent(searchQuery.trim());
    const newUrl = `https://www.google.com/search?q=${query}`;
    setCurrentUrl(newUrl);
  };

  // Helper to download remote file locally and trigger onSendMedia
  const processAndSendMedia = async (
    src: string,
    type: "image" | "video" | "link",
    pageUrl?: string,
    linkUrl?: string,
  ) => {
    const isGoogleVideoPreview =
      src.includes("gstatic.com/video") || src.includes("/video?q=tbn");

    // Check if the URL is a video platform link (YouTube, Vimeo, Dailymotion)
    const isVideoPlatform =
      src.includes("youtube.com") ||
      src.includes("youtu.be") ||
      src.includes("vimeo.com") ||
      src.includes("dailymotion.com") ||
      (pageUrl &&
        (pageUrl.includes("youtube.com") ||
          pageUrl.includes("youtu.be") ||
          pageUrl.includes("vimeo.com") ||
          pageUrl.includes("dailymotion.com"))) ||
      (linkUrl &&
        (linkUrl.includes("youtube.com") ||
          linkUrl.includes("youtu.be") ||
          linkUrl.includes("vimeo.com") ||
          linkUrl.includes("dailymotion.com")));

    if (isGoogleVideoPreview || isVideoPlatform) {
      if (onSendLink) {
        // Resolve the best video platform link to share
        let videoUrl = null;
        if (
          linkUrl &&
          (linkUrl.includes("youtube.com") ||
            linkUrl.includes("youtu.be") ||
            linkUrl.includes("vimeo.com") ||
            linkUrl.includes("dailymotion.com"))
        ) {
          videoUrl = linkUrl;
        } else if (
          src.startsWith("http") &&
          (src.includes("youtube.com") ||
            src.includes("youtu.be") ||
            src.includes("vimeo.com") ||
            src.includes("dailymotion.com"))
        ) {
          videoUrl = src;
        } else if (
          pageUrl &&
          (pageUrl.includes("youtube.com") ||
            pageUrl.includes("youtu.be") ||
            pageUrl.includes("vimeo.com") ||
            pageUrl.includes("dailymotion.com"))
        ) {
          videoUrl = pageUrl;
        } else if (linkUrl && linkUrl.startsWith("http")) {
          videoUrl = linkUrl; // Fallback to outer link
        } else if (pageUrl) {
          videoUrl = pageUrl; // Fallback to current page
        }

        if (videoUrl) {
          onSendLink(videoUrl);
          return;
        }
      }
    }

    // If it is a blob URL that hasn't been converted yet
    if (src.startsWith("blob:")) {
      Alert.alert(
        "Mídia não suportada",
        "Este vídeo é uma transmissão em tempo real (streaming) ou está protegido e não pode ser baixado diretamente.",
      );
      return;
    }

    // If it is a remote http/https URL, send it directly as a link!
    if (src.startsWith("http://") || src.startsWith("https://")) {
      if (onSendLink) {
        onSendLink(src);
        return;
      }
    }

    setDownloading(true);
    try {
      const ext = type === "video" ? "mp4" : "jpg";
      const filename = `web_media_${Date.now()}.${ext}`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      // Handle Base64 Data URL
      if (src.startsWith("data:")) {
        const parts = src.split(";base64,");
        if (parts.length === 2) {
          const base64Data = parts[1];
          await FileSystem.writeAsStringAsync(localUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          onSendMedia({
            uri: localUri,
            name: filename,
            type,
            mimeType: type === "video" ? "video/mp4" : "image/jpeg",
          });
          setDownloading(false);
          return;
        }
      }

      // Download remote URL
      const downloadResult = await FileSystem.downloadAsync(src, localUri);
      if (downloadResult.status === 200) {
        onSendMedia({
          uri: downloadResult.uri,
          name: filename,
          type,
          mimeType: type === "video" ? "video/mp4" : "image/jpeg",
        });
      } else {
        Alert.alert("Erro", "Não foi possível baixar o arquivo de mídia.");
      }
    } catch (err) {
      console.error("Error downloading media:", err);
      Alert.alert("Erro", "Erro ao processar arquivo de mídia.");
    } finally {
      setDownloading(false);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data) return;

      // Top margin of WebView relative to screen = SCREEN_HEIGHT - current sheet height + header offset (approx 120px)
      const webViewTopOffset = SCREEN_HEIGHT - sheetHeight + 110;

      if (data.type === "MEDIA_CONTEXT_MENU") {
        setMediaModalState({
          visible: true,
          mediaType: data.mediaType,
          src: data.src,
        });
      } else if (data.type === "MEDIA_DRAG_START") {
        const newDrag = {
          type: data.mediaType,
          src: data.src,
          pageUrl: data.pageUrl,
          linkUrl: data.linkUrl,
          x: data.x,
          y: webViewTopOffset + data.y,
          active: true,
        };
        dragMediaRef.current = newDrag;
        setDragMedia(newDrag);
      } else if (data.type === "MEDIA_DRAG_MOVE") {
        if (dragMediaRef.current) {
          dragMediaRef.current.x = data.x;
          dragMediaRef.current.y = webViewTopOffset + data.y;
        }
        setDragMedia((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            x: data.x,
            y: webViewTopOffset + data.y,
          };
        });
      } else if (data.type === "MEDIA_SRC_CONVERTED") {
        if (
          dragMediaRef.current &&
          dragMediaRef.current.src === data.originalSrc
        ) {
          dragMediaRef.current.src = data.convertedSrc;
        }
        setDragMedia((prev) => {
          if (prev && prev.src === data.originalSrc) {
            return {
              ...prev,
              src: data.convertedSrc,
            };
          }
          return prev;
        });
      } else if (data.type === "MEDIA_DRAG_END") {
        const activeDrag = dragMediaRef.current;
        if (activeDrag && activeDrag.active) {
          // Check if dropped above the bottom sheet (meaning it was dragged to the chat area)
          const isDroppedInChat = activeDrag.y < SCREEN_HEIGHT - sheetHeight;
          if (isDroppedInChat) {
            processAndSendMedia(
              activeDrag.src,
              activeDrag.type,
              activeDrag.pageUrl,
              activeDrag.linkUrl,
            );
          }
        }
        // Reset both state and ref synchronously to avoid processing duplicate drag end events
        dragMediaRef.current = null;
        setDragMedia(null);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  };

  if (!visible) return null;

  // JS script to inject inside webview to detect dragging of images and videos
  const injectedJs = `
    (function() {
      // Apply dark theme if isDark is active
      if (${isDark}) {
        try {
          if (!document.getElementById('dark-mode-style')) {
            var invertStyle = document.createElement('style');
            invertStyle.id = 'dark-mode-style';
            invertStyle.innerHTML = 'html { filter: invert(0.92) hue-rotate(180deg) !important; background-color: #121212 !important; } ' +
                                    'img, video, iframe, [style*="background-image"], svg, [class*="avatar"], [class*="logo"] { filter: invert(1.08) hue-rotate(180deg) !important; }';
            document.documentElement.appendChild(invertStyle);
            
            var meta = document.createElement('meta');
            meta.name = 'color-scheme';
            meta.content = 'dark';
            document.head.appendChild(meta);
          }
        } catch(e) { console.error(e); }
      }

      var activeMedia = null;
      var isDragging = false;
      var dragThreshold = 15;
      var startX = 0, startY = 0;

      function convertBlobToDataUrl(blobUrl, callback) {
        fetch(blobUrl)
          .then(function(res) { return res.blob(); })
          .then(function(blob) {
            var reader = new FileReader();
            reader.onloadend = function() {
              callback(reader.result);
            };
            reader.readAsDataURL(blob);
          })
          .catch(function(err) {
            console.error('Failed to convert blob', err);
          });
      }

      document.addEventListener('touchstart', function(e) {
        var touch = e.touches[0];
        var elements = [];
        if (document.elementsFromPoint) {
          elements = document.elementsFromPoint(touch.clientX, touch.clientY);
        }
        
        var mediaElement = null;
        for (var i = 0; i < elements.length; i++) {
          var el = elements[i];
          var tagName = el.tagName ? el.tagName.toUpperCase() : '';
          if (tagName === 'IMG' || tagName === 'VIDEO' || tagName === 'A') {
            mediaElement = el;
            break;
          }
        }
        
        if (!mediaElement) {
          var target = e.target;
          while (target && target !== document.body) {
            var tagName = target.tagName ? target.tagName.toUpperCase() : '';
            if (tagName === 'IMG' || tagName === 'VIDEO' || tagName === 'A') {
              mediaElement = target;
              break;
            }
            target = target.parentNode;
          }
        }

        if (mediaElement) {
          var src = mediaElement.src || mediaElement.currentSrc || mediaElement.getAttribute('src');
          var linkUrl = null;
          
          if (mediaElement.tagName.toUpperCase() === 'A') {
            linkUrl = mediaElement.href;
            src = src || linkUrl;
          } else {
            var p = mediaElement;
            while (p && p !== document.body) {
              if (p.tagName && p.tagName.toUpperCase() === 'A') {
                linkUrl = p.href;
                break;
              }
              p = p.parentNode;
            }
          }

          var isBlob = src && src.indexOf('blob:') === 0;
          var mediaType = 'image';
          if (mediaElement.tagName.toUpperCase() === 'A') {
            mediaType = 'link';
          } else if (mediaElement.tagName.toUpperCase() === 'VIDEO') {
            mediaType = 'video';
          }

          // Detect video platform elements (YouTube, Vimeo, Dailymotion, etc.)
          var isVideoPlatform = (window.location.href.indexOf('youtube.com') !== -1 || 
                                 window.location.href.indexOf('youtu.be') !== -1 ||
                                 window.location.href.indexOf('vimeo.com') !== -1 ||
                                 window.location.href.indexOf('dailymotion.com') !== -1 ||
                                 (linkUrl && (
                                   linkUrl.indexOf('youtube.com') !== -1 || 
                                   linkUrl.indexOf('youtu.be') !== -1 ||
                                   linkUrl.indexOf('vimeo.com') !== -1 ||
                                   linkUrl.indexOf('dailymotion.com') !== -1
                                 )) ||
                                 (src && (
                                   src.indexOf('ytimg.com') !== -1 ||
                                   src.indexOf('vimeocdn.com') !== -1 ||
                                   src.indexOf('gstatic.com/video') !== -1 ||
                                   src.indexOf('/video') !== -1
                                 )));

          if (isVideoPlatform) {
            mediaType = 'video';
            var videoUrl = linkUrl || window.location.href;
            if (videoUrl) {
              if (videoUrl.indexOf('google.com') !== -1) {
                var urlMatch = videoUrl.match(/[?&](url|q)=([^&]+)/);
                if (urlMatch && urlMatch[2]) {
                  videoUrl = decodeURIComponent(urlMatch[2]);
                }
              }
              src = videoUrl;
              isBlob = false;
            }
          }

          if (mediaType === 'video' && (!src || isBlob)) {
            // Try to find <source> tags with non-blob URLs
            var sources = mediaElement.getElementsByTagName('source');
            for (var j = 0; j < sources.length; j++) {
              var sUrl = sources[j].src || sources[j].getAttribute('src');
              if (sUrl && sUrl.indexOf('blob:') !== 0) {
                src = sUrl;
                isBlob = false;
                break;
              }
            }
            // Try common data attributes
            if (isBlob || !src) {
              var dataSrc = mediaElement.getAttribute('data-src') || 
                            mediaElement.getAttribute('data-video-url') ||
                            mediaElement.getAttribute('data-original');
              if (dataSrc && dataSrc.indexOf('blob:') !== 0) {
                src = dataSrc;
                isBlob = false;
              }
            }
          }

          // If it is a blob or empty, and we have a parent link, fallback to the link
          if ((!src || isBlob) && linkUrl) {
            src = linkUrl;
            isBlob = false;
          }

          if (src) {
            activeMedia = {
              type: mediaType,
              src: src,
              pageUrl: window.location.href,
              linkUrl: linkUrl
            };
            startX = touch.clientX;
            startY = touch.clientY;
            isDragging = false;

            if (isBlob) {
              convertBlobToDataUrl(src, function(dataUrl) {
                if (activeMedia && activeMedia.src === src) {
                  activeMedia.src = dataUrl;
                }
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'MEDIA_SRC_CONVERTED',
                  originalSrc: src,
                  convertedSrc: dataUrl
                }));
              });
            }
          }
        }
      }, { passive: false });

      document.addEventListener('touchmove', function(e) {
        if (!activeMedia) return;
        var touch = e.touches[0];
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        
        if (!isDragging && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
          isDragging = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MEDIA_DRAG_START',
            mediaType: activeMedia.type,
            src: activeMedia.src,
            pageUrl: activeMedia.pageUrl,
            linkUrl: activeMedia.linkUrl,
            x: touch.clientX,
            y: touch.clientY
          }));
        }

        if (isDragging) {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MEDIA_DRAG_MOVE',
            x: touch.clientX,
            y: touch.clientY
          }));
        }
      }, { passive: false });

      document.addEventListener('touchend', function(e) {
        if (activeMedia) {
          if (isDragging) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MEDIA_DRAG_END'
            }));
          }
          activeMedia = null;
          isDragging = false;
        }
      }, { passive: false });

      document.addEventListener('contextmenu', function(e) {
        var target = e.target;
        while (target && target !== document.body) {
          var tagName = target.tagName ? target.tagName.toUpperCase() : '';
          if (tagName === 'IMG' || tagName === 'VIDEO') {
            e.preventDefault();
            var src = target.src || target.currentSrc || target.getAttribute('src');
            if (src) {
              if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
                var a = document.createElement('a');
                a.href = src;
                src = a.href;
              }
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MEDIA_CONTEXT_MENU',
                mediaType: tagName === 'IMG' ? 'image' : 'video',
                src: src
              }));
            }
            return;
          }
          target = target.parentNode;
        }
      }, true);
    })();
  `;

  const isDraggingAboveSheet =
    dragMedia && dragMedia.y < SCREEN_HEIGHT - sheetHeight;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}
        activeOpacity={1}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      />

      {/* Resizable Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: animatedHeight,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        {/* Resize Handle / Drag bar */}
        <View {...panResponder.panHandlers} style={styles.handleContainer}>
          <View
            style={[styles.handleBar, { backgroundColor: colors.border }]}
          />
        </View>

        <View style={styles.container}>
          <TouchableOpacity
            onPress={() => webViewRef.current?.goBack()}
            style={{
              backgroundColor: colors.cardBackground,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 8,
              borderRadius: 50,
            }}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          {/* Search Bar */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.cardBackground,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Pesquisar imagem ou vídeo no Google..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* WebView */}
        <View
          style={[styles.webWrapper, { backgroundColor: colors.background }]}
        >
          <WebView
            key={isDark ? "dark" : "light"}
            ref={webViewRef}
            source={{ uri: currentUrl }}
            style={[styles.webView, { backgroundColor: colors.background }]}
            containerStyle={{ backgroundColor: colors.background }}
            injectedJavaScript={injectedJs}
            onMessage={handleWebViewMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />
          {loading && (
            <ActivityIndicator
              size="large"
              color={colors.brandGreen}
              style={styles.loader}
            />
          )}
        </View>
      </Animated.View>

      {/* Floating Dragged Media Indicator */}
      {dragMedia && dragMedia.active && (
        <View
          pointerEvents="none"
          style={[
            styles.dragIndicator,
            {
              left: dragMedia.x - 40,
              top: dragMedia.y - 40,
              borderColor: isDraggingAboveSheet
                ? colors.brandGreen
                : colors.textSecondary,
              backgroundColor: isDraggingAboveSheet
                ? "rgba(7, 193, 96, 0.2)"
                : "rgba(255, 255, 255, 0.4)",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              dragMedia.type === "video"
                ? "video"
                : dragMedia.type === "link"
                ? "link"
                : "image"
            }
            size={36}
            color={isDraggingAboveSheet ? colors.brandGreen : colors.text}
          />
        </View>
      )}

      {/* Downloading Overlay */}
      {downloading && (
        <View
          style={[
            styles.downloadOverlay,
            { backgroundColor: colors.modalOverlay },
          ]}
        >
          <View
            style={[
              styles.downloadCard,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <ActivityIndicator size="large" color={colors.brandGreen} />
            <Text style={[styles.downloadText, { color: colors.text }]}>
              Processando e enviando mídia...
            </Text>
          </View>
        </View>
      )}

      <BrowserMediaActionsModal
        visible={mediaModalState.visible}
        onClose={() =>
          setMediaModalState((prev) => ({ ...prev, visible: false }))
        }
        mediaType={mediaModalState.mediaType}
        src={mediaModalState.src}
        onOpenInNewTab={(url) => {
          setCurrentUrl(url);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
    zIndex: 1000,
    overflow: "hidden",
  },
  handleContainer: {
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 50,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 15,
  },
  webWrapper: {
    flex: 1,
    position: "relative",
  },
  webView: {
    flex: 1,
  },
  loader: {
    position: "absolute",
    top: "40%",
    left: "50%",
    marginLeft: -20,
  },
  dragIndicator: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 30,
  },
  downloadOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
  },
  downloadCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  downloadText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
  },
});
