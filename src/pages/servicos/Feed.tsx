import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Home, Users, Plus, MessageCircle, User } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function ServicosFeed() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/servicos/auth', { replace: true });
      } else {
        setEmail(session.user.email ?? null);
      }
    });
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/servicos', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <SEOHead title="Início — Watizat" description="Feed de demandas e ofertas." />

      {/* Header verde */}
      <header className="bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold">Jataí Região Trabalho</h1>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a className="hover:underline cursor-pointer">Acolhida</a>
            <a className="hover:underline cursor-pointer">Ofertantes</a>
            <a className="hover:underline cursor-pointer font-semibold">Demanda +</a>
            <a className="hover:underline cursor-pointer">Assinatura</a>
            <a className="hover:underline cursor-pointer">Mensagens</a>
          </nav>
          <Button onClick={logout} variant="ghost" size="sm" className="text-white hover:bg-green-700">Sair</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-2">Bem-vindo{email ? `, ${email}` : ''} 👋</h2>
          <p className="text-gray-600 text-sm mb-4">
            Esta é a <strong>Fase 1</strong> do clone (autenticação + layout base).
            Nas próximas mensagens vou implementar: schema de posts/mensagens,
            FeedPage completa, DirectChat, Volunteers, Subscription e PIX.
          </p>
          <div className="text-xs text-gray-500 border-t pt-3 mt-3">
            Rota atual: <code>/servicos/home</code>
          </div>
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t flex items-center justify-around h-16 z-50">
        <button className="flex flex-col items-center text-green-600 text-xs">
          <Home className="w-5 h-5 mb-0.5" />Início
        </button>
        <button className="flex flex-col items-center text-gray-500 text-xs">
          <Users className="w-5 h-5 mb-0.5" />Ofertantes
        </button>
        <button className="flex flex-col items-center text-white text-xs bg-green-600 rounded-full w-12 h-12 -mt-6 shadow-lg">
          <Plus className="w-6 h-6" />
        </button>
        <button className="flex flex-col items-center text-gray-500 text-xs">
          <MessageCircle className="w-5 h-5 mb-0.5" />Mensagens
        </button>
        <button className="flex flex-col items-center text-gray-500 text-xs">
          <User className="w-5 h-5 mb-0.5" />Perfil
        </button>
      </nav>
    </div>
  );
}
