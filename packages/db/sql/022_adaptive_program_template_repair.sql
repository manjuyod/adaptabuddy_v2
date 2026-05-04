-- Adaptive program family metadata repair.
--
-- This migration keeps challenge programs slotless and marks them as
-- deterministic adaptive templates owned by the engine boundary.

begin;

create or replace function pg_temp.scale_challenge_set(
  set_json jsonb,
  scale_factor numeric,
  min_floor integer
) returns jsonb
language sql
immutable
as $$
  select jsonb_set(
    set_json,
    '{reps}',
    to_jsonb(greatest(min_floor, round(((set_json->>'reps')::numeric * scale_factor))::integer)),
    true
  );
$$;

create or replace function pg_temp.scale_challenge_day(
  day_json jsonb,
  scale_factor numeric,
  min_floor integer
) returns jsonb
language sql
immutable
as $$
  select jsonb_set(
    day_json,
    '{sets}',
    coalesce(
      (
        select jsonb_agg(
          pg_temp.scale_challenge_set(set_item, scale_factor, min_floor)
          order by set_ordinal
        )
        from jsonb_array_elements(coalesce(day_json->'sets', '[]'::jsonb))
          with ordinality as sets(set_item, set_ordinal)
      ),
      '[]'::jsonb
    ),
    true
  );
$$;

create or replace function pg_temp.scale_challenge_week(
  week_json jsonb,
  scale_factor numeric,
  min_floor integer
) returns jsonb
language sql
immutable
as $$
  select jsonb_set(
    week_json,
    '{days}',
    coalesce(
      (
        select jsonb_agg(
          pg_temp.scale_challenge_day(day_item, scale_factor, min_floor)
          order by day_ordinal
        )
        from jsonb_array_elements(coalesce(week_json->'days', '[]'::jsonb))
          with ordinality as days(day_item, day_ordinal)
      ),
      '[]'::jsonb
    ),
    true
  );
$$;

create or replace function pg_temp.scale_challenge_groups(
  base_groups jsonb,
  scale_factor numeric,
  min_floor integer
) returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(
      group_key,
      jsonb_set(
        group_value,
        '{weeks}',
        coalesce(
          (
            select jsonb_agg(
              pg_temp.scale_challenge_week(week_item, scale_factor, min_floor)
              order by week_ordinal
            )
            from jsonb_array_elements(coalesce(group_value->'weeks', '[]'::jsonb))
              with ordinality as weeks(week_item, week_ordinal)
          ),
          '[]'::jsonb
        ),
        true
      )
    ),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(base_groups, '{}'::jsonb)) as groups(group_key, group_value);
$$;

create or replace function pg_temp.scale_challenge_test_groups(
  base_test_groups jsonb,
  scale_factor numeric,
  min_floor integer
) returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_set(
        jsonb_set(
          group_item,
          '{min}',
          to_jsonb(greatest(
            case when (group_item->>'min')::integer = 0 then 0 else min_floor end,
            floor(((group_item->>'min')::numeric * scale_factor))::integer
          )),
          true
        ),
        '{max}',
        to_jsonb(greatest(
          min_floor,
          ceiling(((group_item->>'max')::numeric * scale_factor))::integer
        )),
        true
      )
      order by group_ordinal
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(base_test_groups, '[]'::jsonb))
    with ordinality as groups(group_item, group_ordinal);
$$;

update public.programs
set
  min_days_per_week = 3,
  max_days_per_week = 3,
  default_days_per_week = 3,
  metadata = jsonb_set(
    jsonb_set(
      metadata,
      '{adaptive_template_family}',
      '"challenge_progression"'::jsonb,
      true
    ),
    '{source_template_json,frequency_per_week}',
    '3'::jsonb,
    true
  )
where slug = '100_push_ups_challenge_3_group_6_week';

with base as (
  select metadata->'source_template_json' as source_template_json
  from public.programs
  where slug = '100_push_ups_challenge_3_group_6_week'
)
update public.programs p
set
  min_days_per_week = 3,
  max_days_per_week = 3,
  default_days_per_week = 3,
  metadata = jsonb_set(
    jsonb_set(
      jsonb_set(
        p.metadata,
        '{adaptive_template_family}',
        '"challenge_progression"'::jsonb,
        true
      ),
      '{source_template_json}',
      (
        coalesce(p.metadata->'source_template_json', '{}'::jsonb)
        || jsonb_build_object(
          'challenge', '20_pullups',
          'exercise', jsonb_build_object(
            'slug', 'pull_up',
            'canonical_name', 'Pull-Up'
          ),
          'frequency_per_week', 3,
          'groups', pg_temp.scale_challenge_groups(
            base.source_template_json->'groups',
            0.25,
            2
          ),
          'initial_test_groups', pg_temp.scale_challenge_test_groups(
            base.source_template_json->'initial_test_groups',
            0.25,
            2
          )
        )
      ),
      true
    ),
    '{source_template_json,scale}',
    jsonb_build_object(
      'from', '100_pushups',
      'factor', 0.25,
      'min_floor', 2
    ),
    true
  )
