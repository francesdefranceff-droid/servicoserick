import React from 'react';
import { Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Yes = () => <Check className="w-5 h-5 text-green-600 mx-auto" strokeWidth={3} />;
const No = () => <X className="w-5 h-5 text-red-500 mx-auto" strokeWidth={3} />;

const SECTIONS = [
  {
    title: 'Oferecer meus serviços',
    rows: [
      { label: 'Configuração', isHeader: true },
      { label: 'Raio de atuação', std: <Yes />, pre: <Yes /> },
      { label: 'Notificações "Novas solicitações"', std: <Yes />, pre: <Yes /> },
      { label: 'Responder solicitações', isHeader: true },
      { label: 'Aluguel de material', std: <Yes />, pre: <Yes /> },
      { label: 'Prestação de serviço', std: 'Amostra', pre: <span className="text-center">Ilimitado*<br /><span className="text-[10px] text-gray-500">* na sua área</span></span> },
    ],
  },
  {
    title: 'Minha visibilidade',
    rows: [
      { label: 'Exibição no meu perfil', isHeader: true },
      { label: 'Número de telefone', std: <No />, pre: <Yes /> },
      { label: 'Fotos das minhas realizações', std: '3', pre: '50' },
      { label: 'Suprimir perfis similares', std: <No />, pre: <Yes /> },
      { label: 'Posicionamento no Google', isHeader: true },
      { label: 'Referenciamento prioritário no Google', std: <No />, pre: <Yes /> },
    ],
  },
  {
    title: 'Suporte',
    rows: [
      { label: 'Acompanhamento personalizado e prioritário', std: <No />, pre: <Yes /> },
      { label: 'Atendimento por WhatsApp', std: <No />, pre: <Yes /> },
    ],
  },
];

export default function OfferServicesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Assinatura</h1>
          <p className="text-gray-600 mt-2">Compare os planos disponíveis</p>
        </div>

        {/* Cabeçalho dos planos */}
        <div className="grid grid-cols-[1fr,180px,180px] md:grid-cols-[1fr,220px,220px] gap-0 border border-gray-200 rounded-3xl overflow-hidden bg-white shadow-sm">
          <div className="bg-white" />
          <div className="border-l border-gray-200 p-6 text-center">
            <h3 className="text-2xl font-bold text-gray-900">Padrão</h3>
            <p className="text-gray-600 mt-1">Grátis</p>
            <button
              onClick={() => navigate('/profile')}
              className="mt-4 h-11 px-8 rounded-full bg-gray-900 text-white font-semibold hover:bg-black transition"
            >Modificar</button>
          </div>
          <div className="border-l border-gray-200 p-6 text-center bg-orange-50/30">
            <h3 className="text-2xl font-bold text-orange-500">Premier</h3>
            <p className="text-orange-600 mt-1">A partir de R$ 49,90 / mês</p>
            <p className="text-xs text-gray-500">Sem compromisso</p>
            <button
              onClick={() => navigate('/assinatura')}
              className="mt-3 h-11 px-8 rounded-full bg-orange-400 hover:bg-orange-500 text-white font-semibold transition"
            >Assinar</button>
          </div>

          {/* Seções */}
          {SECTIONS.map((section, si) => (
            <React.Fragment key={si}>
              <div className="col-span-3 border-t border-gray-200 px-6 pt-6 pb-2">
                <h4 className="text-lg font-bold text-gray-900">{section.title}</h4>
              </div>
              {section.rows.map((row, ri) =>
                row.isHeader ? (
                  <div key={ri} className="col-span-3 px-6 pt-3 pb-1 font-semibold text-gray-800 text-sm">
                    {row.label}
                  </div>
                ) : (
                  <React.Fragment key={ri}>
                    <div className="px-6 py-3 pl-10 text-sm text-gray-700 border-t border-gray-100">{row.label}</div>
                    <div className="border-l border-t border-gray-100 py-3 text-center text-sm text-gray-700 flex items-center justify-center">
                      {row.std}
                    </div>
                    <div className="border-l border-t border-gray-100 py-3 text-center text-sm text-gray-700 bg-orange-50/30 flex items-center justify-center">
                      {row.pre}
                    </div>
                  </React.Fragment>
                )
              )}
            </React.Fragment>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          *Recursos ilimitados se aplicam ao seu raio de atuação configurado.
        </p>
      </div>
    </div>
  );
}
