# Relatório de Criptografia — Projeto Zapi

**Data:** 02/08/2026
**Autor:** Auditoria técnica automatizada
**Escopo:** Busca em `backend/` (Rust/Axum), `mobile/` (React Native/Expo), `web/` (Next.js)

---

## Veredicto

**NÃO.** O Zapi **não usa criptografia para as mensagens de texto**. As mensagens são
transmitidas e armazenadas em **texto puro** (plaintext), tanto no servidor quanto no
cliente. As únicas primitivas criptográficas encontradas no projeto servem para
autenticação (senha/JWT), integridade de arquivos (SHA-256) e chamadas de voz/vídeo
(WebRTC). Nenhuma delas protege o conteúdo das mensagens de texto.

---

## 1. O que foi encontrado (primitivas criptográficas existentes)

### 1.1 Argon2 — Hash de senha (NÃO é criptografia de mensagem)
- **Onde:** `backend/src/handlers/auth.rs:61-71` (registro), `:147-161` (login)
- **Uso:** Geração/verificação do hash da senha do usuário com salt aleatório (`OsRng`).
- **Propósito:** Protege as **credenciais** armazenadas no banco, não o conteúdo de conversas.
- **Biblioteca:** `argon2 = "0.5"` (`backend/Cargo.toml:17`)

### 1.2 JWT (jsonwebtoken) — Assinatura HMAC-SHA
- **Onde:** `backend/src/auth.rs:21-48`
- **Uso:** Tokens de sessão `HS256` com `JWT_SECRET` (expiração de 7 dias).
- **Propósito:** **Autenticação/autorização** — provar "quem é você" para a API. Não há
  chave usada para cifrar/decifrar conteúdo de mensagem.
- **Biblioteca:** `jsonwebtoken = "9"` (`backend/Cargo.toml:18`)

### 1.3 SHA-256 — Hash de integridade de anexos
- **Onde:** `backend/src/handlers/messages.rs:20`, `backend/src/handlers/upload.rs:129-152`,
  `mobile/services/database.ts:115`, `mobile/services/api.ts:67`
- **Uso:** Coluna `sha256` na tabela `attachments`.
- **Propósito:** **Deduplicação** de uploads e verificação de integridade do arquivo.
  Hash é um algoritmo de mão única — **não cifra** e não protege confidencialidade.

### 1.4 WebRTC (DTLS-SRTP) — ÚNICO caso de criptografia ponta-a-ponta (E2EE)
- **Onde:** `mobile/services/voiceCallManager.ts:359-363`, `web/lib/call-context.tsx:249`
- **Uso:** `RTCPeerConnection` com `stun:stun.l.google.com:19302` para chamadas de voz/vídeo.
- **Propósito:** A mídia de **chamadas** é criptografada de ponta a ponta de forma nativa
  (SRTP com troca de chaves DTLS). **Aplicável apenas a chamadas — NÃO a mensagens de texto.**
- **Ressalva:** O *signaling* (SDP/ICE) trafega pelo WebSocket da aplicação (sem E2EE),
  embora o transporte WS possa ser TLS se o deploy usar HTTPS.

---

## 2. O que NÃO existe (evidências da ausência)

| Camada | Situação | Evidência |
|---|---|---|
| **Transmissão de mensagens (WS)** | Texto puro | `backend/src/ws.rs:29-36` (`broadcast` de string JSON). `mobile/services/ws.ts:10-17` conecta em `ws://` (não `wss://`). |
| **Transmissão de mensagens (HTTP)** | Texto puro | `mobile/services/api.ts:5-17` e `web/lib/api.ts:1` usam `http://localhost:3000` por padrão. |
| **Armazenamento servidor (Postgres)** | Texto puro | `backend/src/handlers/messages.rs:133-155` faz `INSERT ... content` sem cifra. Tabela `messages.content` e `attachments.remote_url` em plaintext. |
| **Armazenamento local (SQLite mobile)** | Texto puro | `mobile/services/database.ts:88-118` — `expo-sqlite` sem SQLCipher/cifra. |
| **Arquivos de mídia (uploads)** | Texto puro | `backend/src/handlers/upload.rs:108-115` grava bytes crus; servidos via `ServeDir` em `backend/src/routes.rs:78`. |
| **E2EE de mensagens** | Ausente | Nenhuma implementação de Signal Protocol, X3DH, Double Ratchet, prekeys, troca de chaves, AES/ChaCha ou cifra assimétrica para mensagens. |
| **TLS no servidor** | Ausente | `backend/src/main.rs:54-60` serve HTTP puro na porta 3000. Nenhum certificado/nginx/reverse-proxy TLS no repo. `docker-compose.yml` só sobe Postgres. |

---

## 3. Mapa da jornada de uma mensagem (sem criptografia)

```text
 Usuário A                        Servidor (plaintext)               Usuário B
    │  POST /chats/{id}/messages        │                                  │
    ├── content="oi" ──────────────────►│  INSERT messages (content)       │
    │                                   │  broadcast JSON (ws.rs)  ──────►│  exibe
    │                                   │  DB Postgres (plaintext)        │  SQLite local (plaintext)
```

---

## 4. Riscos decorrentes

1. **Confidencialidade:** Qualquer acesso ao banco (`messages.content`), aos arquivos em
   `uploads/`, ao tráfego de rede (sniffing em `http://`/`ws://`) ou ao SQLite do aparelho
   expõe o conteúdo integral das conversas.
2. **Ausência de E2EE:** O servidor "enxerga" e consegue ler todas as mensagens (confiança
   total no provedor).
3. **Push notifications:** `backend/src/handlers/messages.rs:324-380` envia o conteúdo da
   mensagem em texto puro no corpo do push (Expo) — visível na tela de notificação.

---

## 5. Recomendações (ordem de prioridade)

1. **Transporte TLS (crítico e barato):** servir o backend atrás de HTTPS/WSS (reverse proxy
   com certificado) e trocar as URLs padrão dos clientes para `https://`/`wss://`.
2. **E2EE de mensagens:** integrar o protocolo **Signal** (biblioteca `libsignal`/`@signalapp/libsignal-client`) com troca de chaves X3DH + Double Ratchet, cifrando `content` antes do envio e antes de gravar no SQLite local (ex.: SQLCipher).
3. **Cifra em repouso:** colunas `messages.content`/`attachments.remote_url` e arquivos em
   `uploads/` com criptografia simétrica (AES-256-GCM) gerenciada pelo servidor.
4. **Push:** remover o corpo do texto das notificações, enviando apenas metadados.
5. **Segredos:** trocar `JWT_SECRET=super-secret-key-change-in-production` (`backend/.env:2`)
   e a senha padrão do Postgres (`docker-compose.yml:7`) antes de qualquer deploy público.

---

## 6. Resumo executivo

- **Existe criptografia no projeto?** Sim, parcialmente (Argon2, JWT, SHA-256, DTLS-SRTP em chamadas).
- **As mensagens de texto são criptografadas?** **NÃO.**
- **Transmissão protegida (TLS)?** Não por padrão (usa `http://`/`ws://`).
- **Armazenamento protegido?** Não (Postgres, uploads e SQLite em texto puro).
