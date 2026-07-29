import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Share2,
  Shield,
  Star,
} from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface BrowserSidebarProps {
  visible: boolean;
  onClose: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  isCurrentFavorite: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onOpenAdblockSettings: () => void;
}

export function BrowserSidebar({
  visible,
  onClose,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onReload,
  isCurrentFavorite,
  onToggleFavorite,
  onShare,
  onOpenAdblockSettings,
}: BrowserSidebarProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.sidebarOverlay}>
        <TouchableOpacity
          style={styles.sidebarDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sidebarContent,
            {
              backgroundColor: colors.surface,
              borderLeftColor: colors.border,
              paddingTop: insets.top || 20,
            },
          ]}
        >
          {/* Top Navigation Row */}
          <View
            style={[styles.sidebarNavRow, { borderBottomColor: colors.border }]}
          >
            <TouchableOpacity
              onPress={() => {
                onGoBack();
                onClose();
              }}
              disabled={!canGoBack}
              style={styles.sidebarNavButton}
            >
              <ArrowLeft
                size={22}
                color={canGoBack ? colors.text : colors.tabIconDefault}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onGoForward();
                onClose();
              }}
              disabled={!canGoForward}
              style={styles.sidebarNavButton}
            >
              <ArrowRight
                size={22}
                color={canGoForward ? colors.text : colors.tabIconDefault}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onReload();
                onClose();
              }}
              style={styles.sidebarNavButton}
            >
              <RotateCw size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onToggleFavorite();
                onClose();
              }}
              style={styles.sidebarNavButton}
            >
              <Star
                size={22}
                color={isCurrentFavorite ? "#FFB300" : colors.text}
                fill={isCurrentFavorite ? "#FFB300" : "transparent"}
              />
            </TouchableOpacity>
          </View>

          {/* Menu Items List */}
          <ScrollView style={styles.sidebarMenuList}>
            <TouchableOpacity
              onPress={() => {
                onShare();
                onClose();
              }}
              style={styles.sidebarMenuItem}
            >
              <Share2
                size={20}
                color={colors.text}
                style={styles.sidebarMenuIcon}
              />
              <Text style={[styles.sidebarMenuText, { color: colors.text }]}>
                Compartilhar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onClose();
                onOpenAdblockSettings();
              }}
              style={styles.sidebarMenuItem}
            >
              <Shield
                size={20}
                color={colors.text}
                style={styles.sidebarMenuIcon}
              />
              <Text style={[styles.sidebarMenuText, { color: colors.text }]}>
                Configurações do AdBlock
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sidebarOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sidebarDismiss: {
    flex: 1,
  },
  sidebarContent: {
    width: 280,
    height: "100%",
    borderLeftWidth: 1,

    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  sidebarNavRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sidebarNavButton: {
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarMenuList: {
    flex: 1,
    paddingTop: 10,
  },
  sidebarMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  sidebarMenuIcon: {
    marginRight: 16,
  },
  sidebarMenuText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
