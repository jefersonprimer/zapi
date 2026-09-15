"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Square, Tag, MessageCircle, AlertCircle, ShoppingBag, Eye, Send, Star, Layers, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_URL, authFetch, type Store, type StoreProduct } from "@/lib/api";

interface LiveStream {
  id: string;
  store_id: string;
  publisher_id: string;
  title: string;
  description: string | null;
  status: string;
  viewer_count: number;
  playback_url: string | null;
}

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

export default function MerchantLiveControlPage() {
  const { token, user } = useAuth();

  const [activeLive, setActiveLive] = useState<LiveStream | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  
  // Create Live Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creatingLive, setCreatingLive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch store and products
  useEffect(() => {
    if (!token) return;

    const fetchStoreAndProducts = async () => {
      try {
        const vendorStores = await authFetch<Store[]>(`${API_URL}/delivery/vendor/stores`, token);
        if (vendorStores && vendorStores.length > 0) {
          const mainStore = vendorStores[0];
          setStore(mainStore);

          const storeProducts = await authFetch<StoreProduct[]>(`${API_URL}/delivery/stores/${mainStore.id}/products`, token);
          setProducts(storeProducts);

          // Check if there's already an active live
          const activeLives = await authFetch<LiveStream[]>(`${API_URL}/lives/active`, token);
          const currentStoreLive = activeLives.find(l => l.store_id === mainStore.id);
          if (currentStoreLive) {
            setActiveLive(currentStoreLive);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do lojista:", err);
      }
    };

    fetchStoreAndProducts();
  }, [token]);

  // Connect to WebSocket when live starts
  useEffect(() => {
    if (!token || !activeLive) return;

    const wsUrl = `${API_URL.replace("http", "ws")}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Painel do lojista inscrito na live:", activeLive.id);
      ws.send(JSON.stringify({
        type: "subscribe",
        chat_id: activeLive.id
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "live:chat_message") {
          const newMsg: ChatMessage = {
            id: data.message_id || Math.random().toString(),
            user_id: data.user_id,
            user_name: data.user_name,
            message: data.message,
            created_at: data.created_at || new Date().toISOString(),
          };
          setMessages(prev => [...prev, newMsg]);
        }
      } catch (err) {
        console.error("Erro no WebSocket:", err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "unsubscribe",
          chat_id: activeLive.id
        }));
        ws.close();
      }
    };
  }, [activeLive, token]);

  // Handle local camera preview
  useEffect(() => {
    if (activeLive && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.warn("Não foi possível acessar a câmera para preview:", err);
        });
    }
  }, [activeLive]);

  // Criar Live
  const handleCreateLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !store || !token) return;

    setCreatingLive(true);
    try {
      const res = await fetch(`${API_URL}/lives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: store.id,
          title,
          description: description || null,
        }),
      });

      if (res.ok) {
        const live: LiveStream = await res.json();
        // Start live immediately
        const startRes = await fetch(`${API_URL}/lives/${live.id}/start`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (startRes.ok) {
          const startedLive = await startRes.json();
          setActiveLive(startedLive);
        }
      }
    } catch (err) {
      console.error("Erro ao criar live:", err);
    } finally {
      setCreatingLive(false);
    }
  };

  // Encerrar Live
  const handleEndLive = async () => {
    if (!activeLive || !token) return;

    if (!confirm("Tem certeza que deseja encerrar a transmissão ao vivo?")) return;

    try {
      const res = await fetch(`${API_URL}/lives/${activeLive.id}/end`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        setActiveLive(null);
        setMessages([]);
        setHighlightedProductId(null);
        // Stop camera stream
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
      }
    } catch (err) {
      console.error("Erro ao encerrar live:", err);
    }
  };

  // Destacar Produto na Live
  const handleHighlightProduct = async (productId: string, featuredState: boolean) => {
    if (!activeLive || !token) return;

    try {
      const res = await fetch(`${API_URL}/lives/${activeLive.id}/highlight`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: productId,
          is_featured: featuredState
        }),
      });

      if (res.ok) {
        setHighlightedProductId(featuredState ? productId : null);
      }
    } catch (err) {
      console.error("Erro ao destacar produto:", err);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Live Commerce</h1>
          <p className="text-zinc-500 text-sm mt-1">Transmita ao vivo e venda seus produtos em tempo real.</p>
        </div>
        {activeLive && (
          <button 
            onClick={handleEndLive}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow"
          >
            <Square className="w-4 h-4 fill-current" /> Encerrar Live
          </button>
        )}
      </div>

      {!activeLive ? (
        /* FORMULÁRIO DE INICIALIZAÇÃO DE LIVE */
        <div className="mt-8 max-w-md mx-auto bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Criar Nova Transmissão</h2>
              <p className="text-zinc-400 text-xs mt-0.5">Preencha os dados da sua live.</p>
            </div>
          </div>

          <form onSubmit={handleCreateLive} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Título da Live</label>
              <input
                type="text"
                placeholder="Ex: Mega Ofertas de Primavera! 🌸"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Descrição</label>
              <textarea
                placeholder="Ex: Descontos de até 50% nos produtos em destaque."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={creatingLive}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-400 text-white font-bold text-sm py-3 rounded-xl transition shadow"
            >
              <Play className="w-4 h-4 fill-current" /> {creatingLive ? "Iniciando..." : "Iniciar Transmissão"}
            </button>
          </form>
        </div>
      ) : (
        /* PAINEL DE CONTROLE DA LIVE ATIVA */
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUNA ESQUERDA: CÂMERA E CHAT (7 colunas) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Player de Preview de Câmera */}
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-md border border-zinc-800 flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Ao Vivo
              </div>
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 text-white font-medium text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                <Eye className="w-4 h-4" /> 142 Espectadores
              </div>
              <div className="absolute bottom-4 left-4 right-4 bg-black/60 p-3 rounded-xl backdrop-blur-sm text-xs">
                <span className="font-bold text-zinc-300">Link da live para compartilhar:</span>
                <span className="block mt-1 font-mono text-emerald-400 select-all">
                  https://zapi.app/delivery/lives/{activeLive.id}
                </span>
              </div>
            </div>

            {/* Chat da Live em Tempo Real */}
            <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm h-[320px]">
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Chat da Live</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                {messages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-1.5">{msg.user_name}:</span>
                    <span className="text-zinc-700 dark:text-zinc-300">{msg.message}</span>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-zinc-400 text-center py-12 text-xs">Aguardando comentários dos espectadores...</p>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA: GERENCIADOR DE PRODUTOS (5 colunas) */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[650px]">
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Produtos do Catálogo</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {products.map(product => {
                const isFeatured = highlightedProductId === product.id;
                return (
                  <div 
                    key={product.id} 
                    className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                      isFeatured 
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" 
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-sm">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        "📦"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold truncate text-zinc-900 dark:text-zinc-100">{product.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                          R$ {product.promotional_price || product.price}
                        </span>
                      </div>
                    </div>
                    
                    {isFeatured ? (
                      <button
                        onClick={() => handleHighlightProduct(product.id, false)}
                        className="bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 font-bold text-xs px-3 py-1.5 rounded-lg transition"
                      >
                        Remover Destaque
                      </button>
                    ) : (
                      <button
                        onClick={() => handleHighlightProduct(product.id, true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3 fill-current" /> Destacar
                      </button>
                    )}
                  </div>
                );
              })}
              {products.length === 0 && (
                <p className="text-zinc-500 text-center py-12 text-xs">Nenhum produto cadastrado nesta loja.</p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
