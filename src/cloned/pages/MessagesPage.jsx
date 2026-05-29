import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../ClonedAuthContext';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Search, Send, Star, ArrowLeft, Home as HomeIcon, Users, Plus, BarChart3, MessageCircle, Settings, Video, Phone, Share2, Pin, Archive, Flag, Ban, Paperclip, Camera, Calendar, CreditCard, MoreHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchChatConversations, fetchChatMessages, fetchChatUser, sendChatMessage } from '../lib/chatService';
import { getStableDefaultAvatarUrl } from '../lib/authProfile';

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatDaySeparator = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const initialUserId = searchParams.get('userId');

  const [conversations, setConversations] = useState([]);
  const [filter, setFilter] = useState('all'); // all | unread | archived
  const [search, setSearch] = useState('');
  const [activeUserId, setActiveUserId] = useState(initialUserId || null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (activeUserId) {
      fetchMessages(activeUserId);
      fetchActiveUser(activeUserId);
      const interval = setInterval(() => fetchMessages(activeUserId), 3000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [activeUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const data = await fetchChatConversations(user?.id);
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch conversations', e);
    }
  };

  const fetchActiveUser = async (uid) => {
    try {
      setActiveUser(await fetchChatUser(uid));
    } catch (e) {
      console.error('Failed to fetch user', e);
    }
  };

  const fetchMessages = async (uid) => {
    try {
      const data = await fetchChatMessages(uid, user?.id);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeUserId) return;
    setSending(true);
    try {
      const sent = await sendChatMessage(activeUserId, input.trim(), user?.id);
      setInput('');
      setMessages((prev) => [...prev, sent]);
      fetchMessages(activeUserId);
      fetchConversations();
    } catch (e) {
      console.error('Failed to send message', e);
      toast.error('Erro de conexão');
    } finally {
      setSending(false);
    }
  };

  const filtered = conversations.filter((c) => {
    const name = c.user?.name?.toLowerCase() || '';
    const query = search.toLowerCase();
    if (query && !name.includes(query)) return false;
    return true;
  });

  const userAvatar = user?.avatar_url || user?.avatar || getStableDefaultAvatarUrl(user);
  const activeAvatar = activeUser?.avatar_url || activeUser?.avatar || getStableDefaultAvatarUrl(activeUser || { id: activeUserId });

  return (
    <div
      className="min-h-screen bg-white pb-20 lg:pb-0"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
      data-testid="messages-page"
    >
      {/* Top Navigation - same Jataí style */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <button className="lg:hidden" onClick={() => navigate('/profile')} data-testid="mobile-avatar">
              <Avatar className="w-8 h-8">
                <AvatarImage src={userAvatar} />
                <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-base font-bold">
                <span className="text-green-500">Wati</span>
                <span className="text-orange-500">zat</span>
              </span>
              <p className="hidden lg:block text-[10px] text-gray-500 ml-2">Paris (France)</p>
            </div>

            <nav className="hidden lg:flex items-center space-x-8 absolute left-1/2 -translate-x-1/2">
              <button onClick={() => navigate('/home')} className="flex flex-col items-center text-gray-700">
                <HomeIcon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Início</span>
              </button>
              <button onClick={() => navigate('/volunteers')} className="flex flex-col items-center text-gray-700">
                <Users className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Voluntários</span>
              </button>
              <button onClick={() => navigate('/home')} className="flex flex-col items-center text-green-600 -mt-1">
                <div className="w-11 h-11 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                  <Plus className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] mt-1">Publicar</span>
              </button>
              <button onClick={() => navigate('/housing')} className="flex flex-col items-center text-gray-700">
                <BarChart3 className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Moradia</span>
              </button>
              <button onClick={() => navigate('/chat')} className="flex flex-col items-center text-gray-900 font-semibold">
                <MessageCircle className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">Mensagens</span>
              </button>
            </nav>

            <button onClick={() => navigate('/profile')} className="hidden lg:flex items-center space-x-2 hover:bg-gray-50 px-3 py-1 rounded-lg" data-testid="desktop-avatar">
              <Avatar className="w-8 h-8">
                <AvatarImage src={userAvatar} />
                <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{user?.name || 'Usuário'}</span>
            </button>

            <div className="lg:hidden w-8" />
          </div>
        </div>
      </header>

      {/* Premium banner */}
      <div className="bg-orange-50 border-b border-orange-100">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center justify-center gap-3 flex-wrap">
          <span className="text-sm text-gray-800">Acesse novamente ferramentas e serviços exclusivos:</span>
          <button
            onClick={() => navigate('/assinatura')}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-1.5 rounded-md"
            data-testid="premium-cta"
          >
            Assine Premier
          </button>
        </div>
      </div>

      {/* Main 2-column messages layout */}
      <div className="flex h-[calc(100dvh-89px)] max-w-[1400px] mx-auto">

        {/* Left: Conversation list */}
        <aside
          className={`${activeUserId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[380px] border-r border-gray-200 bg-gradient-to-b from-white to-gray-50`}
          data-testid="conversations-list"
        >
          {/* Tabs prominentes no topo */}
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'unread', label: 'Não lidas' },
              { id: 'archived', label: 'Arquivadas' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filter === t.id
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-400'
                }`}
                data-testid={`filter-${t.id}`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => navigate('/volunteers')}
              className="ml-auto w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all hover:scale-105"
              data-testid="messages-edit-btn"
              title="Nova conversa"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar conversas..."
                className="pl-10 h-10 bg-white border border-gray-200 rounded-xl shadow-sm focus-visible:ring-2 focus-visible:ring-green-500/20"
                data-testid="messages-search"
              />
            </div>
          </div>
                {t.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    filter === t.id ? 'bg-white/20' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Nenhuma conversa ainda</p>
                <p className="text-xs text-gray-500">Inicie um papo pelo feed ou voluntários.</p>
              </div>
            ) : (
              filtered.map((c) => {
                const u = c.user || {};
                const isActive = activeUserId === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => navigate(`/direct-chat/${u.id}`)}
                    className={`w-full px-3 py-3 mb-1 rounded-2xl flex items-start gap-3 transition-all text-left group ${
                      isActive
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm ring-1 ring-green-200'
                        : 'hover:bg-white hover:shadow-sm'
                    }`}
                    data-testid={`conv-item-${u.id}`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className={`w-12 h-12 ring-2 transition-all ${isActive ? 'ring-green-400' : 'ring-white'}`}>
                        <AvatarImage src={u.avatar || `https://i.pravatar.cc/150?u=${u.id}`} />
                        <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                          {u.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`font-semibold text-sm truncate ${isActive ? 'text-green-900' : 'text-gray-900'}`}>
                          {u.name || 'Usuário'}
                        </p>
                        <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0 font-medium">
                          {formatDate(c.last_message_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-semibold text-gray-700">5.0</span>
                        </div>
                        {u.professional_area && (
                          <span className="px-1.5 py-0.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-md text-[10px] font-medium truncate">
                            {u.professional_area}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${c.unread ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                          {c.last_message || 'Sem mensagens'}
                        </p>
                        {c.unread && (
                          <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                            {c.unread_count || ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>


        {/* Center: Conversation messages */}
        <section
          className={`${activeUserId ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-gray-50 min-w-0`}
          data-testid="conversation-area"
        >
          {!activeUserId ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Selecione uma conversa
            </div>
          ) : (
            <>
              {/* Conversation header (mobile back) */}
              <div className="lg:hidden bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-3 sticky top-[49px] z-10">
                <button onClick={() => setActiveUserId(null)} data-testid="conv-back-btn">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar className="w-9 h-9">
                  <AvatarImage src={activeAvatar} />
                  <AvatarFallback>{activeUser?.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{activeUser?.name || 'Usuário'}</p>
                  <p className="text-[10px] text-green-600">Online agora</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-green-50/40 to-white">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm mt-8">Nenhuma mensagem ainda. Diga olá!</p>
                ) : (
                  messages.map((m, idx) => {
                    const fromMe = m.is_from_me || m.from_user_id === user?.id;
                    const prev = messages[idx - 1];
                    const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                    return (
                      <React.Fragment key={m.id || idx}>
                        {showDay && (
                          <div className="flex justify-center my-4">
                            <span className="text-xs text-gray-500 font-medium px-3 py-1 bg-white/80 rounded-full border border-gray-100">
                              {formatDaySeparator(m.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                              fromMe
                                ? 'bg-green-500 text-white rounded-tr-md'
                                : 'bg-white border border-gray-200 text-gray-900 rounded-tl-md'
                            }`}
                            data-testid={`msg-${idx}`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.message}</p>
                            <p className={`text-[10px] mt-1 ${fromMe ? 'text-white/80' : 'text-gray-500'}`}>
                              {formatTime(m.created_at)}
                            </p>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick actions bar */}
              <div className="bg-white border-t border-gray-200 px-4 pt-3 pb-1">
                <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
                  {[
                    { icon: X, label: 'Recusar', color: 'text-gray-600', bg: 'bg-gray-100' },
                    { icon: Calendar, label: 'Agendar', color: 'text-green-600', bg: 'bg-green-50' },
                    { icon: CreditCard, label: 'Pagamento', color: 'text-orange-600', bg: 'bg-orange-50' },
                    { icon: Star, label: 'Avaliação', color: 'text-amber-600', bg: 'bg-amber-50' },
                    { icon: MoreHorizontal, label: 'Ver tudo', color: 'text-gray-700', bg: 'bg-gray-100' },
                  ].map((a) => (
                    <button
                      key={a.label}
                      onClick={() => toast.info(`${a.label} em breve`)}
                      className="flex flex-col items-center gap-1 group"
                      data-testid={`action-${a.label.toLowerCase()}`}
                    >
                      <span className={`w-10 h-10 rounded-xl ${a.bg} ${a.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                        <a.icon className="w-5 h-5" />
                      </span>
                      <span className="text-[10px] text-gray-600">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="bg-white border-t border-gray-100 p-3">
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500" title="Anexar">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500" title="Foto">
                    <Camera className="w-5 h-5" />
                  </button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Sua mensagem..."
                    className="flex-1 bg-gray-100 border-0 rounded-full h-10 px-4"
                    data-testid="message-input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                    className="w-10 h-10 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 rounded-full flex items-center justify-center text-white transition-colors"
                    data-testid="send-message-btn"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right: Profile panel (desktop only) */}
        {activeUser && (
          <aside className="hidden xl:flex flex-col w-[300px] border-l border-gray-200 bg-white" data-testid="profile-panel">
            <div className="flex flex-col items-center p-6 border-b border-gray-100">
              <Avatar className="w-20 h-20 mb-3 ring-4 ring-green-50">
                <AvatarImage src={activeAvatar} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">{activeUser?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <h3 className="text-base font-bold text-gray-900">{activeUser?.name}</h3>
              <div className="flex items-center gap-1 text-xs mt-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-gray-800">5/5</span>
                <span className="text-gray-500">(2 avis)</span>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => toast.info('Chamada de vídeo em breve')}
                  className="w-11 h-11 rounded-full border border-gray-200 hover:bg-green-50 hover:border-green-200 flex items-center justify-center text-green-600 transition-colors"
                  title="Vídeo"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  onClick={() => toast.info('Ligação em breve')}
                  className="w-11 h-11 rounded-full border border-gray-200 hover:bg-green-50 hover:border-green-200 flex items-center justify-center text-green-600 transition-colors"
                  title="Telefone"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate(`/profile/${activeUser.id}`)}
                  className="px-4 h-11 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-900 hover:text-white text-sm font-semibold transition-colors"
                  data-testid="view-full-profile"
                >
                  Ver perfil
                </button>
              </div>
            </div>

            <div className="p-4 space-y-1 text-sm">
              <button
                onClick={() => {
                  if (navigator.share) navigator.share({ title: activeUser?.name, url: window.location.href }).catch(() => {});
                  else { navigator.clipboard?.writeText(window.location.href); toast.success('Link copiado'); }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-800"
              >
                <Share2 className="w-4 h-4 text-gray-500" /> Compartilhar perfil
              </button>
              <button
                onClick={() => toast.success('Conversa fixada')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-800"
              >
                <Pin className="w-4 h-4 text-gray-500" /> Fixar conversa
              </button>
              <button
                onClick={() => toast.success('Conversa arquivada')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-800"
              >
                <Archive className="w-4 h-4 text-gray-500" /> Arquivar conversa
              </button>
              <div className="border-t border-gray-100 my-2" />
              <button
                onClick={() => toast.warning('Perfil reportado')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600"
              >
                <Flag className="w-4 h-4" /> Reportar perfil
              </button>
              <button
                onClick={() => toast.warning('Usuário bloqueado')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600"
              >
                <Ban className="w-4 h-4" /> Bloquear
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile Bottom Nav (same as FeedPage) */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 flex items-center justify-around z-50 lg:hidden"
        data-testid="bottom-navigation"
      >
        <button onClick={() => navigate('/home')} className="flex flex-col items-center gap-1 p-2 min-w-[60px]" data-testid="nav-home">
          <HomeIcon className="w-6 h-6 text-gray-400" />
          <span className="text-[10px] text-gray-500">Início</span>
        </button>
        <button onClick={() => navigate('/volunteers')} className="flex flex-col items-center gap-1 p-2 min-w-[60px]" data-testid="nav-volunteers">
          <Users className="w-6 h-6 text-gray-400" />
          <span className="text-[10px] text-gray-500">Voluntários</span>
        </button>
        <button onClick={() => navigate('/home')} className="flex flex-col items-center gap-1 p-2 min-w-[60px] relative" data-testid="nav-publish-center">
          <div className="w-12 h-12 -mt-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] text-green-600 font-semibold mt-1">Publicar</span>
        </button>
        {user?.role === 'admin' ? (
          <button onClick={() => navigate('/admin')} className="flex flex-col items-center gap-1 p-2 min-w-[60px]" data-testid="nav-admin">
            <Settings className="w-6 h-6 text-gray-400" />
            <span className="text-[10px] text-gray-500">Admin</span>
          </button>
        ) : (
          <button onClick={() => navigate('/housing')} className="flex flex-col items-center gap-1 p-2 min-w-[60px]" data-testid="nav-housing">
            <BarChart3 className="w-6 h-6 text-gray-400" />
            <span className="text-[10px] text-gray-500">Moradia</span>
          </button>
        )}
        <button className="flex flex-col items-center gap-1 p-2 min-w-[60px]" data-testid="nav-chat">
          <MessageCircle className="w-6 h-6 text-gray-900" strokeWidth={2.5} />
          <span className="text-[10px] text-gray-900 font-semibold">Mensagens</span>
        </button>
      </div>
    </div>
  );
}
