-- 10/10 : page « Santé du site » de l'admin. Une seule lecture, réservée aux administrateurs :
-- taille de la base, connexions, stockage par dossier, volumes principaux. Rejouable.
create or replace function public.admin_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin() then raise exception 'réservé aux administrateurs'; end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'db_version', current_setting('server_version'),
    'connections', (select count(*) from pg_stat_activity where datname = current_database()),
    'max_connections', current_setting('max_connections')::int,
    'storage', coalesce((select jsonb_object_agg(bucket_id, jsonb_build_object('files', n, 'bytes', b))
      from (select bucket_id, count(*) n, coalesce(sum((metadata->>'size')::bigint), 0) b from storage.objects group by bucket_id) s), '{}'::jsonb),
    'users', (select count(*) from auth.users),
    'orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders where status = 'pending'),
    'lessons', (select count(*) from public.lessons),
    'oldest_pending_minutes', (select extract(epoch from now() - min(created_at)) / 60 from public.orders where status = 'pending')
  );
end;
$$;
revoke all on function public.admin_health() from public, anon;
grant execute on function public.admin_health() to authenticated;
