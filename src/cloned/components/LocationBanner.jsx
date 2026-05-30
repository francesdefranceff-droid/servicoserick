import { useEffect, useState } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUserLocation } from '../lib/userLocation';
import { requestLocationPermission } from '../utils/geolocation';

const DISMISS_KEY = 'svc:location-banner-dismissed';

export default function LocationBanner() {
  const { location, setManualLocation } = useUserLocation();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [loading, setLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [address, setAddress] = useState('');

  // Auto-tenta IP em background ao montar (não bloqueia UI)
  useEffect(() => {
    if (!location) {
      requestLocationPermission({ silent: true }).then((loc) => {
        if (loc && typeof loc.lat === 'number') setManualLocation(loc);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (location || dismissed) return null;

  const detectNow = async () => {
    setLoading(true);
    try {
      const loc = await requestLocationPermission({ forceBrowser: true, showToast: true });
      if (loc) {
        setManualLocation(loc);
      } else {
        toast.error('Não foi possível detectar. Tente inserir manualmente.');
        setManualOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    const q = address.trim();
    if (!q) return;
    setLoading(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (Array.isArray(d) && d[0]) {
        const loc = {
          lat: parseFloat(d[0].lat),
          lng: parseFloat(d[0].lon),
          address: d[0].display_name,
          source: 'manual',
        };
        setManualLocation(loc);
        toast.success('📍 Localização definida');
      } else {
        toast.error('Endereço não encontrado');
      }
    } catch {
      toast.error('Erro ao buscar endereço');
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-2 right-2 lg:left-auto lg:right-4 lg:max-w-sm z-40 bg-white rounded-2xl shadow-lg border border-green-200 p-3">
      <div className="flex items-start gap-2">
        <div className="w-9 h-9 rounded-full bg-green-100 grid place-items-center text-green-600 shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Ative sua localização</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Para mostrar serviços e mapas perto de você.
          </p>
          {!manualOpen ? (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={detectNow}
                disabled={loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                Detectar automaticamente
              </button>
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold hover:bg-gray-200"
              >
                Inserir manualmente
              </button>
            </div>
          ) : (
            <form onSubmit={submitManual} className="mt-2 flex gap-2">
              <input
                type="text"
                autoFocus
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Cidade, rua, CEP..."
                className="flex-1 min-w-0 px-3 py-1.5 rounded-full border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                disabled={loading || !address.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                OK
              </button>
            </form>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="text-gray-400 hover:text-gray-700 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
