import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';

/**
 * Botão flutuante "Publicar" exibido em todas as páginas
 * (exceto a própria home que já tem o botão na navegação).
 * Navega para /home?action=publish, que abre o modal de publicação no FeedPage.
 */
export default function PublishFab({ className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Não mostrar na home/feed (já tem botão na nav central)
  if (location.pathname === '/home' || location.pathname === '/') return null;

  return (
    <button
      onClick={() => navigate('/home?action=publish')}
      className={`fixed right-4 bottom-24 lg:bottom-8 z-40 group ${className}`}
      data-testid="global-publish-fab"
      title="Publicar"
      aria-label="Publicar"
    >
      <span className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white pl-3 pr-4 py-3 rounded-full shadow-2xl shadow-green-500/40 hover:scale-105 transition-all">
        <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
          <Plus className="w-5 h-5" strokeWidth={2.8} />
        </span>
        <span className="text-sm font-bold">Publicar</span>
      </span>
    </button>
  );
}
