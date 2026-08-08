import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
  StatusBar,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useAppTheme } from "@/context/ThemeContext";
import { useBrowserStore, BrowserTab } from "@/store/useBrowserStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface BrowserTabManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.68;
const CARD_HEIGHT = height * 0.68;
const CARD_MARGIN = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN * 2;
const EMPTY_SPACE = (width - CARD_WIDTH) / 2 - CARD_MARGIN;
interface TabCardProps {
  item: BrowserTab;
  index: number;
  isActive: boolean;
  isIncognito: boolean;
  isDark: boolean;
  colors: any;
  scale: any;
  opacity: any;
  handleSelectTab: (id: string) => void;
  closeTab: (id: string) => void;
  renderViewportContent: (
    item: BrowserTab,
    isDark: boolean,
    index: number,
  ) => React.ReactNode;
}

const TabCard = ({
  item,
  index,
  isActive,
  isIncognito,
  isDark,
  colors,
  scale,
  opacity,
  handleSelectTab,
  closeTab,
  renderViewportContent,
}: TabCardProps) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
          const newOpacity = Math.max(0, 1 + gestureState.dy / 250);
          cardOpacity.setValue(newOpacity);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -120) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -CARD_HEIGHT - 100,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
              toValue: 0,
              duration: 180,
              useNativeDriver: true,
            }),
          ]).start(() => {
            closeTab(item.id);
          });
        } else {
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(cardOpacity, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(cardOpacity, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      },
    }),
  ).current;

  const cardBg = isIncognito ? "#2C2C2E" : isDark ? "#1C1C1E" : "#FFFFFF";

  const titleColor = isIncognito || isDark ? "#FFFFFF" : "#000000";

  const activeBorderColor = isIncognito
    ? "#A78BFA"
    : isDark
      ? "#3A3A3C"
      : "#C7C7CC";

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ scale }, { translateY }],
          opacity: Animated.multiply(opacity, cardOpacity),
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.tabCard,
          {
            backgroundColor: "transparent",
            borderColor: isActive
              ? activeBorderColor
              : isIncognito
                ? "#3A3A3C"
                : isDark
                  ? "#2C2C2E"
                  : "#E5E5EA",
            borderWidth: 0,
            shadowOpacity: isActive ? 0.3 : 0.08,
            shadowRadius: isActive ? 10 : 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: isActive ? 4 : 2 },
            elevation: isActive ? 6 : 2,
          },
        ]}
        onPress={() => handleSelectTab(item.id)}
      >
        <View style={styles.cardViewport}>
          <View style={styles.cardViewportHeader}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.faviconContainer}>
                {isIncognito ? (
                  <MaterialCommunityIcons
                    name="eye-off"
                    size={13}
                    color="#A78BFA"
                  />
                ) : item.url.includes("google.com") ? (
                  <Text
                    style={[
                      styles.faviconText,
                      { color: "#4285F4", fontWeight: "bold" },
                    ]}
                  >
                    G
                  </Text>
                ) : (
                  <MaterialCommunityIcons
                    name="earth"
                    size={13}
                    color={isDark ? "#AEAEB2" : "#8E8E93"}
                  />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.miniUrlText, { color: titleColor }]}
              >
                {item.title || "Nova Guia"}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.cardViewportContent,
              {
                backgroundColor: cardBg,
                borderRadius: 24,
                overflow: "hidden",
              },
            ]}
          >
            {renderViewportContent(item, isDark, index)}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
