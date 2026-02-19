-- Allow accept/reject from public proposal page via controlled RPC.
-- Avoids granting broad UPDATE to anon while keeping token-based flow working.

CREATE OR REPLACE FUNCTION public.public_set_proposal_status_by_token(
  p_token TEXT,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.proposals
  SET
    status = p_status,
    accepted_at = CASE WHEN p_status = 'accepted' THEN now() ELSE NULL END
  WHERE token = p_token
    AND status = 'pending';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.public_set_proposal_status_by_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_set_proposal_status_by_token(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.public_set_proposal_status_by_token(TEXT, TEXT) TO authenticated;
