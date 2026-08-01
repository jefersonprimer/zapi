import React, { forwardRef, useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Share,
  Clipboard,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Link, Share2, PlusCircle, Search, Check } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  getContacts,
  createChat,
  sendMessage,
  type Contact,
  API_URL,
} from "@/services/api";
import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ShareBottomSheetProps {
  clipId: string;
  shareUrl?: string;
  onAddToStatus?: () => void;
  onDismiss?: () => void;
}

export const ShareBottomSheet = forwardRef<
  BottomSheetModal,
  ShareBottomSheetProps
>(
  (
    { clipId, shareUrl = `https://zapi.app/clip/${clipId}`, onAddToStatus, onDismiss },
    ref,
  ) => {
    const { colors, isDark } = useAppTheme();
    const { token } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [sendingIds, setSendingIds] = useState<
      Record<string, "sending" | "sent">
    >({});
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Fetch contacts
    const loadContacts = useCallback(async () => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await getContacts(token);
        setContacts(data);
      } catch (err) {
        console.error("Failed to load contacts for share sheet:", err);
      } finally {
        setLoading(false);
      }
    }, [token]);

    // Show temporary toast inside bottom sheet
    const showToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => {
        setToastMessage(null);
      }, 2000);
    };

    const handleShareToContact = async (contact: Contact) => {
      if (!token) return;
      const contactId = contact.contact_id;

      // Prevent double tap or resending if already sending/sent
      if (sendingIds[contactId]) return;

      setSendingIds((prev) => ({ ...prev, [contactId]: "sending" }));

      try {
        // 1. Create/Get chat with the contact
        const chat = await createChat(token, contactId);

        // 2. Send message with the clip link
        const messageText = `Confira este Clip no Zapi: ${shareUrl}`;
        await sendMessage(token, chat.id, messageText);

        setSendingIds((prev) => ({ ...prev, [contactId]: "sent" }));
        showToast(`Enviado para ${contact.username}`);
      } catch (err) {
        console.error("Error sharing with contact:", err);
        setSendingIds((prev) => {
          const updated = { ...prev };
          delete updated[contactId];
          return updated;
        });
        showToast("Erro ao compartilhar");
      }
    };

    const handleCopyLink = () => {
      Clipboard.setString(shareUrl);
      showToast("Link copiado!");
    };

    const handleNativeShare = async () => {
      try {
        await Share.share({
          message: `Confira este Clip no Zapi: ${shareUrl}`,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error with native share:", err);
      }
    };

    const handleStatusShare = () => {
      if (onAddToStatus) {
        onAddToStatus();
      } else {
        // Default action: navigate to create story/status
        router.push({
          pathname: "/create-story",
          params: { shareText: shareUrl },
        });
      }
      // @ts-ignore
      ref?.current?.dismiss();
    };

    // Filter contacts based on search query
    const filteredContacts = useMemo(() => {
      if (!searchQuery) return contacts;
      return contacts.filter(
        (c) =>
          c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())),
      );
    }, [contacts, searchQuery]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      [],
    );

    // Reset sending states & fetch contacts when bottom sheet changes state
    const handleSheetChange = (index: number) => {
      if (index >= 0) {
        loadContacts();
      } else {
        // Reset when closed
        setSendingIds({});
        setSearchQuery("");
      }
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["50%", "75%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.menuBackground }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        onChange={handleSheetChange}
        onDismiss={onDismiss}
      >
        <BottomSheetView
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Compartilhar
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Compartilhe com seus amigos no Zapi
            </Text>
          </View>

          {/* Search bar */}
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: isDark ? "#1E1E1E" : "#F3F4F6",
                borderColor: colors.border,
              },
            ]}
          >
            <Search
              size={18}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Pesquisar contatos..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Toast Message Display inside sheet */}
          {toastMessage && (
            <View
              style={[
                styles.toastContainer,
                { backgroundColor: colors.brandGreen || "#07C160" },
              ]}
            >
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Contact List */}
          <View style={styles.contactsWrapper}>
            {loading ? (
              <ActivityIndicator
                color={colors.brandGreen || "#07C160"}
                style={styles.loader}
              />
            ) : filteredContacts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery
                  ? "Nenhum contato encontrado"
                  : "Nenhum contato disponível"}
              </Text>
            ) : (
              <FlatList
                data={filteredContacts}
                keyExtractor={(item) => item.contact_id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.contactsList}
                renderItem={({ item }) => {
                  const avatarUri = item.avatar_url
                    ? item.avatar_url.startsWith("http")
                      ? item.avatar_url
                      : `${API_URL}${item.avatar_url}`
                    : null;

                  const status = sendingIds[item.contact_id];

                  return (
                    <TouchableOpacity
                      style={styles.contactItem}
                      activeOpacity={0.7}
                      onPress={() => handleShareToContact(item)}
                    >
                      <View style={styles.avatarContainer}>
                        {avatarUri ? (
                          <Image
                            source={{ uri: avatarUri }}
                            style={styles.avatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.avatarPlaceholder,
                              {
                                backgroundColor: colors.brandGreen || "#07C160",
                              },
                            ]}
                          >
                            <Text style={styles.avatarText}>
                              {item.username.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        {/* Status overlays */}
                        {status === "sent" && (
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: colors.brandGreen || "#07C160",
                              },
                            ]}
                          >
                            <Check size={10} color="white" />
                          </View>
                        )}
                        {status === "sending" && (
                          <View style={styles.statusBadge}>
                            <ActivityIndicator size="small" color="white" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.contactName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {item.username}
                      </Text>
                      <View
                        style={[
                          styles.sendBtn,
                          status === "sent" && {
                            backgroundColor: "transparent",
                            borderWidth: 1,
                            borderColor: colors.border,
                          },
                          status === "sending" && { opacity: 0.7 },
                        ]}
                      >
                        {status === "sent" ? (
                          <Text
                            style={[
                              styles.sendBtnText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Enviado
                          </Text>
                        ) : status === "sending" ? (
                          <Text style={styles.sendBtnText}>...</Text>
                        ) : (
                          <Text style={styles.sendBtnText}>Enviar</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          {/* Action Grid */}
          <View style={[styles.actionGrid, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleStatusShare}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: isDark ? "#2A2A2A" : "#F3F4F6" },
                ]}
              >
                <PlusCircle size={24} color={colors.brandGreen || "#07C160"} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                Meu Status
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleCopyLink}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: isDark ? "#2A2A2A" : "#F3F4F6" },
                ]}
              >
                <Link size={24} color={colors.text} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                Copiar Link
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleNativeShare}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: isDark ? "#2A2A2A" : "#F3F4F6" },
                ]}
              >
                <Share2 size={24} color={colors.text} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                Compartilhar
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

ShareBottomSheet.displayName = "ShareBottomSheet";

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  toastContainer: {
    position: "absolute",
    top: 45,
    left: 20,
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  contactsWrapper: {
    height: 140,
    justifyContent: "center",
  },
  loader: {
    alignSelf: "center",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
  },
  contactsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  contactItem: {
    width: 72,
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  statusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  contactName: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
    width: "100%",
  },
  sendBtn: {
    marginTop: 6,
    backgroundColor: "#07C160",
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
    width: "100%",
    alignItems: "center",
  },
  sendBtnText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  actionGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 20,
    marginHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionItem: {
    alignItems: "center",
    width: SCREEN_WIDTH / 4,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
});
