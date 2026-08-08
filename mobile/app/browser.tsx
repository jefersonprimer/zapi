import React, { useRef, useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Keyboard,
  BackHandler,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import { useAppTheme } from "@/context/ThemeContext";
import { useBrowserStore } from "@/store/useBrowserStore";
import { getAdblockScript } from "@/utils/adblockScript";

import { BrowserMediaActionsModal } from "@/components/BrowserMediaActionsModal";
import { BrowserBottomSheetModal } from "@/components/BrowserBottomSheetModal";
import { BrowserAdblockStatsModal } from "@/components/BrowserAdblockStatsModal";
import { BrowserTabManagerModal } from "@/components/BrowserTabManagerModal";
import { BrowserHistoryBookmarksModal } from "@/components/BrowserHistoryBookmarksModal";
import { StickerEditorModal } from "@/components/StickerEditorModal";

const MAX_ACTIVE_WEBVIEWS = 3;

export default function BrowserScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; search?: string }>();
  const insets = useSafeAreaInsets();

  // Multi-tab WebView references
  const webViewRefs = useRef<{ [tabId: string]: WebView | null }>({});

  const {
    tabs,
    activeTabId,
    createTab,
    updateTabState,
    addToHistory,
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

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const [inputUrl, setInputUrl] = useState("");
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const sidebarRef = useRef<BottomSheetModal>(null);
  const [tabManagerVisible, setTabManagerVisible] = useState(false);
  const [historyBookmarksVisible, setHistoryBookmarksVisible] = useState(false);

  const [mediaModalState, setMediaModalState] = useState<{
    visible: boolean;
    mediaType: "image" | "video" | null;
    src: string | null;
  }>({
    visible: false,
    mediaType: null,
    src: null,
  });

  const [editorState, setEditorState] = useState<{
    visible: boolean;
    imageUri: string | null;
  }>({
    visible: false,
    imageUri: null,
  });

  const lastHandledParams = useRef<{ url?: string; search?: string }>({});

  // Load initial URL if passed in parameters or fallback to active tab URL
  useEffect(() => {
    const urlChanged = params.url !== lastHandledParams.current.url;
    const searchChanged = params.search !== lastHandledParams.current.search;

    if (urlChanged || searchChanged) {
      lastHandledParams.current = { url: params.url, search: params.search };

      if (params.url) {
        let targetUrl = params.url;
        if (
          !targetUrl.startsWith("http://") &&
          !targetUrl.startsWith("https://")
        ) {
          targetUrl = "https://" + targetUrl;
        }
        // Open in active tab
        updateTabState(activeTabId, {
          url: targetUrl,
          navigationUrl: targetUrl,
        });
        setInputUrl(targetUrl);
      } else if (params.search) {
        const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(params.search)}`;
        updateTabState(activeTabId, {
          url: targetUrl,
          navigationUrl: targetUrl,
        });
        setInputUrl(targetUrl);
      }
    }
  }, [params.url, params.search, activeTabId, updateTabState]);

  // Synchronize search input when active tab changes
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
    }
  }, [activeTabId, activeTab]);

  // Handle hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      const activeWebView = webViewRefs.current[activeTabId];
      if (activeTab.canGoBack && activeWebView) {
        activeWebView.goBack();
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
  }, [activeTab.canGoBack, activeTabId, router]);

  // Dynamically inject JS to update body zoom when zoom changes
  useEffect(() => {
    const activeWebView = webViewRefs.current[activeTabId];
    if (activeWebView) {
      const zoomVal = activeTab.zoom || 100;
      activeWebView.injectJavaScript(`
        (function() {
          document.body.style.zoom = '${zoomVal}%';
        })();
        true;
      `);
    }
  }, [activeTabId, activeTab.zoom]);

  // Dynamically inject JS to toggle dark mode when theme changes
  useEffect(() => {
    const toggleScript = `
      (function() {
        var existingStyle = document.getElementById('dark-mode-style');
        if (${isDark}) {
          if (!existingStyle) {
            var style = document.createElement('style');
            style.id = 'dark-mode-style';
            style.type = 'text/css';
            style.innerHTML = 'html { filter: invert(1) hue-rotate(180deg) !important; background: #000 !important; } img, video, iframe, canvas, svg { filter: invert(1) hue-rotate(180deg) !important; }';
            document.head.appendChild(style);
          }
        } else {
          if (existingStyle) {
            existingStyle.remove();
          }
        }
      })();
      true;
    `;

    Object.values(webViewRefs.current).forEach((webView) => {
      if (webView) {
        webView.injectJavaScript(toggleScript);
      }
    });
  }, [isDark]);

  const handleNavigate = (urlText: string) => {
    Keyboard.dismiss();
    let url = urlText.trim();
    if (!url) return;

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
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }

    setInputUrl(url);
    updateTabState(activeTabId, { url, navigationUrl: url });
  };

  const handleReload = () => {
    webViewRefs.current[activeTabId]?.reload();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${activeTab.title}\n${activeTab.url}`,
        url: activeTab.url,
      });
    } catch (e) {
      console.warn("Share failed", e);
    }
  };

  const toggleFavoriteStatus = () => {
    if (isFavorite(activeTab.url)) {
      removeFavorite(activeTab.url);
    } else {
      addFavorite(activeTab.url, activeTab.title || activeTab.url);
    }
  };

  const handleMessage = (event: any, tabId: string) => {
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
    } catch {
      // Ignored
    }
  };

  // Determine which tabs to render based on LRU to conserve memory
  const activeTabsToRender = [...tabs]
    .sort((a, b) => b.lastActive - a.lastActive)
    .slice(0, MAX_ACTIVE_WEBVIEWS)
    .map((t) => t.id);

  // Styling helpers for Incognito Mode
  const isIncognito = activeTab.isIncognito;
  const headerBackground = "transparent";
  const inputBackground = isIncognito
    ? "#312E81"
    : isDark
      ? "#2A2A2F"
      : "#F1F5F9";
  const inputTextColor = isIncognito ? "#FFFFFF" : colors.text;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isIncognito ? "#0F172A" : colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* ADDRESS BAR */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: headerBackground,
            borderBottomColor: "transparent",
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerButton, { backgroundColor: inputBackground }]}
        >
          <Ionicons
            name="chevron-back-outline"
            size={24}
            color={isIncognito ? "#FFFFFF" : colors.text}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.addressInputContainer,
            { backgroundColor: inputBackground },
          ]}
        >
          <TextInput
            style={[styles.addressInput, { color: inputTextColor }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={() => handleNavigate(inputUrl)}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
            placeholder={
              isIncognito ? "Guia Anônima" : "Buscar ou digitar endereço"
            }
            placeholderTextColor={
              isIncognito ? "#C7D2FE" : colors.textSecondary
            }
          />
          {activeTab.loading ? (
            <ActivityIndicator
              size="small"
              color={isIncognito ? "#818CF8" : colors.brandGreen}
              style={{ marginRight: 6 }}
            />
          ) : (
            <TouchableOpacity
              onPress={handleReload}
              style={{ marginRight: 6, padding: 4 }}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={24}
                color={isIncognito ? "#A5B4FC" : isDark ? "#A1A1AA" : "#71717A"}
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => sidebarRef.current?.present()}
          style={[styles.headerButton, { backgroundColor: inputBackground }]}
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={24}
            color={isIncognito ? "#FFFFFF" : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* WEBVIEWS */}
      <View style={styles.webContainer}>
        {tabs.map((tab) => {
          const shouldRender = activeTabsToRender.includes(tab.id);
          const isCurrentlyActive = tab.id === activeTabId;

          if (!shouldRender) return null;

          return (
            <View
              key={tab.id}
              style={[
                styles.webViewWrapper,
                { display: isCurrentlyActive ? "flex" : "none" },
              ]}
            >
              <WebView
                ref={(ref) => {
                  webViewRefs.current[tab.id] = ref;
                }}
                source={{ uri: tab.navigationUrl }}
                style={styles.webView}
                pullToRefreshEnabled={true}
                bounces={true}
                nestedScrollEnabled={true}
                injectedJavaScriptBeforeContentLoaded={`
                  ${getAdblockScript(adblockEnabled)}
                  
                  if (${isDark}) {
                    var style = document.createElement('style');
                    style.id = 'dark-mode-style';
                    style.type = 'text/css';
                    style.innerHTML = 'html { filter: invert(1) hue-rotate(180deg) !important; background: #000 !important; } img, video, iframe, canvas, svg { filter: invert(1) hue-rotate(180deg) !important; }';
                    document.head.appendChild(style);
                  }
                  
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
                injectedJavaScript={`
                  (function() {
                    document.body.style.zoom = '${tab.zoom || 100}%';
                  })();
                  true;
                `}
                onMessage={(e) => handleMessage(e, tab.id)}
                onNavigationStateChange={(navState) => {
                  // Update tab URL states dynamically
                  updateTabState(tab.id, {
                    url: navState.url,
                    title: navState.title,
                    canGoBack: navState.canGoBack,
                    canGoForward: navState.canGoForward,
                    loading: navState.loading,
                  });

                  if (isCurrentlyActive) {
                    setInputUrl(navState.url);
                  }

                  if (navState.url && navState.title) {
                    addToHistory(navState.url, navState.title);
                  }
                }}
                onLoadStart={() => {
                  updateTabState(tab.id, { loading: true });
                }}
                onLoadEnd={() => {
                  updateTabState(tab.id, { loading: false });
                }}
              />
            </View>
          );
        })}
      </View>

      {/* SIDEBAR MODAL */}
      <BrowserBottomSheetModal
        ref={sidebarRef}
        canGoBack={activeTab.canGoBack}
        canGoForward={activeTab.canGoForward}
        onGoBack={() => webViewRefs.current[activeTabId]?.goBack()}
        onGoForward={() => webViewRefs.current[activeTabId]?.goForward()}
        onReload={handleReload}
        isCurrentFavorite={isFavorite(activeTab.url)}
        onToggleFavorite={toggleFavoriteStatus}
        onShare={handleShare}
        onOpenAdblockSettings={() => setStatsModalVisible(true)}
        onOpenHistoryBookmarks={() => setHistoryBookmarksVisible(true)}
        onCreateTab={() => createTab("https://www.google.com", isIncognito)}
        onOpenTabManager={() => setTabManagerVisible(true)}
        tabsCount={tabs.length}
        zoom={activeTab.zoom || 100}
        onZoomIn={() => {
          const currentZoom = activeTab.zoom || 100;
          updateTabState(activeTabId, {
            zoom: Math.min(currentZoom + 10, 200),
          });
        }}
        onZoomOut={() => {
          const currentZoom = activeTab.zoom || 100;
          updateTabState(activeTabId, { zoom: Math.max(currentZoom - 10, 50) });
        }}
        onResetZoom={() => {
          updateTabState(activeTabId, { zoom: 100 });
        }}
      />

      {/* TAB MANAGER MODAL */}
      {tabManagerVisible && (
        <BrowserTabManagerModal
          visible={tabManagerVisible}
          onClose={() => setTabManagerVisible(false)}
        />
      )}

      {/* HISTORY & BOOKMARKS MODAL */}
      {historyBookmarksVisible && (
        <BrowserHistoryBookmarksModal
          visible={historyBookmarksVisible}
          onClose={() => setHistoryBookmarksVisible(false)}
          onNavigateToUrl={(url) => {
            updateTabState(activeTabId, { url, navigationUrl: url });
            setInputUrl(url);
          }}
        />
      )}

      {/* ADBLOCK STATS MODAL */}
      {statsModalVisible && (
        <BrowserAdblockStatsModal
          visible={statsModalVisible}
          onClose={() => setStatsModalVisible(false)}
          adblockEnabled={adblockEnabled}
          onToggleAdblock={() => {
            setAdblockEnabled(!adblockEnabled);
            handleReload();
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
          createTab(url, isIncognito);
        }}
        onTransformSticker={(imageUri) => {
          setEditorState({
            visible: true,
            imageUri: imageUri,
          });
        }}
      />

      <StickerEditorModal
        visible={editorState.visible}
        imageUri={editorState.imageUri}
        onClose={() => setEditorState({ visible: false, imageUri: null })}
        onSaveAndSend={() => {
          // In standalone browser, we don't have a chat to send to directly,
          // so saving it to the database/library is sufficient.
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
  webContainer: {
    flex: 1,
  },
  webViewWrapper: {
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
  tabBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
