import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Radio } from 'lucide-react';

/**
 * Mostra um carrossel com avatares + selo vermelho "AO VIVO" de
 * todos os usuários atualmente transmitindo. Atualiza em tempo real.
 */
export default function LiveIndicators({ onOpen }) {
  const [lives, setLives] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('live_streams')
        .select('user_id, display_name, avatar_url, started_at')
        .order('started_at', { ascending: false });
      if (!cancelled) setLives(data || []);
    };
    load();

    const channel = supabase
      .channel('live_streams_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  if (lives.length === 0) return null;

  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 mb-2">
      <div className="flex items-center gap-1 text-xs font-bold text-red-600 shrink-0">
        <Radio size={14} className="animate-pulse" /> AO VIVO
      </div>
      {lives.map((l) => (
        <button
          key={l.user_id}
          type="button"
          onClick={() => onOpen?.(l)}
          className="flex flex-col items-center gap-1 shrink-0"
          title={`${l.display_name} está ao vivo`}
        >
          <div className="relative w-14 h-14 rounded-full p-[2px] bg-red-500 animate-pulse">
            <div className="w-full h-full rounded-full bg-white p-[2px]">
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-200">
                {l.avatar_url ? (
                  <img src={l.avatar_url} alt={l.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-bold">
                    {l.display_name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
            </div>
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded uppercase shadow">
              AO VIVO
            </span>
          </div>
          <span className="text-[11px] text-textPrimary truncate max-w-[60px]">{l.display_name}</span>
        </button>
      ))}
    </div>
  );
}
