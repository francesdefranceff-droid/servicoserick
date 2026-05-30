import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Radio, X, Video, VideoOff, Mic, MicOff, ImagePlus, Heart, MessageCircle, Send, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import LiveIndicators from './LiveIndicators';

const STORAGE_KEY = 'svc:stories:v1';

// Mock de amigos conectados (stories de outras pessoas)
const FRIEND_STORIES = [
  { id: 'f1', userName: 'Ana', avatar: 'https://i.pravatar.cc/100?img=47', type: 'image', src: 'https://images.unsplash.com/photo-1503264116251-35a269479413?w=600' },
  { id: 'f2', userName: 'Bruno', avatar: 'https://i.pravatar.cc/100?img=12', type: 'image', src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600' },
  { id: 'f3', userName: 'Carla', avatar: 'https://i.pravatar.cc/100?img=32', type: 'image', src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600' },
  { id: 'f4', userName: 'Diego', avatar: 'https://i.pravatar.cc/100?img=15', type: 'image', src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600' },
];

function loadStories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    const now = Date.now();
    return list.filter((s) => now - s.createdAt < 24 * 60 * 60 * 1000);
  } catch {
    return [];
  }
}

function saveStories(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function ProfileStories({ avatarSrc, userName = 'Você' }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const liveVideoRef = useRef(null);
  const liveStreamRef = useRef(null);
  const [stories, setStories] = useState(loadStories);
  const [viewing, setViewing] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [reply, setReply] = useState('');
  const [live, setLive] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [viewers, setViewers] = useState(0);

  useEffect(() => saveStories(stories), [stories]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setViewers((v) => v + Math.floor(Math.random() * 3)), 2500);
    return () => clearInterval(t);
  }, [live]);

  useEffect(() => {
    if (live && liveVideoRef.current && liveStreamRef.current) {
      liveVideoRef.current.srcObject = liveStreamRef.current;
    }
  }, [live]);

  const onAddStory = () => fileRef.current?.click();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const baseMeta = {
        name: file.name,
        size: file.size,
        sizeLabel: formatBytes(file.size),
        type: file.type,
        lastModified: file.lastModified,
        lastModifiedISO: new Date(file.lastModified).toISOString(),
      };
      const finalize = (extra = {}) => {
        const meta = { ...baseMeta, ...extra };
        setStories((prev) => [
          {
            id: Date.now(),
            createdAt: Date.now(),
            userName,
            avatar: avatarSrc,
            type: file.type.startsWith('video') ? 'video' : 'image',
            src: reader.result,
            meta,
          },
          ...prev,
        ]);
      };
      if (file.type.startsWith('image')) {
        const img = new Image();
        img.onload = () => finalize({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => finalize();
        img.src = reader.result;
      } else {
        finalize();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const announceLive = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('live_streams').upsert({
        user_id: user.id,
        display_name: userName || user.email?.split('@')[0] || 'Usuário',
        avatar_url: avatarSrc || null,
        started_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Falha ao anunciar live:', e);
    }
  };

  const endLiveAnnouncement = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('live_streams').delete().eq('user_id', user.id);
    } catch (e) {
      console.warn('Falha ao encerrar live:', e);
    }
  };

  const startLive = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Faça login para transmitir ao vivo.');
        return;
      }
      // Registra a live para que outros vejam o selo "AO VIVO"
      await supabase.from('live_streams').upsert({
        user_id: user.id,
        display_name: userName || user.email?.split('@')[0] || 'Usuário',
        avatar_url: avatarSrc || null,
        started_at: new Date().toISOString(),
      });
      setLive(true);
      setViewers(1);
      // Abre a sala Jitsi como transmissor (mesma sala que os espectadores vão entrar)
      navigate(`/call/live-${user.id}?kind=video`);
    } catch (err) {
      alert('Não foi possível iniciar a live: ' + (err?.message || err));
    }
  };

  const stopLive = () => {
    liveStreamRef.current?.getTracks().forEach((t) => t.stop());
    liveStreamRef.current = null;
    setLive(false);
    setViewers(0);
    endLiveAnnouncement();
  };

  // Garante encerramento ao fechar a aba
  useEffect(() => {
    const handler = () => { if (live) endLiveAnnouncement(); };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      if (live) endLiveAnnouncement();
    };
  }, [live]);

  const toggleCam = () => {
    const track = liveStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };
  const toggleMic = () => {
    const track = liveStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };

  const closeViewer = () => { setViewing(null); setShowInfo(false); setReply(''); };

  const sendReply = () => {
    if (!reply.trim()) return;
    alert(`Resposta enviada para ${viewing?.userName || 'usuário'}: ${reply}`);
    setReply('');
  };

  return (
    <div className="relative py-2 overflow-visible">
      {/* Indicador global: quem está ao vivo agora (visível a todos) */}
      <LiveIndicators />

      <div className="mb-3 flex flex-wrap items-center gap-2 overflow-visible">
        <button
          type="button"
          onClick={onAddStory}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white shadow-sm hover:opacity-90"
        >
          <ImagePlus size={16} />
          Publicar story
        </button>
        <button
          type="button"
          onClick={live ? stopLive : startLive}
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold text-white shadow-sm hover:opacity-90 ${live ? 'bg-red-500' : 'bg-orange-500'}`}
        >
          <Radio size={16} />
          {live ? 'Encerrar ao vivo' : 'Iniciar ao vivo'}
        </button>
        {live && (
          <span className="inline-flex h-10 items-center rounded-full bg-red-50 px-3 text-xs font-semibold text-red-600">
            {viewers} espectadores
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 overflow-x-auto overflow-y-visible no-scrollbar pb-1">
        {/* Seu story */}
        <div className="relative flex-shrink-0">
          <button onClick={onAddStory} className="flex flex-col items-center gap-1" title="Publicar story">
            <div className={`relative w-16 h-16 rounded-full p-[2px] ${live ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'}`}>
              <div className="w-full h-full rounded-full bg-white p-[2px]">
                <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 text-xs">Eu</span>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-primary rounded-full border-2 border-white flex items-center justify-center shadow">
                <Plus size={14} className="text-white" />
              </div>
              {live && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded uppercase">
                  AO VIVO
                </span>
              )}
            </div>
            <span className="text-xs text-textPrimary">Seu story</span>
          </button>
        </div>

        {/* Stories do usuário */}
        {stories.map((s) => (
          <button key={s.id} onClick={() => setViewing(s)} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
              <div className="w-full h-full rounded-full bg-white p-[2px]">
                <div className="w-full h-full rounded-full overflow-hidden bg-gray-200">
                  {s.type === 'video' ? (
                    <video src={s.src} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={s.src} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs text-textPrimary">{s.userName || userName}</span>
          </button>
        ))}

        {/* Stories de amigos conectados */}
        {FRIEND_STORIES.map((s) => (
          <button key={s.id} onClick={() => setViewing(s)} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
              <div className="w-full h-full rounded-full bg-white p-[2px]">
                <div className="w-full h-full rounded-full overflow-hidden bg-gray-200">
                  <img src={s.avatar} alt={s.userName} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
            <span className="text-xs text-textPrimary truncate max-w-[64px]">{s.userName}</span>
          </button>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

      {/* Story viewer com botões de interação */}
      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 text-white">
            <div className="flex items-center gap-2">
              {viewing.avatar && (
                <img src={viewing.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/40" />
              )}
              <span className="text-sm font-semibold">{viewing.userName || 'Usuário'}</span>
            </div>
            <div className="flex items-center gap-2">
              {viewing.meta && (
                <button onClick={() => setShowInfo((v) => !v)} className="p-2 rounded-full bg-white/10" title="Informações da imagem">
                  <Info size={20} />
                </button>
              )}
              <button onClick={closeViewer} className="p-2 rounded-full bg-white/10">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Mídia em tela cheia */}
          <div className="flex-1 w-full flex items-center justify-center bg-black overflow-hidden">
            {viewing.type === 'video' ? (
              <video src={viewing.src} autoPlay controls className="w-full h-full object-contain" />
            ) : (
              <img src={viewing.src} alt="" className="w-full h-full object-contain" />
            )}
          </div>

          {/* Painel de informações da imagem */}
          {showInfo && viewing.meta && (
            <div className="mx-4 mb-2 rounded-xl bg-white/10 text-white text-xs p-3 space-y-1 backdrop-blur">
              <div className="font-semibold text-sm mb-1">Informações da imagem</div>
              <div><span className="opacity-70">Arquivo:</span> {viewing.meta.name}</div>
              <div><span className="opacity-70">Tipo:</span> {viewing.meta.type}</div>
              <div><span className="opacity-70">Tamanho:</span> {viewing.meta.sizeLabel}</div>
              {viewing.meta.width && (
                <div><span className="opacity-70">Dimensões:</span> {viewing.meta.width} × {viewing.meta.height}px</div>
              )}
              <div><span className="opacity-70">Modificado:</span> {new Date(viewing.meta.lastModified).toLocaleString('pt-BR')}</div>
            </div>
          )}

          {/* Barra de interação */}
          <div className="flex items-center gap-2 p-3 border-t border-white/10">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendReply()}
              placeholder={`Responder ${viewing.userName || ''}...`}
              className="flex-1 bg-white/10 text-white placeholder-white/50 rounded-full px-4 py-2 text-sm outline-none"
            />
            <button onClick={() => alert('Curtido!')} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center" title="Curtir">
              <Heart size={20} />
            </button>
            <button onClick={() => alert('Comentário enviado')} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center" title="Comentar">
              <MessageCircle size={20} />
            </button>
            <button onClick={sendReply} className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center" title="Enviar">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Live overlay */}
      {live && (
        <div className="fixed inset-0 z-[100] bg-black">
          {/* Vídeo em tela cheia (estilo TikTok) */}
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay topo */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 text-white bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-500 text-xs font-bold rounded uppercase animate-pulse">● AO VIVO</span>
              <span className="text-sm opacity-90">{viewers} espectadores</span>
            </div>
            <button onClick={stopLive} className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-full font-semibold">
              Encerrar
            </button>
          </div>
          {/* Overlay controles inferior */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-black/60 to-transparent">
            <button onClick={toggleMic} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center">
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            <button onClick={toggleCam} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center">
              {camOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
