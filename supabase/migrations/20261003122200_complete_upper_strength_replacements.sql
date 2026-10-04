-- Complete upper-body strength replacement pools with source-backed variants
-- that differ by support, joint position, resistance, or contraction type.
-- These are catalog candidates, not assertions of injury safety or equal dose.
begin;

select setval(
  pg_get_serial_sequence('public.exercises', 'id'),
  greatest(
    (select coalesce(max(id), 1) from public.exercises),
    (select last_value from public.exercises_id_seq)
  ),
  true
);

create temporary table upper_strength_additions (
  slug text primary key,
  name text not null,
  replacement_family text not null,
  movement_pattern text not null,
  tracking_mode text not null,
  equipment jsonb not null,
  is_bodyweight boolean not null,
  instructions jsonb not null,
  source_urls jsonb not null,
  equipment_options jsonb not null,
  variant_group text not null
) on commit drop;

insert into upper_strength_additions (
  slug, name, replacement_family, movement_pattern, tracking_mode,
  equipment, is_bodyweight, instructions, source_urls,
  equipment_options, variant_group
)
values
  -- Chest fly: floor support limits depth; the hold changes contraction type.
  (
    'dumbbell_floor_fly', 'Dumbbell Floor Fly', 'chest_fly',
    'horizontal_adduction', 'reps', '["dumbbell"]', false,
    '["Lie on the floor with elbows softly bent. Open the arms until the upper arms meet the floor, then bring the dumbbells together over the chest."]',
    '["https://www.acefitness.org/resources/pros/expert-articles/8972/be-a-chest-day-champion-an-evidence-based-approach-to-training-the-chest/"]',
    '[["dumbbell"]]', 'dumbbell_floor_fly'
  ),
  (
    'dumbbell_fly_isometric_hold', 'Dumbbell Fly Isometric Hold', 'chest_fly',
    'horizontal_adduction', 'duration', '["dumbbell","bench"]', false,
    '["Lie on a flat bench and hold the dumbbells with softly bent elbows at a controlled tested angle in the fly arc. Keep the arms still for six seconds, then return deliberately."]',
    '["https://www.asep.org/asep/asep/JEPonlineAPRIL2018_Reiser.pdf"]',
    '[["dumbbell","bench"]]', 'dumbbell_fly_isometric_hold'
  ),

  -- Dip: knee position and foot elevation materially change support and load.
  (
    'bent_knee_bench_dip', 'Bent-knee Bench Dip', 'dip',
    'dip', 'reps', '["bench"]', true,
    '["Support both hands on a stable bench with knees bent and feet planted. Bend and straighten the elbows while keeping the hips close to the bench."]',
    '["https://www.nasm.org/resource-center/exercise-library/bench-dips"]',
    '[["bench"]]', 'bent_knee_bench_dip'
  ),
  (
    'feet_elevated_bench_dip', 'Feet-elevated Bench Dip', 'dip',
    'dip', 'reps', '["bench","step"]', true,
    '["Support the hands on a stable bench and the feet on a stable step. Lower by bending the elbows, then press back to straight arms without moving the supports."]',
    '["https://www.nasm.org/resource-center/exercise-library/bench-dips"]',
    '[["bench","step"]]', 'feet_elevated_bench_dip'
  ),

  -- Elbow extension: high-anchor, hip-hinged, and dumbbell resistance paths.
  (
    'band_triceps_pushdown', 'High-anchor Band Triceps Pushdown', 'elbow_extension',
    'elbow_extension', 'reps', '["band","high_anchor"]', false,
    '["Face a rated high anchor with elbows held near the ribs. Straighten the elbows against the band and return with control."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band","high_anchor"]]', 'band_triceps_pushdown'
  ),
  (
    'band_triceps_kickback', 'Band Triceps Kickback', 'elbow_extension',
    'elbow_extension', 'reps_each_side', '["band"]', false,
    '["Stand on the band and hinge forward. Hold the upper arm beside the trunk, straighten the elbow behind you, then return slowly."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band"]]', 'band_triceps_kickback'
  ),
  (
    'dumbbell_triceps_kickback', 'Dumbbell Triceps Kickback', 'elbow_extension',
    'elbow_extension', 'reps_each_side', '["dumbbell","bench"]', false,
    '["Brace one hand on a bench, hold the upper arm beside the trunk, and straighten the loaded elbow without swinging the shoulder."]',
    '["https://www.acefitness.org/about-ace/press-room/press-releases/2718/american-council-on-exercise-study-highlights-most-effective-triceps-exercises/"]',
    '[["dumbbell","bench"]]', 'dumbbell_triceps_kickback'
  ),

  -- Elbow flexion: neutral and pronated grips are distinct from a supinated curl.
  (
    'band_hammer_curl', 'Band Hammer Curl', 'elbow_flexion',
    'elbow_flexion', 'reps', '["band"]', false,
    '["Stand on the band with palms facing each other. Keep the elbows steady while curling the hands toward the shoulders."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band"]]', 'band_hammer_curl'
  ),
  (
    'band_reverse_curl', 'Band Reverse Curl', 'elbow_flexion',
    'elbow_flexion', 'reps', '["band"]', false,
    '["Stand on the band with palms facing down. Curl without letting the wrists fold or the elbows travel forward."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band"]]', 'band_reverse_curl'
  ),

  -- Face pull: kneeling and supine support remove different sources of momentum.
  (
    'half_kneeling_cable_face_pull', 'Half-kneeling Cable Face Pull', 'face_pull',
    'horizontal_pull', 'reps', '["cable","rope_attachment"]', false,
    '["Set the rope near face height and take a half-kneeling stance. Pull toward the face with elbows high while keeping the trunk still."]',
    '["https://www.nasm.org/resource-center/exercise-library/face-pull","https://www.nsca.com/education/articles/kinetic-select/face-pull-machine/"]',
    '[["cable","rope_attachment"]]', 'half_kneeling_cable_face_pull'
  ),
  (
    'supine_cable_face_pull', 'Supine Cable Face Pull', 'face_pull',
    'horizontal_pull', 'reps', '["cable","rope_attachment","bench"]', false,
    '["Lie on a bench facing a cable set beyond the head. Pull the rope toward the forehead while the bench supports the trunk, then return under control."]',
    '["https://www.youtube.com/watch?v=1JyOgvHh2Ws","https://www.nsca.com/education/articles/kinetic-select/face-pull-machine/"]',
    '[["cable","rope_attachment","bench"]]', 'supine_cable_face_pull'
  ),

  -- Horizontal row: standing anchored resistance and plank support.
  (
    'split_stance_band_row', 'Split-stance Anchored Band Row', 'horizontal_row',
    'horizontal_pull', 'reps', '["band","anchor"]', false,
    '["Face a secure anchor in a split stance. Row both hands toward the ribs without leaning back, then extend the arms slowly."]',
    '["https://www.nasm.org/workout-exercise-guidance"]',
    '[["band","anchor"]]', 'split_stance_band_row'
  ),
  (
    'dumbbell_renegade_row', 'Dumbbell Renegade Row', 'horizontal_row',
    'horizontal_pull', 'reps_each_side', '["dumbbell"]', false,
    '["From a stable high plank on dumbbells, row one dumbbell toward the ribs while limiting trunk rotation. Alternate sides under control."]',
    '["https://www.acefitness.org/resources/everyone/exercise-library/355/renegade-row/"]',
    '[["dumbbell"]]', 'dumbbell_renegade_row'
  ),

  -- Lateral raise: bilateral versus seated support and side-lying resistance.
  (
    'bilateral_band_lateral_raise', 'Bilateral Band Lateral Raise', 'lateral_raise',
    'shoulder_abduction', 'reps', '["band"]', false,
    '["Stand on the center of the band and raise both arms out to the sides through a controlled range without shrugging."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band"]]', 'bilateral_band_lateral_raise'
  ),
  (
    'seated_band_lateral_raise', 'Seated Band Lateral Raise', 'lateral_raise',
    'shoulder_abduction', 'reps', '["band","chair"]', false,
    '["Sit on a chair with the band secured under the feet. Raise both arms sideways while keeping the trunk supported and still."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band","chair"]]', 'seated_band_lateral_raise'
  ),
  (
    'seated_dumbbell_lateral_raise', 'Seated Dumbbell Lateral Raise', 'lateral_raise',
    'shoulder_abduction', 'reps', '["dumbbell","chair"]', false,
    '["Sit tall with dumbbells at the sides. Raise both arms sideways without using leg drive, then lower with control."]',
    '["https://www.acefitness.org/resources/everyone/exercise-library/26/lateral-raise/"]',
    '[["dumbbell","chair"]]', 'seated_dumbbell_lateral_raise'
  ),
  (
    'side_lying_dumbbell_lateral_raise', 'Side-lying Dumbbell Lateral Raise', 'lateral_raise',
    'shoulder_abduction', 'reps_each_side', '["dumbbell","bench"]', false,
    '["Lie on one side on a bench and raise the upper dumbbell away from the thigh without rolling the trunk. Lower slowly."]',
    '["https://www.acefitness.org/resources/everyone/exercise-library/26/lateral-raise/"]',
    '[["dumbbell","bench"]]', 'side_lying_dumbbell_lateral_raise'
  ),

  -- Rear-delt fly: unsupported standing and chair-supported seated positions.
  (
    'standing_bent_over_dumbbell_reverse_fly', 'Standing Bent-over Dumbbell Reverse Fly', 'rear_delt_fly',
    'horizontal_abduction', 'reps', '["dumbbell"]', false,
    '["Hinge with a steady spine and softly bent elbows. Open both arms sideways, pause, and lower without changing the hip position."]',
    '["https://orthoinfo.aaos.org/globalassets/pdfs/2022-rotator-cuff-and-shoulder-conditioning-program.pdf"]',
    '[["dumbbell"]]', 'standing_bent_over_dumbbell_reverse_fly'
  ),
  (
    'seated_bent_over_dumbbell_reverse_fly', 'Seated Bent-over Dumbbell Reverse Fly', 'rear_delt_fly',
    'horizontal_abduction', 'reps', '["dumbbell","chair"]', false,
    '["Sit near the chair edge and hinge the trunk forward. Raise both dumbbells sideways while the lower body stays supported."]',
    '["https://www.acefitness.org/continuing-education/prosource/september-2014/4972/dynamite-delts-ace-research-identifies-top-shoulder-exercises/"]',
    '[["dumbbell","chair"]]', 'seated_bent_over_dumbbell_reverse_fly'
  ),

  -- Scapular elevation: seated dynamic work and a static loaded hold.
  (
    'seated_dumbbell_shrug', 'Seated Dumbbell Shrug', 'scapular_elevation',
    'scapular_elevation', 'reps', '["dumbbell","chair"]', false,
    '["Sit tall with dumbbells at the sides. Lift the shoulders straight upward, pause briefly, and lower without rolling them."]',
    '["https://14weeks.nchpad.org/videos.php?id=59&type=strength"]',
    '[["dumbbell","chair"]]', 'seated_dumbbell_shrug'
  ),
  (
    'seated_dumbbell_shrug_isometric_hold', 'Seated Dumbbell Shrug Isometric Hold', 'scapular_elevation',
    'scapular_elevation', 'duration', '["dumbbell","chair"]', false,
    '["Sit tall with dumbbells at the sides and lift the shoulders straight upward. Hold that position without rolling the shoulders, then lower deliberately."]',
    '["https://14weeks.nchpad.org/videos.php?id=59&type=strength"]',
    '[["dumbbell","chair"]]', 'seated_dumbbell_shrug_isometric_hold'
  ),

  -- Shoulder extension: cable constant resistance and a barbell pullover arc.
  (
    'cable_straight_arm_pulldown', 'Cable Straight-arm Pulldown', 'shoulder_extension',
    'shoulder_extension', 'reps', '["cable"]', false,
    '["Face a high cable with arms nearly straight. Pull the handle toward the thighs by moving at the shoulders while keeping the ribs controlled."]',
    '["https://www.acefitness.org/continuing-education/certified/june-2024/8648/short-on-time-try-reciprocal-superset-training/"]',
    '[["cable"]]', 'cable_straight_arm_pulldown'
  ),
  (
    'barbell_pullover', 'Barbell Pullover', 'shoulder_extension',
    'shoulder_extension', 'reps', '["barbell","bench"]', false,
    '["Lie across a bench holding a barbell above the chest. With softly bent elbows, move the bar behind the head through a controlled range and return."]',
    '["https://pubmed.ncbi.nlm.nih.gov/21975179/","https://www.mdpi.com/2076-3417/12/21/11138"]',
    '[["barbell","bench"]]', 'barbell_pullover'
  ),

  -- Rotator-cuff variants use a different shoulder angle or contraction.
  (
    'band_external_rotation_90_abduction', 'Band External Rotation at 90 Degrees', 'shoulder_external_rotation',
    'shoulder_external_rotation', 'reps_each_side', '["band","anchor"]', false,
    '["Anchor the band at shoulder height. Hold the upper arm at shoulder level with the elbow bent, then rotate the forearm backward without moving the elbow."]',
    '["https://www.massgeneral.org/assets/mgh/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-rotator-cuff-tear-small-to-medium-tear.pdf"]',
    '[["band","anchor"]]', 'band_external_rotation_90_abduction'
  ),
  (
    'band_external_rotation_isometric_hold', 'Band External-rotation Isometric Hold', 'shoulder_external_rotation',
    'shoulder_external_rotation', 'duration_each_side', '["band","anchor"]', false,
    '["With the elbow held at the side, rotate outward against the band to a controlled position. Hold the forearm still, then return slowly."]',
    '["https://www.uhs.nhs.uk/departments/trauma-and-orthopaedics/shoulders/patient-information/rotator-cuff-repair/rotator-cuff-repair-exercises"]',
    '[["band","anchor"]]', 'band_external_rotation_isometric_hold'
  ),
  (
    'prone_dumbbell_external_rotation_90_abduction', 'Prone Dumbbell External Rotation at 90 Degrees', 'shoulder_external_rotation',
    'shoulder_external_rotation', 'reps_each_side', '["dumbbell","bench"]', false,
    '["Lie face down with the upper arm supported at shoulder height and the forearm hanging. Keep the elbow bent and rotate the dumbbell upward until the hand is level with the elbow."]',
    '["https://www.massgeneral.org/assets/MGH/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-rotator-cuff-and-subscapularis.pdf"]',
    '[["dumbbell","bench"]]', 'prone_dumbbell_external_rotation_90_abduction'
  ),
  (
    'slow_lowering_side_lying_dumbbell_external_rotation', 'Slow-lowering Side-lying Dumbbell External Rotation', 'shoulder_external_rotation',
    'shoulder_external_rotation', 'reps_each_side', '["dumbbell"]', false,
    '["Use the free hand to help place the loaded forearm upright in side-lying. Remove the help and lower the forearm forward slowly while the working elbow stays supported."]',
    '["https://dynamichealth.nhs.uk/help-and-advice/shoulder-pain/"]',
    '[["dumbbell"]]', 'slow_lowering_side_lying_dumbbell_external_rotation'
  ),
  (
    'band_internal_rotation_90_abduction', 'Band Internal Rotation at 90 Degrees', 'shoulder_internal_rotation',
    'shoulder_internal_rotation', 'reps_each_side', '["band","anchor"]', false,
    '["Anchor the band behind you at shoulder height. Hold the upper arm at shoulder level with the elbow bent, then rotate the forearm forward without moving the elbow."]',
    '["https://www.massgeneral.org/assets/mgh/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-superior-labrum-anterior-and-posterior-slap.pdf"]',
    '[["band","anchor"]]', 'band_internal_rotation_90_abduction'
  ),
  (
    'band_internal_rotation_isometric_hold', 'Band Internal-rotation Isometric Hold', 'shoulder_internal_rotation',
    'shoulder_internal_rotation', 'duration_each_side', '["band","anchor"]', false,
    '["With the elbow held at the side, rotate inward against the band to a controlled position. Hold the forearm still, then return slowly."]',
    '["https://www.massgeneral.org/assets/mgh/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-rotator-cuff-tear-small-to-medium-tear.pdf"]',
    '[["band","anchor"]]', 'band_internal_rotation_isometric_hold'
  ),
  (
    'supine_dumbbell_internal_rotation_90_abduction', 'Supine Dumbbell Internal Rotation at 90 Degrees', 'shoulder_internal_rotation',
    'shoulder_internal_rotation', 'reps_each_side', '["dumbbell"]', false,
    '["Lie on the back with the upper arm supported at shoulder height and elbow bent. Begin with the forearm tilted toward the head-side floor, then rotate the loaded forearm toward vertical while the elbow stays planted."]',
    '["https://orthoinfo.aaos.org/globalassets/pdfs/2024-rotator-cuff-and-shoulder-conditioning-program.pdf"]',
    '[["dumbbell"]]', 'supine_dumbbell_internal_rotation_90_abduction'
  ),
  (
    'slow_lowering_side_lying_dumbbell_internal_rotation', 'Slow-lowering Side-lying Dumbbell Internal Rotation', 'shoulder_internal_rotation',
    'shoulder_internal_rotation', 'reps_each_side', '["dumbbell"]', false,
    '["Lie on the working side with the elbow bent and upper arm against the ribs. Rotate the dumbbell inward, then lower the forearm slowly through the return while the elbow stays supported."]',
    '["https://orthoinfo.aaos.org/globalassets/pdfs/2017-rehab_shoulder.pdf"]',
    '[["dumbbell"]]', 'slow_lowering_side_lying_dumbbell_internal_rotation'
  ),

  -- Upright row: seated support and an isometric contraction.
  (
    'seated_dumbbell_upright_row', 'Seated Dumbbell Upright Row', 'upright_row',
    'shoulder_abduction', 'reps', '["dumbbell","chair"]', false,
    '["Sit tall with dumbbells in front of the thighs. Draw the elbows upward while the trunk stays still, then lower under control."]',
    '["https://med.psu.edu/departments-faculty/cancer-institute/oncology-nutrition-exercise-one-group/exercise-videos"]',
    '[["dumbbell","chair"]]', 'seated_dumbbell_upright_row'
  ),
  (
    'single_arm_dumbbell_upright_row', 'Single-arm Dumbbell Upright Row', 'upright_row',
    'shoulder_abduction', 'reps_each_side', '["dumbbell"]', false,
    '["Stand tall with one dumbbell in front of the thigh. Lead with the elbow and draw the dumbbell toward the upper chest without leaning, then lower slowly."]',
    '["https://wodprep.com/wp-content/uploads/2023/05/WODprep-Sample-Programming-1.pdf","https://ocw.mit.edu/courses/pe-720-weight-training-spring-2006/pages/video/"]',
    '[["dumbbell"]]', 'single_arm_dumbbell_upright_row'
  ),

  -- Vertical press: kneeling or seated band support and strict dumbbell grips.
  (
    'half_kneeling_single_arm_band_press', 'Half-kneeling Single-arm Band Press', 'vertical_press',
    'vertical_press', 'reps_each_side', '["band"]', false,
    '["Kneel on one knee with the band secured under the rear knee or foot. Press one hand overhead while keeping the ribs and pelvis stacked."]',
    '["https://www.performancehealth.com/articles/theraband-high-resistance-band-5-exercises"]',
    '[["band"]]', 'half_kneeling_single_arm_band_press'
  ),
  (
    'seated_band_overhead_press', 'Seated Band Overhead Press', 'vertical_press',
    'vertical_press', 'reps', '["band","chair"]', false,
    '["Sit on a chair with the band secured under both feet. Press both hands overhead while the lower body stays supported."]',
    '["https://www.performancehealth.com/articles/theraband-high-resistance-band-5-exercises"]',
    '[["band","chair"]]', 'seated_band_overhead_press'
  ),
  (
    'seated_neutral_grip_dumbbell_press', 'Seated Neutral-grip Dumbbell Press', 'vertical_press',
    'vertical_press', 'reps', '["dumbbell","bench"]', false,
    '["Sit upright with palms facing each other and dumbbells at shoulder height. Press overhead without changing the neutral grip, then lower slowly."]',
    '["https://www.acefitness.org/resources/everyone/exercise-library/45/seated-overhead-press/"]',
    '[["dumbbell","bench"]]', 'seated_neutral_grip_dumbbell_press'
  ),
  (
    'standing_dumbbell_shoulder_press', 'Standing Dumbbell Shoulder Press', 'vertical_press',
    'vertical_press', 'reps', '["dumbbell"]', false,
    '["Stand with dumbbells at shoulder height and palms forward. Press overhead without leg drive, then return with the trunk steady."]',
    '["https://www.acefitness.org/resources/pros/expert-articles/5047/strength-training-workout-for-beginners/"]',
    '[["dumbbell"]]', 'standing_dumbbell_shoulder_press'
  ),

  -- Vertical pull: kneeling support and unilateral loading.
  (
    'half_kneeling_band_lat_pulldown', 'Half-kneeling Band Lat Pulldown', 'vertical_pull',
    'vertical_pull', 'reps', '["band","high_anchor"]', false,
    '["Kneel below a rated high anchor and pull both band ends toward the upper chest without leaning backward."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band","high_anchor"]]', 'half_kneeling_band_lat_pulldown'
  ),
  (
    'single_arm_band_lat_pulldown', 'Single-arm Band Lat Pulldown', 'vertical_pull',
    'vertical_pull', 'reps_each_side', '["band","high_anchor"]', false,
    '["Face a rated high anchor and pull one band end toward the same-side ribs while keeping the torso square. Return slowly."]',
    '["https://www.performancehealth.com/articles/33-theraband-resistance-band-exercises-to-do-at-home"]',
    '[["band","high_anchor"]]', 'single_arm_band_lat_pulldown'
  ),

  -- Wrist work: elbow position and eccentric-only lowering are distinct loads.
  (
    'straight_elbow_resisted_wrist_extension', 'Straight-elbow Resisted Wrist Extension', 'wrist_extension',
    'wrist_extension', 'reps_each_side', '["band","dumbbell","table"]', false,
    '["Support the straight forearm with the palm down and hand beyond the edge. Lift the back of the hand against a band or dumbbell, then lower slowly."]',
    '["https://msk-bexley.nhs.uk/conditions/elbow-pain/tennis-elbow"]',
    '[["band","table"],["dumbbell","table"]]', 'straight_elbow_resisted_wrist_extension'
  ),
  (
    'eccentric_resisted_wrist_extension', 'Eccentric Resisted Wrist Extension', 'wrist_extension',
    'wrist_extension', 'reps_each_side', '["band","dumbbell","table"]', false,
    '["Support the forearm palm-down. Use the other hand to lift the working hand, then remove the help and lower against the band or dumbbell for several seconds."]',
    '["https://www.leicspart.nhs.uk/wp-content/uploads/2026/06/LPT-CHSMSK17-Tennis-Elbow.pdf"]',
    '[["band","table"],["dumbbell","table"]]', 'eccentric_resisted_wrist_extension'
  ),
  (
    'straight_elbow_resisted_wrist_flexion', 'Straight-elbow Resisted Wrist Flexion', 'wrist_flexion',
    'wrist_flexion', 'reps_each_side', '["band","dumbbell","table"]', false,
    '["Support the straight forearm with the palm up and hand beyond the edge. Curl the palm toward the forearm against a band or dumbbell, then lower slowly."]',
    '["https://msk-bexley.nhs.uk/conditions/elbow-pain/tennis-elbow"]',
    '[["band","table"],["dumbbell","table"]]', 'straight_elbow_resisted_wrist_flexion'
  ),
  (
    'eccentric_resisted_wrist_flexion', 'Eccentric Resisted Wrist Flexion', 'wrist_flexion',
    'wrist_flexion', 'reps_each_side', '["band","dumbbell","table"]', false,
    '["Support the forearm palm-up. Use the other hand to lift the working hand, then remove the help and lower against the band or dumbbell for several seconds."]',
    '["https://dynamichealth.nhs.uk/help-and-advice/elbow-pain/"]',
    '[["band","table"],["dumbbell","table"]]', 'eccentric_resisted_wrist_flexion'
  ),

  -- Pending legacy classifications leave these families one variant short.
  (
    'forearm_wall_slide_with_lift_off', 'Forearm Wall Slide with Lift-off', 'scapular_upward_rotation',
    'scapular_upward_rotation', 'reps', '["wall"]', true,
    '["Place both forearms on a wall and slide them upward into a Y. Let the shoulder blades move outward, lift the forearms slightly from the wall, then return."]',
    '["https://dynamichealth.nhs.uk/help-and-advice/shoulder-pain/"]',
    '[["wall"]]', 'forearm_wall_slide_with_lift_off'
  ),
  (
    'seated_cable_scapular_retraction', 'Seated Cable Scapular Retraction', 'scapular_retraction',
    'scapular_retraction', 'reps', '["cable"]', false,
    '["Sit facing a cable with arms straight. Draw the shoulder blades toward each other without bending the elbows, then let them move forward under control."]',
    '["https://www.uhs.nhs.uk/departments/trauma-and-orthopaedics/shoulders/patient-information/rotator-cuff-repair/rotator-cuff-repair-exercises"]',
    '[["cable"]]', 'seated_cable_scapular_retraction'
  ),
  (
    'bent_over_barbell_scapular_retraction', 'Bent-over Barbell Scapular Retraction', 'scapular_retraction',
    'scapular_retraction', 'reps', '["barbell"]', false,
    '["Hold a stable hip hinge with the bar hanging below the shoulders and the elbows straight. Draw the shoulder blades together to move the bar a short distance, then release slowly without bending the elbows."]',
    '["https://ditillo2.blogspot.com/2008/05/shrug-variations-paul-kelso.html?m=0"]',
    '[["barbell"]]', 'bent_over_barbell_scapular_retraction'
  );

