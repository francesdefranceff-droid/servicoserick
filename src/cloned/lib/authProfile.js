import { supabase } from '@/integrations/supabase/client';

export const normalizeAuthUser = (authUser, profile = {}) => {
  if (!authUser) return null;
  const metadata = authUser.user_metadata || {};
  const displayName = profile.display_name || metadata.display_name || authUser.email?.split('@')[0] || 'Usuário';

  return {
    id: authUser.id,
    email: authUser.email,
    name: displayName,
    display_name: displayName,
    role: profile.role || metadata.role || 'migrant',
    avatar_url: profile.avatar_url || metadata.avatar_url || null,
    bio: profile.bio || '',
    city: profile.city || metadata.location || '',
    categories: Array.isArray(profile.categories) ? profile.categories : [],
  };
};

export const getOrCreateSvcProfile = async (authUser, fallback = {}) => {
  if (!authUser?.id) return null;

  const { data: existing, error: selectError } = await supabase
    .from('svc_profiles')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const metadata = authUser.user_metadata || {};
  const displayName = fallback.display_name || metadata.display_name || authUser.email?.split('@')[0] || 'Usuário';
  const role = fallback.role || metadata.role || 'migrant';

  const { data: created, error: insertError } = await supabase
    .from('svc_profiles')
    .insert({
      user_id: authUser.id,
      display_name: displayName,
      role,
      city: fallback.city || metadata.location || null,
      avatar_url: fallback.avatar_url || metadata.avatar_url || null,
      categories: Array.isArray(fallback.categories) ? fallback.categories : [],
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return created;
};

export const updateSvcProfile = async (userId, values) => {
  const { data, error } = await supabase
    .from('svc_profiles')
    .update(values)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};