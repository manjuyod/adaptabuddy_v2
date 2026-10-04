-- Complete lower-body and core strength replacement families with source-backed,
-- meaningfully different positions, loading modes, or movement demands.
-- Family membership supports planning only; it does not assert clinical safety or
-- equivalent load, range, impact, difficulty, or prescription.
begin;

select setval(
  pg_get_serial_sequence('public.exercises', 'id'),
  greatest(
    (select coalesce(max(id), 1) from public.exercises),
    (select last_value from public.exercises_id_seq)
  ),
  true
);

create temporary table lower_strength_additions (
  entry jsonb not null
) on commit drop;

insert into lower_strength_additions(entry) values
  ('{"slug":"seated_toe_raise","name":"Seated Toe Raise","family":"ankle_dorsiflexion","tracking":"reps","equipment":["chair"],"options":[["chair"]],"cue":"Sit with both heels planted; lift the forefeet and toes, then lower them with control.","sources":["https://www.wwl.nhs.uk/media/Services/MSK%20Physio/Exercise%20Programs/LEVEL%201%20ANKLE%20EXERCISES.pdf"],"muscles":[["tibialis_anterior","primary",1]]}'),
  ('{"slug":"standing_toe_raise","name":"Supported Standing Toe Raise","family":"ankle_dorsiflexion","tracking":"reps","equipment":["stable_counter"],"options":[["stable_counter"],["wall"]],"cue":"Stand tall at a stable support; keep the heels down while lifting the fronts of both feet.","sources":["https://www.worcsacute.nhs.uk/leaflets/strength-and-balance-exercise-programme/"],"muscles":[["tibialis_anterior","primary",1],["calves","secondary",0.5]]}'),
  ('{"slug":"heel_walk","name":"Heel Walk","family":"ankle_dorsiflexion","tracking":"reps","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Raise the toes and take short controlled steps on the heels while staying upright.","sources":["https://www.royalfree.nhs.uk/patients-and-visitors/patient-information-leaflets/exercises-perform-home-those-intermittent-claudication/submit/43795"],"muscles":[["tibialis_anterior","primary",1],["core","secondary",0.5]]}'),

  ('{"slug":"hollow_body_rock","name":"Hollow-body Rock","family":"anti_extension","tracking":"reps","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Hold a hollow-body shape with the lower back anchored and rock without changing the trunk position.","sources":["https://www.acefitness.org/resources/everyone/blog/5602/10-minute-core-workout/"],"muscles":[["transverse_abdominis","primary",1],["rectus_abdominis","secondary",0.5],["obliques","secondary",0.5]]}'),
  ('{"slug":"star_side_plank","name":"Star Side Plank","family":"anti_lateral_flexion","tracking":"duration_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Hold a straight side plank and lift the top leg without letting the supporting side of the trunk sag.","sources":["https://www.acefitness.org/continuing-education/prosource/may-2014/3797/what-comes-after-planks/"],"muscles":[["obliques","primary",1],["transverse_abdominis","secondary",0.5],["glute_med_min","secondary",0.5]]}'),
  ('{"slug":"plank_shoulder_tap","name":"Plank Shoulder Tap","family":"anti_rotation","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"From a straight-arm plank, tap the opposite shoulder while keeping the hips quiet.","sources":["https://www.nasm.org/resource-center/blog/training/the-plank-coaching-progressions-and-variations-for-every-client"],"muscles":[["transverse_abdominis","primary",1],["obliques","secondary",0.5],["serratus_anterior","secondary",0.5]]}'),
  ('{"slug":"plank_walkup","name":"Plank Walk-up","family":"anti_rotation","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Move one arm at a time between forearm and straight-arm plank while limiting hip rotation.","sources":["https://www.nasm.org/resource-center/exercise-library/plank-walkup"],"muscles":[["transverse_abdominis","primary",1],["obliques","secondary",0.5],["triceps","secondary",0.5]]}'),

  ('{"slug":"seated_bodyweight_calf_raise","name":"Seated Bodyweight Calf Raise","family":"calf_raise_bent_knee","tracking":"reps","equipment":["chair"],"options":[["chair"]],"cue":"Sit with knees bent and feet planted; raise both heels while keeping the toes down.","sources":["https://www.uhsussex.nhs.uk/resources/chair-exercises/"],"muscles":[["calves_soleus","primary",1],["calves_gastrocnemius","secondary",0.5]]}'),
  ('{"slug":"bent_knee_calf_raise","name":"Bent-knee Calf Raise","family":"calf_raise_bent_knee","tracking":"reps","equipment":["chair"],"options":[["chair"],["stable_counter"]],"cue":"Hold stable support, keep both knees bent, and raise and lower both heels under control.","sources":["https://www.leicspart.nhs.uk/wp-content/uploads/2020/06/Rehab-1-Class-Exercises.pdf"],"muscles":[["calves_soleus","primary",1],["calves_gastrocnemius","secondary",0.5]]}'),
  ('{"slug":"single_leg_bent_knee_calf_raise","name":"Single-leg Bent-knee Calf Raise","family":"calf_raise_bent_knee","tracking":"reps_each_side","equipment":["chair"],"options":[["chair"],["stable_counter"]],"cue":"Use stable support, keep the standing knee slightly bent, and raise the heel on one leg.","sources":["https://www.nelft.nhs.uk/severs-disease-information-page-"],"muscles":[["calves_soleus","primary",1],["calves_gastrocnemius","secondary",0.5]]}'),
  ('{"slug":"single_leg_straight_knee_calf_raise","name":"Single-leg Straight-knee Calf Raise","family":"calf_raise_straight_knee","tracking":"reps_each_side","equipment":["chair"],"options":[["chair"],["stable_counter"],["wall"]],"cue":"Keep the standing knee straight and lift the heel through the ball of the foot without leaning forward.","sources":["https://www.uhcw.nhs.uk/download/clientfiles/files/Patient%20Information%20Leaflets/Trauma%20and%20Neuro%20services/Trauma%20and%20Orthopaedics/Achilles%20tendinopathy.pdf"],"muscles":[["calves_gastrocnemius","primary",1],["calves_soleus","secondary",0.5]]}'),
  ('{"slug":"flat_floor_eccentric_calf_raise","name":"Flat-floor Eccentric Calf Raise","family":"calf_raise_straight_knee","tracking":"reps_each_side","equipment":["chair"],"options":[["chair"],["stable_counter"]],"cue":"Rise on both feet, transfer to one straight leg, and lower that heel slowly to the floor.","sources":["https://www.mskdorset.nhs.uk/ankle-pain/ankle-pain-achilles-tendon-pain/"],"muscles":[["calves_gastrocnemius","primary",1],["calves_soleus","secondary",0.5]]}'),

  ('{"slug":"standing_hip_abduction","name":"Supported Standing Hip Abduction","family":"hip_abduction","tracking":"reps_each_side","equipment":["chair"],"options":[["chair"],["stable_counter"],["wall"]],"cue":"Stand upright at stable support and lift one straight leg sideways without leaning the trunk.","sources":["https://www.uhsussex.nhs.uk/resources/standing-exercises/"],"muscles":[["glute_med_min","primary",1],["abductors","secondary",0.5]]}'),
  ('{"slug":"wall_isometric_hip_abduction","name":"Wall Isometric Hip Abduction","family":"hip_abduction","tracking":"duration_each_side","equipment":["wall"],"options":[["wall"]],"cue":"Stand side-on and press the bent outside knee into the wall while keeping the standing hip level.","sources":["https://www.cuh.nhs.uk/patient-information/hip-strengthening-exercises/"],"muscles":[["glute_med_min","primary",1],["abductors","secondary",0.5],["core","secondary",0.5]]}'),
  ('{"slug":"supine_hip_adduction_slide","name":"Supine Hip Adduction Slide","family":"hip_adduction","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Slide one straight leg outward, then draw it back to the midline with the toes facing upward.","sources":["https://www.nth.nhs.uk/resources/bed-exercise/"],"muscles":[["adductors","primary",1],["adductors_longus_brevis","secondary",0.5]]}'),
  ('{"slug":"copenhagen_hip_adduction","name":"Chair-supported Copenhagen Hip Adduction","family":"hip_adduction","tracking":"reps","equipment":["chair","bench"],"options":[["chair"],["bench"]],"cue":"Support the upper ankle on a sturdy chair or bench; lift the hips and bring the lower leg toward it.","sources":["https://www.dynamichealth.nhs.uk/help-and-advice/hip-pain/hip-adductor-strains-and-tendinopathies/"],"muscles":[["adductors","primary",1],["obliques","secondary",0.5],["glute_med_min","secondary",0.5]]}'),
  ('{"slug":"staggered_glute_bridge","name":"Staggered-stance Glute Bridge","family":"hip_bridge","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Place one foot closer to the hips than the other and lift the pelvis without letting it rotate.","sources":["https://www.leicspart.nhs.uk/wp-content/uploads/2026/06/LPT-CHSMSK18-GTPS.pdf"],"muscles":[["glutes","primary",1],["hamstrings","secondary",0.5],["transverse_abdominis","secondary",0.5]]}'),
  ('{"slug":"bodyweight_hip_hinge","name":"Bodyweight Hip Hinge","family":"hip_hinge","tracking":"reps","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Push the hips backward with a slight knee bend and return by driving the hips forward.","sources":["https://www.cntw.nhs.uk/wp-content/uploads/2020/01/NHS-HOW-Fit-Leaflet-Design-Generic.pdf"],"muscles":[["hamstrings","primary",1],["glutes","secondary",0.5],["spinal_erectors","secondary",0.5]]}'),
  ('{"slug":"split_stance_hip_hinge","name":"Split-stance Hip Hinge","family":"hip_hinge","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Use a short split stance, bias the front leg, and hinge at the hips without turning the pelvis.","sources":["https://www.acefitness.org/continuing-education/certified/august-2026/9176/beyond-tight-hip-flexors-a-more-complete-approach-to-hip-pain/"],"muscles":[["hamstrings","primary",1],["glutes","secondary",0.5],["spinal_erectors","secondary",0.5]]}'),

  ('{"slug":"supine_static_quad_set","name":"Supine Static Quad Set","family":"knee_extension","tracking":"duration_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"With the leg straight, tighten the thigh and press the back of the knee into the supporting surface.","sources":["https://www.leedsth.nhs.uk/patients/resources/knee-exercises/"],"muscles":[["quads","primary",1],["quads_vastus_medialis","secondary",0.5]]}'),
  ('{"slug":"self_resisted_knee_extension_isometric","name":"Self-resisted Knee-extension Isometric","family":"knee_extension","tracking":"duration_each_side","equipment":["chair"],"options":[["chair"]],"cue":"While seated, press one lower leg forward against the other leg with equal force so neither knee moves.","sources":["https://www.leedsth.nhs.uk/patients/staying-well/shape-up-for-surgery/your-surgery/knee-ligament-surgery/exercises/"],"muscles":[["quads","primary",1],["quads_vastus_intermedius","secondary",0.5]]}'),
  ('{"slug":"supine_active_knee_flexion","name":"Supine Active Knee Flexion","family":"knee_flexion","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Slide the heel away, then use the back of the thigh to pull the foot toward the buttock.","sources":["https://www.southtees.nhs.uk/resources/active-knee-flexion/"],"muscles":[["hamstrings","primary",1],["hamstrings_semitendinosus","secondary",0.5]]}'),
  ('{"slug":"seated_isometric_hamstring_curl","name":"Seated Isometric Hamstring Curl","family":"knee_flexion","tracking":"duration_each_side","equipment":["chair"],"options":[["chair"]],"cue":"Sit with one knee bent and pull that heel backward against the opposite fixed leg without movement.","sources":["https://www.southtees.nhs.uk/resources/isometric-hamstrings/"],"muscles":[["hamstrings","primary",1],["hamstrings_biceps_femoris","secondary",0.5]]}'),
  ('{"slug":"bodyweight_reverse_lunge","name":"Bodyweight Reverse Lunge","family":"lunge_split_squat","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Step one foot backward, lower both knees with control, and drive through the front foot to return.","sources":["https://www.acefitness.org/resources/pros/expert-articles/9158/ankles-knees-and-hips-10-joint-friendly-exercises-for-the-lower-extremity/"],"muscles":[["quads","primary",1],["glutes","secondary",0.5],["hamstrings","secondary",0.5]]}'),
  ('{"slug":"bodyweight_split_squat","name":"Bodyweight Split Squat","family":"lunge_split_squat","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Hold a stationary split stance, lower the back knee under control, and drive through the front mid-foot to stand.","sources":["https://www.nasm.org/resource-center/blog/squat-alternatives"],"muscles":[["quads","primary",1],["glutes","secondary",0.5],["hamstrings","secondary",0.5]]}'),
  ('{"slug":"wall_sit","name":"Wall Sit","family":"squat","tracking":"duration","equipment":["wall"],"options":[["wall"]],"cue":"Slide down a wall to a controlled squat depth and hold with the knees tracking over the toes.","sources":["https://www.nasm.org/resource-center/blog/training/wall-sits"],"muscles":[["quads","primary",1],["glutes","secondary",0.5],["core","secondary",0.5]]}'),
  ('{"slug":"lateral_step_up","name":"Lateral Step-up","family":"step_up","tracking":"reps_each_side","equipment":["step"],"options":[["step"]],"cue":"Stand side-on to a sturdy step, place the near foot on it, and rise without pushing off the floor foot.","sources":["https://www.acefitness.org/certifiednewsarticle/1159/a-commonsense-approach-to-exercise-following-iliotibial-band-syndrome/"],"muscles":[["glutes","primary",1],["quads","secondary",0.5],["glute_med_min","secondary",0.5]]}'),
  ('{"slug":"toes_to_bar","name":"Toes-to-bar","family":"hanging_leg_raise","tracking":"reps","equipment":["pull_up_bar"],"options":[["pull_up_bar"]],"cue":"Hang without swinging and raise the straight legs toward the bar by curling the pelvis upward.","sources":["https://www.nasm.org/resource-center/blog/training/best-abs-exercises"],"muscles":[["rectus_abdominis","primary",1],["hip_flexors","secondary",0.5],["obliques","secondary",0.5]]}'),

  ('{"slug":"floor_clamshell","name":"Floor Clamshell","family":"hip_external_rotation","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Lie on the side with knees bent and lift the upper knee while the feet stay together and pelvis stays still.","sources":["https://www.dynamichealth.nhs.uk/help-and-advice/osteoarthritis-oa/"],"muscles":[["glute_med_min","primary",1],["glutes","secondary",0.5]]}'),
  ('{"slug":"standing_clam","name":"Supported Standing Clam","family":"hip_external_rotation","tracking":"reps_each_side","equipment":["chair"],"options":[["chair"],["stable_counter"]],"cue":"Hold stable support, place one foot against the opposite knee, and rotate the bent knee outward without turning the trunk.","sources":["https://www.dynamichealth.nhs.uk/help-and-advice/osteoarthritis-oa/"],"muscles":[["glute_med_min","primary",1],["glutes","secondary",0.5],["core","secondary",0.5]]}'),

  ('{"slug":"pogo_hop","name":"Two-leg Pogo Hop","family":"calf_plyometric","tracking":"reps","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Keep the legs nearly straight and make quick low hops from the balls of both feet.","sources":["https://www.acefitness.org/cp/pdfs/FitnessMatters/Sept07.pdf"],"muscles":[["calves","primary",1],["quads","secondary",0.5]]}'),
  ('{"slug":"single_leg_pogo_hop","name":"Single-leg Pogo Hop","family":"calf_plyometric","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Hop in place on one foot with short ground contacts and controlled quiet landings.","sources":["https://www.acefitness.org/resources/pros/expert-articles/5021/youth-fitness-the-abcs-of-physical-activity/"],"muscles":[["calves","primary",1],["glute_med_min","secondary",0.5],["quads","secondary",0.5]]}'),
  ('{"slug":"single_leg_lateral_hop","name":"Single-leg Lateral Hop","family":"calf_plyometric","tracking":"reps_each_side","equipment":["bodyweight"],"options":[["bodyweight"]],"cue":"Hop side to side on one foot over a small imaginary line and stabilize each landing.","sources":["https://www.acefitness.org/resources/everyone/blog/5059/youth-fitness-training-specificity-basketball/"],"muscles":[["calves","primary",1],["glute_med_min","secondary",0.5],["quads","secondary",0.5]]}');