-- The legacy row was an unspecified bench dip. Define it as the straight-leg
-- floor-foot version so it cannot double-count either sourced progression.
update public.exercises
set
  name = 'Straight-leg Bench Dip',
  instructions = '["Support both hands on a stable bench with straight legs and heels on the floor. Bend and straighten the elbows while keeping the hips close to the bench."]'::jsonb,
  source_urls = '["https://www.nasm.org/resource-center/exercise-library/bench-dips"]'::jsonb,
  review_status = 'reviewed',
  catalog_notes = 'Legacy bench dip clarified as the straight-leg, floor-foot version. Bent-knee and feet-elevated progressions have separate variant groups; none asserts injury safety or equivalent difficulty.',
  variant_group = 'straight_leg_bench_dip'
where slug = 'bench_dip';

create temporary table upper_strength_family_muscles (
  replacement_family text not null,
  muscle text not null,
  role text not null,
  contribution numeric not null,
  primary key (replacement_family, muscle)
) on commit drop;

insert into upper_strength_family_muscles values
  ('chest_fly','chest','primary',1),
  ('chest_fly','delts_anterior','secondary',0.5),
  ('dip','triceps','primary',1),
  ('dip','chest','secondary',0.5),
  ('dip','delts_anterior','secondary',0.5),
  ('elbow_extension','triceps','primary',1),
  ('elbow_flexion','biceps','primary',1),
  ('elbow_flexion','forearms','secondary',0.5),
  ('face_pull','delts_posterior','primary',1),
  ('face_pull','rhomboids','secondary',0.5),
  ('face_pull','traps_mid_lower','secondary',0.5),
  ('horizontal_row','upper_back','primary',1),
  ('horizontal_row','lats','secondary',0.5),
  ('horizontal_row','biceps','secondary',0.5),
  ('lateral_raise','delts_lateral','primary',1),
  ('lateral_raise','traps_upper','secondary',0.5),
  ('rear_delt_fly','delts_posterior','primary',1),
  ('rear_delt_fly','rhomboids','secondary',0.5),
  ('rear_delt_fly','traps_mid_lower','secondary',0.5),
  ('scapular_elevation','traps_upper','primary',1),
  ('shoulder_extension','lats','primary',1),
  ('shoulder_extension','chest','secondary',0.5),
  ('shoulder_external_rotation','rotator_cuff','primary',1),
  ('shoulder_external_rotation','delts_posterior','secondary',0.5),
  ('shoulder_internal_rotation','rotator_cuff','primary',1),
  ('shoulder_internal_rotation','chest','secondary',0.5),
  ('upright_row','delts_lateral','primary',1),
  ('upright_row','traps_upper','secondary',0.5),
  ('upright_row','biceps','secondary',0.5),
  ('vertical_press','delts_anterior','primary',1),
  ('vertical_press','triceps','secondary',0.5),
  ('vertical_pull','lats','primary',1),
  ('vertical_pull','biceps','secondary',0.5),
  ('vertical_pull','upper_back','secondary',0.5),
  ('wrist_extension','forearms_extensors','primary',1),
  ('wrist_flexion','forearms_flexors','primary',1),
  ('scapular_upward_rotation','serratus_anterior','primary',1),
  ('scapular_upward_rotation','traps_mid_lower','secondary',0.5),
  ('scapular_retraction','traps_mid_lower','primary',1),
  ('scapular_retraction','rhomboids','secondary',0.5);

