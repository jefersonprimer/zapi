import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import {
  useBrowserStore,
  HistoryItem,
  FavoriteItem,
} from "@/store/useBrowserStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface BrowserHistoryBookmarksModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToUrl: (url: string) => void;
}

export function BrowserHistoryBookmarksModal({
  visible,
  onClose,
  onNavigateToUrl,
}: BrowserHistoryBookmarksModalProps) {
  const { colors } = useAppTheme();
  const { history, favorites, clearHistory, removeFavorite } =
    useBrowserStore();

  const [activeTab, setActiveTab] = useState<"favorites" | "history">(
    "favorites",
  );

  const handleSelectUrl = (url: string) => {
    onNavigateToUrl(url);
    onClose();
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => (
    <View style={[styles.listItem, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={styles.listItemTextContainer}
        onPress={() => handleSelectUrl(item.url)}
      >
        <Text
          style={[styles.listItemTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.listItemUrl, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.url}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFavoriteItem = ({ item }: { item: FavoriteItem }) => (
    <View style={[styles.listItem, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={styles.listItemTextContainer}
        onPress={() => handleSelectUrl(item.url)}
      >
        <Text
          style={[styles.listItemTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.listItemUrl, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.url}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeFavorite(item.url)}
      >
        <MaterialCommunityIcons
          name="trash-can"
          size={18}
          color={colors.danger}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Favoritos e Histórico
          </Text>
          <TouchableOpacity style={styles.headerCloseButton} onPress={onClose}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View
          style={[
            styles.tabSelectorContainer,
            { borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "favorites" && [
                styles.activeTabButton,
                { borderBottomColor: colors.brandGreen || "#10B981" },
              ],
            ]}
            onPress={() => setActiveTab("favorites")}
          >
            <MaterialCommunityIcons
              name="star"
              size={18}
              color={
                activeTab === "favorites"
                  ? colors.brandGreen || "#10B981"
                  : colors.textSecondary
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color:
                    activeTab === "favorites"
                      ? colors.brandGreen || "#10B981"
                      : colors.textSecondary,
                },
              ]}
            >
              Favoritos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "history" && [
                styles.activeTabButton,
                { borderBottomColor: colors.brandGreen || "#10B981" },
              ],
            ]}
            onPress={() => setActiveTab("history")}
          >
            <MaterialCommunityIcons
              name="history"
              size={18}
              color={
                activeTab === "history"
                  ? colors.brandGreen || "#10B981"
                  : colors.textSecondary
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color:
                    activeTab === "history"
                      ? colors.brandGreen || "#10B981"
                      : colors.textSecondary,
                },
              ]}
            >
              Histórico
            </Text>
          </TouchableOpacity>
        </View>

        {/* List Content */}
        {activeTab === "favorites" ? (
          <FlatList
            data={favorites}
            renderItem={renderFavoriteItem}
            keyExtractor={(item) => item.url}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: colors.textSecondary }}>
                  Nenhum favorito salvo.
                </Text>
              </View>
            }
          />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={history}
              renderItem={renderHistoryItem}
              keyExtractor={(item, index) => `${item.url}-${index}`}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={{ color: colors.textSecondary }}>
                    Nenhum histórico disponível.
                  </Text>
                </View>
              }
            />
            {history.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.clearAllButton,
                  { backgroundColor: colors.danger },
                ]}
                onPress={clearHistory}
              >
                <MaterialCommunityIcons
                  name="trash-can"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.clearAllText}>Limpar Todo o Histórico</Text>
              </TouchableOpacity>
            )}
          </View>
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
    height: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerCloseButton: {
    padding: 4,
  },
  tabSelectorContainer: {
    flexDirection: "row",
    height: 48,
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  activeTabButton: {
    borderBottomWidth: 3,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  listItemUrl: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
    height: 48,
    borderRadius: 8,
  },
  clearAllText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