do $$
begin
  if (select count(*) from lower_strength_additions) <> 33 then
    raise exception 'Expected 33 lower-body and core strength catalog rows';
  end if;

  if exists (
    select 1
    from lower_strength_additions addition
    cross join lateral jsonb_array_elements(addition.entry->'muscles') muscle
    left join public.muscle_groups existing on existing.slug = muscle->>0
    where existing.id is null
  ) then
    raise exception 'A lower-strength anatomy target does not resolve';
  end if;

  if exists (
    select 1 from lower_strength_additions
    where jsonb_array_length(entry->'sources') = 0
       or jsonb_array_length(jsonb_build_array(entry->>'cue')) = 0
       or jsonb_array_length(entry->'options') = 0
  ) then
    raise exception 'A lower-strength row lacks a source, cue, or equipment option';
  end if;
end;
$$;

insert into public.exercises (
  slug, name, movement_pattern, equipment, is_bodyweight, aliases, tags,
  media, contraindications, is_active, category, tracking_mode, instructions,
  source_urls, review_status, catalog_notes, replacement_family,
  equipment_options, variant_group, replacement_status, replacement_reason
)
select
  entry->>'slug',
  entry->>'name',
  entry->>'family',
  (
    select jsonb_agg(distinct equipment_item)
    from jsonb_array_elements(entry->'options') option
    cross join lateral jsonb_array_elements(option) equipment_item
  ),
  coalesce((entry->>'bodyweight')::boolean, true),
  '[]'::jsonb,
  jsonb_build_array('strength', entry->>'family'),
  '{}'::jsonb,
  '[]'::jsonb,
  true,
  'strength',
  entry->>'tracking',
  jsonb_build_array(entry->>'cue'),
  entry->'sources',
  'reviewed',
  'Source-backed general strength variation. Anatomy weights are qualitative legacy heuristics. Replacement-family membership does not assert clinical safety or an equivalent load, range, impact, difficulty, or prescription.',
  entry->>'family',
  entry->'options',
  entry->>'slug',
  'eligible',
  null
