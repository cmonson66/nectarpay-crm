CREATE TABLE public.lead_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  document_type text NOT NULL CHECK (document_type IN ('trial_agreement', 'purchase_agreement', 'invoice')),
  title text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  file_size bigint,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_documents TO authenticated;
GRANT ALL ON public.lead_documents TO service_role;

ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM users can view visible lead documents"
ON public.lead_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_documents.lead_id
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);

CREATE POLICY "CRM users can create visible lead documents"
ON public.lead_documents
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_documents.lead_id
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);

CREATE POLICY "CRM users can update visible lead documents"
ON public.lead_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_documents.lead_id
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_documents.lead_id
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);

CREATE POLICY "CRM users can delete visible lead documents"
ON public.lead_documents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_documents.lead_id
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);