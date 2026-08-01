import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useCartStore } from "@/store/useCartStore";
import {
  listAddresses,
  createOrder,
  validateCoupon,
  UserAddress,
  Store,
  StoreDeliverySlot,
  StoreHours,
  FulfillmentType,
  getStore,
  simulatePayment,
} from "@/services/deliveryApi";

type ScheduleDay = {
  date: string;
  dayNum: number;
  label: string;
  isToday: boolean;
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTimeStr(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function buildScheduleDays(count: number, hours: StoreHours[]): ScheduleDay[] {
  const short = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const days: ScheduleDay[] = [];
  const now = new Date();
  const hasHoursConfig = hours && hours.length > 0;
  let added = 0;

  // Safety limit of looking up to 30 days ahead to find count open days
  for (let i = 0; i < 30 && added < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayOfWeek = d.getDay();

    if (!hasHoursConfig) {
      // If there is no hours configuration at all in the database, we treat the store as closed.
      continue;
    }

    const hourSetting = hours.find((h) => h.day_of_week === dayOfWeek);
    if (!hourSetting || hourSetting.is_closed) {
      // A day is closed if there is no record for it or if it is marked as closed.
      continue;
    }

    days.push({
      date: toDateStr(d),
      dayNum: d.getDate(),
      label: i === 0 ? "Hoje" : short[dayOfWeek],
      isToday: i === 0,
    });
    added++;
  }
  return days;
}

function slotApplies(slot: StoreDeliverySlot, type: FulfillmentType): boolean {
  return slot.fulfillment_type === "ambos" || slot.fulfillment_type === type;
}

function formatSlotSummary(
  type: FulfillmentType,
  day: ScheduleDay | null,
  slot: StoreDeliverySlot | null,
): string {
  if (!day || !slot) return "Escolha um horário";
  const dayWord = day.isToday ? "hoje" : day.label.toLowerCase();
  if (type === "entrega") {
    return `Receba ${dayWord} das ${slot.start_time} às ${slot.end_time}`;
  }
  return `Retire ${dayWord} a partir das ${slot.start_time.replace(/^0/, "")}`;
}

export default function CheckoutScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    storeId,
    items,
    getSubtotal,
    getTotal,
    discount,
    couponCode,
    setCoupon,
    clearCart,
  } = useCartStore();

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(
    null,
  );
  const [store, setStore] = useState<Store | null>(null);
  const [slots, setSlots] = useState<StoreDeliverySlot[]>([]);
  const [storeHours, setStoreHours] = useState<StoreHours[]>([]);
  const [observation, setObservation] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [couponInput, setCouponInput] = useState(couponCode || "");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponApplied, setCouponApplied] = useState(!!couponCode);

  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("entrega");
  const [selectedDay, setSelectedDay] = useState<ScheduleDay | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<StoreDeliverySlot | null>(
    null,
  );
  const [showMoreSlots, setShowMoreSlots] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<
    "pix" | "credit_card" | "debit_card"
  >("pix");
  const [pendingOrder, setPendingOrder] = useState<any | null>(null);
  const [simulatingPay, setSimulatingPay] = useState(false);

  const subtotal = getSubtotal();
  const total = getTotal();

  const scheduleDays = useMemo(
    () => buildScheduleDays(store?.schedule_days ?? 5, storeHours),
    [store?.schedule_days, storeHours],
  );

  const availableSlots = useMemo(() => {
    const now = nowTimeStr();
    return slots
      .filter((s) => s.is_active && slotApplies(s, fulfillmentType))
      .filter((s) => {
        if (!selectedDay?.isToday) return true;
        return s.end_time > now;
      })
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.start_time.localeCompare(b.start_time),
      );
  }, [slots, fulfillmentType, selectedDay]);

  const primarySlots = availableSlots.slice(0, 4);
  const moreSlots = availableSlots.slice(4);
  const visibleSlots = showMoreSlots ? availableSlots : primarySlots;

  useEffect(() => {
    if (scheduleDays.length && !selectedDay) {
      setSelectedDay(scheduleDays[0]);
    }
  }, [scheduleDays, selectedDay]);

  useEffect(() => {
    if (availableSlots.length === 0) {
      setSelectedSlot(null);
      return;
    }
    if (
      !selectedSlot ||
      !availableSlots.find((s) => s.id === selectedSlot.id)
    ) {
      setSelectedSlot(availableSlots[0]);
    }
  }, [availableSlots, selectedSlot]);

  const loadData = useCallback(async () => {
    if (!token || !storeId) return;
    try {
      const [addrData, storeData] = await Promise.all([
        listAddresses(token),
        getStore(token, storeId),
      ]);
      setAddresses(addrData.addresses);
      setStore(storeData.store);
      setSlots(storeData.slots || []);
      setStoreHours(storeData.hours || []);
      const defaultAddr = addrData.addresses.find((a) => a.is_default);
      if (defaultAddr) setSelectedAddress(defaultAddr);
      else if (addrData.addresses.length > 0)
        setSelectedAddress(addrData.addresses[0]);

      if (
        storeData.store.accepts_delivery === false &&
        storeData.store.accepts_pickup !== false
      ) {
        setFulfillmentType("retirada");
      }
    } catch (err) {
      console.error("Failed to load checkout data:", err);
    } finally {
      setLoading(false);
    }
  }, [token, storeId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleApplyCoupon = async () => {
    if (!token || !couponInput.trim()) return;
    setValidatingCoupon(true);
    try {
      const result = await validateCoupon(token, couponInput.trim(), subtotal);
      setCoupon(couponInput.trim().toUpperCase(), result.discount);
      setCouponApplied(true);
    } catch (err: any) {
      Alert.alert(
        "Cupom inválido",
        err.message || "Não foi possível aplicar o cupom",
      );
      setCoupon(null, 0);
      setCouponApplied(false);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon(null, 0);
    setCouponInput("");
    setCouponApplied(false);
  };

  const deliveryFee =
    fulfillmentType === "entrega"
      ? (selectedSlot?.fee ?? store?.delivery_fee ?? 0)
      : 0;

  const canSubmit =
    !!selectedSlot &&
    !!selectedDay &&
    (fulfillmentType === "retirada" || !!selectedAddress) &&
    !submitting;

  const handleOrder = async () => {
    if (!token || !storeId || !selectedSlot || !selectedDay) return;

    if (fulfillmentType === "entrega" && !selectedAddress) {
      Alert.alert("Endereço", "Selecione um endereço de entrega.");
      return;
    }

    if (!store?.is_open) {
      Alert.alert("Loja fechada", "Esta loja está fechada no momento.");
      return;
    }

    if (store.minimum_order > subtotal) {
      Alert.alert(
        "Pedido mínimo",
        `O pedido mínimo é R$ ${store.minimum_order.toFixed(2)}. Seu subtotal é R$ ${subtotal.toFixed(2)}.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await createOrder(token, {
        store_id: storeId,
        address_id:
          fulfillmentType === "entrega" ? selectedAddress?.id : undefined,
        items: items.map((item) => {
          const saleType = item.saleType || "unit";
          if (saleType === "weight") {
            return {
              product_id: item.productId,
              quantity_decimal: item.quantity,
              observation: item.observation,
              addon_ids: item.addons.map((a) => a.id),
            };
          }
          return {
            product_id: item.productId,
            quantity: item.quantity,
            observation: item.observation,
            addon_ids: item.addons.map((a) => a.id),
          };
        }),
        observation: observation || undefined,
        coupon_code: couponCode || undefined,
        fulfillment_type: fulfillmentType,
        scheduled_date: selectedDay.date,
        slot_id: selectedSlot.id,
        payment_method: paymentMethod,
      });

      clearCart();

      if (res.order.payment_status === "paid") {
        Alert.alert(
          "Pedido criado e pago!",
          "Seu pedido foi pago e enviado para a loja.",
          [{ text: "OK", onPress: () => router.replace("/delivery/orders") }],
        );
      } else {
        // Payment is pending (e.g. Pix)
        setPendingOrder(res.order);
      }
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (pendingOrder) {
    const copiaCola = pendingOrder.payment_details?.pix_copia_e_cola || "";
    const orderShortId = pendingOrder.id.substring(0, 8).toUpperCase();

    const handleCopyPix = () => {
      try {
        Clipboard.setString(copiaCola);
        Alert.alert("Copiado!", "Código Pix Copia e Cola copiado com sucesso.");
      } catch {
        Alert.alert("Erro", "Não foi possível copiar o código.");
      }
    };

    const handleSimulatePayment = async () => {
      if (!token) return;
      setSimulatingPay(true);
      try {
        await simulatePayment(token, pendingOrder.id);
        Alert.alert(
          "Pagamento aprovado!",
          "O pagamento foi confirmado e o pedido foi enviado para o vendedor.",
          [
            {
              text: "OK",
              onPress: () => {
                setPendingOrder(null);
                router.replace("/delivery/orders");
              },
            },
          ],
        );
      } catch (err: any) {
        Alert.alert("Erro", err.message || "Falha ao confirmar pagamento");
      } finally {
        setSimulatingPay(false);
      }
    };

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: 50,
            paddingHorizontal: 16,
          },
        ]}
      >
        <View style={{ alignItems: "center", marginVertical: 24 }}>
          <MaterialCommunityIcons name="qrcode" color={colors.tint} size={64} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            Pagamento do Pedido
          </Text>
          <Text
            style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}
          >
            Pedido #{orderShortId} • Total: R${" "}
            {(total + deliveryFee).toFixed(2)}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Pague via Pix (Sandbox de Teste)
          </Text>

          {/* Styled fake QR Code box */}
          <View
            style={{
              width: 200,
              height: 200,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderColor: colors.border,
              borderWidth: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
              marginBottom: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "column", gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderWidth: 4,
                    borderColor: "#000",
                    backgroundColor: "#000",
                  }}
                />
                <View
                  style={{
                    width: 100,
                    height: 40,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 10, color: "#888", fontWeight: "bold" }}
                  >
                    ZAPI PAY
                  </Text>
                </View>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderWidth: 4,
                    borderColor: "#000",
                    backgroundColor: "#000",
                  }}
                />
              </View>
              <View
                style={{
                  width: 180,
                  height: 80,
                  borderColor: "#000",
                  borderStyle: "dashed",
                  borderWidth: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.tint,
                    fontWeight: "600",
                  }}
                >
                  QR Code Sandbox
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderWidth: 4,
                    borderColor: "#000",
                    backgroundColor: "#000",
                  }}
                />
                <View style={{ width: 100, height: 40 }} />
                <View
                  style={{ width: 40, height: 40, backgroundColor: "#000" }}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 20,
              width: "100%",
              alignItems: "center",
              marginBottom: 12,
            }}
            onPress={handleCopyPix}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              Copiar Código Pix Copia e Cola
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              textAlign: "center",
              paddingHorizontal: 12,
            }}
          >
            Como estamos no ambiente de testes (Sandbox), você pode simular a
            confirmação do pagamento clicando no botão abaixo.
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: colors.tint,
            height: 52,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
          onPress={handleSimulatePayment}
          disabled={simulatingPay}
        >
          {simulatingPay ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              Simular Pagamento Aprovado
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            alignItems: "center",
            paddingVertical: 12,
          }}
          onPress={() => {
            setPendingOrder(null);
            router.replace("/delivery/orders");
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Pagar mais tarde
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const acceptsDelivery = store?.accepts_delivery !== false;
  const acceptsPickup = store?.accepts_pickup !== false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { backgroundColor: colors.headerBackground }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" color={colors.headerText} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Finalizar Pedido
        </Text>
      </View>

      <FlatList
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* Fulfillment type */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Forma de entrega
              </Text>
              <View style={styles.fulfillmentRow}>
                {acceptsDelivery && (
                  <TouchableOpacity
                    style={[
                      styles.fulfillmentCard,
                      {
                        borderColor:
                          fulfillmentType === "entrega"
                            ? colors.tint
                            : colors.border,
                        backgroundColor:
                          fulfillmentType === "entrega"
                            ? `${colors.tint}12`
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      setFulfillmentType("entrega");
                      setShowMoreSlots(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="bike"
                      color={
                        fulfillmentType === "entrega"
                          ? colors.tint
                          : colors.icon
                      }
                      size={22}
                    />
                    <Text
                      style={[styles.fulfillmentTitle, { color: colors.text }]}
                    >
                      Entrega
                    </Text>
                    <Text
                      style={[
                        styles.fulfillmentSub,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {fulfillmentType === "entrega"
                        ? formatSlotSummary(
                            "entrega",
                            selectedDay,
                            selectedSlot,
                          )
                        : "Receba no seu endereço"}
                    </Text>
                  </TouchableOpacity>
                )}
                {acceptsPickup && (
                  <TouchableOpacity
                    style={[
                      styles.fulfillmentCard,
                      {
                        borderColor:
                          fulfillmentType === "retirada"
                            ? colors.tint
                            : colors.border,
                        backgroundColor:
                          fulfillmentType === "retirada"
                            ? `${colors.tint}12`
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      setFulfillmentType("retirada");
                      setShowMoreSlots(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="shopping"
                      color={
                        fulfillmentType === "retirada"
                          ? colors.tint
                          : colors.icon
                      }
                      size={22}
                    />
                    <Text
                      style={[styles.fulfillmentTitle, { color: colors.text }]}
                    >
                      Retirada
                    </Text>
                    <Text
                      style={[
                        styles.fulfillmentSub,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {fulfillmentType === "retirada"
                        ? formatSlotSummary(
                            "retirada",
                            selectedDay,
                            selectedSlot,
                          )
                        : "Retire na loja"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Day picker */}
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                Agendamento
              </Text>
              <View style={styles.daysRow}>
                {scheduleDays.map((day) => {
                  const selected = selectedDay?.date === day.date;
                  return (
                    <TouchableOpacity
                      key={day.date}
                      style={[
                        styles.dayChip,
                        {
                          borderColor: selected ? colors.tint : colors.border,
                          backgroundColor: selected
                            ? colors.tint
                            : "transparent",
                        },
                      ]}
                      onPress={() => {
                        setSelectedDay(day);
                        setShowMoreSlots(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dayLabel,
                          { color: selected ? "#fff" : colors.textSecondary },
                        ]}
                      >
                        {day.label}
                      </Text>
                      <Text
                        style={[
                          styles.dayNum,
                          { color: selected ? "#fff" : colors.text },
                        ]}
                      >
                        {day.dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time slots */}
              {availableSlots.length === 0 ? (
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                  Nenhum horário disponível para este dia.
                </Text>
              ) : (
                <View style={styles.slotsList}>
                  {visibleSlots.map((slot) => {
                    const selected = selectedSlot?.id === slot.id;
                    const feeLabel =
                      fulfillmentType === "entrega"
                        ? `R$ ${slot.fee.toFixed(2)}`
                        : "Grátis";
                    return (
                      <TouchableOpacity
                        key={slot.id}
                        style={[
                          styles.slotRow,
                          {
                            borderColor: selected ? colors.tint : colors.border,
                            backgroundColor: selected
                              ? `${colors.tint}12`
                              : "transparent",
                          },
                        ]}
                        onPress={() => setSelectedSlot(slot)}
                      >
                        <Text style={[styles.slotTime, { color: colors.text }]}>
                          {slot.start_time} - {slot.end_time}
                        </Text>
                        <Text
                          style={[
                            styles.slotFee,
                            {
                              color: selected
                                ? colors.tint
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          {feeLabel}
                        </Text>
                        {selected && <MaterialCommunityIcons name="check" color={colors.tint} size={18} />}
                      </TouchableOpacity>
                    );
                  })}
                  {moreSlots.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setShowMoreSlots((v) => !v)}
                      style={styles.moreSlotsBtn}
                    >
                      <Text style={{ color: colors.tint, fontWeight: "600" }}>
                        {showMoreSlots
                          ? "Menos opções de horário"
                          : "Mais opções de horário"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Payment Method */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Forma de pagamento
              </Text>

              <TouchableOpacity
                style={[
                  styles.addressOption,
                  {
                    borderColor:
                      paymentMethod === "pix" ? colors.tint : colors.border,
                  },
                  paymentMethod === "pix" && {
                    backgroundColor: `${colors.tint}15`,
                  },
                ]}
                onPress={() => setPaymentMethod("pix")}
              >
                <MaterialCommunityIcons
                  name="qrcode"
                  color={paymentMethod === "pix" ? colors.tint : colors.icon}
                  size={20}
                />
                <View style={styles.addressInfo}>
                  <Text style={[styles.addressLabel, { color: colors.text }]}>
                    Pix (Sandbox)
                  </Text>
                  <Text
                    style={[
                      styles.addressText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Pague com QR Code ou Pix Copia e Cola.
                  </Text>
                </View>
                {paymentMethod === "pix" && (
                  <MaterialCommunityIcons name="check" color={colors.tint} size={20} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addressOption,
                  {
                    borderColor:
                      paymentMethod === "credit_card"
                        ? colors.tint
                        : colors.border,
                  },
                  paymentMethod === "credit_card" && {
                    backgroundColor: `${colors.tint}15`,
                  },
                ]}
                onPress={() => setPaymentMethod("credit_card")}
              >
                <MaterialCommunityIcons
                  name="credit-card"
                  color={
                    paymentMethod === "credit_card" ? colors.tint : colors.icon
                  }
                  size={20}
                />
                <View style={styles.addressInfo}>
                  <Text style={[styles.addressLabel, { color: colors.text }]}>
                    Cartão de Crédito (Mock)
                  </Text>
                  <Text
                    style={[
                      styles.addressText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Aprovação imediata para testes.
                  </Text>
                </View>
                {paymentMethod === "credit_card" && (
                  <MaterialCommunityIcons name="check" color={colors.tint} size={20} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addressOption,
                  {
                    borderColor:
                      paymentMethod === "debit_card"
                        ? colors.tint
                        : colors.border,
                  },
                  paymentMethod === "debit_card" && {
                    backgroundColor: `${colors.tint}15`,
                  },
                ]}
                onPress={() => setPaymentMethod("debit_card")}
              >
                <MaterialCommunityIcons
                  name="credit-card"
                  color={
                    paymentMethod === "debit_card" ? colors.tint : colors.icon
                  }
                  size={20}
                />
                <View style={styles.addressInfo}>
                  <Text style={[styles.addressLabel, { color: colors.text }]}>
                    Cartão de Débito (Mock)
                  </Text>
                  <Text
                    style={[
                      styles.addressText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Aprovação imediata para testes.
                  </Text>
                </View>
                {paymentMethod === "debit_card" && (
                  <MaterialCommunityIcons name="check" color={colors.tint} size={20} />
                )}
              </TouchableOpacity>
            </View>

            {/* Address — only for delivery */}
            {fulfillmentType === "entrega" && (
              <View
                style={[
                  styles.section,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Endereço de entrega
                </Text>
                {addresses.length === 0 ? (
                  <TouchableOpacity
                    onPress={() => router.push("/delivery/addresses")}
                  >
                    <Text
                      style={[styles.addAddressLink, { color: colors.tint }]}
                    >
                      + Adicionar endereço
                    </Text>
                  </TouchableOpacity>
                ) : (
                  addresses.map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[
                        styles.addressOption,
                        {
                          borderColor:
                            selectedAddress?.id === addr.id
                              ? colors.tint
                              : colors.border,
                        },
                        selectedAddress?.id === addr.id && {
                          backgroundColor: `${colors.tint}15`,
                        },
                      ]}
                      onPress={() => setSelectedAddress(addr)}
                    >
                      <MaterialCommunityIcons
                        name="map-marker"
                        color={
                          selectedAddress?.id === addr.id
                            ? colors.tint
                            : colors.icon
                        }
                        size={20}
                      />
                      <View style={styles.addressInfo}>
                        <Text
                          style={[styles.addressLabel, { color: colors.text }]}
                        >
                          {addr.label === "casa"
                            ? "Casa"
                            : addr.label === "trabalho"
                              ? "Trabalho"
                              : "Outro"}
                        </Text>
                        <Text
                          style={[
                            styles.addressText,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {addr.rua}, {addr.numero} - {addr.bairro},{" "}
                          {addr.cidade}-{addr.estado}
                        </Text>
                      </View>
                      {selectedAddress?.id === addr.id && (
                        <MaterialCommunityIcons name="check" color={colors.tint} size={20} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {fulfillmentType === "retirada" && store && (
              <View
                style={[
                  styles.section,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Local de retirada
                </Text>
                <View
                  style={[styles.addressOption, { borderColor: colors.border }]}
                >
                  <MaterialCommunityIcons name="map-marker" color={colors.tint} size={20} />
                  <View style={styles.addressInfo}>
                    <Text style={[styles.addressLabel, { color: colors.text }]}>
                      {store.name}
                    </Text>
                    <Text
                      style={[
                        styles.addressText,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {[store.street, store.number]
                        .filter(Boolean)
                        .join(", ") || store.city}
                      {store.neighborhood ? ` - ${store.neighborhood}` : ""}
                      {`, ${store.city}-${store.state}`}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View
              style={[
                styles.section,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Resumo do pedido
              </Text>
              {items.map((item, idx) => {
                const addonsTotal = item.addons.reduce(
                  (s, a) => s + a.price,
                  0,
                );
                return (
                  <View key={`${item.productId}-${idx}`}>
                    <View style={styles.summaryRow}>
                      <Text
                        style={[styles.summaryItemName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {item.quantity}x {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.summaryItemPrice,
                          { color: colors.text },
                        ]}
                      >
                        R${" "}
                        {((item.price + addonsTotal) * item.quantity).toFixed(
                          2,
                        )}
                      </Text>
                    </View>
                    {item.addons.map((addon) => (
                      <View
                        key={addon.id}
                        style={[styles.summaryRow, { paddingLeft: 16 }]}
                      >
                        <Text
                          style={[
                            styles.summaryItemName,
                            { color: colors.textSecondary, fontSize: 12 },
                          ]}
                          numberOfLines={1}
                        >
                          + {addon.name}
                        </Text>
                        <Text
                          style={[
                            styles.summaryItemPrice,
                            { color: colors.textSecondary, fontSize: 12 },
                          ]}
                        >
                          R$ {addon.price.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>

            <View
              style={[
                styles.section,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Cupom de desconto
              </Text>
              {couponApplied ? (
                <View
                  style={[
                    styles.couponApplied,
                    { backgroundColor: "#ECFDF5", borderColor: "#10B981" },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                     <MaterialCommunityIcons name="tag-outline" color="#10B981" size={16} />
                    <Text style={{ color: "#10B981", fontWeight: "600" }}>
                      {couponCode}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: "#10B981", fontWeight: "700" }}>
                      - R$ {discount.toFixed(2)}
                    </Text>
                     <TouchableOpacity onPress={handleRemoveCoupon}>
                      <MaterialCommunityIcons name="close" color="#10B981" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.couponRow}>
                  <TextInput
                    style={[
                      styles.couponInput,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                    placeholder="Digite o cupom"
                    placeholderTextColor={colors.textSecondary}
                    value={couponInput}
                    onChangeText={setCouponInput}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[
                      styles.couponButton,
                      { backgroundColor: colors.tint },
                    ]}
                    onPress={handleApplyCoupon}
                    disabled={validatingCoupon || !couponInput.trim()}
                  >
                    {validatingCoupon ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "600",
                          fontSize: 14,
                        }}
                      >
                        Aplicar
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View
              style={[
                styles.section,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Observação
              </Text>
              <TextInput
                style={[
                  styles.obsInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Alguma observação? (opcional)"
                placeholderTextColor={colors.textSecondary}
                value={observation}
                onChangeText={setObservation}
                multiline
                numberOfLines={3}
              />
            </View>
          </>
        }
        data={[]}
        renderItem={null}
        ListFooterComponent={
          <View
            style={[
              styles.totals,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.totalRow}>
              <Text
                style={[styles.totalLabel, { color: colors.textSecondary }]}
              >
                Subtotal
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                R$ {subtotal.toFixed(2)}
              </Text>
            </View>
            {discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: "#10B981" }]}>
                  Desconto
                </Text>
                <Text style={[styles.totalValue, { color: "#10B981" }]}>
                  - R$ {discount.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text
                style={[styles.totalLabel, { color: colors.textSecondary }]}
              >
                {fulfillmentType === "entrega" ? "Entrega" : "Retirada"}
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {deliveryFee > 0 ? `R$ ${deliveryFee.toFixed(2)}` : "Grátis"}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.totalFinal]}>
              <Text style={[styles.totalFinalLabel, { color: colors.text }]}>
                Total
              </Text>
              <Text style={[styles.totalFinalValue, { color: colors.tint }]}>
                R$ {(total + deliveryFee).toFixed(2)}
              </Text>
            </View>
          </View>
        }
      />

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.cardBackground,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.orderButton,
            { backgroundColor: !canSubmit ? colors.surface : colors.tint },
          ]}
          onPress={handleOrder}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.orderButtonText}>
              Confirmar Pedido — R$ {(total + deliveryFee).toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 8,
  },
  content: { padding: 16, paddingBottom: 100 },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 10,
  },
  fulfillmentRow: { flexDirection: "row", gap: 10 },
  fulfillmentCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  fulfillmentTitle: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  fulfillmentSub: { fontSize: 12, lineHeight: 16 },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    width: 58,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  dayLabel: { fontSize: 11, fontWeight: "500" },
  dayNum: { fontSize: 18, fontWeight: "700", marginTop: 2 },
  slotsList: { marginTop: 12, gap: 8 },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  slotTime: { flex: 1, fontSize: 15, fontWeight: "500" },
  slotFee: { fontSize: 14, fontWeight: "600" },
  moreSlotsBtn: { paddingVertical: 10, alignItems: "center" },
  addAddressLink: { fontSize: 14, fontWeight: "500" },
  addressOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  addressInfo: { flex: 1, marginLeft: 10 },
  addressLabel: { fontSize: 14, fontWeight: "600" },
  addressText: { fontSize: 13, marginTop: 2 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryItemName: { flex: 1, fontSize: 14, marginRight: 8 },
  summaryItemPrice: { fontSize: 14 },
  couponRow: {
    flexDirection: "row",
    gap: 8,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
  },
  couponButton: {
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  obsInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: "top",
  },
  totals: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14 },
  totalFinal: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 8,
    paddingTop: 8,
  },
  totalFinalLabel: { fontSize: 16, fontWeight: "700" },
  totalFinalValue: { fontSize: 18, fontWeight: "700" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  orderButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  orderButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