export function BrowserTabManagerModal({
  visible,
  onClose,
}: BrowserTabManagerModalProps) {
  const { colors, isDark } = useAppTheme();
  const { tabs, activeTabId, createTab, closeTab, setActiveTabId } =
    useBrowserStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [activeMode, setActiveMode] = useState<"normal" | "incognito">(
    "normal",
  );

  const flatListRef = useRef<FlatList<BrowserTab>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Sync mode with currently active tab upon opening
  useEffect(() => {
    if (visible && activeTab) {
      setActiveMode(activeTab.isIncognito ? "incognito" : "normal");
    }
  }, [visible, activeTabId, activeTab]);

  const filteredTabs = tabs.filter((t) =>
    activeMode === "incognito" ? t.isIncognito : !t.isIncognito,
  );

  // Scroll to active tab on open or mode switch
  useEffect(() => {
    if (visible && filteredTabs.length > 0) {
      const index = filteredTabs.findIndex((t) => t.id === activeTabId);
      if (index !== -1) {
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: false,
          });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [visible, activeMode, filteredTabs.length]);

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
    onClose();
  };

  const handleNewTab = () => {
    const isIncognito = activeMode === "incognito";
    createTab("https://www.google.com", isIncognito);
    onClose();
  };

  const getDomain = (url: string) => {
    try {
      const cleanUrl = url.replace(/(^\w+:|^)\/\//, "").split("/")[0];
      return cleanUrl.replace("www.", "") || url;
    } catch {
      return url;
    }
  };

  const getInitial = (title: string, url: string) => {
    if (title && title !== "Nova Guia" && title !== "Guia Anônima") {
      return title.charAt(0).toUpperCase();
    }
    const domain = getDomain(url);
    return domain ? domain.charAt(0).toUpperCase() : "G";
  };

  const getItemLayout = (data: any, index: number) => ({
    length: SNAP_INTERVAL,
    offset: SNAP_INTERVAL * index,
    index,
  });

  const renderViewportContent = (
    item: BrowserTab,
    isDark: boolean,
    index: number,
  ) => {
    const isIncognito = item.isIncognito;
    const url = item.url.toLowerCase();
    const activeIndex = filteredTabs.findIndex((t) => t.id === activeTabId);

    // Render live active tab AND the next tab in the list using WebView
    if (index === activeIndex || index === activeIndex + 1) {
      return (
        <View style={styles.realWebViewContainer} pointerEvents="none">
          <WebView
            source={{ uri: item.url }}
            style={styles.realWebView}
            androidLayerType="hardware"
            domStorageEnabled={true}
            javaScriptEnabled={true}
          />
          <View style={styles.realWebViewOverlay} />
        </View>
      );
    }

    if (isIncognito) {
      return (
        <View style={styles.mockIncognitoContainer}>
          <MaterialCommunityIcons
            name="eye-off"
            size={36}
            color="#A78BFA"
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.mockIncognitoTitle}>Navegação Privada</Text>
          <View style={styles.mockIncognitoLines}>
            <View style={styles.mockIncognitoLine} />
            <View style={[styles.mockIncognitoLine, { width: "80%" }]} />
            <View style={[styles.mockIncognitoLine, { width: "60%" }]} />
          </View>
        </View>
      );
    }

    if (url.includes("google.com")) {
      return (
        <View style={styles.mockGoogleContainer}>
          <View style={styles.mockGoogleLogo}>
            <Text style={[styles.mockGoogleLetter, { color: "#4285F4" }]}>
              G
            </Text>
            <Text style={[styles.mockGoogleLetter, { color: "#EA4335" }]}>
              o
            </Text>
            <Text style={[styles.mockGoogleLetter, { color: "#FBBC05" }]}>
              o
            </Text>
            <Text style={[styles.mockGoogleLetter, { color: "#4285F4" }]}>
              g
            </Text>
            <Text style={[styles.mockGoogleLetter, { color: "#34A853" }]}>
              l
            </Text>
            <Text style={[styles.mockGoogleLetter, { color: "#EA4335" }]}>
              e
            </Text>
          </View>
          <View
            style={[
              styles.mockSearchBar,
              { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
            ]}
          >
            <MaterialCommunityIcons name="magnify" size={14} color="#8E8E93" />
            <View style={styles.mockSearchBarPlaceholder} />
            <MaterialCommunityIcons
              name="microphone"
              size={14}
              color="#4285F4"
            />
          </View>
          <View style={styles.mockShortcuts}>
            <View
              style={[
                styles.mockShortcutDot,
                { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
              ]}
            />
            <View
              style={[
                styles.mockShortcutDot,
                { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
              ]}
            />
            <View
              style={[
                styles.mockShortcutDot,
                { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
              ]}
            />
            <View
              style={[
                styles.mockShortcutDot,
                { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
              ]}
            />
          </View>
        </View>
      );
    }

    if (url.includes("github.com")) {
      return (
        <View style={styles.mockGithubContainer}>
          <View style={styles.mockGithubHeader}>
            <MaterialCommunityIcons
              name="github"
              size={20}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
            <Text
              style={[
                styles.mockGithubUser,
                { color: isDark ? "#FFFFFF" : "#000000" },
              ]}
            >
              dashboard
            </Text>
          </View>
          <View style={styles.mockGithubRepoList}>
            <View
              style={[
                styles.mockGithubRepoCard,
                { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
              ]}
            >
              <View style={styles.mockGithubRepoRow}>
                <View
                  style={[styles.mockLangDot, { backgroundColor: "#F1E05A" }]}
                />
                <View
                  style={[
                    styles.mockGithubRepoTitle,
                    { backgroundColor: isDark ? "#3A3A3C" : "#D1D1D6" },
                  ]}
                />
              </View>
              <View
                style={[
                  styles.mockGithubRepoDesc,
                  { backgroundColor: isDark ? "#1C1C1E" : "#C7C7CC" },
                ]}
              />
            </View>
            <View
              style={[
                styles.mockGithubRepoCard,
                { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
              ]}
            >
              <View style={styles.mockGithubRepoRow}>
                <View
                  style={[styles.mockLangDot, { backgroundColor: "#3178C6" }]}
                />
                <View
                  style={[
                    styles.mockGithubRepoTitle,
                    {
                      backgroundColor: isDark ? "#3A3A3C" : "#D1D1D6",
                      width: "50%",
                    },
                  ]}
                />
              </View>
              <View
                style={[
                  styles.mockGithubRepoDesc,
                  { backgroundColor: isDark ? "#1C1C1E" : "#C7C7CC" },
                ]}
              />
            </View>
          </View>
        </View>
      );
    }

    if (url.includes("wikipedia.org")) {
      return (
        <View style={styles.mockWikiContainer}>
          <View style={styles.mockWikiHeader}>
            <MaterialCommunityIcons
              name="wikipedia"
              size={20}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
            <Text
              style={[
                styles.mockWikiTitle,
                { color: isDark ? "#FFFFFF" : "#000000" },
              ]}
            >
              Wikipedia
            </Text>
          </View>
          <View style={styles.mockWikiContent}>
            <View
              style={[
                styles.mockWikiFeaturedImage,
                { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
              ]}
            />
            <View style={styles.mockWikiLines}>
              <View
                style={[
                  styles.mockWikiLine,
                  {
                    backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA",
                    width: "90%",
                  },
                ]}
              />
              <View
                style={[
                  styles.mockWikiLine,
                  {
                    backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA",
                    width: "100%",
                  },
                ]}
              />
              <View
                style={[
                  styles.mockWikiLine,
                  {
                    backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA",
                    width: "80%",
                  },
                ]}
              />
            </View>
          </View>
        </View>
      );
    }

    // Generic Mockup
    return (
      <View style={styles.mockGenericContainer}>
        {/* Mock Hero Header / Banner */}
        <View
          style={[
            styles.mockGenericHero,
            { backgroundColor: isDark ? "#2C2C2E" : "#E8ECF2" },
          ]}
        >
          <MaterialCommunityIcons
            name="earth"
            size={24}
            color={isDark ? "#555" : "#CCC"}
          />
        </View>
        {/* Skeleton content */}
        <View style={styles.mockGenericBody}>
          <View
            style={[
              styles.mockGenericTitle,
              { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
            ]}
          />
          <View
            style={[
              styles.mockGenericLine,
              {
                backgroundColor: isDark ? "#1C1C1E" : "#F0F0F0",
                width: "100%",
              },
            ]}
          />
          <View
            style={[
              styles.mockGenericLine,
              { backgroundColor: isDark ? "#1C1C1E" : "#F0F0F0", width: "85%" },
            ]}
          />
          <View
            style={[
              styles.mockGenericLine,
              { backgroundColor: isDark ? "#1C1C1E" : "#F0F0F0", width: "60%" },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderTabCard = ({
    item,
    index,
  }: {
    item: BrowserTab;
    index: number;
  }) => {
    const isActive = item.id === activeTabId;
    const isIncognito = item.isIncognito;

    const inputRange = [
      (index - 1) * SNAP_INTERVAL,
      index * SNAP_INTERVAL,
      (index + 1) * SNAP_INTERVAL,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: "clamp",
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.75, 1, 0.75],
      extrapolate: "clamp",
    });

    return (
      <TabCard
        item={item}
        index={index}
        isActive={isActive}
        isIncognito={isIncognito}
        isDark={isDark}
        colors={colors}
        scale={scale}
        opacity={opacity}
        handleSelectTab={handleSelectTab}
        closeTab={closeTab}
        renderViewportContent={renderViewportContent}
      />
    );
  };

  // True Apple Safari-style dark/light background setup
  const modalBg =
    activeMode === "incognito"
      ? "#000000" // Private browsing background
      : isDark
        ? "#000000"
        : "#F2F2F7"; // iOS systemGroupedBackground

  const headerBottomBorder =
    activeMode === "incognito" ? "#1C1C1E" : isDark ? "#1C1C1E" : "#E5E5EA";

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <StatusBar
        barStyle={
          activeMode === "incognito" || isDark
            ? "light-content"
            : "dark-content"
        }
        backgroundColor={modalBg}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: modalBg }]}>
        {/* Navigation / Control Header */}
        <View
          style={[styles.header, { borderBottomColor: headerBottomBorder }]}
        >
          <TouchableOpacity
            style={[
              styles.modalHeaderButton,
              {
                borderColor: isDark ? "#2C2C2E" : "#E5E5EA",
                backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
              },
            ]}
            onPress={onClose}
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={
                activeMode === "incognito" || isDark ? "#FFFFFF" : "#3D3D3D"
              }
            />
          </TouchableOpacity>

          {/* iOS Segmented Control */}
          <View
            style={[
              styles.segmentedControl,
              {
                backgroundColor:
                  activeMode === "incognito"
                    ? "#1C1C1E"
                    : isDark
                      ? "#1C1C1E"
                      : "#7676801F",
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segment,
                activeMode === "normal" && [
                  styles.segmentActive,
                  {
                    backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
                  },
                ],
              ]}
              onPress={() => setActiveMode("normal")}
            >
              <MaterialCommunityIcons
                name="compass"
                size={13}
                color={
                  activeMode === "normal"
                    ? isDark
                      ? "#FFFFFF"
                      : "#000000"
                    : "#8E8E93"
                }
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color:
                      activeMode === "normal"
                        ? isDark
                          ? "#FFFFFF"
                          : "#000000"
                        : "#8E8E93",
                  },
                ]}
              >
                Abas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segment,
                activeMode === "incognito" && [
                  styles.segmentActive,
                  {
                    backgroundColor:
                      activeMode === "incognito"
                        ? "#3A3A3C"
                        : isDark
                          ? "#2C2C2E"
                          : "#FFFFFF",
                  },
                ],
              ]}
              onPress={() => setActiveMode("incognito")}
            >
              <MaterialCommunityIcons
                name="eye-off"
                size={13}
                color={activeMode === "incognito" ? "#A78BFA" : "#8E8E93"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: activeMode === "incognito" ? "#FFFFFF" : "#8E8E93",
                  },
                ]}
              >
                Privado
              </Text>
            </TouchableOpacity>
          </View>

          {/* Plus Button Header (on the right) */}
          <TouchableOpacity
            style={[
              styles.modalHeaderButton,
              {
                backgroundColor: colors.brandGreen || "#34C759",
                borderColor: colors.brandGreen || "#34C759",
              },
            ]}
            onPress={handleNewTab}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Tab Grid or Empty State */}
        {filteredTabs.length === 0 ? (
          <View style={styles.emptyContainer}>
            {activeMode === "incognito" ? (
              <View style={styles.privateIntroContainer}>
                <MaterialCommunityIcons
                  name="eye-off"
                  size={48}
                  color="#A78BFA"
                  style={{ marginBottom: 12 }}
                />
                <Text style={styles.privateIntroTitle}>Navegação Privada</Text>
                <Text style={styles.privateIntroDesc}>
                  O Zapi não lembrará das páginas que você visitou, do seu
                  histórico de busca ou das informações de preenchimento
                  automático depois que você fechar esta aba.
                </Text>
              </View>
            ) : (
              <>
                <MaterialCommunityIcons
                  name="compass"
                  size={40}
                  color={isDark ? "#2C2C2E" : "#D1D1D6"}
                  style={{ marginBottom: 12 }}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: isDark ? "#8E8E93" : "#8E8E93" },
                  ]}
                >
                  Nenhuma Aba Aberta
                </Text>
              </>
            )}
          </View>
        ) : (
          <Animated.FlatList
            ref={flatListRef}
            data={filteredTabs}
            renderItem={renderTabCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            snapToAlignment="center"
            decelerationRate="fast"
            contentContainerStyle={[
              styles.listContent,
              {
                paddingHorizontal: EMPTY_SPACE,
              },
            ]}
            getItemLayout={getItemLayout}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true },
            )}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  segmentedControl: {
    flexDirection: "row",
    height: 32,
    borderRadius: 8,
    padding: 2,
    width: 180,
    alignItems: "center",
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  segmentActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
  },
  doneButton: {
    paddingHorizontal: 8,
    height: "100%",
    justifyContent: "center",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  listContent: {
    paddingVertical: 20,
    alignItems: "center",
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: CARD_MARGIN,
    justifyContent: "center",
    alignItems: "center",
  },
  tabCard: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  headerCloseButton: {
    position: "absolute",
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cardViewport: {
    flex: 1,
    flexDirection: "column",
  },
  cardViewportHeader: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    position: "relative",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  faviconContainer: {
    width: 20,
    height: 20,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  faviconText: {
    fontSize: 12,
  },
  miniUrlText: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },
  cardViewportContent: {
    flex: 1,
  },
  mockIncognitoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  mockIncognitoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  mockIncognitoLines: {
    width: "100%",
    alignItems: "center",
    gap: 4,
  },
  mockIncognitoLine: {
    height: 4,
    width: "90%",
    backgroundColor: "#3A3A3C",
    borderRadius: 2,
  },
  mockGoogleContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  mockGoogleLogo: {
    flexDirection: "row",
    marginBottom: 12,
  },
  mockGoogleLetter: {
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: -1,
  },
  mockSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    borderRadius: 16,
    width: "100%",
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  mockSearchBarPlaceholder: {
    flex: 1,
  },
  mockShortcuts: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
  },
  mockShortcutDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  mockGithubContainer: {
    flex: 1,
    width: "100%",
    padding: 12,
  },
  mockGithubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  mockGithubUser: {
    fontSize: 12,
    fontWeight: "bold",
  },
  mockGithubRepoList: {
    flex: 1,
    gap: 6,
  },
  mockGithubRepoCard: {
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  mockGithubRepoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mockLangDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mockGithubRepoTitle: {
    height: 8,
    width: "70%",
    borderRadius: 4,
  },
  mockGithubRepoDesc: {
    height: 6,
    width: "90%",
    borderRadius: 3,
  },
  mockWikiContainer: {
    flex: 1,
    width: "100%",
    padding: 12,
  },
  mockWikiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  mockWikiTitle: {
    fontSize: 12,
    fontWeight: "bold",
  },
  mockWikiContent: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  mockWikiFeaturedImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  mockWikiLines: {
    flex: 1,
    gap: 6,
  },
  mockWikiLine: {
    height: 5,
    borderRadius: 2.5,
  },
  mockGenericContainer: {
    flex: 1,
    width: "100%",
  },
  mockGenericHero: {
    height: "40%",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  mockGenericBody: {
    flex: 1,
    padding: 10,
    gap: 6,
  },
  mockGenericTitle: {
    height: 8,
    width: "50%",
    borderRadius: 4,
    marginBottom: 4,
  },
  mockGenericLine: {
    height: 4,
    borderRadius: 2,
  },
  cardFooter: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.03)",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
  privateIntroContainer: {
    alignItems: "center",
    textAlign: "center",
  },
  privateIntroTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  privateIntroDesc: {
    fontSize: 13,
    color: "#AEAEB2",
    textAlign: "center",
    lineHeight: 18,
  },
  modalHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  realWebViewContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
  },
  realWebView: {
    flex: 1,
  },
  realWebViewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
});
