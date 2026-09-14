-- Admin-only access to private pos-releases bucket
CREATE POLICY "Admins can read pos-releases"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pos-releases' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload pos-releases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pos-releases' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pos-releases"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pos-releases' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'pos-releases' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pos-releases"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pos-releases' AND public.has_role(auth.uid(), 'admin'));