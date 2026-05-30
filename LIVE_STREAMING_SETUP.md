## 🎬 Guia de Configuração - Live Streaming

### Visão Geral

Este guia explica como usar o sistema de transmissão ao vivo (Live Streaming) implementado no projeto.

**Tecnologia:** WebRTC + Socket.io (100% gratuito e de código aberto)

---

## 📋 Pré-requisitos

- Node.js v16+
- npm ou yarn
- Câmera e microfone funcionando
- Navegador moderno com suporte a WebRTC (Chrome, Firefox, Safari, Edge)

---

## 🚀 Instalação e Configuração

### 1. Instalar Dependências do Frontend

```bash
cd servicoserick
npm install
```

### 2. Instalar Dependências do Servidor de Streaming

```bash
cd server
npm install
```

### 3. Configurar Variáveis de Ambiente

Na raiz do projeto, crie um arquivo `.env` baseado em `.env.example`:

```bash
cp .env.example .env
```

Configure:

```env
# Para desenvolvimento local
VITE_SOCKET_SERVER=http://localhost:3001
PORT=3001
CLIENT_URL=http://localhost:5173
```

### 4. Iniciar o Servidor de Streaming

**Em um terminal novo:**

```bash
cd server
npm run dev
```

Você verá:
```
🎬 Servidor de streaming rodando em http://localhost:3001
```

### 5. Iniciar o Frontend

**Em outro terminal:**

```bash
npm run dev
```

---

## 📱 Como Usar

### Para o Broadcaster (Transmissor)

1. Acesse a página do evento que deseja transmitir
2. Clique em "Iniciar Transmissão"
3. Autorize o acesso à câmera e microfone
4. Compartilhe o link do evento com os espectadores
5. Para encerrar, clique em "Encerrar Transmissão"

### Para o Viewer (Espectador)

1. Acesse o link do evento
2. Clique em "Assistir Transmissão"
3. Se houver uma transmissão ativa, você verá o vídeo
4. Para sair, clique em "Sair da Transmissão"

---

## 🔧 Integração com a Página de Evento

### Exemplo: Adicionar Live Streaming a uma Página de Evento

```tsx
import { LiveStreamBroadcaster } from '@/components/LiveStreamBroadcaster';
import { LiveStreamViewer } from '@/components/LiveStreamViewer';
import { useAuth } from '@/contexts/AuthContext';

export function EventDetail({ eventId, eventTitle, broadcasterUserId }) {
  const { user } = useAuth();
  
  // Se o usuário é o criador do evento, mostrar broadcaster
  if (user?.id === broadcasterUserId) {
    return <LiveStreamBroadcaster eventId={eventId} eventTitle={eventTitle} />;
  }
  
  // Caso contrário, mostrar viewer
  return <LiveStreamViewer eventId={eventId} eventTitle={eventTitle} />;
}
```

---

## 🎯 Componentes Disponíveis

### `LiveStreamBroadcaster`

Componente para quem está transmitindo.

**Props:**
- `eventId` (string): ID único do evento
- `eventTitle` (string): Título do evento

**Recursos:**
- Iniciar/Parar transmissão
- Visualizar câmera em tempo real
- Ver lista de espectadores conectados
- Status em tempo real

### `LiveStreamViewer`

Componente para quem quer assistir a transmissão.

**Props:**
- `eventId` (string): ID único do evento
- `eventTitle` (string): Título do evento

**Recursos:**
- Entrar/Sair de transmissões
- Visualizar transmissão ao vivo
- Status da conexão
- Indicador AO VIVO

---

## 📡 Hook: `useLiveStream`

Hook customizado para gerenciar transmissões.

```tsx
import { useLiveStream } from '@/hooks/useLiveStream';

const {
  isStreaming,        // boolean - está transmitindo?
  isBroadcaster,      // boolean - sou o broadcaster?
  viewers,            // array - lista de espectadores
  error,              // string | null - erro se houver
  localStream,        // MediaStream | null - seu stream
  startBroadcast,     // () => Promise<void> - iniciar
  stopBroadcast,      // () => void - parar
  joinStream,         // (eventId) => Promise<void> - entrar
  leaveStream,        // () => void - sair
} = useLiveStream(eventId, userId, userName);
```

---

## 🌐 Arquitetura

```
┌─────────────────┐              ┌──────────────────┐
│   Broadcaster   │◄────────────►│  Socket.io Server│
│   (Transmissor) │   WebSocket  │   (Port 3001)    │
└─────────────────┘              └──────────────────┘
                                        ▲
                                        │
                                   WebSocket
                                        │
                      ┌─────────────────┴─────────────────┐
                      ▼                                   ▼
               ┌─────────────┐                     ┌─────────────┐
               │  Viewer 1   │                     │  Viewer 2   │
               │ (Espectador)│                     │ (Espectador)│
               └─────────────┘                     └─────────────┘

            Conexões WebRTC P2P (Peer-to-Peer)
               ◄──────────────────────────────────────►
```

---

## 🔒 Segurança

- ✅ STUN Servers do Google para NAT traversal
- ✅ Conexões criptografadas via WebRTC
- ✅ Validação de usuários via Supabase Auth
- ✅ CORS configurado

Para produção, considere:
- [ ] Adicionar TURN servers privados
- [ ] Implementar autorização por token
- [ ] Rate limiting no socket server
- [ ] Monitoramento de conexões

---

## 🐛 Troubleshooting

### "Permissão de câmera negada"

- Verifique as configurações de câmera do navegador
- Certifique-se de usar HTTPS em produção (WebRTC requer HTTPS)

### "Não consigo conectar ao servidor"

- Verifique se o servidor está rodando: `http://localhost:3001/health`
- Verifique a variável `VITE_SOCKET_SERVER` em `.env`

### "Vídeo travando ou com atraso"

- Reduz a qualidade de vídeo no `useLiveStream.ts`
- Verifica a velocidade da internet (recomenda 2.5+ Mbps para upload)
- Testa com conexão de fio (ethernet)

---

## 📊 Monitoramento

### Health Check do Servidor

```bash
curl http://localhost:3001/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "activeStreams": 1,
  "connectedUsers": 5
}
```

### Lista de Transmissões Ativas

```bash
curl http://localhost:3001/api/active-streams
```

---

## 🚀 Deployment

### Opção 1: Deploy da App no Vercel / Netlify (Frontend)

```bash
npm run build
# Depois deploy a pasta 'dist' para Vercel/Netlify
```

### Opção 2: Deploy do Servidor no Railway / Heroku

```bash
# Railway
railway link
railway deploy

# Ou Heroku
heroku login
heroku create seu-app-streaming
git push heroku main
```

### Variáveis de Ambiente em Produção

```env
CLIENT_URL=https://seu-dominio.com
PORT=3001
```

---

## 📚 Recursos Adicionais

- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.io Documentation](https://socket.io/docs/)
- [Simple Peer](https://github.com/feross/simple-peer)

---

## ✨ Próximas Features

- [ ] Gravação de transmissões
- [ ] Chat em tempo real durante transmissão
- [ ] Filtros de vídeo
- [ ] Screen sharing
- [ ] Estatísticas de transmissão
- [ ] Moderação de comentários
