import React, { useEffect, useState } from 'react';
import { MapPin, Utensils, HandHeart, ExternalLink } from 'lucide-react';
import { useUserLocation } from '../lib/userLocation';

const CATEGORIES = [
  { key: 'food', label: 'Alimentação', icon: Utensils, query: 'food bank OR soup kitchen OR banco de alimentos OR cozinha comunitária', amenity: 'social_facility' },
  { key: 'donation', label: 'Doações', icon: HandHeart, query: 'donation center OR charity OR doação OR ONG', amenity: 'social_facility' },
];

// Busca no OpenStreetMap (Nominatim) por locais próximos da categoria.
async function searchNearby({ lat, lng, query }) {
  const delta = 0.1; // ~11km
  const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt,en' } });
    if (!r.ok) return [];
    const data = await r.json();
    return data.map((d) => ({
      id: d.place_id,
      name: d.display_name?.split(',')[0] || 'Local',
      address: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch {
    return [];
  }
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyHelpPlaces() {
  const { location } = useUserLocation();
  const [results, setResults] = useState({ food: [], donation: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location?.lat || !location?.lng) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(
      CATEGORIES.map((c) => searchNearby({ lat: location.lat, lng: location.lng, query: c.query }).then((items) => [c.key, items]))
    ).then((pairs) => {
      if (cancelled) return;
      setResults(Object.fromEntries(pairs));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [location?.lat, location?.lng]);

  if (!location?.lat || !location?.lng) return null;

  return (
    <div className="bg-white rounded-3xl shadow-card p-4 mb-6">
      <h3 className="font-bold text-textPrimary mb-3 flex items-center gap-2">
        <MapPin size={18} className="text-primary" />
        Locais de ajuda próximos
      </h3>
      {loading && <p className="text-sm text-gray-500">Buscando próximos a você...</p>}
      {!loading && CATEGORIES.every((c) => (results[c.key] || []).length === 0) && (
        <p className="text-sm text-gray-500">Nenhum local encontrado nas proximidades.</p>
      )}
      <div className="space-y-4">
        {CATEGORIES.map((c) => {
          const items = results[c.key] || [];
          if (items.length === 0) return null;
          const Icon = c.icon;
          return (
            <div key={c.key}>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
                <Icon size={16} className="text-primary" /> {c.label}
              </div>
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-800 truncate">{it.name}</p>
                      <p className="text-xs text-gray-500 truncate">{it.address}</p>
                      <p className="text-xs text-primary mt-1">{distanceKm(location.lat, location.lng, it.lat, it.lng).toFixed(1)} km</p>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${it.lat},${it.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 shrink-0"
                      title="Abrir no mapa"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
