
-- 1) Lock down the private debug-uploads bucket to admins only
DROP POLICY IF EXISTS "Authenticated can read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload debug-uploads" ON storage.objects;

CREATE POLICY "Admins can read debug-uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'debug-uploads' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Revoke EXECUTE from anon/public on SECURITY DEFINER functions that require auth.uid()
REVOKE EXECUTE ON FUNCTION public.ensure_svc_category(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_phone() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_svc_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_svc_role_escalation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.svc_validate_conversation_participants() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ensure_svc_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_svc_profile() TO authenticated;

-- 3) Restrict Realtime channel subscriptions: only allow postgres_changes (row RLS enforced),
--    and scope broadcast/presence topics to the authenticated user's own id.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime channels" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    extension = 'postgres_changes'
    OR topic LIKE '%' || auth.uid()::text || '%'
  );

DROP POLICY IF EXISTS "Authenticated can publish realtime channels" ON realtime.messages;
CREATE POLICY "Authenticated can publish realtime channels"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    extension = 'postgres_changes'
    OR topic LIKE '%' || auth.uid()::text || '%'
  );
