import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { X, Globe, Lock, Hash, MessageSquare, Calendar } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
}

// 1. CREATE COMMUNITY MODAL
interface CreateCommunityModalProps extends ModalProps {
  onSubmit: (payload: { name: string; description: string; visibility: "public" | "private"; category: string }) => Promise<void>;
}

export function CreateCommunityModal({ visible, onClose, onSubmit }: CreateCommunityModalProps) {
  const { colors } = useAppTheme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [category, setCategory] = useState("Geral");
  const [loading, setLoading] = useState(false);

  const handleSub = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name, description, visibility, category });
      setName("");
      setDescription("");
      setVisibility("public");
      setCategory("Geral");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Nova Comunidade</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Nome da Comunidade</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Desenvolvedores JS"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Descrição</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Sobre o que é essa comunidade?"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Categoria</Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="Ex: Tecnologia, Jogos, Esportes"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Privacidade</Text>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => setVisibility("public")}
                style={[
                  styles.optionCard,
                  { borderColor: visibility === "public" ? colors.brandGreen : colors.border },
                  visibility === "public" && { backgroundColor: colors.listBgGreen },
                ]}
              >
                <Globe size={20} color={visibility === "public" ? colors.brandGreen : colors.textSecondary} />
                <Text style={[styles.optionText, { color: colors.text, fontWeight: visibility === "public" ? "600" : "400" }]}>Pública</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setVisibility("private")}
                style={[
                  styles.optionCard,
                  { borderColor: visibility === "private" ? colors.brandGreen : colors.border },
                  visibility === "private" && { backgroundColor: colors.listBgGreen },
                ]}
              >
                <Lock size={20} color={visibility === "private" ? colors.brandGreen : colors.textSecondary} />
                <Text style={[styles.optionText, { color: colors.text, fontWeight: visibility === "private" ? "600" : "400" }]}>Privada</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnSec, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSub} disabled={!name.trim() || loading} style={[styles.btn, styles.btnPri, { backgroundColor: colors.brandGreen }]}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPriText}>Criar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 2. JOIN COMMUNITY MODAL
interface JoinCommunityModalProps extends ModalProps {
  onSubmit: (code: string) => Promise<void>;
}

export function JoinCommunityModal({ visible, onClose, onSubmit }: JoinCommunityModalProps) {
  const { colors } = useAppTheme();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSub = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await onSubmit(code);
      setCode("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Entrar em Comunidade</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Código de Convite</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Ex: ZAPI-XXXXX"
              autoCapitalize="characters"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Peça a um administrador de comunidade para gerar um código de convite para você.
            </Text>
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnSec, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSub} disabled={!code.trim() || loading} style={[styles.btn, styles.btnPri, { backgroundColor: colors.brandGreen }]}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPriText}>Entrar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 3. CREATE CHANNEL MODAL
interface CreateChannelModalProps extends ModalProps {
  onSubmit: (payload: { name: string; type: "text" | "forum" | "event"; description: string }) => Promise<void>;
}

export function CreateChannelModal({ visible, onClose, onSubmit }: CreateChannelModalProps) {
  const { colors } = useAppTheme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"text" | "forum" | "event">("text");
  const [loading, setLoading] = useState(false);

  const handleSub = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name, description, type });
      setName("");
      setDescription("");
      setType("text");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Criar Canal</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Nome do Canal</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: anuncios"
              autoCapitalize="none"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Descrição (Opcional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Do que se trata este canal?"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Tipo de Canal</Text>
            <View style={styles.col}>
              <TouchableOpacity
                onPress={() => setType("text")}
                style={[
                  styles.typeOption,
                  { borderColor: colors.border },
                  type === "text" && { borderColor: colors.brandGreen, backgroundColor: colors.listBgGreen },
                ]}
              >
                <Hash size={22} color={type === "text" ? colors.brandGreen : colors.textSecondary} />
                <View style={styles.typeInfo}>
                  <Text style={[styles.typeTitle, { color: colors.text }]}>Texto</Text>
                  <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>Envie mensagens, imagens e converse em tempo real.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setType("forum")}
                style={[
                  styles.typeOption,
                  { borderColor: colors.border },
                  type === "forum" && { borderColor: colors.brandGreen, backgroundColor: colors.listBgGreen },
                ]}
              >
                <MessageSquare size={22} color={type === "forum" ? colors.brandGreen : colors.textSecondary} />
                <View style={styles.typeInfo}>
                  <Text style={[styles.typeTitle, { color: colors.text }]}>Fórum</Text>
                  <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>Crie tópicos estruturados para posts e discussões organizadas.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setType("event")}
                style={[
                  styles.typeOption,
                  { borderColor: colors.border },
                  type === "event" && { borderColor: colors.brandGreen, backgroundColor: colors.listBgGreen },
                ]}
              >
                <Calendar size={22} color={type === "event" ? colors.brandGreen : colors.textSecondary} />
                <View style={styles.typeInfo}>
                  <Text style={[styles.typeTitle, { color: colors.text }]}>Eventos</Text>
                  <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>Agende encontros, reuniões e veja quem vai comparecer.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnSec, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSub} disabled={!name.trim() || loading} style={[styles.btn, styles.btnPri, { backgroundColor: colors.brandGreen }]}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPriText}>Criar Canal</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 4. CREATE POST MODAL
interface CreatePostModalProps extends ModalProps {
  onSubmit: (payload: { title: string; content: string }) => Promise<void>;
}

export function CreatePostModal({ visible, onClose, onSubmit }: CreatePostModalProps) {
  const { colors } = useAppTheme();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSub = async () => {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ title, content });
      setTitle("");
      setContent("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Novo Post</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Título do Post</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Escolha um título claro e objetivo"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Conteúdo</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="O que você deseja compartilhar com a comunidade?"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={8}
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, height: 180 }]}
            />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnSec, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSub}
              disabled={!title.trim() || !content.trim() || loading}
              style={[styles.btn, styles.btnPri, { backgroundColor: colors.brandGreen }]}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPriText}>Publicar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 5. CREATE EVENT MODAL
interface CreateEventModalProps extends ModalProps {
  onSubmit: (payload: { title: string; description: string; location: string; start_time: string }) => Promise<void>;
}

export function CreateEventModal({ visible, onClose, onSubmit }: CreateEventModalProps) {
  const { colors } = useAppTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSub = async () => {
    if (!title.trim() || !startTime.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ title, description, location: location || "Zapi Voice Lounge", start_time: new Date(startTime).toISOString() });
      setTitle("");
      setDescription("");
      setLocation("");
      setStartTime("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Agendar Evento</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Título do Evento</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Oficina de React Native"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Descrição</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o que vai acontecer no evento..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, height: 100 }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Localização / Link</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Ex: Canal de Voz ou Zoom Link"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Data e Hora de Início</Text>
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="Ex: YYYY-MM-DD HH:MM (ex: 2026-08-30 18:00)"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnSec, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSub}
              disabled={!title.trim() || !startTime.trim() || loading}
              style={[styles.btn, styles.btnPri, { backgroundColor: colors.brandGreen }]}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPriText}>Agendar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "50%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeBtn: {
    padding: 4,
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
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
  btnSec: {
    borderWidth: 1,
  },
  btnPri: {},
  btnPriText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
