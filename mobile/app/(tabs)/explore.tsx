import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import {
  Search,
  ShoppingBag,
  Wallet,
  FileText,
  Sparkles,
  ChevronRight,
  X,
  Bell,
  CheckCircle2,
  HelpCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  category: "utilities" | "finance" | "delivery" | "all";
  icon: (props: { color: string; size?: number }) => React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  fullDescription: string;
  details: string[];
  available?: boolean;
}

export default function ExploreScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "utilities" | "finance" | "delivery">("all");
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [subscribedServices, setSubscribedServices] = useState<Record<string, boolean>>({});

  const services: ServiceItem[] = [
    {
      id: "delivery",
      title: "Delivery",
      description: "Comida, mercado e compras sem sair do chat.",
      category: "delivery",
      icon: (props) => <ShoppingBag size={props.size ?? 24} color={props.color} />,
      iconBgColor: "#FFEFEF",
      iconColor: "#FF4B4B",
      fullDescription: "Uma forma revolucionária de fazer pedidos. Com o Zapi Delivery, você poderá fazer compras em restaurantes, supermercados e lojas direto de conversas ou canais, compartilhando pedidos com amigos e dividindo a conta facilmente.",
      details: [
        "Cardápios interativos dentro dos chats",
        "Pedidos em grupo e divisão de conta automática",
        "Rastreamento de entrega em tempo real",
        "Descontos exclusivos integrados"
      ]
    },
    {
      id: "payments",
      title: "Pagamentos",
      description: "Gerencie sua chave Pix e receba de contatos.",
      category: "finance",
      icon: (props) => <Wallet size={props.size ?? 24} color={props.color} />,
      iconBgColor: "#E8F8F0",
      iconColor: "#10B981",
      fullDescription: "Cadastre sua chave Pix para que contatos possam te pagar pelo Zapi. Gerencie tipo, valor, nome na conta e quem pode ver sua chave.",
      details: [
        "Cadastre celular, CPF, e-mail ou chave aleatória",
        "Controle quem pode ver sua chave Pix",
        "Copie, edite ou exclua sua chave a qualquer momento",
        "Compartilhada automaticamente com contatos autorizados"
      ],
      available: true,
    },
    {
      id: "notes",
      title: "Notas e Tarefas",
      description: "Crie e organize suas notas rapidamente.",
      category: "utilities",
      icon: (props) => <FileText size={props.size ?? 24} color={props.color} />,
      iconBgColor: "#F3E8FF",
      iconColor: "#A855F7",
      fullDescription: "Anotações rápidas direto do Zapi. Crie notas simples, organize suas ideias e acesse de qualquer lugar. Uma ferramenta leve para capturar o que importa no momento.",
      details: [
        "Crie notas com título e conteúdo",
        "Favorite suas notas importantes",
        "Acesse de qualquer lugar dentro do Zapi",
        "Interface simples e rápida"
      ],
      available: true,
    }
  ];

  const handleServicePress = (service: ServiceItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (service.id === "notes") {
      router.push("/notes");
      return;
    }
    if (service.id === "payments") {
      router.push("/payments");
      return;
    }
    setSelectedService(service);
  };

  const toggleSubscription = (serviceId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setSubscribedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Explorar</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Descubra novas experiências e utilitários no Zapi.
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: isDark ? "#1E1E1E" : "#EFEFEF" }]}>
        <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          placeholder="Pesquisar serviços..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          {[
            { id: "all", label: "Tudo" },
            { id: "utilities", label: "Utilitários" },
            { id: "finance", label: "Finanças" },
            { id: "delivery", label: "Delivery" }
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  setSelectedCategory(cat.id as any);
                }}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected
                      ? colors.tint
                      : isDark
                      ? "#242424"
                      : "#ECECEC",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: isSelected
                        ? "#FFFFFF"
                        : colors.text,
                      fontWeight: isSelected ? "600" : "400",
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: colors.tint + "15", borderColor: colors.tint + "30" }]}>
          <View style={styles.bannerHeader}>
            <Sparkles size={22} color={colors.tint} />
            <Text style={[styles.bannerTitle, { color: colors.tint }]}>Zapi SuperApp</Text>
          </View>
          <Text style={[styles.bannerDescription, { color: colors.text }]}>
            Estamos transformando o Zapi em um SuperApp para integrar tudo o que você precisa no seu dia a dia direto nas suas conversas.
          </Text>
        </View>

        {/* Services Grid/List */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Serviços Disponíveis em breve</Text>

        {filteredServices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <HelpCircle size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum serviço encontrado.</Text>
          </View>
        ) : (
          filteredServices.map((service) => (
            <Pressable
              key={service.id}
              onPress={() => handleServicePress(service)}
              style={({ pressed }) => [
                styles.serviceCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  opacity: pressed ? 0.95 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                }
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: service.iconBgColor }]}>
                {service.icon({ color: service.iconColor })}
              </View>

              <View style={styles.cardInfo}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{service.title}</Text>
                  <View style={[styles.badge, { backgroundColor: service.available ? "#10B98120" : colors.tint + "15" }]}>
                    <Text style={[styles.badgeText, { color: service.available ? "#10B981" : colors.tint }]}>
                      {service.available ? "Disponível" : "Em breve"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {service.description}
                </Text>
              </View>

              <ChevronRight size={20} color={colors.textSecondary} style={styles.cardArrow} />
            </Pressable>
          ))
        )}

        {/* Footer info */}
        <View style={styles.footerInfo}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Quer sugerir um serviço? Entre em contato com o suporte do Zapi.
          </Text>
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={selectedService !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedService(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            {selectedService && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: selectedService.iconBgColor, width: 48, height: 48, borderRadius: 12 }]}>
                    {selectedService.icon({ color: selectedService.iconColor, size: 28 })}
                  </View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedService.title}</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedService(null)}
                    style={[styles.closeButton, { backgroundColor: isDark ? "#2A2A2A" : "#F3F3F3" }]}
                  >
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Modal Body */}
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.modalDescription, { color: colors.text }]}>
                    {selectedService.fullDescription}
                  </Text>

                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>O que está incluso:</Text>
                  {selectedService.details.map((detail, index) => (
                    <View key={index} style={styles.detailRow}>
                      <View style={[styles.bulletPoint, { backgroundColor: colors.tint }]} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>{detail}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Modal Footer / Subscription Button */}
                <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={() => toggleSubscription(selectedService.id)}
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: subscribedServices[selectedService.id]
                          ? "#10B981"
                          : colors.tint,
                      },
                    ]}
                  >
                    {subscribedServices[selectedService.id] ? (
                      <View style={styles.buttonContent}>
                        <CheckCircle2 size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.actionButtonText}>Inscrito para Novidades!</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Bell size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.actionButtonText}>Me avise quando lançar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
  },
  header: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  categoriesContainer: {
    marginBottom: 15,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  banner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 25,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  bannerDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardArrow: {
    alignSelf: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
  },
  footerInfo: {
    marginTop: 30,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    maxHeight: "80%",
    minHeight: "50%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 14,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingLeft: 4,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
  },
  actionButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