do $$
begin
  if (select count(*) from upper_strength_additions) <> 46 then
    raise exception 'Expected 46 upper-strength catalog additions';
  end if;

  if exists (
    select 1
    from upper_strength_additions addition
    left join upper_strength_family_muscles muscle
      on muscle.replacement_family = addition.replacement_family
    where muscle.replacement_family is null
  ) then
    raise exception 'An upper-strength family has no anatomy mapping';
  end if;

  if exists (
    select 1
    from upper_strength_family_muscles muscle
    left join public.muscle_groups existing on existing.slug = muscle.muscle
    where existing.id is null
  ) then
    raise exception 'An upper-strength anatomy target does not resolve';
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
  jsonb_build_array('strength', replacement_family),
  '{}'::jsonb,
  '[]'::jsonb,
  true,
  'strength',
  tracking_mode,
  instructions,
  source_urls || jsonb_build_array(
    'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs'
  ),
  case
    when slug in (
      'dumbbell_floor_fly',
      'band_hammer_curl',
      'band_reverse_curl',
      'half_kneeling_cable_face_pull',
      'supine_cable_face_pull',
      'split_stance_band_row',
      'seated_band_lateral_raise',
      'side_lying_dumbbell_lateral_raise',
      'band_internal_rotation_isometric_hold',
      'single_arm_dumbbell_upright_row',
      'half_kneeling_single_arm_band_press',
      'seated_band_overhead_press',
      'half_kneeling_band_lat_pulldown',
      'single_arm_band_lat_pulldown',
      'eccentric_resisted_wrist_extension',
      'eccentric_resisted_wrist_flexion',
      'seated_cable_scapular_retraction'
    ) then 'needs_review'
    else 'reviewed'
  end,
  case
    when slug = 'bent_over_barbell_scapular_retraction' then
      'Bent-over barbell shrug technique is sourced to a hosted archive of Paul Kelso original 1988 article. Anatomy weights are qualitative, and family membership does not assert injury safety or equivalent prescription.'
    when slug = 'supine_cable_face_pull' then
      'The original trainer demonstration establishes the lying cable setup; this is not clinical validation. Technique remains flagged for editorial review, and family membership does not assert injury safety or equivalent prescription.'
    when slug = 'seated_cable_scapular_retraction' then
      'Cable loading is an editorial adaptation of sourced straight-elbow scapular retraction. Equipment-specific technique remains flagged for review; family membership does not assert injury safety or equivalent prescription.'
    when slug in (
      'dumbbell_floor_fly',
      'band_hammer_curl',
      'band_reverse_curl',
      'half_kneeling_cable_face_pull',
      'split_stance_band_row',
      'seated_band_lateral_raise',
      'side_lying_dumbbell_lateral_raise',
      'band_internal_rotation_isometric_hold',
      'single_arm_dumbbell_upright_row',
      'half_kneeling_single_arm_band_press',
      'seated_band_overhead_press',
      'half_kneeling_band_lat_pulldown',
      'single_arm_band_lat_pulldown',
      'eccentric_resisted_wrist_extension',
      'eccentric_resisted_wrist_flexion'
    ) then
      'The source establishes the base movement, contraction, or named variant; the documented posture or equipment adaptation remains flagged for technique review. Anatomy weights are qualitative, and family membership does not assert injury safety or equivalent prescription.'
    else
      'Source-backed general catalog variation. Anatomy weights are qualitative heuristics, and family membership does not assert injury safety, clinical suitability, or an equivalent prescription.'
  end,
  replacement_family,
  equipment_options,
  variant_group,
  'eligible',
  null
from upper_strength_additions
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
using public.exercises exercise, upper_strength_additions addition
where mapping.exercise_id = exercise.id
  and exercise.slug = addition.slug;

insert into public.exercise_muscle_map (
  exercise_id, muscle_group_id, role, contribution
)
select
  exercise.id,
  muscle_group.id,
  case
    when addition.slug = 'barbell_pullover' and family_muscle.muscle = 'chest'
      then 'primary'
    when addition.slug = 'barbell_pullover' and family_muscle.muscle = 'lats'
      then 'secondary'
    else family_muscle.role
  end,
  case
    when addition.slug = 'barbell_pullover' and family_muscle.muscle = 'chest'
      then 1
    when addition.slug = 'barbell_pullover' and family_muscle.muscle = 'lats'
      then 0.5
    else family_muscle.contribution
  end
from upper_strength_additions addition
join public.exercises exercise on exercise.slug = addition.slug
join upper_strength_family_muscles family_muscle
  on family_muscle.replacement_family = addition.replacement_family
join public.muscle_groups muscle_group on muscle_group.slug = family_muscle.muscle;

commit;
