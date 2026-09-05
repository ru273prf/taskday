-- TaskDay 勉強時間 v3.0.8
-- プロジェクトの「種類」(1～10)を追加します。
-- 同じ種類のプロジェクトは study.js 側で同じ勉強時間ストリームを共有します。

alter table public.study_projects
  add column if not exists project_type integer;

-- 既存プロジェクトは作成順に 1～10 を割り当て、既存データが突然すべて共有されないようにします。
with numbered as (
  select id,
         ((row_number() over (order by created_at, id) - 1) % 10 + 1)::integer as t
  from public.study_projects
)
update public.study_projects p
set project_type = n.t
from numbered n
where p.id = n.id
  and p.project_type is null;

update public.study_projects
set project_type = 1
where project_type is null;

alter table public.study_projects
  alter column project_type set default 1;

alter table public.study_projects
  alter column project_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'study_projects_project_type_check'
  ) then
    alter table public.study_projects
      add constraint study_projects_project_type_check
      check (project_type between 1 and 10);
  end if;
end $$;

create index if not exists study_projects_user_project_type_idx
  on public.study_projects(user_id, project_type);
