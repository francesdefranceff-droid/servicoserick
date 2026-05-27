import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Search, Wrench, MapPin, Star } from 'lucide-react';
import i18n from '../i18n';
import AuthModal from '../components/AuthModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [language, setLanguage] = useState((i18n.language || 'pt').toUpperCase().slice(0, 2));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const openAuth = (mode) => { setAuthMode(mode); setAuthOpen(true); };

  const changeLanguage = (lang) => {
    const code = lang.toLowerCase();
    i18n.changeLanguage(code);
    setLanguage(lang);
  };

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-orange-400 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              W
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold">
                <span className="text-green-500">Wati</span>
                <span className="text-orange-500">zat</span>
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">{t('landingTagline') || 'Apoio para Migrantes'}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-xs sm:text-sm">
              {['PT', 'FR', 'EN', 'ES'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  data-testid={`lang-${lang.toLowerCase()}`}
                  className={`px-2 py-1 rounded ${language === lang ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-600 hover:text-green-600'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/auth')}
              className="border-gray-300 rounded-full"
              data-testid="landing-login-btn"
            >
              {t('login') || 'Entrar'}
            </Button>
            <Button
              onClick={() => navigate('/auth')}
              className="bg-gray-900 hover:bg-gray-800 text-white rounded-full"
              data-testid="landing-register-btn"
            >
              {t('register') || 'Cadastrar-se'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="mb-8">
              <div className="inline-flex items-center space-x-2 bg-green-50 px-4 py-2 rounded-full mb-4">
                <span className="text-green-600 font-semibold flex items-center space-x-1">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span>4.9/5</span>
                </span>
                <span className="text-gray-600 text-sm">+500 pessoas ajudadas</span>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Conectando migrantes
              <br />
              <span className="text-green-600">e voluntários em Paris</span>
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              A maior plataforma de apoio solidário para migrantes na França
            </p>
            <div className="flex items-center space-x-2 mb-8 text-sm text-gray-600">
              <MapPin className="w-5 h-5 text-green-600" />
              <span>Disponível em Paris, Lyon, Marseille e mais cidades</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button
                onClick={() => navigate('/auth?role=migrant')}
                className="bg-gray-900 hover:bg-gray-800 text-white h-14 px-8 text-base rounded-full"
                data-testid="cta-need-help"
              >
                <Search className="w-5 h-5 mr-2" />
                Preciso de Ajuda
              </Button>
              <Button
                onClick={() => navigate('/auth?role=helper')}
                variant="outline"
                className="border-2 border-green-500 text-green-600 hover:bg-green-50 h-14 px-8 text-base rounded-full"
                data-testid="cta-want-help"
              >
                <Wrench className="w-5 h-5 mr-2" />
                Quero Ajudar
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">500+</p>
                <p className="text-sm text-gray-600">Migrantes apoiados</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">200+</p>
                <p className="text-sm text-gray-600">Voluntários ativos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">1.2k+</p>
                <p className="text-sm text-gray-600">Conexões feitas</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=85"
                alt="Comunidade Watizat"
                className="w-full h-[500px] object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-green-500 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0">
            <p className="text-white text-lg font-medium mb-1">
              Junte-se a milhares de pessoas na rede solidária Watizat
            </p>
            <p className="text-green-50 text-sm">
              Encontre ajuda ou ofereça apoio perto de você
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate('/auth')}
              className="bg-white text-green-600 hover:bg-gray-100 px-8 rounded-full"
              data-testid="bottom-cta-register"
            >
              Cadastrar-se Grátis
            </Button>
          </div>
        </div>
      </div>

      {/* Trust badges */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
          <div className="p-6 bg-gray-50 rounded-2xl">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-500 text-yellow-500" />
              ))}
              <span className="text-lg font-bold ml-2">4.9/5</span>
            </div>
            <p className="text-sm text-gray-600">Avaliado por migrantes em Paris</p>
          </div>
          <div className="p-6 bg-gray-50 rounded-2xl">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-500 text-yellow-500" />
              ))}
              <span className="text-lg font-bold ml-2">4.8/5</span>
            </div>
            <p className="text-sm text-gray-600">Recomendado por voluntários</p>
          </div>
        </div>
      </div>
    </div>
  );
}
