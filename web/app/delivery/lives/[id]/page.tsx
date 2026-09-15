"use client";

import { useEffect, useState, useRef, use } from "react";
import { useParams, useRouter } from "next/navigation";
import { Heart, MessageCircle, Send, ShoppingBag, X, Volume2, VolumeX, Eye, ArrowLeft, Star, ShoppingCart } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
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

export default function LiveStreamPlayerPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { token, user } = useAuth();
  const { addToCart } = useCart();

  const [live, setLive] = useState<LiveStream | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [highlightedProduct, setHighlightedProduct] = useState<StoreProduct | null>(null);
  const [showProductBag, setShowProductBag] = useState(false);
  const [liveProducts, setLiveProducts] = useState<StoreProduct[]>([]);
  
  // Heart reactions list
  const [hearts, setHearts] = useState<{ id: number; left: number }[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch Live and Store details
  useEffect(() => {
    if (!token) return;

    const fetchDetails = async () => {
      try {
        // Fetch specific live stream info
        const activeLives = await authFetch<LiveStream[]>(`${API_URL}/lives/active`, token);
        const currentLive = activeLives.find(l => l.id === id);
        
        if (currentLive) {
          setLive(currentLive);
          
          // Fetch store details
          const storeDetails = await authFetch<Store>(`${API_URL}/delivery/stores/${currentLive.store_id}`, token);
          setStore(storeDetails);

          // Fetch products associated to store (using as list of live products)
          const storeProducts = await authFetch<StoreProduct[]>(`${API_URL}/delivery/stores/${currentLive.store_id}/products`, token);
          setLiveProducts(storeProducts);

          // If there's an already highlighted product, set it
          const featured = storeProducts.find(p => p.is_available); // Fallback to first available
          if (featured) setHighlightedProduct(featured);
        } else {
          // If not found in active, try mock data so page doesn't crash in preview
          setLive({
            id,
            store_id: "store-uuid",
            publisher_id: "user-uuid",
            title: "Super Live de Ofertas Especiais! 🛍️",
            description: "Descontos imperdíveis ao vivo. Compre em 1 clique!",
            status: "live",
            viewer_count: 142,
            playback_url: null,
          });
        }
      } catch (err) {
        console.error("Erro ao carregar detalhes da live:", err);
      }
    };

    fetchDetails();
  }, [id, token]);

  // Connect to WebSocket
  useEffect(() => {
    if (!token || !id) return;

    const wsUrl = `${API_URL.replace("http", "ws")}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket conectado para Live Commerce");
      // Inscrever na sala da live
      ws.send(JSON.stringify({
        type: "subscribe",
        chat_id: id
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Mensagem recebida da Live:", data);

        if (data.type === "live:chat_message") {
          const newMsg: ChatMessage = {
            id: data.message_id || Math.random().toString(),
            user_id: data.user_id,
            user_name: data.user_name,
            message: data.message,
            created_at: data.created_at || new Date().toISOString(),
          };
          setMessages(prev => [...prev, newMsg]);
        } else if (data.type === "live:product_highlight") {
          if (data.is_featured) {
            // Find product in our list
            const prod = liveProducts.find(p => p.id === data.product_id);
            if (prod) {
              setHighlightedProduct(prod);
            }
          } else {
            setHighlightedProduct(null);
          }
        }
      } catch (err) {
        console.error("Erro ao ler evento do WebSocket:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket da Live desconectado");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "unsubscribe",
          chat_id: id
        }));
        ws.close();
      }
    };
  }, [id, token, liveProducts]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Enviar Mensagem de Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !token) return;

    try {
      await fetch(`${API_URL}/lives/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: inputText }),
      });
      setInputText("");
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    }
  };

  // Enviar Reação de Coração
  const handleSendHeart = () => {
    // Adicionar animação de coração na tela
    const newHeart = {
      id: Date.now(),
      left: Math.random() * 80 + 10, // Posição aleatória na tela
    };
    setHearts(prev => [...prev, newHeart]);

    // Remover após animação de 2 segundos
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 2000);
  };

  const handleBuyProduct = (product: StoreProduct) => {
    if (!store) return;
    addToCart(product, store);
    
    // Feedback visual de adicionado
    alert(`${product.name} adicionado ao carrinho!`);
  };

  return (
    <div className="relative h-[92vh] w-full max-w-md mx-auto bg-black text-white overflow-hidden rounded-2xl shadow-2xl border border-zinc-800">
      
      {/* 1. MOCK PLAYER DE VÍDEO (Simulando uma Live Ativa) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 z-0">
        <video 
          className="w-full h-full object-cover"
          src="https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-fresh-vegetable-salad-41617-large.mp4" // Video mock de salada/comida
          autoPlay 
          loop 
          muted={isMuted}
          playsInline
        />
      </div>

      {/* 2. OVERLAY SUPERIOR */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 pr-3 rounded-full">
          <button onClick={() => router.back()} className="p-1 hover:bg-white/10 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="w-8 h-8 rounded-full bg-emerald-500 overflow-hidden flex items-center justify-center font-bold text-sm">
            {store?.avatar ? (
              <img src={store.avatar} alt={store.name} className="w-full h-full object-cover" />
            ) : (
              store?.name.charAt(0) || "L"
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold truncate max-w-[120px]">{store?.name || "Loja do Super App"}</h4>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">Ao Vivo</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Espectadores */}
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-full text-xs font-medium">
            <Eye className="w-4 h-4 text-white" />
            <span>{live?.viewer_count || 128}</span>
          </div>

          {/* Som Mute/Unmute */}
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className="p-2 bg-black/40 backdrop-blur-md hover:bg-black/60 rounded-full transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Título da Live */}
      <div className="absolute top-20 left-4 right-4 z-10">
        <h2 className="text-sm font-semibold drop-shadow-md text-white/90 truncate bg-black/20 p-2 rounded-lg backdrop-blur-sm">
          {live?.title || "Super Live de Ofertas!"}
        </h2>
      </div>

      {/* 3. ANIMAÇÃO DE REAÇÕES (CORAÇÕES SUBINDO) */}
      <div className="absolute right-6 bottom-36 w-20 h-64 z-20 pointer-events-none overflow-hidden">
        {hearts.map(heart => (
          <div
            key={heart.id}
            className="absolute bottom-0 text-red-500 animate-bounce pointer-events-none"
            style={{
              left: `${heart.left}%`,
              animation: "slideUpAndFade 2s ease-out forwards",
            }}
          >
            <Heart className="w-6 h-6 fill-current drop-shadow-lg" />
          </div>
        ))}
      </div>

      {/* Estilo CSS in-line para animação dos corações */}
      <style jsx global>{`
        @keyframes slideUpAndFade {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translateY(-250px) scale(1.3) rotate(${Math.random() * 40 - 20}deg);
            opacity: 0;
          }
        }
      `}</style>

      {/* 4. CHAT EM TEMPO REAL (OVERLAY INFERIOR) */}
      <div className="absolute bottom-20 left-4 right-4 z-10 flex flex-col gap-3 max-h-[40%] justify-end">
        {/* Mensagens de Chat */}
        <div className="overflow-y-auto flex flex-col gap-1.5 pr-2 max-h-[160px] no-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-2xl max-w-[85%] self-start text-xs border border-white/5">
              <span className="font-bold text-emerald-400 mr-1.5">{msg.user_name}:</span>
              <span className="text-zinc-100">{msg.message}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* 5. PRODUTO EM DESTAQUE (POP-UP DINÂMICO) */}
        {highlightedProduct && (
          <div className="flex items-center gap-3 bg-white text-zinc-900 p-2.5 rounded-2xl shadow-2xl animate-bounce border border-emerald-500">
            <div className="w-14 h-14 bg-zinc-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xs">
              {highlightedProduct.image ? (
                <img src={highlightedProduct.image} alt={highlightedProduct.name} className="w-full h-full object-cover" />
              ) : (
                "📦"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Em Destaque
              </span>
              <h4 className="text-xs font-bold truncate mt-0.5">{highlightedProduct.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-extrabold text-emerald-600">
                  R$ {highlightedProduct.promotional_price || highlightedProduct.price}
                </span>
                {highlightedProduct.promotional_price && (
                  <span className="text-[10px] line-through text-zinc-400">R$ {highlightedProduct.price}</span>
                )}
              </div>
            </div>
            <button 
              onClick={() => handleBuyProduct(highlightedProduct)}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1"
            >
              Comprar
            </button>
          </div>
        )}
      </div>

      {/* 6. INPUTS E AÇÕES INFERIORES */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-2">
        {/* Sacola de compras da live */}
        <button 
          onClick={() => setShowProductBag(true)}
          className="p-3 bg-zinc-900/90 backdrop-blur-md hover:bg-zinc-800 rounded-full transition relative border border-zinc-800"
        >
          <ShoppingBag className="w-5 h-5 text-white" />
          {liveProducts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {liveProducts.length}
            </span>
          )}
        </button>

        {/* Input do Chat */}
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-800">
          <input
            type="text"
            placeholder="Comente na live..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white focus:outline-none placeholder-zinc-400 py-2"
          />
          <button type="submit" className="p-1.5 text-emerald-400 hover:text-emerald-500 transition">
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Reação de Coração */}
        <button 
          onClick={handleSendHeart}
          className="p-3 bg-red-600 hover:bg-red-500 hover:scale-105 active:scale-95 rounded-full transition shadow-lg border border-red-500"
        >
          <Heart className="w-5 h-5 fill-current text-white" />
        </button>
      </div>

      {/* 7. PAINEL/GAVETA DE PRODUTOS DA LIVE (BOTTOM SHEET MODAL) */}
      {showProductBag && (
        <div className="absolute inset-x-0 bottom-0 bg-zinc-950 text-white rounded-t-3xl p-5 z-30 max-h-[70%] overflow-y-auto border-t border-zinc-800 transition-all animate-in slide-in-from-bottom">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm">Produtos da Live</h3>
            </div>
            <button onClick={() => setShowProductBag(false)} className="p-1 hover:bg-zinc-800 rounded-full transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col gap-3.5 mt-4">
            {liveProducts.map(product => (
              <div key={product.id} className="flex items-center gap-3 bg-zinc-900 p-2.5 rounded-2xl border border-zinc-850 hover:border-zinc-800 transition">
                <div className="w-16 h-16 bg-zinc-850 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-sm">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    "📦"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold truncate">{product.name}</h4>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">{product.description || "Sem descrição"}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-extrabold text-emerald-400">
                      R$ {product.promotional_price || product.price}
                    </span>
                    {product.promotional_price && (
                      <span className="text-[10px] line-through text-zinc-500">R$ {product.price}</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => handleBuyProduct(product)}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1"
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
            ))}
            {liveProducts.length === 0 && (
              <p className="text-zinc-500 text-center py-6 text-xs">Nenhum produto cadastrado para esta live.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
