import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/context/ThemeContext";
import { Feather, Ionicons } from "@expo/vector-icons";

// Helper to handle dismissing modal from forwarded ref
const dismissRef = (ref: React.ForwardedRef<BottomSheetModal>) => {
  if (ref && "current" in ref && ref.current) {
    ref.current.dismiss();
  }
};

// 1. CREATE COMMUNITY MODAL
interface CreateCommunityModalProps {
  onSubmit: (payload: {
    name: string;
    description: string;
    visibility: "public" | "private";
    category: string;
  }) => Promise<void>;
}

export const CreateCommunityModal = React.forwardRef<
  BottomSheetModal,
  CreateCommunityModalProps
>(({ onSubmit }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["85%"], []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [category, setCategory] = useState("Geral");
  const [loading, setLoading] = useState(false);

  const isDisabled = !name.trim() || loading;

  const handleSub = async () => {
    if (isDisabled) return;
    setLoading(true);
    try {
      await onSubmit({ name, description, visibility, category });
      setName("");
      setDescription("");
      setVisibility("public");
      setCategory("Geral");
      dismissRef(ref);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    dismissRef(ref);
  };

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

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerButton, { borderColor: colors.border }]}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Nova Comunidade
          </Text>
          <TouchableOpacity
            onPress={handleSub}
            disabled={isDisabled}
            style={[
              styles.headerButton,
              {
                backgroundColor: isDisabled ? colors.border : "#34C759",
                borderColor: isDisabled ? colors.border : "#34C759",
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="checkmark"
                size={24}
                color={isDisabled ? colors.textSecondary : "#ffffff"}
              />
            )}
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Nome da Comunidade
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex: Desenvolvedores JS"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Descrição
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Sobre o que é essa comunidade?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Categoria
          </Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Ex: Tecnologia, Jogos, Esportes"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Privacidade
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => setVisibility("public")}
              style={[
                styles.optionCard,
                {
                  borderColor:
                    visibility === "public"
                      ? colors.brandGreen
                      : colors.border,
                },
                visibility === "public" && {
                  backgroundColor: colors.listBgGreen,
                },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={20}
                color={
                  visibility === "public"
                    ? colors.brandGreen
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.optionText,
                  {
                    color: colors.text,
                    fontWeight: visibility === "public" ? "600" : "400",
                  },
                ]}
              >
                Pública
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setVisibility("private")}
              style={[
                styles.optionCard,
                {
                  borderColor:
                    visibility === "private"
                      ? colors.brandGreen
                      : colors.border,
                },
                visibility === "private" && {
                  backgroundColor: colors.listBgGreen,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={
                  visibility === "private"
                    ? colors.brandGreen
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.optionText,
                  {
                    color: colors.text,
                    fontWeight: visibility === "private" ? "600" : "400",
                  },
                ]}
              >
                Privada
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});
CreateCommunityModal.displayName = "CreateCommunityModal";

// 2. JOIN COMMUNITY MODAL
interface JoinCommunityModalProps {
  onSubmit: (code: string) => Promise<void>;
}

export const JoinCommunityModal = React.forwardRef<
  BottomSheetModal,
  JoinCommunityModalProps
>(({ onSubmit }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["60%"], []);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const isDisabled = !code.trim() || loading;

  const handleSub = async () => {
    if (isDisabled) return;
    setLoading(true);
    try {
      await onSubmit(code);
      setCode("");
      dismissRef(ref);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    dismissRef(ref);
  };

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

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerButton, { borderColor: colors.border }]}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Entrar em Comunidade
          </Text>
          <TouchableOpacity
            onPress={handleSub}
            disabled={isDisabled}
            style={[
              styles.headerButton,
              {
                backgroundColor: isDisabled ? colors.border : "#34C759",
                borderColor: isDisabled ? colors.border : "#34C759",
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="checkmark"
                size={24}
                color={isDisabled ? colors.textSecondary : "#ffffff"}
              />
            )}
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Código de Convite
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Ex: ZAPI-XXXXX"
            autoCapitalize="characters"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Peça a um administrador de comunidade para gerar um código de
            convite para você.
          </Text>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});
JoinCommunityModal.displayName = "JoinCommunityModal";

// 3. CREATE CHANNEL MODAL
interface CreateChannelModalProps {
  onSubmit: (payload: {
    name: string;
    type: "text" | "forum" | "event";
    description: string;
  }) => Promise<void>;
}

export const CreateChannelModal = React.forwardRef<
  BottomSheetModal,
  CreateChannelModalProps
