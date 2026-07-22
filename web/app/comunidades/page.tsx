"use client";

import { useState } from "react";
import { Users, Plus, Search, Compass, Sparkles, Check } from "lucide-react";
import Image from "next/image";

interface Community {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  category: string;
  avatarUrl: string;
  bannerUrl: string;
  joined: boolean;
}

export default function CommunitiesPage() {
  const [activeTab, setActiveTab] = useState<"my" | "explore">("explore");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [communities, setCommunities] = useState<Community[]>([
    {
      id: "1",
      name: "Desenvolvedores Zapi",
      description: "Espaço dedicado a desenvolvedores criando soluções, bots e integrações integradas ao Zapi API e Superapp.",
      membersCount: 1240,
      category: "Tecnologia",
      avatarUrl: "https://images.unsplash.com/photo-1618401471353-b98aedd07871?w=150",
      bannerUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500",
      joined: true
    },
    {
      id: "2",
      name: "Delivery e Food Commerce Brasil",
      description: "Dicas, novidades e networking para donos de restaurantes, hamburguerias e delivery na plataforma Zapi.",
      membersCount: 890,
      category: "Negócios",
      avatarUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=150",
      bannerUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500",
      joined: false
    },
    {
      id: "3",
      name: "Marketing Digital de Resultados",
      description: "Estratégias de vendas no chat, funis de conversão automáticos e atração de clientes via Zapi e redes sociais.",
      membersCount: 2310,
      category: "Marketing",
      avatarUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=150",
      bannerUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500",
      joined: false
    },
    {
      id: "4",
      name: "Suporte e Sucesso do Cliente",
      description: "Discussões sobre atendimento humanizado e automatizado, NPS elevado e encantamento do cliente no chat.",
      membersCount: 512,
      category: "Negócios",
      avatarUrl: "https://images.unsplash.com/photo-1521791136364-7286472b5399?w=150",
      bannerUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500",
      joined: true
    }
  ]);

  const [newCommName, setNewCommName] = useState("");
  const [newCommDesc, setNewCommDesc] = useState("");
  const [newCommCategory, setNewCommCategory] = useState("Geral");

  const handleCreateCommunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommName.trim()) return;

    const newComm: Community = {
      id: Date.now().toString(),
      name: newCommName.trim(),
      description: newCommDesc.trim() || "Sem descrição disponível.",
      membersCount: 1,
      category: newCommCategory,
      avatarUrl: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150",
      bannerUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500",
      joined: true
    };

    setCommunities([newComm, ...communities]);
    setNewCommName("");
    setNewCommDesc("");
    setNewCommCategory("Geral");
    setShowCreateModal(false);
  };

  const handleJoinToggle = (id: string) => {
    setCommunities(communities.map(comm => {
      if (comm.id === id) {
        return {
          ...comm,
          joined: !comm.joined,
          membersCount: comm.joined ? comm.membersCount - 1 : comm.membersCount + 1
        };
      }
      return comm;
    }));
  };

  const filteredCommunities = communities.filter(comm => {
    const matchesSearch = comm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          comm.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          comm.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === "my") return comm.joined;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#fafafa] dark:bg-[#0c0c14] overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
          <Users className="h-64 w-64 rotate-12" />
        </div>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Comunidades</h1>
            <p className="text-emerald-100 mt-1 text-sm md:text-base">
              Conecte-se com pessoas com os mesmos interesses e faça parte de grandes grupos.
            </p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="self-start md:self-auto flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Criar Comunidade
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl w-full mx-auto px-4 py-8 flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Stats & Search */}
          <div className="md:col-span-1 space-y-6">
            {/* Search */}
            <div className="bg-white dark:bg-[#11111e] rounded-2xl p-4 border border-card-border/60 shadow-sm">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-text" />
                <input
                  type="text"
                  placeholder="Buscar comunidades..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-white/5 border-0 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-[#151528] transition-all outline-none"
                />
              </div>
            </div>

            {/* Quick Stats Info card */}
            <div className="bg-white dark:bg-[#11111e] rounded-2xl p-5 border border-card-border/60 shadow-sm space-y-4">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-bold text-sm">Por que participar?</h3>
              </div>
              <ul className="text-xs text-muted-text space-y-2.5 list-disc pl-4 leading-relaxed">
                <li>Compartilhe insights e aprenda com o ecossistema.</li>
                <li>Receba atualizações importantes diretamente de organizadores.</li>
                <li>Encontre desenvolvedores e lojistas parceiros.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Communities List */}
          <div className="md:col-span-2 space-y-6">
            {/* Navigation Tabs */}
            <div className="flex border-b border-card-border/60 gap-6">
              <button
                onClick={() => setActiveTab("explore")}
                className={`pb-3 text-sm font-semibold relative transition-all cursor-pointer ${
                  activeTab === "explore"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-text hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Compass className="h-4 w-4" /> Explodir & Explorar
                </span>
                {activeTab === "explore" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("my")}
                className={`pb-3 text-sm font-semibold relative transition-all cursor-pointer ${
                  activeTab === "my"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-text hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Minhas Comunidades
                </span>
                {activeTab === "my" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded" />
                )}
              </button>
            </div>

            {/* List */}
            <div className="space-y-4">
              {filteredCommunities.length === 0 ? (
                <div className="py-12 text-center bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-sm">
                  <Users className="h-10 w-10 text-gray-300 dark:text-neutral-700 mx-auto mb-3 animate-pulse" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma comunidade encontrada.</p>
                </div>
              ) : (
                filteredCommunities.map((comm) => (
                  <div
                    key={comm.id}
                    className="bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 shadow-sm overflow-hidden flex flex-col md:flex-row group hover:shadow-md transition-all duration-300"
                  >
                    {/* Visual Banner on side or background */}
                    <div className="relative md:w-40 h-28 md:h-auto bg-neutral-200 dark:bg-neutral-800 flex-shrink-0">
                      <Image
                        src={comm.bannerUrl}
                        alt="Community banner"
                        fill
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        unoptimized
                      />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {comm.category}
                      </div>
                    </div>

                    {/* Community Content */}
                    <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                      <div className="flex gap-4">
                        <Image
                          src={comm.avatarUrl}
                          alt={comm.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800"
                          unoptimized
                        />
                        <div className="space-y-1">
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">
                            {comm.name}
                          </h3>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            {comm.membersCount.toLocaleString()} participantes
                          </p>
                          <p className="text-xs text-muted-text leading-relaxed">
                            {comm.description}
                          </p>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <div className="flex gap-2 self-end">
                        {comm.joined ? (
                          <>
                            <button
                              onClick={() => handleJoinToggle(comm.id)}
                              className="flex items-center gap-1.5 border border-emerald-500/20 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer active:scale-95"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Membro
                            </button>
                            <button className="bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer active:scale-95">
                              Abrir
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleJoinToggle(comm.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer active:scale-95 shadow-md shadow-emerald-600/10"
                          >
                            Participar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white dark:bg-[#11111e] rounded-2xl border border-card-border/60 w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Criar Nova Comunidade</h3>
            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-text mb-1">Nome da Comunidade</label>
                <input
                  type="text"
                  placeholder="Ex: Desenvolvedores Frontend"
                  value={newCommName}
                  onChange={(e) => setNewCommName(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-white/5 border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-[#151528] transition-all outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-text mb-1">Descrição</label>
                <textarea
                  placeholder="Fale brevemente sobre o foco e regras da comunidade..."
                  value={newCommDesc}
                  onChange={(e) => setNewCommDesc(e.target.value)}
                  className="w-full h-24 bg-neutral-100 dark:bg-white/5 border-0 rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-[#151528] transition-all outline-none resize-none"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-text mb-1">Categoria</label>
                <select
                  value={newCommCategory}
                  onChange={(e) => setNewCommCategory(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-[#151528] border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Geral">Geral</option>
                  <option value="Tecnologia">Tecnologia</option>
                  <option value="Negócios">Negócios</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Entretenimento">Entretenimento</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-md shadow-emerald-600/10 cursor-pointer"
                >
                  Criar Comunidade
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
