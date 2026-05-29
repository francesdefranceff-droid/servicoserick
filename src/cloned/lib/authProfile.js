import { supabase } from '@/integrations/supabase/client';

export const getStableDefaultAvatarUrl = (user = {}) => {
  const account = user || {};
  const seed = account.id || account.email || account.user_id || 'pertodemimservicos-user';
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundColor=22c55e,f97316,0ea5e9`;
};

export const normalizeAuthUser = (authUser, profile = {}) => {
  if (!authUser) return null;
  const metadata = authUser.user_metadata || {};
  const displayName = profile.display_name || metadata.display_name || authUser.email?.split('@')[0] || 'Usuário';
  const avatarUrl = profile.avatar_url || metadata.avatar_url || getStableDefaultAvatarUrl(authUser);

  return {
    id: authUser.id,
    email: authUser.email,
    name: displayName,
    display_name: displayName,
    role: profile.role || metadata.role || 'migrant',
    avatar_url: avatarUrl,
    avatar: avatarUrl,
    bio: profile.bio || '',
    city: profile.city || metadata.location || '',
    location: profile.city || metadata.location || '',
    lat: typeof profile.lat === 'number' ? profile.lat : null,
    lng: typeof profile.lng === 'number' ? profile.lng : null,
    cover_url: profile.cover_url || null,
    categories: Array.isArray(profile.categories) ? profile.categories : [],
  };
};

export const getOrCreateSvcProfile = async (authUser, fallback = {}) => {
  if (!authUser?.id) return null;

  const metadata = authUser.user_metadata || {};
  const displayName = fallback.display_name || metadata.display_name || authUser.email?.split('@')[0] || 'Usuário';
  const avatarUrl = fallback.avatar_url || metadata.avatar_url || getStableDefaultAvatarUrl(authUser);
  const city = fallback.city || metadata.location || null;
  const categories = Array.isArray(fallback.categories) ? fallback.categories : [];

  const { data, error } = await supabase.rpc('get_or_create_own_svc_profile', {
    _display_name: displayName,
    _avatar_url: avatarUrl,
    _city: city,
    _categories: categories,
  });

  if (error) {
    // Fallback resiliente: não derruba o app se a RPC/RLS falhar
    console.warn('[svc_profiles] RPC falhou, usando perfil local:', error.message);
    return {
      user_id: authUser.id,
      display_name: displayName,
      role: fallback.role || metadata.role || 'migrant',
      city,
      avatar_url: avatarUrl,
      categories,
    };
  }
  return data;
};

export const updateSvcProfile = async (userId, values) => {
  const { data, error } = await supabase
    .from('svc_profiles')
    .update(values)
    .eq('user_id', userId)
    .limit(1)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};