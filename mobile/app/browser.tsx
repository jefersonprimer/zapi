import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Modal,
  ScrollView,
  SafeAreaView,
  Keyboard,
  BackHandler,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Share2,
  Shield,
  ShieldAlert,
  Lock,
  Globe,
  Home,
  X,
  Plus,
  Star,
  ExternalLink,
  ChevronLeft,
  MoreVertical,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useBrowserStore } from "@/store/useBrowserStore";
import { getAdblockScript } from "@/utils/adblockScript";
import { BrowserMediaActionsModal } from "@/components/BrowserMediaActionsModal";
import { BrowserSidebar } from "@/components/BrowserSidebar";
import { BrowserAdblockStatsModal } from "@/components/BrowserAdblockStatsModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BrowserScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; search?: string }>();
  const insets = useSafeAreaInsets();

  const webViewRef = useRef<WebView>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [title, setTitle] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSecure, setIsSecure] = useState(true);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeUrl, setActiveUrl] = useState("");
  const [mediaModalState, setMediaModalState] = useState<{
    visible: boolean;
    mediaType: "image" | "video" | null;
    src: string | null;
  }>({
    visible: false,
    mediaType: null,
    src: null,
  });

  const {
    currentUrl,
    setCurrentUrl,
    addToHistory,
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    adblockEnabled,
    setAdblockEnabled,
    blockedCount,
    trackersBlockedCount,
    dataSavedMb,
    timeSavedSeconds,
    incrementBlockedCount,
    resetStats,
  } = useBrowserStore();

  // Load initial URL
  useEffect(() => {
    let targetUrl = "https://www.google.com";

    if (params.url) {
      targetUrl = params.url;
    } else if (params.search) {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(params.search)}`;
    } else if (currentUrl) {
      targetUrl = currentUrl;
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    setActiveUrl(targetUrl);
    setInputUrl(targetUrl);
  }, [params.url, params.search]);

  // Handle hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      } else {
        router.back();
        return true;
      }
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigate = (urlText: string) => {
    Keyboard.dismiss();
    let url = urlText.trim();
    if (!url) return;

    // Check if it looks like a URL
    const urlPattern =
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    const ipPattern =
      /^(https?:\/\/)?\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/;

    if (
      urlPattern.test(url) ||
      ipPattern.test(url) ||
      (url.includes(".") && !url.includes(" "))
    ) {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
    } else {
      // Otherwise search Google
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }

    setActiveUrl(url);
    setInputUrl(url);
    setIsSecure(url.startsWith("https://"));
  };

  const handleReload = () => {
    webViewRef.current?.reload();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${title}\n${currentUrl}`,
        url: currentUrl,
      });
    } catch (e) {
      console.warn("Share failed", e);
    }
  };

  const toggleFavoriteStatus = () => {
    if (isFavorite(currentUrl)) {
      removeFavorite(currentUrl);
    } else {
      addFavorite(currentUrl, title || currentUrl);
    }
  };

  // Process message from WebView (for AdBlock statistics)
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "AD_BLOCKED") {
        incrementBlockedCount(data.count || 1);
      } else if (data.type === "MEDIA_CONTEXT_MENU") {
        setMediaModalState({
          visible: true,
          mediaType: data.mediaType,
          src: data.src,
        });
      }
    } catch (e) {
      // Not a json or not standard message
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* ADDRESS BAR */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.headerButton,
            { backgroundColor: isDark ? "#2A2A2F" : "#F1F5F9" },
          ]}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View
          style={[
            styles.addressInputContainer,
            { backgroundColor: isDark ? "#2A2A2F" : "#F1F5F9" },
          ]}
        >
          {isSecure ? (
            <Lock
              size={14}
              color={isDark ? "#A1A1AA" : "#71717A"}
              style={{ marginRight: 6 }}
            />
          ) : (
            <ShieldAlert
              size={14}
              color={colors.danger}
              style={{ marginRight: 6 }}
            />
          )}
          <TextInput
            style={[styles.addressInput, { color: colors.text }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={() => handleNavigate(inputUrl)}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
            placeholder="Buscar ou digitar endereço"
            placeholderTextColor={colors.textSecondary}
          />
          {loading ? (
            <ActivityIndicator
              size="small"
              color={colors.brandGreen}
              style={{ marginRight: 6 }}
            />
          ) : (
            <TouchableOpacity
              onPress={() => setStatsModalVisible(true)}
              style={styles.inputShieldButton}
            >
              <Shield
                size={16}
                color={
                  adblockEnabled
                    ? isDark
                      ? "#34D399"
                      : "#10B981"
                    : isDark
                      ? "#71717A"
                      : "#A1A1AA"
                }
                fill={
                  adblockEnabled
                    ? isDark
                      ? "#34D399"
                      : "#10B981"
                    : "transparent"
                }
              />
              {adblockEnabled && blockedCount > 0 && (
                <View
                  style={[
                    styles.inlineBadge,
                    { backgroundColor: isDark ? "#3F3F46" : "#E4E4E7" },
                  ]}
                >
                  <Text
                    style={[
                      styles.inlineBadgeText,
                      { color: isDark ? "#F4F4F5" : "#18181B" },
                    ]}
                  >
                    {blockedCount > 99 ? "99+" : blockedCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* MORE VERTICAL BUTTON */}
        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          style={[
            styles.headerButton,
            { backgroundColor: isDark ? "#2A2A2F" : "#F1F5F9" },
          ]}
        >
          <MoreVertical size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* PROGRESS BAR */}
      {loading && progress < 1 && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${progress * 100}%`, backgroundColor: "#07C160" },
            ]}
          />
        </View>
      )}

      {/* WEBVIEW */}
      <View style={styles.webContainer}>
        {activeUrl ? (
          <WebView
            ref={webViewRef}
            source={{ uri: activeUrl }}
            style={styles.webView}
            injectedJavaScriptBeforeContentLoaded={`
              ${getAdblockScript(adblockEnabled)}
              
              (function() {
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
            `}
            onMessage={handleMessage}
            onNavigationStateChange={(navState) => {
              setInputUrl(navState.url);
              setTitle(navState.title);
              setCanGoBack(navState.canGoBack);
              setCanGoForward(navState.canGoForward);
              setIsSecure(navState.url.startsWith("https://"));

              // update store state silently for bookmarking/history
              setCurrentUrl(navState.url);

              if (navState.url && navState.title) {
                addToHistory(navState.url, navState.title);
              }
            }}
            onLoadStart={() => {
              setLoading(true);
              setProgress(0);
            }}
            onLoadEnd={() => setLoading(false)}
            onLoadProgress={({ nativeEvent }) =>
              setProgress(nativeEvent.progress)
            }
          />
        ) : (
          <View
            style={[
              styles.webContainer,
              { justifyContent: "center", alignItems: "center" },
            ]}
          >
            <ActivityIndicator size="large" color="#07C160" />
          </View>
        )}
      </View>

      {/* SIDEBAR MODAL */}
      <BrowserSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={() => webViewRef.current?.goBack()}
        onGoForward={() => webViewRef.current?.goForward()}
        onReload={handleReload}
        isCurrentFavorite={isFavorite(currentUrl)}
        onToggleFavorite={toggleFavoriteStatus}
        onShare={handleShare}
        onOpenAdblockSettings={() => setStatsModalVisible(true)}
      />

      {/* ADBLOCK STATS MODAL */}
      {statsModalVisible && (
        <BrowserAdblockStatsModal
          visible={statsModalVisible}
          onClose={() => setStatsModalVisible(false)}
          adblockEnabled={adblockEnabled}
          onToggleAdblock={() => {
            setAdblockEnabled(!adblockEnabled);
            webViewRef.current?.reload();
          }}
          blockedCount={blockedCount}
          trackersBlockedCount={trackersBlockedCount}
          dataSavedMb={dataSavedMb}
          timeSavedSeconds={timeSavedSeconds}
          onResetStats={resetStats}
        />
      )}

      <BrowserMediaActionsModal
        visible={mediaModalState.visible}
        onClose={() =>
          setMediaModalState((prev) => ({ ...prev, visible: false }))
        }
        mediaType={mediaModalState.mediaType}
        src={mediaModalState.src}
        onOpenInNewTab={(url) => {
          setActiveUrl(url);
          setInputUrl(url);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 30 : 0,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  addressInputContainer: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  addressInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  inputShieldButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginRight: -4,
  },
  inlineBadge: {
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  inlineBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  progressContainer: {
    height: 2,
    width: "100%",
    backgroundColor: "transparent",
  },
  progressBar: {
    height: "100%",
  },
  webContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  bottomBar: {
    height: 52,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
  },
  bottomBarButton: {
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
