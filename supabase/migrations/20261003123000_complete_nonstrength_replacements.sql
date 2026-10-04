-- Complete the curated non-strength replacement families with source-backed,
-- meaningfully different positions, supports, or movement demands.
-- These rows are catalog candidates only: they do not assert injury safety,
-- clinical suitability, or equivalent dose, range, intensity, or difficulty.
begin;

-- Imported explicit IDs can leave a serial counter behind the table. This
-- migration inserts with default IDs, so repair the counter first.
select setval(
  pg_get_serial_sequence('public.exercises', 'id'),
  greatest(
    (select coalesce(max(id), 1) from public.exercises),
    (select last_value from public.exercises_id_seq)
  ),
  true
);

create temporary table nonstrength_additions (
  slug text primary key,
  name text not null,
  category text not null,
  movement_pattern text not null,
  tracking_mode text not null,
  equipment jsonb not null,
  is_bodyweight boolean not null,
  instructions jsonb not null,
  source_urls jsonb not null,
  replacement_family text not null,
  equipment_options jsonb not null,
  variant_group text not null,
  muscles jsonb not null
) on commit drop;

insert into nonstrength_additions (
  slug, name, category, movement_pattern, tracking_mode, equipment,
  is_bodyweight, instructions, source_urls, replacement_family,
  equipment_options, variant_group, muscles
)
values
  -- Pilates: two independent additions for every one-variant family.
  (
    'pilates_one_leg_circle', 'Pilates One-leg Circle', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["From tabletop, trace a small circle with one knee while keeping the pelvis level."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'anti_rotation', '[["bodyweight"]]', 'pilates_one_leg_circle',
    '[{"muscle":"transverse_abdominis","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0},{"muscle":"hip_flexors","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_superman', 'Pilates Superman', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["From hands and knees, reach one arm and the opposite leg while keeping the trunk steady."]',
    '["https://www.stgeorges.nhs.uk/wp-content/uploads/2026/04/HONC_INPT_01.pdf"]',
    'anti_rotation', '[["bodyweight"]]', 'pilates_superman',
    '[{"muscle":"transverse_abdominis","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0},{"muscle":"glutes","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_side_leg_circle', 'Pilates Side-lying Leg Circle', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["From side-lying, hold the upper leg slightly raised and draw a small controlled circle."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'hip_abduction', '[["bodyweight"]]', 'pilates_side_leg_circle',
    '[{"muscle":"glute_med_min","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_side_kick', 'Pilates Side Kick', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["Keep the upper leg at hip height and move it forward and back without rolling the pelvis."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'hip_abduction', '[["bodyweight"]]', 'pilates_side_kick',
    '[{"muscle":"glute_med_min","role":"primary","contribution":0},{"muscle":"glutes","role":"secondary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_bridge_hip_drops', 'Pilates Bridge Hip Drops', 'pilates', 'pilates',
    'reps', '["bodyweight"]', true,
    '["Hold a shoulder bridge, lower the pelvis slightly, then lift it again with control."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'hip_bridge', '[["bodyweight"]]', 'pilates_bridge_hip_drops',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"hamstrings","role":"secondary","contribution":0},{"muscle":"abdominals","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_bridge_march', 'Pilates Bridge March', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["Hold a shoulder bridge and float one foot at a time without letting the hips rotate."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'hip_bridge', '[["bodyweight"]]', 'pilates_bridge_march',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"hamstrings","role":"secondary","contribution":0},{"muscle":"transverse_abdominis","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_clam_leg_extension', 'Pilates Clam with Leg Extension', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["Open the upper knee from a clam, straighten that knee, then return without rolling backward."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'hip_external_rotation', '[["bodyweight"]]', 'pilates_clam_leg_extension',
    '[{"muscle":"glute_med_min","role":"primary","contribution":0},{"muscle":"glutes","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_side_lying_hip_rotation', 'Pilates Side-lying Hip Rotation', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["Raise the straight upper leg slightly and rotate the toes up and down without moving the pelvis."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'hip_external_rotation', '[["bodyweight"]]', 'pilates_side_lying_hip_rotation',
    '[{"muscle":"glute_med_min","role":"primary","contribution":0},{"muscle":"glutes","role":"secondary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_four_point_pelvic_tilt', 'Pilates Four-point Pelvic Tilt', 'pilates', 'pilates',
    'reps', '["bodyweight"]', true,
    '["From hands and knees, slowly tuck and untuck the pelvis while the spine follows comfortably."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'pelvic_control', '[["bodyweight"]]', 'pilates_four_point_pelvic_tilt',
    '[{"muscle":"abdominals","role":"primary","contribution":0},{"muscle":"spinal_erectors","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_seated_pelvic_tilt', 'Pilates Seated Pelvic Tilt', 'pilates', 'pilates',
    'reps', '["chair"]', true,
    '["Sit tall and slowly tip the pelvis forward and backward through a comfortable range."]',
    '["https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/total-hip-replacement-exercise-pack"]',
    'pelvic_control', '[["chair"]]', 'pilates_seated_pelvic_tilt',
    '[{"muscle":"abdominals","role":"primary","contribution":0},{"muscle":"spinal_erectors","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_oblique_curl_up', 'Pilates Oblique Curl-up', 'pilates', 'pilates',
    'reps_each_side', '["bodyweight"]', true,
    '["Lift the shoulder blades in a small curl-up, rotate gently to one side, then lower with control."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'trunk_flexion', '[["bodyweight"]]', 'pilates_oblique_curl_up',
    '[{"muscle":"abdominals","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0}]'
  ),
  (
    'pilates_tabletop_curl_up', 'Pilates Tabletop Curl-up', 'pilates', 'pilates',
    'reps', '["bodyweight"]', true,
    '["Hold one leg in tabletop and make a small curl-up without pulling on the neck."]',
    '["https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4"]',
    'trunk_flexion', '[["bodyweight"]]', 'pilates_tabletop_curl_up',
    '[{"muscle":"abdominals","role":"primary","contribution":0},{"muscle":"transverse_abdominis","role":"secondary","contribution":0},{"muscle":"hip_flexors","role":"secondary","contribution":0}]'
  ),

  -- Balance: static reach and posture variants plus backward gait practice.
  (
    'single_leg_clock_reach', 'Single-leg Clock Reach', 'balance', 'stability',
    'reps_each_side', '["bodyweight","chair"]', true,
    '["Stand near sturdy support and tap the free foot forward, sideways, and behind while staying balanced."]',
    '["https://www.kingstonandrichmond.nhs.uk/patients-and-families/patient-leaflets/home-exercise-programme-falls-prevention"]',
    'single_leg_balance', '[["bodyweight"],["chair"]]', 'single_leg_clock_reach',
    '[{"muscle":"glute_med_min","role":"primary","contribution":0},{"muscle":"calves","role":"secondary","contribution":0},{"muscle":"quads","role":"secondary","contribution":0}]'
  ),
  (
    'tree_pose_balance', 'Tree-pose Balance', 'balance', 'stability',
    'duration_each_side', '["bodyweight"]', true,
    '["Balance on one leg with the other foot placed lightly against the standing leg at a comfortable height."]',
    '["https://www.stgeorges.nhs.uk/wp-content/uploads/2026/04/HONC_INPT_01.pdf"]',
    'single_leg_balance', '[["bodyweight"]]', 'tree_pose_balance',
    '[{"muscle":"glute_med_min","role":"primary","contribution":0},{"muscle":"calves","role":"secondary","contribution":0},{"muscle":"quads","role":"secondary","contribution":0}]'
  ),
  (
    'backward_walking_balance', 'Backward Walking Balance', 'balance', 'stability',
    'reps', '["bodyweight"]', true,
    '["Walk backward slowly along a clear straight path while maintaining an upright posture."]',
    '["https://www.nbt.nhs.uk/our-services/a-z-services/physiotherapy/specialist-physiotherapy-service/therapy-erehab-video-resources/therapy-erehab-dynamic-balance"]',
    'walking_balance', '[["bodyweight"]]', 'backward_walking_balance',
    '[{"muscle":"calves","role":"primary","contribution":0},{"muscle":"glute_med_min","role":"secondary","contribution":0},{"muscle":"quads","role":"secondary","contribution":0}]'
  ),

  -- Mobility: household-supported shoulder, hip-rotation, and thoracic options.
  (
    'shoulder_table_slide', 'Shoulder Table Slide', 'mobility', 'mobility',
    'reps_each_side', '["table"]', true,
    '["Rest the hand on a smooth cloth and slide it forward across a table through a comfortable range."]',
    '["https://www.leedsth.nhs.uk/services/fracture-clinic/virtual/arm/acj/phase-1/"]',
    'shoulder_mobility', '[["table"]]', 'shoulder_table_slide',
    '[{"muscle":"delts","role":"primary","contribution":0},{"muscle":"rotator_cuff","role":"secondary","contribution":0}]'
  ),
  (
    'shoulder_wall_slide_mobility', 'Shoulder Wall Slide', 'mobility', 'mobility',
    'reps', '["wall"]', true,
    '["Face a smooth wall and slide both hands upward without shrugging, then return slowly."]',
    '["https://www.leedsth.nhs.uk/patients/resources/anterior-shoulder-dislocation-without-bony-injury/"]',
    'shoulder_mobility', '[["wall"]]', 'shoulder_wall_slide_mobility',
    '[{"muscle":"delts","role":"primary","contribution":0},{"muscle":"rotator_cuff","role":"secondary","contribution":0},{"muscle":"serratus_anterior","role":"secondary","contribution":0}]'
  ),
  (
    'crook_lying_hip_rotation', 'Crook-lying Hip Rotation', 'mobility', 'mobility',
    'reps_each_side', '["bodyweight"]', true,
    '["Lie with knees bent and let one knee move outward while the opposite leg and pelvis stay still."]',
    '["https://www.yorkhospitals.nhs.uk/seecmsfile/?id=7235"]',
    'hip_rotation_mobility', '[["bodyweight"]]', 'crook_lying_hip_rotation',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"adductors","role":"secondary","contribution":0}]'
  ),
  (
    'chair_supported_hip_rotation', 'Chair-supported Hip Rotation', 'mobility', 'mobility',
    'reps_each_side', '["chair"]', true,
    '["Rest one knee on a sturdy chair and sweep the lower leg across and back without moving the pelvis."]',
    '["https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/total-hip-replacement-exercise-pack"]',
    'hip_rotation_mobility', '[["chair"]]', 'chair_supported_hip_rotation',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"adductors","role":"secondary","contribution":0},{"muscle":"hip_flexors","role":"secondary","contribution":0}]'
  ),
  (
    'standing_supported_hip_rotation', 'Standing Supported Hip Rotation', 'mobility', 'mobility',
    'reps_each_side', '["bodyweight","chair"]', true,
    '["Hold a stable support, lift one foot, and slowly move the knee outward before returning to center. Keep the pelvis facing forward."]',
    '["https://www.cntw.nhs.uk/wp-content/uploads/2020/01/HowFit-Leaflet-NclNTGH-version.pdf"]',
    'hip_rotation_mobility', '[["chair"],["wall"],["stable_counter"]]', 'standing_supported_hip_rotation',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"glute_med_min","role":"secondary","contribution":0},{"muscle":"core","role":"secondary","contribution":0}]'
  ),
  (
    'seated_thoracic_rotation', 'Seated Thoracic Rotation', 'mobility', 'mobility',
    'reps_each_side', '["chair"]', true,
    '["Sit upright with arms crossed and rotate the upper trunk without lifting from the chair."]',
    '["https://www.cuh.nhs.uk/patient-information/thoracic-spine-exercises/"]',
    'thoracic_mobility', '[["chair"]]', 'seated_thoracic_rotation',
    '[{"muscle":"spinal_erectors_thoracic","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0}]'
  ),
  (
    'quadruped_thoracic_rotation', 'Quadruped Thoracic Rotation', 'mobility', 'mobility',
    'reps_each_side', '["bodyweight"]', true,
    '["From hands and knees, lift one arm sideways and let the upper trunk rotate as your eyes follow."]',
    '["https://www.cuh.nhs.uk/patient-information/thoracic-spine-exercises/"]',
    'thoracic_mobility', '[["bodyweight"]]', 'quadruped_thoracic_rotation',
    '[{"muscle":"spinal_erectors_thoracic","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0},{"muscle":"traps_mid_lower","role":"secondary","contribution":0}]'
  ),
  (
    'open_book_thoracic_rotation', 'Open-book Thoracic Rotation', 'mobility', 'mobility',
    'reps_each_side', '["bodyweight"]', true,
    '["From side-lying with knees together, arc the top arm behind you while following it with your eyes."]',
    '["https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/"]',
    'thoracic_mobility', '[["bodyweight"]]', 'open_book_thoracic_rotation',
    '[{"muscle":"spinal_erectors_thoracic","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0},{"muscle":"chest","role":"secondary","contribution":0}]'
  ),

  -- Recovery: tool-specific glute self-massage variants. Household profiles
  -- without either tool remain explicitly unsupported rather than being padded.
  (
    'foam_roller_glute_release', 'Foam-roller Glute Release', 'recovery', 'soft_tissue',
    'duration_each_side', '["foam_roller"]', false,
    '["Sit on the roller over one rear hip, cross that ankle over the other thigh, and roll slowly without crossing bony areas."]',
    '["https://www.nasm.org/docs/default-source/pdf/nasm-guide-to-foam-rolling.pdf","https://www.acefitness.org/resources/pros/expert-articles/5895/recover-faster-and-more-effectively-with-these-foam-roller-moves/"]',
    'glute_soft_tissue', '[["foam_roller"]]', 'foam_roller_glute_release',
    '[{"muscle":"glutes","role":"primary","contribution":0}]'
  ),
  (
    'wall_ball_glute_release', 'Wall Ball Glute Release', 'recovery', 'soft_tissue',
    'duration_each_side', '["lacrosse_ball","wall"]', false,
    '["Place the ball between a wall and the glute, lean gently into it, and move slowly around soft tissue only."]',
    '["https://documents.ucr.edu/HR-Wellness/fswp-move-well-self-myofascial-released-ball.pdf"]',
    'glute_soft_tissue', '[["lacrosse_ball","wall"]]', 'wall_ball_glute_release',
    '[{"muscle":"glutes","role":"primary","contribution":0}]'
  ),

  -- Stretching: three household-available positions or support patterns per
  -- family; the existing stick shoulder stretch remains an additional option.
  (
    'unsupported_standing_calf_stretch', 'Unsupported Standing Calf Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Use a staggered stance, keep the rear knee straight and heel down, and lean forward without bouncing."]',
    '["https://www.worcsacute.nhs.uk/documents/documents/patient-information-leaflets-a-z/supported-home-based-exercise-programme-for-intermittent-claudication/?layout=file"]',
    'calf_stretch_straight_knee', '[["bodyweight"]]', 'unsupported_standing_calf_stretch',
    '[{"muscle":"calves_gastrocnemius","role":"primary","contribution":0},{"muscle":"calves_soleus","role":"secondary","contribution":0}]'
  ),
  (
    'long_sit_active_calf_stretch', 'Long-sit Active Calf Stretch', 'stretching', 'stretching',
    'reps_each_side', '["bodyweight"]', true,
    '["Sit with the knee straight and slowly draw the toes toward the shin, pausing at a comfortable calf stretch."]',
    '["https://www.sfh-tr.nhs.uk/patients-and-visiting/patient-information-leaflets/musculoskeletal-msk/achilles-tendinopathy/"]',
    'calf_stretch_straight_knee', '[["bodyweight"]]', 'long_sit_active_calf_stretch',
    '[{"muscle":"calves_gastrocnemius","role":"primary","contribution":0},{"muscle":"calves_soleus","role":"secondary","contribution":0}]'
  ),
  (
    'knee_to_wall_calf_stretch', 'Knee-to-wall Calf Stretch', 'stretching', 'stretching',
    'duration_each_side', '["wall"]', true,
    '["Keep the whole front foot down and guide its bent knee toward the wall without turning the hip."]',
    '["https://www.opalreturntowork.nhs.uk/exercises/knee-to-wall-stretch/"]',
    'calf_stretch_bent_knee', '[["wall"]]', 'knee_to_wall_calf_stretch',
    '[{"muscle":"calves_soleus","role":"primary","contribution":0}]'
  ),
  (
    'unsupported_bent_knee_calf_stretch', 'Unsupported Bent-knee Calf Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["In a short staggered stance, bend both knees while keeping the rear heel down and the torso upright."]',
    '["https://www.dbth.nhs.uk/wp-content/uploads/2025/12/Plantar-Fascitis-leaflet.pdf"]',
    'calf_stretch_bent_knee', '[["bodyweight"]]', 'unsupported_bent_knee_calf_stretch',
    '[{"muscle":"calves_soleus","role":"primary","contribution":0}]'
  ),
  (
    'corner_chest_stretch', 'Corner Chest Stretch', 'stretching', 'stretching',
    'duration', '["wall"]', true,
    '["Place both forearms on the two walls of a corner and lean the chest forward gently."]',
    '["https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/"]',
    'chest_stretch', '[["wall"]]', 'corner_chest_stretch',
    '[{"muscle":"chest","role":"primary","contribution":0},{"muscle":"delts_anterior","role":"secondary","contribution":0}]'
  ),
  (
    'seated_chest_stretch', 'Seated Chest Stretch', 'stretching', 'stretching',
    'duration', '["chair"]', true,
    '["Sit away from the chair back, draw the shoulders back and down, and open both arms while lifting the chest gently."]',
    '["https://www.nhs.uk/live-well/exercise/sitting-exercises/"]',
    'chest_stretch', '[["chair"]]', 'seated_chest_stretch',
    '[{"muscle":"chest","role":"primary","contribution":0},{"muscle":"delts_anterior","role":"secondary","contribution":0}]'
  ),
  (
    'seated_twisted_glute_stretch', 'Seated Twisted Glute Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Sit with one leg crossed over the other and draw that knee gently toward the opposite shoulder."]',
    '["https://www.cuh.nhs.uk/patient-information/stretches-for-the-hip/"]',
    'glute_stretch', '[["bodyweight"]]', 'seated_twisted_glute_stretch',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"obliques","role":"secondary","contribution":0}]'
  ),
  (
    'supine_figure_four_glute_stretch', 'Supine Figure-four Glute Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Cross one ankle over the opposite thigh and draw the uncrossed leg toward the chest."]',
    '["https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/"]',
    'glute_stretch', '[["bodyweight"]]', 'supine_figure_four_glute_stretch',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"glute_med_min","role":"secondary","contribution":0}]'
  ),
  (
    'standing_hamstring_stretch', 'Standing Hamstring Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Place one straight leg forward with its heel down and hinge at the hips over that leg."]',
    '["https://www.cuh.nhs.uk/patient-information/stretches-for-the-hip/"]',
    'hamstring_stretch', '[["bodyweight"]]', 'standing_hamstring_stretch',
    '[{"muscle":"hamstrings","role":"primary","contribution":0}]'
  ),
  (
    'prone_hip_flexor_stretch', 'Prone Hip-flexor Stretch', 'stretching', 'stretching',
    'duration', '["bodyweight"]', true,
    '["Lie face down and press up on the forearms while keeping the pelvis and legs relaxed on the floor."]',
    '["https://www.worcsacute.nhs.uk/documents/documents/patient-information-leaflets-a-z/3051-stretching-exercises-physiotherapy/"]',
    'hip_flexor_stretch', '[["bodyweight"]]', 'prone_hip_flexor_stretch',
    '[{"muscle":"hip_flexors","role":"primary","contribution":0},{"muscle":"quads_rectus_femoris","role":"secondary","contribution":0}]'
  ),
  (
    'prone_hip_internal_rotation_stretch', 'Prone Hip Internal-rotation Stretch', 'stretching', 'stretching',
    'reps_each_side', '["bodyweight"]', true,
    '["Lie face down with one knee bent to 90 degrees. Keep the pelvis flat, slowly let that foot move outward to rotate the hip inward, then return to center."]',
    '["https://www.massgeneral.org/assets/mgh/pdf/orthopaedics/sports-medicine/physical-therapy/mass-general-hip-exercises.pdf"]',
    'hip_rotation_stretch', '[["bodyweight"]]', 'prone_hip_internal_rotation_stretch',
    '[{"muscle":"glutes","role":"primary","contribution":0},{"muscle":"glute_med_min","role":"secondary","contribution":0},{"muscle":"adductors","role":"secondary","contribution":0}]'
  ),
  (
    'supine_bound_angle_hip_rotation_stretch', 'Supine Bound-angle Hip-rotation Stretch', 'stretching', 'stretching',
    'duration', '["bodyweight"]', true,
    '["Lie with the soles of the feet together and let both knees open outward without forcing them down."]',
    '["https://www.stgeorges.nhs.uk/wp-content/uploads/2026/04/HONC_INPT_01.pdf"]',
    'hip_rotation_stretch', '[["bodyweight"]]', 'supine_bound_angle_hip_rotation_stretch',
    '[{"muscle":"adductors","role":"primary","contribution":0},{"muscle":"glutes","role":"secondary","contribution":0}]'
  ),
  (
    'standing_crossed_forward_bend_outer_hip_stretch', 'Standing Crossed-leg Outer-hip Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Cross one foot over the other, keep both knees soft but straight, and hinge forward comfortably."]',
    '["https://www.kentcht.nhs.uk/leaflet/lower-limb-strengthening-activities/"]',
    'outer_hip_stretch', '[["bodyweight"]]', 'standing_crossed_forward_bend_outer_hip_stretch',
    '[{"muscle":"abductors_tfl","role":"primary","contribution":0},{"muscle":"glute_med_min","role":"secondary","contribution":0}]'
  ),
  (
    'supine_crossover_outer_hip_stretch', 'Supine Crossover Outer-hip Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Lie back, cross one bent leg over the straight leg, and guide the bent knee gently across."]',
    '["https://elht.nhs.uk/services/paediatric-physiotherapy/information-patients/toeing-and-out-toeing"]',
    'outer_hip_stretch', '[["bodyweight"]]', 'supine_crossover_outer_hip_stretch',
    '[{"muscle":"abductors_tfl","role":"primary","contribution":0},{"muscle":"glute_med_min","role":"secondary","contribution":0}]'
  ),
  (
    'sleeper_posterior_shoulder_stretch', 'Sleeper Posterior-shoulder Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Lie on the affected side with the lower shoulder and elbow at 90 degrees. Use the other hand to press the forearm down gently, stopping at a stretch behind the shoulder, and hold for the prescribed duration."]',
    '["https://msk-bexley.nhs.uk/conditions/shoulder-pain/frozen-shoulder"]',
    'posterior_shoulder_stretch', '[["bodyweight"]]', 'sleeper_posterior_shoulder_stretch',
    '[{"muscle":"delts_posterior","role":"primary","contribution":0},{"muscle":"rotator_cuff","role":"secondary","contribution":0}]'
  ),
  (
    'wall_sleeper_posterior_shoulder_stretch', 'Wall Sleeper Posterior-shoulder Stretch', 'stretching', 'stretching',
    'duration_each_side', '["wall"]', true,
    '["Use a wall-supported sleeper position and rotate the forearm gently toward the wall without shrugging."]',
    '["https://elht.nhs.uk/services/integrated-msk-pain-and-rheumatology-service/patient-information/exercises/upper-limb-exercise-videos"]',
    'posterior_shoulder_stretch', '[["wall"]]', 'wall_sleeper_posterior_shoulder_stretch',
    '[{"muscle":"delts_posterior","role":"primary","contribution":0},{"muscle":"rotator_cuff","role":"secondary","contribution":0}]'
  ),
  (
    'prone_quadriceps_stretch', 'Prone Quadriceps Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Lie face down, bend one knee, and draw that heel gently toward the buttock without lifting the hip."]',
    '["https://www.cuh.nhs.uk/patient-information/stretches-for-the-hip/"]',
    'quadriceps_stretch', '[["bodyweight"]]', 'prone_quadriceps_stretch',
    '[{"muscle":"quads","role":"primary","contribution":0},{"muscle":"quads_rectus_femoris","role":"secondary","contribution":0}]'
  ),
  (
    'side_lying_quadriceps_stretch', 'Side-lying Quadriceps Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Lie on one side, bend the upper knee, and guide its heel toward the buttock while keeping the pelvis stacked."]',
    '["https://royalwolverhampton.nhs.uk/pil/quads-stretch-in-side-lying/"]',
    'quadriceps_stretch', '[["bodyweight"]]', 'side_lying_quadriceps_stretch',
    '[{"muscle":"quads","role":"primary","contribution":0},{"muscle":"quads_rectus_femoris","role":"secondary","contribution":0}]'
  ),
  (
    'self_assisted_shoulder_external_rotation_stretch', 'Self-assisted Shoulder External-rotation Stretch', 'stretching', 'stretching',
    'duration_each_side', '["bodyweight"]', true,
    '["Keep the elbow bent at the side and use the other hand at the wrist to guide the forearm outward."]',
    '["https://www.royalfree.nhs.uk/patients-and-visitors/patient-information-leaflets/soft-tissue-shoulder-injury/submit/43795"]',
    'shoulder_external_rotation_stretch', '[["bodyweight"]]', 'self_assisted_shoulder_external_rotation_stretch',
    '[{"muscle":"rotator_cuff","role":"primary","contribution":0},{"muscle":"chest","role":"secondary","contribution":0}]'
  ),
  (
    'supine_abducted_shoulder_external_rotation_stretch', 'Supine Abducted Shoulder External-rotation Stretch', 'stretching', 'stretching',
    'duration', '["bodyweight"]', true,
    '["Lie on your back with hands behind the neck or head and elbows pointing upward. Let both elbows open outward comfortably, hold for the prescribed duration, then return."]',
    '["https://www.ouh.nhs.uk/media/xuqnlojh/86594shoulder.pdf"]',
    'shoulder_external_rotation_stretch', '[["bodyweight"]]', 'supine_abducted_shoulder_external_rotation_stretch',
    '[{"muscle":"rotator_cuff","role":"primary","contribution":0},{"muscle":"chest","role":"secondary","contribution":0}]'
  ),
  (
    'wall_shoulder_external_rotation_stretch', 'Wall Shoulder External-rotation Stretch', 'stretching', 'stretching',
    'duration_each_side', '["wall"]', true,
    '["Place the wrist against a wall edge with the elbow bent at the side and turn the trunk away gently."]',
    '["https://here-msk.azurewebsites.net/wp-content/uploads/2020/06/genericexsgetmoving_shoulder.pdf"]',
    'shoulder_external_rotation_stretch', '[["wall"]]', 'wall_shoulder_external_rotation_stretch',
    '[{"muscle":"rotator_cuff","role":"primary","contribution":0},{"muscle":"chest","role":"secondary","contribution":0}]'
  ),
  (
    'prayer_wrist_flexor_stretch', 'Prayer Wrist-flexor Stretch', 'stretching', 'stretching',
    'duration', '["bodyweight"]', true,
    '["Press the palms together and lower the hands while letting the elbows move outward."]',
    '["https://www.dynamichealth.nhs.uk/help-and-advice/wrist-hand-and-thumb-pain/"]',
    'wrist_flexor_stretch', '[["bodyweight"]]', 'prayer_wrist_flexor_stretch',
    '[{"muscle":"forearms_flexors","role":"primary","contribution":0}]'
  ),
  (
    'tabletop_wrist_flexor_stretch', 'Tabletop Wrist-flexor Stretch', 'stretching', 'stretching',
    'duration_each_side', '["table"]', true,
    '["Place the palm flat on a table with the elbow straight and lean forward only as far as comfortable."]',
    '["https://www.cuh.nhs.uk/patient-information/wrist-range-of-movement-exercises/"]',
    'wrist_flexor_stretch', '[["table"]]', 'tabletop_wrist_flexor_stretch',
    '[{"muscle":"forearms_flexors","role":"primary","contribution":0}]'
  ),
  (
    'table_edge_wrist_extensor_stretch', 'Table-edge Wrist-extensor Stretch', 'stretching', 'stretching',
    'duration_each_side', '["table"]', true,
    '["Support the forearm palm-down over a table edge and use the other hand to guide the wrist toward the floor."]',
    '["https://www.worcsacute.nhs.uk/documents/documents/patient-information-leaflets-a-z/wrist-fracture/?layout=file"]',
    'wrist_extensor_stretch', '[["table"]]', 'table_edge_wrist_extensor_stretch',
    '[{"muscle":"forearms_extensors","role":"primary","contribution":0}]'
  ),
  (
    'clasped_hand_wrist_extensor_stretch', 'Clasped-hand Wrist-extensor Stretch', 'stretching', 'stretching',
    'duration', '["table"]', true,
    '["Clasp the hands with forearms supported and bend both wrists downward together over the table edge."]',
    '["https://www.cuh.nhs.uk/patient-information/wrist-range-of-movement-exercises/"]',
    'wrist_extensor_stretch', '[["table"]]', 'clasped_hand_wrist_extensor_stretch',
    '[{"muscle":"forearms_extensors","role":"primary","contribution":0}]'
  );

