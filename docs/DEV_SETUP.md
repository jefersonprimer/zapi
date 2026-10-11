# Como rodar o projeto local (dev)

O projeto é um monorepo com 4 partes, cada uma subida em um terminal:

| Parte | Pasta | Stack | Porta (dev) |
|---|---|---|---|
| Banco | `docker-compose.yml` | PostgreSQL 16 | `5432` |
| Backend | `backend/` | Rust + Axum + SQLx | `3001` (HTTP + WS) |
| Web | `web/` | Next.js 16 + pnpm | `3000` |
| Mobile | `mobile/` | Expo 57 (React Native 0.86) | — (Metro `8081`) |
| *(opcional)* bg-remover | `services/bg-remover/` | Python | `5050` |

> **Portas:** o backend e o Next usam `3000` por default. Para não brigar, os exemplos de `.env` deste guia rodam o **backend em 3001** e o **web em 3000**.

---

## Pré-requisitos

- Docker (com o plugin `docker compose`)
- Rust (o `backend/rust-toolchain.toml` puxa o `stable`; mínimo 1.88)
- Node.js 20+ e [pnpm](https://pnpm.io) (o `web/` usa `pnpm-lock.yaml`)
- Para o mobile: Expo Go no celular **ou** Android Studio/Xcode para emulador

---

## 1. Banco de dados

```bash
docker compose up -d postgres
```

Credenciais do container: user `postgres`, senha `password`, db `primer_chat`, porta `5432`.
Os dados ficam no volume `pgdata` e sobrevivem a `docker compose down` (use `down -v` só para apagar tudo).

## 2. Backend (API + WebSocket)

```bash
cp backend/.env.example backend/.env   # ajuste se precisar
cd backend
cargo run                              # primeiro build baixa as deps (demora)
```

- As **migrations rodam sozinhas** no boot (`backend/src/main.rs`, `sqlx::migrate!("./migrations")`). Não precisa rodar nada à mão.
- Só quiser aplicar migrations sem subir a API:
  ```bash
  cargo run --bin migrate
  ```
- Saúde da API:
  ```bash
  curl http://localhost:3001/health
  ```

## 3. bg-remover *(opcional)*

Só é usado na remoção de fundo de stickers (`BG_REMOVER_URL` no `.env` do backend). Sem ele o resto funciona normalmente.

```bash
docker compose up -d bg-remover        # http://localhost:5050
```

## 4. Web

```bash
cp web/.env.local.example web/.env.local
cd web
pnpm install
pnpm dev                               # http://localhost:3000
```

## 5. Mobile

```bash
cp mobile/.env.example mobile/.env
cd mobile
npm install
npx expo start                         # Expo Go / QR code
```

- **Celular físico:** troque `localhost` pelo IP da sua máquina na mesma rede Wi‑Fi em `mobile/.env` (`http://192.168.x.x:3001`) e reinicie o Metro com `npx expo start --clear`.
- **Expo Go:** o projeto está em **SDK 57**. O Expo Go da loja só roda o SDK estável mais recente — se o app acusar "mismatch de SDK", atualize o Expo Go ou rode `npx expo start` com o aparelho conectado, que ele mesmo instala a versão certa. Desde set/2026 é obrigatório estar **logado na conta Expo** para rodar projetos no Expo Go.
- **Limitações do Expo Go** (funcionam apenas em development build): chamadas de voz/vídeo (`react-native-webrtc`) e push notification remoto no Android. A biblioteca de mídia também tem acesso parcial no Expo Go por restrição de permissões do Android.
- **Depois de subir de SDK**, regenere a pasta nativa `mobile/android/` (gerada pelo prebuild e não versionada) antes de buildar:
  ```bash
  npx expo prebuild -p android     # no SDK 57 o prebuild limpa e regenera por padrão
  ```
- **`react-native-webrtc` (chamadas de voz/vídeo) não roda no Expo Go** — para testar chamadas use um development client:
  ```bash
  npm run start:dev-client
  npm run android            # build nativo local (requer Android Studio)
  # ou gerar o .apk: eas build --profile development --platform android
  ```

---

## Ordem de subida

```bash
docker compose up -d postgres   # 1. banco
cd backend && cargo run         # 2. API (porta 3001)
cd web && pnpm dev              # 3. web  (porta 3000)
cd mobile && npx expo start     # 4. app
```

Resumo das variáveis de ambiente (os `.env` **não são versionados** — sempre copie dos `.env.example`):

| Arquivo | Variáveis |
|---|---|
| `backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `BG_REMOVER_URL`, `PORT` |
| `web/.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GIPHY_API_KEY` |
| `mobile/.env` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`, `EXPO_PUBLIC_GIPHY_API_KEY` |

> Os `.env.example` de `web/` e `mobile/` já apontam para `localhost:3001` (backend local). Se preferir testar contra a API de produção, use `https://zapi-production-94ee.up.railway.app`.

---

## Problemas comuns

- **`port 3000 is already in use`** no Next ou no backend → alguma das duas está na 3000. Suba o backend com `PORT=3001 cargo run` (ou mude o `-p` do `pnpm dev`).
- **`failed to connect to database`** → o container não está no ar (`docker compose ps`) ou `DATABASE_URL` errado no `backend/.env`.
- **Migrations falham no boot** → banco novo vazio é o esperado; se bagunçou, `docker compose down -v && docker compose up -d postgres` e suba o backend de novo.
- **App não conecta no celular físico** → `localhost` no celular aponta para o próprio aparelho. Use o IP da máquina na LAN e libere a porta no firewall.
- **Chamadas de áudio/vídeo não iniciam no Expo Go** → esperado; use o development client (seção 5).
