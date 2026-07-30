import React, { forwardRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Share2,
  Shield,
  Star,
  Plus,
  Layers,
} from "lucide-react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { useAppTheme } from "@/context/ThemeContext";

interface BrowserSidebarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  isCurrentFavorite: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onOpenAdblockSettings: () => void;
  onOpenHistoryBookmarks: () => void;
  onCreateTab: () => void;
  onOpenTabManager: () => void;
  tabsCount: number;
}

export const BrowserSidebar = forwardRef<BottomSheetModal, BrowserSidebarProps>(
  (
    {
      canGoBack,
      canGoForward,
      onGoBack,
      onGoForward,
      onReload,
      isCurrentFavorite,
      onToggleFavorite,
      onShare,
      onOpenAdblockSettings,
      onOpenHistoryBookmarks,
      onCreateTab,
      onOpenTabManager,
      tabsCount,
    },
    ref
  ) => {
    const { colors } = useAppTheme();
    const snapPoints = useMemo(() => ["35%"], []);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      []
    );

    const handleClose = () => {
      if (ref && "current" in ref && ref.current) {
        ref.current.dismiss();
      }
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={styles.contentContainer}>
          {/* Top Navigation Row */}
          <View
            style={[styles.bottomSheetNavRow, { borderBottomColor: colors.border }]}
          >
            <TouchableOpacity
              onPress={() => {
                onGoBack();
                handleClose();
              }}
              disabled={!canGoBack}
              style={[
                styles.bottomSheetNavButton,
                { backgroundColor: colors.background, opacity: canGoBack ? 1 : 0.5 },
              ]}
            >
              <ArrowLeft
                size={22}
                color={canGoBack ? colors.text : colors.tabIconDefault}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onGoForward();
                handleClose();
              }}
              disabled={!canGoForward}
              style={[
                styles.bottomSheetNavButton,
                { backgroundColor: colors.background, opacity: canGoForward ? 1 : 0.5 },
              ]}
            >
              <ArrowRight
                size={22}
                color={canGoForward ? colors.text : colors.tabIconDefault}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onReload();
                handleClose();
              }}
              style={[styles.bottomSheetNavButton, { backgroundColor: colors.background }]}
            >
              <RotateCw size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onToggleFavorite();
                handleClose();
              }}
              style={[styles.bottomSheetNavButton, { backgroundColor: colors.background }]}
            >
              <Star
                size={22}
                color={isCurrentFavorite ? "#FFB300" : colors.text}
                fill={isCurrentFavorite ? "#FFB300" : "transparent"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onCreateTab();
                handleClose();
              }}
              style={[styles.bottomSheetNavButton, { backgroundColor: colors.background }]}
            >
              <Plus size={22} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onOpenTabManager();
                handleClose();
              }}
              style={[styles.bottomSheetNavButton, { backgroundColor: colors.background }]}
            >
              <View style={[styles.tabBadge, { borderColor: colors.text }]}>
                <Text style={[styles.tabBadgeText, { color: colors.text }]}>
                  {tabsCount}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Menu Items List */}
          <View style={styles.bottomSheetMenuList}>
            <TouchableOpacity
              onPress={() => {
                onShare();
                handleClose();
              }}
              style={styles.bottomSheetMenuItem}
            >
              <Share2
                size={20}
                color={colors.text}
                style={styles.bottomSheetMenuIcon}
              />
              <Text style={[styles.bottomSheetMenuText, { color: colors.text }]}>
                Compartilhar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                handleClose();
                onOpenHistoryBookmarks();
              }}
              style={styles.bottomSheetMenuItem}
            >
              <Star
                size={20}
                color={colors.text}
                style={styles.bottomSheetMenuIcon}
              />
              <Text style={[styles.bottomSheetMenuText, { color: colors.text }]}>
                Favoritos e Histórico
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                handleClose();
                onOpenAdblockSettings();
              }}
              style={styles.bottomSheetMenuItem}
            >
              <Shield
                size={20}
                color={colors.text}
                style={styles.bottomSheetMenuIcon}
              />
              <Text style={[styles.bottomSheetMenuText, { color: colors.text }]}>
                Configurações do AdBlock
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

BrowserSidebar.displayName = "BrowserSidebar";

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 24,
  },
  bottomSheetNavRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  bottomSheetNavButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  bottomSheetMenuList: {
    paddingVertical: 8,
  },
  bottomSheetMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  bottomSheetMenuIcon: {
    marginRight: 16,
  },
  bottomSheetMenuText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
