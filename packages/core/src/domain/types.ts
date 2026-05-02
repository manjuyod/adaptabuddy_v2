export type Exercise = {
  id: string;
  name: string;
  goals: string[];
  equipment: string[];
  contraindications?: string[];
  block: "main" | "accessory" | "conditioning";
  sets: number;
  reps: string;
  rir?: number;
  rest_sec?: number;
};

export const exerciseFixture: Exercise[] = [
  {
    id: "sq_barbell",
    name: "Back Squat",
    goals: ["strength", "hypertrophy"],
    equipment: ["barbell", "rack"],
    contraindications: ["knee_pain"],
    block: "main",
    sets: 4,
    reps: "5",
    rir: 2,
    rest_sec: 180
  },
  {
    id: "dl_barbell",
    name: "Conventional Deadlift",
    goals: ["strength", "hinge"],
    equipment: ["barbell", "platform"],
    contraindications: ["low_back_pain"],
    block: "main",
    sets: 3,
    reps: "5",
    rir: 2,
    rest_sec: 180
  },
  {
    id: "bp_barbell",
    name: "Barbell Bench Press",
    goals: ["strength", "push"],
    equipment: ["barbell", "bench", "rack"],
    contraindications: ["shoulder_pain"],
    block: "main",
    sets: 4,
    reps: "5",
    rir: 2,
    rest_sec: 150
  },
  {
    id: "ohp_dumbbell",
    name: "Dumbbell Overhead Press",
    goals: ["hypertrophy", "push"],
    equipment: ["dumbbells", "bench"],
    contraindications: ["shoulder_pain"],
    block: "accessory",
    sets: 3,
    reps: "10-12",
    rir: 2,
    rest_sec: 90
  },
  {
    id: "row_dumbbell",
    name: "Single Arm Row",
    goals: ["hypertrophy", "pull"],
    equipment: ["dumbbells", "bench"],
    contraindications: [],
    block: "accessory",
    sets: 3,
    reps: "10-12 / arm",
    rir: 2,
    rest_sec: 90
  },
  {
    id: "split_squat",
    name: "Rear Foot Elevated Split Squat",
    goals: ["hypertrophy", "unilateral"],
    equipment: ["dumbbells", "bench"],
    contraindications: ["knee_pain"],
    block: "accessory",
    sets: 3,
    reps: "8-10 / leg",
    rir: 2,
    rest_sec: 120
  },
  {
    id: "hinge_kb",
    name: "Kettlebell Swing",
    goals: ["conditioning", "hinge"],
    equipment: ["kettlebell"],
    contraindications: ["low_back_pain"],
    block: "conditioning",
    sets: 5,
    reps: "15",
    rir: 3,
    rest_sec: 60
  },
  {
    id: "carry_kb",
    name: "Suitcase Carry",
    goals: ["conditioning", "core"],
    equipment: ["kettlebell"],
    contraindications: [],
    block: "conditioning",
    sets: 4,
    reps: "40m / side",
    rir: 3,
    rest_sec: 45
  },
  {
    id: "pushup",
    name: "Tempo Push-up",
    goals: ["hypertrophy", "push"],
    equipment: [],
    contraindications: ["wrist_pain", "shoulder_pain"],
    block: "accessory",
    sets: 3,
    reps: "12-15",
    rir: 1,
    rest_sec: 75
  },
  {
    id: "hinge_bw",
    name: "Hip Hinge Drill",
    goals: ["technique", "hinge"],
    equipment: [],
    contraindications: [],
    block: "conditioning",
    sets: 2,
    reps: "12",
    rest_sec: 45
  }
];
