# Z-API - Próximas Features e Inovações (Backlog)

Este documento centraliza as ideias de novas funcionalidades para o nosso ecossistema **Z-API** (super-app contendo Chat, Rede Social, Comunidades, Agendamento e Marketplace de Delivery).

---

## 🚀 Lista de Features Propostas

### 1. Carrinho Coletivo e Pedidos Compartilhados (Group Cart)
* **O que é:** Permitir que membros de um grupo de chat ou comunidade criem um pedido único em um restaurante/loja do marketplace. Cada um adiciona seus itens de seu próprio aparelho, o frete é dividido proporcionalmente e o pagamento pode ser rachado diretamente via PIX.
* **Visão de UX/Design:** Um card dinâmico no chat mostra quem já adicionou itens ao carrinho, o valor parcial de cada um e um botão "Finalizar Pedido" para o criador.

### 2. [Live Commerce / Compras em Transmissões ao Vivo](docs/live-commerce.md)
* **O que é:** Integrar o sistema de Stories/Clipes com o Marketplace. Lojistas ou influenciadores da plataforma podem iniciar uma transmissão de vídeo ao vivo (Live Stream) mostrando produtos, e os usuários podem comprar com 1 clique diretamente na tela da live.
* **Visão de UX/Design:** Tela cheia de vídeo vertical com chat integrado no canto inferior esquerdo e um carrossel discreto e interativo de "Produtos em Destaque" no canto inferior direito, permitindo abrir o checkout sem pausar o vídeo.
* **Planejamento Técnico:** Consulte o detalhamento completo em [`docs/live-commerce.md`](file:///home/primer/Documents/zapi/docs/live-commerce.md).

### 3. Carteira Digital Integrada com Cashback e Envio P2P
* **O que é:** Criar uma carteira interna (`Digital Wallet`) onde o usuário pode manter saldo (carregado via PIX) e transferir instantaneamente para contatos no chat de forma privada (P2P), além de acumular cashback vindo de compras no marketplace.
* **Visão de UX/Design:** Opção "Enviar Dinheiro" integrada na barra de anexos da conversa do chat. Extrato financeiro simplificado e seguro com animações de confirmação.

### 4. Assistente de IA para Lojistas e Clientes (AI Shop Assistant)
* **O que é:** 
  * *Para Lojistas:* Chatbot automático que responde a perguntas frequentes de clientes fora do expediente, facilitando pedidos e informando disponibilidade de estoque.
  * *Para Clientes:* IA de recomendação integrada ao app para sugerir produtos, pratos e serviços próximos.
* **Visão de UX/Design:** Indicador visual de "IA Ativa" nos chats, mantendo a transparência, com respostas rápidas em formato de cards clicáveis.

### 5. Compras Coletivas e Descontos Sociais (Social Buying)
* **O que é:** Compra conjunta inspirada no modelo do Pinduoduo. Caso o usuário convide mais 2 amigos para comprar o mesmo produto em um intervalo de tempo determinado, todos ganham um desconto expressivo.
* **Visão de UX/Design:** Contagem regressiva na página do produto com fotos dos amigos que entraram na oferta conjunta e botão rápido para compartilhar em conversas.

### 6. Gamificação e Programa de Fidelidade Unificado
* **O que é:** Sistema de conquistas, níveis e pontuação baseado na atividade do usuário. Ações simples geram pontos que podem ser trocados por cupons de frete grátis e vantagens no app.
* **Visão de UX/Design:** Tela "Minhas Conquistas" com visual limpo, insígnias (badges) ilustradas em 3D e barras de progresso animadas.

### 7. Agendamento Inteligente com Depósito de Garantia (PIX Escrow)
* **O que é:** Melhoria do sistema de agendamento que possibilita cobrar uma taxa de reserva (sinal) via PIX. Reduz os casos de faltas sem aviso prévio (*No-Show*).
* **Visão de UX/Design:** Calendário integrado intuitivo com regras de cancelamento e estorno automatizado em caso de imprevisto por parte do profissional.

### 8. Feed de Comunidade Baseado em Localização (Hyperlocal Feed)
* **O que é:** Uma aba do feed social que reúne publicações, fotos, achados/perdidos e ofertas de lojas em um raio de até 5km a partir do GPS do usuário.
* **Visão de UX/Design:** Um mapa interativo discreto na parte superior que serve de filtro dinâmico de raio de proximidade.

### 9. Provador Virtual e Busca Visual com Câmera (Visual Search & AR)
* **O que é:** Uso da câmera do dispositivo para buscar produtos semelhantes no catálogo. Utilização da inteligência de remoção de fundo (`bg-remover`) para permitir montagem e simulação de roupas em fotos do usuário.
* **Visão de UX/Design:** Modo câmera limpo com guia inteligente e retorno rápido de correspondências do catálogo em uma gaveta inferior (bottom sheet).

### 10. Central de Segurança e Modo Privado Avançado
* **O que é:** Pasta segura protegida por biometria dentro do chat, bloqueio de printscreens de mídias temporárias e opção de mensagens com expiração agendada.
* **Visão de UX/Design:** Interface discreta e limpa, utilizando criptografia visual e autenticação local instantânea do dispositivo.
