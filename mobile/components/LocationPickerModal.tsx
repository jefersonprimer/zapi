import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { useAppTheme } from "@/context/ThemeContext";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSendLocation: (location: {
    type: "location";
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  }) => void;
}

export function LocationPickerModal({
  visible,
  onClose,
  onSendLocation,
}: LocationPickerModalProps) {
  const { colors, isDark } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addressInfo, setAddressInfo] = useState<{ name: string; address: string } | null>(null);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const initialCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (visible) {
      initialCoordsRef.current = null;
      getUserLocation();
    }
  }, [visible]);

  const getUserLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão Negada",
          "Precisamos de permissão de localização para obter sua posição atual."
        );
        onClose();
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      initialCoordsRef.current = { latitude, longitude };
      setCoords({ latitude, longitude });
      setAddressInfo({ name: "Localização no mapa", address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
      fetchAddress(latitude, longitude);
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível obter sua localização.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const fetchAddress = async (lat: number, lng: number) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setFetchingAddress(true);
    debounceTimeoutRef.current = setTimeout(async () => {
      // 1. Try Expo native geocoder first (no rate limits, uses Google/Apple system API, returns in local language)
      try {
        const geoResults = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geoResults && geoResults.length > 0) {
          const addr = geoResults[0];
          const street = addr.street || addr.name || "";
          const num = addr.streetNumber ? `, ${addr.streetNumber}` : "";
          const name = street ? `${street}${num}` : "Localização selecionada";
          
          const parts = [
            addr.district || addr.subregion, // Bairro / Região
            addr.city,                       // Cidade
            addr.region                      // Estado / UF
          ].filter(Boolean);
          const addressText = parts.join(" - ");
          
          setAddressInfo({ name, address: addressText });
          setFetchingAddress(false);
          return;
        }
      } catch (nativeErr) {
        console.warn("Native reverse geocode failed, falling back to Nominatim:", nativeErr);
      }

      // 2. Fallback to Nominatim OpenStreetMap API
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
          {
            headers: {
              "User-Agent": "Zapi-App-Location-Share",
            },
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Expected JSON response, but got: ${contentType}`);
        }
        const data = await response.json();
        if (data && data.address) {
          const address = data.address;
          const road = address.road || "";
          const houseNumber = address.house_number || "";
          const suburb = address.suburb || address.neighbourhood || "";
          const city = address.city || address.town || address.village || "";
          const state = address.state || "";

          const name = road
            ? `${road}${houseNumber ? `, ${houseNumber}` : ""}`
            : "Localização selecionada";
          const addressText = [suburb, city, state].filter(Boolean).join(" - ");

          setAddressInfo({ name, address: addressText });
        } else {
          setAddressInfo({ name: "Localização no mapa", address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
        }
      } catch (error) {
        console.warn("Reverse geocode fallback failed:", error);
        setAddressInfo({ name: "Localização no mapa", address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
      } finally {
        setFetchingAddress(false);
      }
    }, 1200); // Debounce requests to respect Nominatim limits
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "location_change") {
        const { latitude, longitude } = data;
        setCoords({ latitude, longitude });
        setAddressInfo({ name: "Localização no mapa", address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
        fetchAddress(latitude, longitude);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = () => {
    console.log("[LocationPickerModal] handleSend clicked. coords:", coords, "addressInfo:", addressInfo, "fetchingAddress:", fetchingAddress);
    if (coords && addressInfo) {
      console.log("[LocationPickerModal] Conditions met, sending location...");
      onSendLocation({
        type: "location",
        latitude: coords.latitude,
        longitude: coords.longitude,
        name: addressInfo.name,
        address: addressInfo.address,
      });
      onClose();
    } else {
      console.log("[LocationPickerModal] Cannot send. coords is null?", !coords, "addressInfo is null?", !addressInfo);
    }
  };

  const mapHtml = initialCoordsRef.current
    ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body, html, #map {
      margin: 0; padding: 0; height: 100%; width: 100%;
      background: ${isDark ? "#1e1e1e" : "#f0f0f0"};
    }
    #center-marker {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 38px;
      height: 38px;
      margin-top: -38px;
      margin-left: -19px;
      z-index: 1000;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="center-marker">
    <svg viewBox="0 0 24 24" width="38" height="38" fill="#4CAF50">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false
    }).setView([${initialCoordsRef.current.latitude}, ${initialCoordsRef.current.longitude}], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    function sendLocation(lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'location_change',
          latitude: lat,
          longitude: lng
        }));
      }
    }

    map.on('moveend', function() {
      var center = map.getCenter();
      sendLocation(center.lat, center.lng);
    });
  </script>
</body>
</html>
`
    : "";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Enviar Localização
          </Text>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        {/* Map / Loading */}
        <View style={styles.mapContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Obtendo localização atual...
              </Text>
            </View>
          ) : (
            initialCoordsRef.current && (
              <WebView
                ref={webViewRef}
                originWhitelist={["*"]}
                source={{ html: mapHtml }}
                onMessage={handleMessage}
                style={styles.webView}
              />
            )
          )}
        </View>

        {/* Address Info & Send Button */}
        {coords && (
          <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={styles.addressContainer}>
              <MaterialCommunityIcons name="map-marker" size={24} color="#4CAF50" style={styles.markerIcon} />
              <View style={styles.addressInfo}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[styles.addressName, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                    {addressInfo?.name || "Localização selecionada"}
                  </Text>
                  {fetchingAddress && (
                    <ActivityIndicator size="small" color={colors.tint} style={{ marginLeft: 8 }} />
                  )}
                </View>
                <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {addressInfo?.address || "Carregando endereço..."}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.tint }]}
              onPress={handleSend}
            >
              <Text style={styles.sendButtonText}>Enviar esta localização</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: Platform.OS === "ios" ? 44 : 0,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerButtonPlaceholder: {
    width: 32,
  },
  mapContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  markerIcon: {
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  addressText: {
    fontSize: 14,
    marginTop: 2,
  },
  sendButton: {
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