from lower_strength_additions
on conflict (slug) do update set
  name = excluded.name,
  movement_pattern = excluded.movement_pattern,
  equipment = excluded.equipment,
  is_bodyweight = excluded.is_bodyweight,
  tags = excluded.tags,
  is_active = excluded.is_active,
  category = excluded.category,
  tracking_mode = excluded.tracking_mode,
  instructions = excluded.instructions,
  source_urls = excluded.source_urls,
  review_status = excluded.review_status,
  catalog_notes = excluded.catalog_notes,
  replacement_family = excluded.replacement_family,
  equipment_options = excluded.equipment_options,
  variant_group = excluded.variant_group,
  replacement_status = excluded.replacement_status,
  replacement_reason = excluded.replacement_reason;

delete from public.exercise_muscle_map mapping
using public.exercises exercise, lower_strength_additions addition
where mapping.exercise_id = exercise.id
  and exercise.slug = addition.entry->>'slug';

insert into public.exercise_muscle_map (
  exercise_id, muscle_group_id, role, contribution
)
select
  exercise.id,
  muscle_group.id,
  muscle->>1,
  (muscle->>2)::numeric
from lower_strength_additions addition
join public.exercises exercise on exercise.slug = addition.entry->>'slug'
cross join lateral jsonb_array_elements(addition.entry->'muscles') muscle
join public.muscle_groups muscle_group on muscle_group.slug = muscle->>0;

