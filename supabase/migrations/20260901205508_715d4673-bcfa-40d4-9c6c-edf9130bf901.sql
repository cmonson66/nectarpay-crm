REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.visible_rep_ids(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_rep_directory() FROM authenticated;

CREATE POLICY "CRM users can view lead document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-documents'
  AND EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = split_part(name, '/', 1)::uuid
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);

CREATE POLICY "CRM users can upload lead document files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-documents'
  AND EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = split_part(name, '/', 1)::uuid
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);

CREATE POLICY "CRM users can update lead document files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lead-documents'
  AND EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = split_part(name, '/', 1)::uuid
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
)
WITH CHECK (
  bucket_id = 'lead-documents'
  AND EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = split_part(name, '/', 1)::uuid
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);

CREATE POLICY "CRM users can delete lead document files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lead-documents'
  AND EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = split_part(name, '/', 1)::uuid
      AND l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  )
);