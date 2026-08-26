# Sistema de Agendamento White-Label por Nicho (Scheduling System)

Esta documentação descreve a arquitetura, o modelo de dados e o funcionamento do sistema de agendamento white-label implementado para comércios baseados em serviços (como barbearias, salões de beleza, clínicas de estética, estúdios de tatuagem, oficinas mecânicas, personal trainers, fotógrafos, etc.).

---

## 1. Visão Geral

Para estabelecimentos que não vendem produtos físicos (com fluxo tradicional de carrinho e entrega), o Zapi agora disponibiliza um **fluxo de agendamento online**. 

* **Dono do Estabelecimento (ERP Web):** Gerencia seu portfólio de serviços, cadastra profissionais da equipe, vincula quais serviços cada um realiza e acompanha/atualiza o status de atendimentos em um calendário de agenda diário.
* **Cliente (Web):** Acessa a página do estabelecimento, visualiza a galeria de trabalhos realizados (portfólio) e realiza o agendamento através de um assistente de 4 passos (Serviço $\rightarrow$ Profissional $\rightarrow$ Data/Horário $\rightarrow$ Identificação).
* **Notificações Integradas:** O sistema envia mensagens de texto automáticas no chat entre a loja e o cliente informando o status do agendamento (Pendente, Confirmado, Cancelado, Concluído).

---

## 2. Modelagem do Banco de Dados (PostgreSQL)

Arquivo de migração: `backend/migrations/083_add_scheduling_system.sql`

```sql
-- 1. Serviços prestados pelo comércio
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    duration_minutes INT NOT NULL DEFAULT 30,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Profissionais cadastrados na equipe
CREATE TABLE professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Relação muitos-para-muitos (Serviços executados por cada Profissional)
CREATE TABLE professional_services (
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, service_id)
);

-- 4. Agendamentos
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled', 'completed'
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Backend (Rust / Axum)

Os endpoints de agendamento estão concentrados no roteador `handlers::scheduling::router()` mapeado sob a rota base `/api/scheduling`.

### Endpoints Disponibilizados

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/scheduling/stores/:store_id/services` | Listar serviços ativos do comércio |
| `POST` | `/scheduling/services` | Cadastrar novo serviço (Requer ser dono) |
| `PUT` | `/scheduling/services/:id` | Editar dados de um serviço (Requer ser dono) |
| `DELETE` | `/scheduling/services/:id` | Excluir um serviço (Requer ser dono) |
| `GET` | `/scheduling/stores/:store_id/professionals` | Listar profissionais da equipe |
| `POST` | `/scheduling/professionals` | Cadastrar novo profissional (Requer ser dono) |
| `PUT` | `/scheduling/professionals/:id` | Editar dados de um profissional (Requer ser dono) |
| `DELETE` | `/scheduling/professionals/:id` | Remover profissional da equipe (Requer ser dono) |
| `GET` | `/scheduling/stores/:store_id/available-slots` | Calcular horários livres dinamicamente |
| `POST` | `/scheduling/appointments` | Criar solicitação de agendamento |
| `GET` | `/scheduling/appointments` | Listar agendamentos do cliente logado |
| `POST` | `/scheduling/appointments/:id/cancel` | Cancelar um agendamento |
| `GET` | `/scheduling/vendor/appointments` | Listar agendamentos do dia no painel do lojista |
| `PATCH` | `/scheduling/appointments/:id/status` | Confirmar ou concluir agendamento (Dono) |

### Lógica de Cálculo de Slots Livres
O backend gera intervalos de tempo a cada 30 minutos a partir do horário de abertura (`open_time`) até o horário de fechamento (`close_time`) da loja. Para cada slot gerado, ele valida se o profissional escolhido possui conflito com outro agendamento ativo no mesmo período (`status != 'cancelled'`), retornando se o slot está `available: true` ou `false`.

---

## 4. Frontend Web (Next.js)

### Estrutura de Páginas do ERP
Ao detectar uma categoria de serviços (`barbeiro`, `salao`, `estetica`, etc.), o painel de administração altera os menus de navegação automaticamente:
* **/servicos (`app/(dashboard)/servicos/page.tsx`):** Gerenciamento de serviços (nome, descrição, preço, duração e foto).
* **/profissionais (`app/(dashboard)/profissionais/page.tsx`):** Gerenciamento da equipe de atendimento e atribuição de serviços.
* **/agenda (`app/(dashboard)/agenda/page.tsx`):** Mural/calendário com os compromissos diários, com botões rápidos para Confirmar, Recusar ou Finalizar atendimentos.

### Experiência do Cliente
A página pública da loja `/delivery/[city]/[storeSlug]` renderiza de forma condicional um wizard guiado de agendamento no lugar da grade de produtos tradicional quando o estabelecimento pertence a uma categoria de serviço.
