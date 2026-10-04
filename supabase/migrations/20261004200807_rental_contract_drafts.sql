-- Carga de contratos desde PDF (IA).
-- El PDF se sube antes de que exista el contrato, así que no puede ir en
-- rental-docs/<contract_id>/. Va a rental-docs/drafts/<auth.uid()>/<archivo>:
-- cada agente solo ve y borra sus propios borradores. Al crear el contrato
-- el servidor lo mueve a la carpeta del contrato; los que quedan colgados los
-- purga el cron.

create policy "Docs alquiler: borrador propio (lectura)" on storage.objects for select to authenticated
using (bucket_id = 'rental-docs' and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text);

create policy "Docs alquiler: borrador propio (alta)" on storage.objects for insert to authenticated
with check (bucket_id = 'rental-docs' and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text);

create policy "Docs alquiler: borrador propio (baja)" on storage.objects for delete to authenticated
using (bucket_id = 'rental-docs' and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text);
