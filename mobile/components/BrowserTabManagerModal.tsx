import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
  Dimensions,
  StatusBar,
  TextInput,
} from "react-native";

import { useAppTheme } from "@/context/ThemeContext";
import { useBrowserStore, BrowserTab } from "@/store/useBrowserStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface BrowserTabManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 36) / 2; // Sleek spacing for two columns

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
  const [searchQuery, setSearchQuery] = useState("");

  // Sync mode with currently active tab upon opening
  useEffect(() => {
    if (visible && activeTab) {
      setActiveMode(activeTab.isIncognito ? "incognito" : "normal");
      setSearchQuery(""); // Reset search
    }
  }, [visible, activeTabId, activeTab]);

  const filteredTabs = tabs
    .filter((t) =>
      activeMode === "incognito" ? t.isIncognito : !t.isIncognito,
    )
    .filter((t) =>
      searchQuery
        ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.url.toLowerCase().includes(searchQuery.toLowerCase())
        : true,
    );

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

  const renderTabCard = ({ item }: { item: BrowserTab }) => {
    const isActive = item.id === activeTabId;
    const isIncognito = item.isIncognito;
    const domain = getDomain(item.url);
    const initial = getInitial(item.title, item.url);

    // iOS system card colors
    const cardBg = isIncognito
      ? "#2C2C2E" // Apple systemGray4 (Dark)
      : isDark
        ? "#1C1C1E" // Apple systemGray6 (Dark)
        : "#FFFFFF"; // Pure white card

    const titleColor = isIncognito || isDark ? "#FFFFFF" : "#000000";
    const domainColor = isIncognito
      ? "#8E8E93"
      : isDark
        ? "#8E8E93"
        : "#8E8E93";

    // Apple active tab border/shadow glow (subtle, clean, and elegant)
    const activeBorderColor = isIncognito
      ? "#A78BFA"
      : colors.brandGreen || "#34C759";

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.tabCard,
          {
            backgroundColor: cardBg,
            borderColor: isActive
              ? activeBorderColor
              : isIncognito
                ? "#3A3A3C"
                : isDark
                  ? "#2C2C2E"
                  : "#E5E5EA",
            borderWidth: isActive ? 2.5 : 1,
            shadowOpacity: isActive ? 0.3 : 0.08,
            shadowRadius: isActive ? 10 : 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: isActive ? 4 : 2 },
            elevation: isActive ? 6 : 2,
          },
        ]}
        onPress={() => handleSelectTab(item.id)}
      >
        {/* iOS Close Button (Floating in top right of card like Safari) */}
        <TouchableOpacity
          style={[
            styles.closeButton,
            {
              backgroundColor: isIncognito
                ? "rgba(255, 255, 255, 0.2)"
                : "rgba(0, 0, 0, 0.08)",
            },
          ]}
          onPress={() => closeTab(item.id)}
        >
          <MaterialCommunityIcons
            name="close"
            size={20}
            color={isIncognito || isDark ? "#FFFFFF" : "#3D3D3D"}
          />
        </TouchableOpacity>

        {/* Card Body / Webpage Mockup Viewport */}
        <View style={styles.cardViewport}>
          {/* Mini Webpage Header Banner */}
          <View
            style={[
              styles.cardViewportHeader,
              {
                backgroundColor: isIncognito
                  ? "#1C1C1E"
                  : isDark
                    ? "#121212"
                    : "#F2F2F7",
              },
            ]}
          >
            <View style={styles.faviconContainer}>
              {isIncognito ? (
                <MaterialCommunityIcons
                  name="eye-off"
                  size={11}
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
                  size={11}
                  color={isDark ? "#AEAEB2" : "#8E8E93"}
                />
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.miniUrlText, { color: domainColor }]}
            >
              {domain}
            </Text>
          </View>

          {/* Webpage Content Representation */}
          <View
            style={[
              styles.cardViewportContent,
              {
                backgroundColor: isIncognito
                  ? "#121212"
                  : isDark
                    ? "#0A0A0A"
                    : "#F9F9FC",
              },
            ]}
          >
            {/* Elegant preview placeholder to look like a real iOS tab preview */}
            <View
              style={[
                styles.previewMockCircle,
                {
                  backgroundColor: isIncognito
                    ? "#2C2C2E"
                    : isDark
                      ? "#1C1C1E"
                      : "#E5E5EA",
                },
              ]}
            >
              <Text
                style={[
                  styles.previewLetter,
                  {
                    color: isIncognito
                      ? "#A78BFA"
                      : isDark
                        ? "#FFFFFF"
                        : "#8E8E93",
                  },
                ]}
              >
                {initial}
              </Text>
            </View>
            <View style={styles.previewLines}>
              <View
                style={[
                  styles.previewLine,
                  {
                    width: "70%",
                    backgroundColor: isIncognito
                      ? "#2C2C2E"
                      : isDark
                        ? "#1C1C1E"
                        : "#EAF0F6",
                  },
                ]}
              />
              <View
                style={[
                  styles.previewLine,
                  {
                    width: "40%",
                    backgroundColor: isIncognito
                      ? "#2C2C2E"
                      : isDark
                        ? "#1C1C1E"
                        : "#EAF0F6",
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Card Footer (Tab Title) */}
        <View style={styles.cardFooter}>
          <Text
            numberOfLines={1}
            style={[styles.cardTitle, { color: titleColor }]}
          >
            {item.title || "Nova Guia"}
          </Text>
        </View>
      </TouchableOpacity>
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
          <View style={{ width: 60 }} />

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

          {/* Done/Concluir Button */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text
              style={[
                styles.doneButtonText,
                {
                  color:
                    activeMode === "incognito"
                      ? "#A78BFA"
                      : colors.brandGreen || "#007AFF",
                },
              ]}
            >
              OK
            </Text>
          </TouchableOpacity>
        </View>

        {/* Safari-style Top Search Bar */}
        <View style={styles.searchBarContainer}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor:
                  activeMode === "incognito"
                    ? "#1C1C1E"
                    : isDark
                      ? "#1C1C1E"
                      : "#E3E3E9",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color="#8E8E93"
              style={{ marginRight: 6 }}
            />
            <TextInput
              placeholder="Buscar abas"
              placeholderTextColor="#8E8E93"
              style={[
                styles.searchInput,
                {
                  color:
                    activeMode === "incognito" || isDark
                      ? "#FFFFFF"
                      : "#000000",
                },
              ]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              autoCapitalize="none"
            />
          </View>
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
          <FlatList
            data={filteredTabs}
            renderItem={renderTabCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Safari Floating Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor:
                activeMode === "incognito"
                  ? "#1C1C1E"
                  : isDark
                    ? "#161618"
                    : "#FFFFFF",
              borderTopColor:
                activeMode === "incognito"
                  ? "#2C2C2E"
                  : isDark
                    ? "#2C2C2E"
                    : "#E5E5EA",
            },
          ]}
        >
          {/* Left Plus Add Button */}
          <TouchableOpacity
            style={[
              styles.plusButton,
              {
                backgroundColor:
                  activeMode === "incognito"
                    ? "rgba(255, 255, 255, 0.08)"
                    : isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.04)",
              },
            ]}
            onPress={handleNewTab}
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={
                activeMode === "incognito"
                  ? "#A78BFA"
                  : colors.brandGreen || "#007AFF"
              }
            />
          </TouchableOpacity>

          {/* Center Tabs Badge */}
          <View style={styles.centerBadgeContainer}>
            <Text
              style={[
                styles.tabCountText,
                {
                  color:
                    activeMode === "incognito" || isDark
                      ? "#FFFFFF"
                      : "#000000",
                },
              ]}
            >
              {filteredTabs.length === 1
                ? `1 aba`
                : `${filteredTabs.length} abas`}
            </Text>
          </View>

          {/* Empty placeholder to mirror Safari layout symmetrically */}
          <View style={{ width: 36 }} />
        </View>
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
  searchBarContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
  searchBar: {
    flexDirection: "row",
    height: 40,
    borderRadius: 50,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    padding: 0,
  },
  listContent: {
    padding: 12,
    paddingBottom: 110,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tabCard: {
    width: CARD_WIDTH,
    height: 190,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  cardViewport: {
    flex: 1,
    flexDirection: "column",
  },
  cardViewportHeader: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  faviconContainer: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  faviconText: {
    fontSize: 10,
  },
  miniUrlText: {
    fontSize: 10,
    fontWeight: "500",
    flex: 1,
  },
  cardViewportContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  previewMockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  previewLetter: {
    fontSize: 18,
    fontWeight: "600",
  },
  previewLines: {
    width: "100%",
    alignItems: "center",
    gap: 4,
  },
  previewLine: {
    height: 3,
    borderRadius: 1.5,
  },
  cardFooter: {
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.03)",
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "500",
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
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBadgeContainer: {
    flex: 1,
    alignItems: "center",
  },
  tabCountText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
