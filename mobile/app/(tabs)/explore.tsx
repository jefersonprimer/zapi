import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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

  const services: ServiceItem[] = [
    {
      id: "delivery",
      title: "Delivery",
      description: "Comida, mercado e compras sem sair do chat.",
      category: "delivery",
      icon: (props) => (
        <MaterialCommunityIcons
          name="shopping-outline"
          size={props.size ?? 24}
          color={props.color}
        />
      ),
      iconBgColor: "#FFEFEF",
      iconColor: "#FF4B4B",
      fullDescription:
        "Peça em restaurantes, mercados e lojas direto no Zapi. Veja cardápios, monte o carrinho, escolha o endereço e pague via PIX.",
      details: [
        "Lojas abertas na sua região",
        "Busca por nome e filtro por categoria",
        "Carrinho, checkout e pagamento PIX",
        "Acompanhe o status do pedido",
      ],
      available: true,
    },
    {
      id: "payments",
      title: "Pagamentos",
      description: "Gerencie sua chave Pix e receba de contatos.",
      category: "finance",
      icon: (props) => (
        <MaterialCommunityIcons
          name="wallet-outline"
          size={props.size ?? 24}
          color={props.color}
        />
      ),
      iconBgColor: "#E8F8F0",
      iconColor: "#10B981",
      fullDescription:
        "Cadastre sua chave Pix para que contatos possam te pagar pelo Zapi. Gerencie tipo, valor, nome na conta e quem pode ver sua chave.",
      details: [
        "Cadastre celular, CPF, e-mail ou chave aleatória",
        "Controle quem pode ver sua chave Pix",
        "Copie, edite ou exclua sua chave a qualquer momento",
        "Compartilhada automaticamente com contatos autorizados",
      ],
      available: true,
    },
    {
      id: "items",
      title: "Notas, Lembretes e Eventos",
      description: "Organize notas, listas, tarefas e calendário em um só lugar.",
      category: "utilities",
      icon: (props) => (
        <MaterialCommunityIcons
          name="calendar-check-outline"
          size={props.size ?? 24}
          color={props.color}
        />
      ),
      iconBgColor: "#F3E8FF",
      iconColor: "#A855F7",
      fullDescription:
        "Gerenciador completo do Superapp. Crie notas, listas de compras, agende lembretes com alarme e organize seus compromissos no calendário.",
      details: [
        "Notas, checklists e listas de compras",
        "Lembretes com notificação local",
        "Eventos com sincronização nativa de calendário",
        "Conversão em 1 toque entre Nota, Lembrete e Evento",
      ],
      available: true,
    },
  ];

  const handleServicePress = (service: ServiceItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (service.id === "items" || service.id === "notes") {
      router.push("/items");
      return;
    }
    if (service.id === "payments") {
      router.push("/payments");
      return;
    }
    if (service.id === "delivery") {
      router.push("/delivery");
      return;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[styles.header, { backgroundColor: colors.headerBackground }]}
      >
        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? colors.headerText : colors.tint },
          ]}
        >
          Explorar
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Descubra novas experiências e utilitários no Zapi.
        </Text>
      </View>

      {/* Services Grid/List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {services.map((service) => (
          <Pressable
            key={service.id}
            onPress={() => handleServicePress(service)}
            style={({ pressed }) => [
              styles.serviceCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
                opacity: pressed ? 0.95 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: service.iconBgColor },
              ]}
            >
              {service.icon({ color: service.iconColor })}
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {service.title}
                </Text>
              </View>
              <Text
                style={[
                  styles.cardDescription,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {service.description}
              </Text>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.textSecondary}
              style={styles.cardArrow}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "500",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardArrow: {
    alignSelf: "center",
  },
});
