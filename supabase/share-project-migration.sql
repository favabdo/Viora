-- Share project: searchable invites, link toggle, expiry / use limits, join preview.

alter table invite_links
  add column if not exists access_role text not null default 'viewer',
  add column if not exists expires_at timestamptz,
  add column if not exists max_uses integer,
  add column if not exists use_count integer not null default 0;

alter table project_members
  add column if not exists role text not null default 'editor';

create or replace function public.search_profiles_for_invite(p_query text)
returns table (
  id uuid,
  username text,
  full_name text,
  email text,
  avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.full_name, p.email, p.avatar_url
  from profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and coalesce(p.is_deleted, false) = false
    and length(trim(p_query)) >= 1
    and (
      p.username ilike '%' || trim(p_query) || '%'
      or coalesce(p.full_name, '') ilike '%' || trim(p_query) || '%'
      or coalesce(p.email, '') ilike '%' || trim(p_query) || '%'
    )
  order by
    case when p.username = lower(trim(p_query)) then 0 else 1 end,
    p.full_name
  limit 8;
$$;

grant execute on function public.search_profiles_for_invite(text) to authenticated;

create or replace function public.invite_user_to_project(p_project_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'مش عضو في المشروع ده';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'متقدرش تدعي نفسك';
  end if;
  if not exists (select 1 from profiles where id = p_user_id and coalesce(is_deleted, false) = false) then
    raise exception 'مفيش يوزر بالاسم ده';
  end if;
  if exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = p_user_id and status = 'accepted'
  ) then
    raise exception 'اليوزر ده عضو بالفعل في المشروع';
  end if;

  insert into project_members (project_id, user_id, status, invited_by)
  values (p_project_id, p_user_id, 'pending', auth.uid())
  on conflict (project_id, user_id) do update set status = 'pending', invited_by = auth.uid();
end;
$$;

grant execute on function public.invite_user_to_project(uuid, uuid) to authenticated;

create or replace function public.set_invite_link_enabled(p_project_id uuid, p_enabled boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'مش عضو في المشروع ده';
  end if;

  if p_enabled then
    return public.get_or_create_invite_link(p_project_id);
  end if;

  update invite_links
  set revoked = true
  where project_id = p_project_id and revoked = false;

  return null;
end;
$$;

grant execute on function public.set_invite_link_enabled(uuid, boolean) to authenticated;

create or replace function public.update_invite_link_settings(
  p_project_id uuid,
  p_access_role text,
  p_expires_at timestamptz,
  p_max_uses integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'مش عضو في المشروع ده';
  end if;

  update invite_links
  set
    access_role = coalesce(nullif(p_access_role, ''), access_role),
    expires_at = p_expires_at,
    max_uses = p_max_uses
  where project_id = p_project_id and revoked = false;
end;
$$;

grant execute on function public.update_invite_link_settings(uuid, text, timestamptz, integer) to authenticated;

drop function if exists public.invite_link_preview(uuid);
create or replace function public.invite_link_preview(p_token uuid)
returns table (
  project_name text,
  valid boolean,
  inviter_name text,
  inviter_avatar text,
  access_role text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.name,
    (
      il.revoked = false
      and (il.expires_at is null or il.expires_at > now())
      and (il.max_uses is null or il.use_count < il.max_uses)
    ) as valid,
    coalesce(nullif(pr.full_name, ''), pr.username, 'User'),
    pr.avatar_url,
    coalesce(il.access_role, 'viewer')
  from invite_links il
  join projects p on p.id = il.project_id
  left join profiles pr on pr.id = il.created_by
  where il.token = p_token;
$$;

grant execute on function public.invite_link_preview(uuid) to anon, authenticated;

create or replace function public.join_project_by_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_created_by uuid;
  v_expires timestamptz;
  v_max integer;
  v_count integer;
  v_revoked boolean;
begin
  if auth.uid() is null then
    raise exception 'لازم تسجل دخول الأول';
  end if;

  select project_id, created_by, expires_at, max_uses, use_count, revoked
    into v_project_id, v_created_by, v_expires, v_max, v_count, v_revoked
  from invite_links
  where token = p_token;

  if v_project_id is null or v_revoked then
    raise exception 'رابط الدعوة ده مش شغال';
  end if;
  if v_expires is not null and v_expires <= now() then
    raise exception 'رابط الدعوة ده مش شغال';
  end if;
  if v_max is not null and v_count >= v_max then
    raise exception 'رابط الدعوة ده مش شغال';
  end if;

  insert into project_members (project_id, user_id, status, invited_by)
  values (v_project_id, auth.uid(), 'accepted', v_created_by)
  on conflict (project_id, user_id) do update set status = 'accepted';

  update invite_links
  set use_count = use_count + 1
  where token = p_token;

  return v_project_id;
end;
$$;

grant execute on function public.join_project_by_invite(uuid) to authenticated;