-- Fail rather than silently dropping an anatomy target if a prerequisite
-- muscle slug changes.
do $$
begin
  if (select count(*) from nonstrength_additions) <> 50 then
    raise exception 'Expected 50 non-strength catalog additions';
  end if;

  if exists (
    select 1
    from nonstrength_additions addition
    cross join lateral jsonb_array_elements(addition.muscles) muscle
    left join public.muscle_groups existing
      on existing.slug = muscle->>'muscle'
    where existing.id is null
  ) then
    raise exception 'A non-strength anatomy target does not resolve';
  end if;

  if exists (
    select 1
    from nonstrength_additions addition
    cross join lateral jsonb_array_elements(addition.muscles) muscle
    where (muscle->>'contribution')::numeric <> 0
  ) then
    raise exception 'Non-strength anatomy contributions must remain zero';
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
  slug,
  name,
  movement_pattern,
  equipment,
  is_bodyweight,
  '[]'::jsonb,
  jsonb_build_array(category, replacement_family),
  '{}'::jsonb,
  '[]'::jsonb,
  true,
  category,
  tracking_mode,
  instructions,
  source_urls,
  'reviewed',
  'Source-backed general catalog variation. Anatomy is qualitative, non-strength contribution is zero, and replacement-family membership does not assert clinical safety or an equivalent prescription.',
  replacement_family,
  equipment_options,
  variant_group,
  'eligible',
  null
from nonstrength_additions
on conflict (slug) do update set
  name = excluded.name,
  movement_pattern = excluded.movement_pattern,
  equipment = excluded.equipment,
  is_bodyweight = excluded.is_bodyweight,
  aliases = excluded.aliases,
  tags = excluded.tags,
  media = excluded.media,
  contraindications = excluded.contraindications,
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
using public.exercises exercise, nonstrength_additions addition
where mapping.exercise_id = exercise.id
  and exercise.slug = addition.slug;

insert into public.exercise_muscle_map (
  exercise_id, muscle_group_id, role, contribution
)
select
  exercise.id,
  muscle_group.id,
  muscle->>'role',
  (muscle->>'contribution')::numeric
from nonstrength_additions addition
join public.exercises exercise on exercise.slug = addition.slug
cross join lateral jsonb_array_elements(addition.muscles) muscle
join public.muscle_groups muscle_group
  on muscle_group.slug = muscle->>'muscle';

commit;
