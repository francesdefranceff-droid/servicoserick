-- 1) svc_subscriptions: prevent status escalation on insert
DROP POLICY IF EXISTS "Users insert own subscription" ON public.svc_subscriptions;
CREATE POLICY "Users insert own subscription"
ON public.svc_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'trial'
  AND pix_brcode IS NULL
  AND pix_txid IS NULL
);

-- 2) has_role: revoke from anon/public; only authenticated roles can call
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3) Make debug-uploads bucket private
UPDATE storage.buckets SET public = false WHERE id = 'debug-uploads';