from base
where p.slug = '20_pull_ups_challenge_derived_6_week';

with base as (
  select metadata->'source_template_json' as source_template_json
  from public.programs
  where slug = '100_push_ups_challenge_3_group_6_week'
)
update public.programs p
set
  min_days_per_week = 3,
  max_days_per_week = 3,
  default_days_per_week = 3,
  metadata = jsonb_set(
    jsonb_set(
      jsonb_set(
        p.metadata,
        '{adaptive_template_family}',
        '"challenge_progression"'::jsonb,
        true
      ),
      '{source_template_json}',
      (
        coalesce(p.metadata->'source_template_json', '{}'::jsonb)
        || jsonb_build_object(
          'challenge', '200_situps',
          'exercise', jsonb_build_object(
            'slug', 'sit_up',
            'canonical_name', 'Sit-Up'
          ),
          'frequency_per_week', 3,
          'groups', pg_temp.scale_challenge_groups(
            base.source_template_json->'groups',
            2,
            10
          ),
          'initial_test_groups', pg_temp.scale_challenge_test_groups(
            base.source_template_json->'initial_test_groups',
            2,
            10
          )
        )
      ),
      true
    ),
    '{source_template_json,scale}',
    jsonb_build_object(
      'from', '100_pushups',
      'factor', 2,
      'min_floor', 10
    ),
    true
  )
from base
where p.slug = '200_sit_ups_challenge_derived_6_week';

update public.programs
set
  min_days_per_week = 3,
  max_days_per_week = 3,
  default_days_per_week = 3,
  metadata = jsonb_set(
    jsonb_set(
      metadata,
      '{adaptive_template_family}',
      '"hypertrophy_engine_v1"'::jsonb,
      true
    ),
    '{source_template_json,frequency_per_week}',
    '3'::jsonb,
    true
  )
where slug = 'hypertrophy_engine_v1';

create or replace function public.program_template_integrity_check()
returns table (
  issue_type text,
  program_id integer,
  slug text,
  issue text
)
language sql
stable
as $$
  with program_family as (
    select
      p.id,
      p.slug,
      p.is_active,
      p.metadata,
      coalesce(p.metadata->>'adaptive_template_family', 'slot_based') as template_family,
      p.metadata->'source_template_json' as source_template
    from public.programs p
  ),
  complete_static_programs as (
    select distinct pd.program_id
    from public.program_days pd
    where exists (
      select 1
      from public.program_slots ps
      where ps.program_day_id = pd.id
    )
  )
  select
    'invalid_active_static_program'::text as issue_type,
    p.id as program_id,
    p.slug,
    'active slot_based program is missing complete program_days/program_slots'::text as issue
  from program_family p
  where p.is_active = true
    and p.template_family not in ('challenge_progression', 'hypertrophy_engine_v1')
    and not exists (
      select 1
      from complete_static_programs c
      where c.program_id = p.id
    )

  union all

  select
    'invalid_active_adaptive_program'::text,
    p.id,
    p.slug,
    'challenge_progression metadata must include exercise.slug, initial_test_groups, groups, and fixed frequency 3'::text
  from program_family p
  where p.is_active = true
    and p.template_family = 'challenge_progression'
    and (
      p.source_template is null
      or p.source_template #>> '{exercise,slug}' is null
      or jsonb_typeof(p.source_template->'initial_test_groups') <> 'array'
      or jsonb_array_length(p.source_template->'initial_test_groups') = 0
      or jsonb_typeof(p.source_template->'groups') <> 'object'
      or coalesce((p.source_template->>'frequency_per_week')::integer, 0) <> 3
    )

  union all

  select
    'invalid_active_adaptive_program'::text,
    p.id,
    p.slug,
    'hypertrophy_engine_v1 metadata must include exactly three source sessions with slots and fixed frequency 3'::text
  from program_family p
  where p.is_active = true
    and p.template_family = 'hypertrophy_engine_v1'
    and (
      p.source_template is null
      or jsonb_typeof(p.source_template->'sessions') <> 'array'
      or jsonb_array_length(p.source_template->'sessions') <> 3
      or exists (
        select 1
        from jsonb_array_elements(coalesce(p.source_template->'sessions', '[]'::jsonb)) as sessions(session_json)
        where session_json->>'session_key' is null
          or jsonb_typeof(session_json->'slots') <> 'array'
          or jsonb_array_length(session_json->'slots') = 0
      )
      or coalesce((p.source_template->>'frequency_per_week')::integer, 0) <> 3
    );
$$;

commit;