>(({ onSubmit }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["85%"], []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"text" | "forum" | "event">("text");
  const [loading, setLoading] = useState(false);

  const isDisabled = !name.trim() || loading;

  const handleSub = async () => {
    if (isDisabled) return;
    setLoading(true);
    try {
      await onSubmit({ name, description, type });
      setName("");
      setDescription("");
      setType("text");
      dismissRef(ref);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    dismissRef(ref);
  };

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

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerButton, { borderColor: colors.border }]}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Criar Canal
          </Text>
          <TouchableOpacity
            onPress={handleSub}
            disabled={isDisabled}
            style={[
              styles.headerButton,
              {
                backgroundColor: isDisabled ? colors.border : "#34C759",
                borderColor: isDisabled ? colors.border : "#34C759",
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="checkmark"
                size={24}
                color={isDisabled ? colors.textSecondary : "#ffffff"}
              />
            )}
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Nome do Canal
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex: anuncios"
            autoCapitalize="none"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Descrição (Opcional)
          </Text>
          <TextInput
            value={description}
            onChangeText={description => setDescription(description)}
            placeholder="Do que se trata este canal?"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Tipo de Canal
          </Text>
          <View style={styles.col}>
            <TouchableOpacity
              onPress={() => setType("text")}
              style={[
                styles.typeOption,
                { borderColor: colors.border },
                type === "text" && {
                  borderColor: colors.brandGreen,
                  backgroundColor: colors.listBgGreen,
                },
              ]}
            >
              <Feather
                name="hash"
                size={22}
                color={
                  type === "text" ? colors.brandGreen : colors.textSecondary
                }
              />
              <View style={styles.typeInfo}>
                <Text style={[styles.typeTitle, { color: colors.text }]}>
                  Texto
                </Text>
                <Text
                  style={[styles.typeDesc, { color: colors.textSecondary }]}
                >
                  Envie mensagens, imagens e converse em tempo real.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setType("forum")}
              style={[
                styles.typeOption,
                { borderColor: colors.border },
                type === "forum" && {
                  borderColor: colors.brandGreen,
                  backgroundColor: colors.listBgGreen,
                },
              ]}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color={
                  type === "forum" ? colors.brandGreen : colors.textSecondary
                }
              />
              <View style={styles.typeInfo}>
                <Text style={[styles.typeTitle, { color: colors.text }]}>
                  Fórum
                </Text>
                <Text
                  style={[styles.typeDesc, { color: colors.textSecondary }]}
                >
                  Crie tópicos estruturados para posts e discussões
                  organizadas.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setType("event")}
              style={[
                styles.typeOption,
                { borderColor: colors.border },
                type === "event" && {
                  borderColor: colors.brandGreen,
                  backgroundColor: colors.listBgGreen,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={22}
                color={
                  type === "event" ? colors.brandGreen : colors.textSecondary
                }
              />
              <View style={styles.typeInfo}>
                <Text style={[styles.typeTitle, { color: colors.text }]}>
                  Eventos
                </Text>
                <Text
                  style={[styles.typeDesc, { color: colors.textSecondary }]}
                >
                  Agende encontros, reuniões e veja quem vai comparecer.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});
CreateChannelModal.displayName = "CreateChannelModal";

// 4. CREATE POST MODAL
interface CreatePostModalProps {
  onSubmit: (payload: { title: string; content: string }) => Promise<void>;
}

export const CreatePostModal = React.forwardRef<
  BottomSheetModal,
  CreatePostModalProps
>(({ onSubmit }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["85%"], []);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const isDisabled = !title.trim() || !content.trim() || loading;

  const handleSub = async () => {
    if (isDisabled) return;
    setLoading(true);
    try {
      await onSubmit({ title, content });
      setTitle("");
      setContent("");
      dismissRef(ref);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    dismissRef(ref);
  };

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

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerButton, { borderColor: colors.border }]}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Novo Post
          </Text>
          <TouchableOpacity
            onPress={handleSub}
            disabled={isDisabled}
            style={[
              styles.headerButton,
              {
                backgroundColor: isDisabled ? colors.border : "#34C759",
                borderColor: isDisabled ? colors.border : "#34C759",
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="checkmark"
                size={24}
                color={isDisabled ? colors.textSecondary : "#ffffff"}
              />
            )}
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Título do Post
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Escolha um título claro e objetivo"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Conteúdo
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="O que você deseja compartilhar com a comunidade?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={8}
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
                height: 180,
              },
            ]}
          />
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});
CreatePostModal.displayName = "CreatePostModal";

// 5. CREATE EVENT MODAL
interface CreateEventModalProps {
  onSubmit: (payload: {
    title: string;
    description: string;
    location: string;
    start_time: string;
  }) => Promise<void>;
}

export const CreateEventModal = React.forwardRef<
  BottomSheetModal,
  CreateEventModalProps
>(({ onSubmit }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["85%"], []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(false);

  const isDisabled = !title.trim() || !startTime.trim() || loading;

  const handleSub = async () => {
    if (isDisabled) return;
    setLoading(true);
    try {
      await onSubmit({
        title,
        description,
        location: location || "Zapi Voice Lounge",
        start_time: new Date(startTime).toISOString(),
      });
      setTitle("");
      setDescription("");
      setLocation("");
      setStartTime("");
      dismissRef(ref);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    dismissRef(ref);
  };

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

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerButton, { borderColor: colors.border }]}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Agendar Evento
          </Text>
          <TouchableOpacity
            onPress={handleSub}
            disabled={isDisabled}
            style={[
              styles.headerButton,
              {
                backgroundColor: isDisabled ? colors.border : "#34C759",
                borderColor: isDisabled ? colors.border : "#34C759",
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="checkmark"
                size={24}
                color={isDisabled ? colors.textSecondary : "#ffffff"}
              />
            )}
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Título do Evento
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Oficina de React Native"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Descrição
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Descreva o que vai acontecer no evento..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
                height: 100,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Localização / Link
          </Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Ex: Canal de Voz ou Zoom Link"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Data e Hora de Início
          </Text>
          <TextInput
            value={startTime}
            onChangeText={setStartTime}
            placeholder="Ex: YYYY-MM-DD HH:MM (ex: 2026-08-30 18:00)"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
          />
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});
CreateEventModal.displayName = "CreateEventModal";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  body: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    textAlignVertical: "top",
    height: 80,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  col: {
    flexDirection: "column",
    gap: 12,
    marginTop: 4,
  },
  optionCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderWidth: 2,
    borderRadius: 10,
    gap: 8,
  },
  optionText: {
    fontSize: 16,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1.5,
    borderRadius: 10,
    gap: 12,
  },
  typeInfo: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  typeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
