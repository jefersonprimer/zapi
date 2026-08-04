import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/context/ThemeContext";
import { UserContactCard } from "@/components/UserContactCard";
import { UserSearchResult } from "@/services/api";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.6;

interface AddGroupMemberModalProps {
  visible: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  searching: boolean;
  searchResults: UserSearchResult[];
  groupParticipants: { id: string }[];
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string, username: string) => void;
  actionLoadingUserId?: string | null;
}

export function AddGroupMemberModal({
  visible,
  onClose,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  searching,
  searchResults,
  groupParticipants,
  onAddMember,
  onRemoveMember,
  actionLoadingUserId,
}: AddGroupMemberModalProps) {
  const { colors, isDark } = useAppTheme();
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: MODAL_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlayContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                backgroundColor: colors.modalOverlay || "rgba(0,0,0,0.5)",
                opacity: backdropAnim,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              borderColor: colors.border,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar for visual indicator */}
          <View style={styles.handleBarContainer}>
            <View
              style={[
                styles.handleBar,
                { backgroundColor: isDark ? "#475569" : "#CBD5E1" },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Adicionar Membros
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons
                name="close-outline"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Search Input Bar */}
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Buscar por usuário..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              onSubmitEditing={onSearch}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searching ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => onSearchQueryChange("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* User Results List */}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isMember = groupParticipants.some((p) => p.id === item.id);
              const isActionLoading = actionLoadingUserId === item.id;

              return (
                <UserContactCard
                  username={item.username}
                  name={item.name}
                  avatarUrl={item.avatar_url}
                  email={item.email}
                  containerStyle={styles.cardContainer}
                  rightElement={
                    isActionLoading ? (
                      <ActivityIndicator size="small" color={colors.tint} />
                    ) : isMember ? (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: colors.danger || "#EF4444" },
                        ]}
                        onPress={() =>
                          onRemoveMember(item.id, item.name || item.username)
                        }
                      >
                        <Ionicons name="trash-outline" size={16} color="#FFF" />
                        <Text style={styles.actionBtnText}>Remover</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: colors.tint || "#07C160" },
                        ]}
                        onPress={() => onAddMember(item.id)}
                      >
                        <Ionicons name="add-outline" size={16} color="#FFF" />
                        <Text style={styles.actionBtnText}>Adicionar</Text>
                      </TouchableOpacity>
                    )
                  }
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {searching ? (
                  <ActivityIndicator size="large" color={colors.tint} />
                ) : (
                  <Text
                    style={[
                      styles.emptyText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {searchQuery.trim().length === 0
                      ? "Digite um nome de usuário para buscar."
                      : "Nenhum usuário encontrado."}
                  </Text>
                )}
              </View>
            }
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    height: MODAL_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  handleBarContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingBottom: 16,
  },
  cardContainer: {
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
