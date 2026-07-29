Acho que vale a pena tratar isso como um **módulo do superapp**, não como uma tela isolada. Assim ele já nasce preparado para Mini Apps, OAuth e abertura de links de qualquer lugar do aplicativo.

# Arquitetura

```text
Zapi
│
├── Conversas
├── Atualizações
├── Lojas
├── IA
├── Configurações
│
└── Navegador
      │
      ├── WebView
      ├── AdBlock Engine
      ├── Download Manager
      ├── History
      ├── Favorites
      ├── Reader Mode
      ├── Share API
      ├── Cookie Manager
      └── Mini Apps (futuro)
```

---

# Fase 1 — MVP

Objetivo: abrir qualquer link sem sair do app.

## Funcionalidades

- ✅ Abrir URL
- ✅ Barra de endereço
- ✅ Voltar
- ✅ Avançar
- ✅ Recarregar
- ✅ Compartilhar
- ✅ Abrir no navegador externo
- ✅ Indicador HTTPS
- ✅ Loading progress

Interface

```
←   🔒 wikipedia.org      ⋮

━━━━━━━━━━━━━━━━━━━━━━━

      Página

━━━━━━━━━━━━━━━━━━━━━━━

◀ ▶ ⟳ 📤 ⋮
```

---

# Fase 2 — AdBlock

Essa é a parte que mais agrega valor.

## Engine

Interceptar todas as requisições da WebView.

Antes da página baixar:

```
imagem.jpg
↓

É anúncio?

↓

SIM
↓

Cancela
```

Filtros:

- EasyList
- EasyPrivacy
- Fanboy Annoyances

Depois você pode adicionar:

```
Zapi Filters
```

para bloquear elementos específicos.

---

## Interface

```
🛡️ 23 anúncios bloqueados
```

tocando:

```
────────────

AdBlock

Anúncios bloqueados
23

Rastreadores
14

Economia
4.2 MB

Tempo economizado
1.3 s

────────────
```

---

# Fase 3 — Segurança

Adicionar:

- bloqueio de popups
- bloqueio de redirecionamentos
- proteção contra phishing
- aviso de HTTP

Ícone

```
🔒

ou

🛡️
```

---

# Fase 4 — Downloads

Tudo baixado aparece aqui.

```
Downloads

PDF

IMG

APK

ZIP

Vídeo
```

---

# Fase 5 — Compartilhamento

Esse é o diferencial.

Enquanto navega:

```
⋮

Enviar para conversa

Criar atualização

Salvar

Copiar link

Abrir externamente
```

---

# Fase 6 — Reader Mode

Para artigos.

Antes

```
██████████

Propaganda

██████████

Banner

██████████
```

Depois

```
Título

Texto

Texto

Texto
```

Sem distrações.

---

# Fase 7 — Histórico

```
Hoje

Wikipedia

GitHub

ChatGPT

Ontem

Reddit

YouTube
```

---

# Fase 8 — Favoritos

```
⭐

Wikipedia

GitHub

React Native

OpenAI
```

---

# Fase 9 — Pesquisa Inteligente

A barra aceita qualquer entrada.

```
react native

↓

Pesquisa

----------------

https://github.com

↓

Abre URL

----------------

192.168.0.1

↓

Abre
```

Como Chrome e Safari.

---

# Fase 10 — Mini Apps (futuro)

Esse navegador será a base.

```
Loja

↓

Mini App

↓

WebView
```

Pagamento

↓

SuperApp

Notificações

↓

SuperApp

Login

↓

SuperApp

---

# Estrutura de pastas

```
browser/

    components/
        AddressBar.tsx
        BottomBar.tsx
        BrowserTab.tsx
        ProgressBar.tsx
        ReaderMode.tsx

    hooks/
        useBrowser.ts
        useHistory.ts
        useDownloads.ts
        useAdblock.ts

    services/
        BrowserService.ts
        AdblockService.ts
        DownloadService.ts
        CookieService.ts
        HistoryService.ts

    screens/
        BrowserScreen.tsx
        DownloadsScreen.tsx
        FavoritesScreen.tsx
        HistoryScreen.tsx

    store/
        browserStore.ts

    types/

    utils/
```

# Tecnologias recomendadas (React Native + Expo)

- **`react-native-webview`** como base do navegador.
- **`@cliqz/adblocker`** ou uma engine compatível com listas EasyList/EasyPrivacy para o bloqueio de anúncios.
- **`react-native-cookies`** (ou gerenciamento equivalente) para cookies e sessões.
- **`zustand`** para estado do navegador (abas, histórico, favoritos).
- **`expo-file-system`** para downloads e armazenamento.
- **`expo-sharing`** para compartilhar páginas e arquivos.

# Ordem de desenvolvimento

1. ✅ Navegação básica (WebView + barra de endereço).
2. ✅ Interceptação de links (abrir links do chat e de outras telas).
3. ✅ AdBlock nativo.
4. ✅ Compartilhar para conversas e Atualizações.
5. ✅ Downloads.
6. ✅ Histórico e favoritos.
7. ✅ Reader Mode.
8. ✅ Múltiplas abas.
9. 🚀 Base para Mini Apps.

Essa sequência entrega valor rapidamente e evita construir recursos avançados antes de ter uma base sólida. Quando chegar às Mini Apps, você já terá um navegador integrado, seguro e reutilizável em todo o superapp.