-- Enforce the migration's contract independently of later requirement rows:
-- every targeted family/profile pair has either zero physical candidates or
-- at least three distinct eligible variants.
do $$
declare
  shortfall record;
begin
  with profiles(slug, inventory) as (
    values
      ('home_bodyweight', '["bodyweight","chair","wall","table","doorway","stable_counter"]'::jsonb),
      ('home_band', '["bodyweight","chair","wall","table","doorway","stable_counter","band","anchor","high_anchor"]'::jsonb),
      ('home_dumbbell', '["bodyweight","chair","wall","table","doorway","stable_counter","dumbbell","bench","step"]'::jsonb),
      ('gym', '["bodyweight","chair","wall","table","doorway","stable_counter","band","anchor","high_anchor","dumbbell","bench","adjustable_bench","preacher_bench","step","barbell","rack","cable","machine","kettlebell","plate","pull_up_bar","ankle_weight","sliders","sliding_surface","nordic_bench","leg_extension_machine","lying_leg_curl_machine","seated_leg_curl_machine","seated_calf_machine","standing_calf_machine","donkey_calf_machine","leg_press_machine","hip_abduction_machine","hip_adduction_machine","hip_thrust_machine"]'::jsonb)
  ),
  families(family) as (
    values
      ('ankle_dorsiflexion'), ('anti_extension'),
      ('anti_lateral_flexion'), ('anti_rotation'),
      ('calf_raise_bent_knee'), ('calf_raise_straight_knee'),
      ('hip_abduction'), ('hip_adduction'), ('hip_bridge'), ('hip_hinge'),
      ('knee_extension'), ('knee_flexion'), ('lunge_split_squat'),
      ('squat'), ('step_up'), ('hanging_leg_raise'),
      ('hip_external_rotation'), ('calf_plyometric')
  ),
  coverage as (
    select
      family.family,
      profile.slug,
      count(distinct coalesce(exercise.variant_group, exercise.slug)) filter (
        where exercise.id is not null
      ) as physical_variants,
      count(distinct coalesce(exercise.variant_group, exercise.slug)) filter (
        where exercise.id is not null
          and exercise.replacement_status = 'eligible'
      ) as eligible_variants
    from families family
    cross join profiles profile
    left join public.exercises exercise
      on exercise.is_active
     and exercise.category = 'strength'
     and exercise.replacement_family = family.family
     and exercise.equipment_options <> '[]'::jsonb
     and exists (
       select 1
       from jsonb_array_elements(exercise.equipment_options) option
       where not exists (
         select 1
         from jsonb_array_elements_text(option) requirement
         where not (profile.inventory ? requirement)
       )
     )
    group by family.family, profile.slug
  )
  select * into shortfall
  from coverage
  where physical_variants between 1 and 2
     or (physical_variants >= 3 and eligible_variants < 3)
  limit 1;

  if found then
    raise exception 'Lower-strength replacement shortfall: family %, profile %, physical %, eligible %',
      shortfall.family, shortfall.slug,
      shortfall.physical_variants, shortfall.eligible_variants;
  end if;
end;
$$;

commit;
