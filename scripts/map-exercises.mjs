// Maps scripts/data/exercises.csv (the hand-trimmed dataset list) onto the
// app's muscle groups and parts, with weights, and writes it in muscle_list.csv's
// format as a drop-in replacement for src/data/muscle_list.csv. It writes to
// scripts/data/ rather than straight over it, so hand edits there aren't lost.
// Usage: node scripts/map-exercises.mjs [input.csv] [output.csv]
//
// The dataset's own muscle columns are too coarse ("shoulders", "pectorals")
// and often wrong (squats target "glutes"), so each exercise is matched by name
// to a movement pattern and given that pattern's weighting instead. Weightings
// follow the hand-written rows muscle_list.csv had where there's a matching lift.
// Ids are the dataset's, so re-running on an edited input keeps them stable.
import { readFileSync, writeFileSync } from 'node:fs'

const input = process.argv[2] ?? 'scripts/data/exercises.csv'
const output = process.argv[3] ?? 'scripts/data/muscle_list.csv'

// Part labels, exactly as in src/data/muscles.ts.
const SH = 'Sternal Head', CH = 'Clavicular Head', SA = 'Serratus Anterior'
const AD = 'Anterior Deltoid', LD = 'Lateral Deltoid', PD = 'Posterior Deltoid'
const TLO = 'Triceps Long Head', TLA = 'Triceps Lateral Head', TM = 'Triceps Medial Head'
const BI = 'Biceps', BR = 'Brachioradialis', FE = 'Forearm Extensors', FF = 'Forearm Flexors'
const ABS = 'Abs', OBL = 'Obliques', NECK = 'Neck'
const UT = 'Upper Trapezius', MT = 'Middle Trapezius', LT = 'Lower Trapezius'
const IN = 'Infraspinatus & Teres Minor', LAT = 'Latissimus Dorsi & Teres Major', ES = 'Erector Spinae'
const GL = 'Glutes', QU = 'Quadriceps', HA = 'Hamstrings', ADD = 'Adductors', ABD = 'Abductors', CA = 'Calves'

/** A weighting: the group it's listed under, then [part, share] with the target part first. */
const p = (group, ...parts) => ({ group, parts })

// Chest
const FLAT_PRESS_BB = p('Chest', [SH, 0.5], [CH, 0.15], [AD, 0.15], [TLA, 0.1], [TLO, 0.05], [TM, 0.05])
const FLAT_PRESS_DB = p('Chest', [SH, 0.55], [CH, 0.15], [AD, 0.15], [TLA, 0.1], [TM, 0.05])
const INCLINE_PRESS_BB = p('Chest', [CH, 0.45], [SH, 0.15], [AD, 0.2], [TLA, 0.1], [TLO, 0.05], [TM, 0.05])
const INCLINE_PRESS_DB = p('Chest', [CH, 0.5], [SH, 0.15], [AD, 0.2], [TLA, 0.1], [TM, 0.05])
const DECLINE_PRESS_BB = p('Chest', [SH, 0.6], [TLA, 0.15], [TLO, 0.1], [TM, 0.1], [AD, 0.05])
const DECLINE_PRESS_DB = p('Chest', [SH, 0.65], [TLA, 0.15], [TM, 0.1], [AD, 0.1])
const FLY = p('Chest', [SH, 0.7], [CH, 0.15], [AD, 0.15])
const INCLINE_FLY = p('Chest', [CH, 0.6], [SH, 0.15], [AD, 0.25])
const DECLINE_FLY = p('Chest', [SH, 0.8], [CH, 0.1], [AD, 0.1])
const MACHINE_FLY = p('Chest', [SH, 0.7], [CH, 0.2], [AD, 0.1])
const CHEST_DIP = p('Chest', [SH, 0.5], [AD, 0.2], [TLA, 0.15], [TM, 0.1], [TLO, 0.05])
const PUSH_UP = p('Chest', [SH, 0.5], [AD, 0.15], [CH, 0.1], [TLA, 0.1], [ABS, 0.1], [TM, 0.05])
const CHEST_PULLOVER = p('Chest', [SH, 0.45], [LAT, 0.3], [TLO, 0.15], [SA, 0.1])
const SERRATUS_RAISE = p('Chest', [SA, 0.75], [AD, 0.15], [SH, 0.1])

// Triceps
const CLOSE_GRIP = p('Triceps', [TLA, 0.35], [SH, 0.2], [TM, 0.15], [TLO, 0.15], [AD, 0.1], [CH, 0.05])
const LYING_EXT = p('Triceps', [TLO, 0.45], [TLA, 0.3], [TM, 0.25])
const OVERHEAD_EXT = p('Triceps', [TLO, 0.6], [TLA, 0.2], [TM, 0.2])
const LUNGE_EXT = p('Triceps', [TLO, 0.5], [TLA, 0.15], [TM, 0.15], [QU, 0.1], [GL, 0.1])
const PUSHDOWN = p('Triceps', [TLA, 0.5], [TM, 0.3], [TLO, 0.2])
const REVERSE_PUSHDOWN = p('Triceps', [TM, 0.5], [TLA, 0.3], [TLO, 0.2])
const KICKBACK = p('Triceps', [TLA, 0.45], [TM, 0.3], [TLO, 0.25])
const BENCH_DIP = p('Triceps', [TLA, 0.4], [TM, 0.25], [TLO, 0.15], [AD, 0.15], [SH, 0.05])
const DIAMOND_PUSH_UP = p('Triceps', [TLA, 0.35], [TM, 0.2], [SH, 0.2], [TLO, 0.1], [AD, 0.1], [ABS, 0.05])

// Shoulders
const SHOULDER_PRESS = p('Shoulders', [AD, 0.45], [LD, 0.2], [TLA, 0.1], [CH, 0.1], [UT, 0.1], [TM, 0.05])
const MACHINE_SHOULDER_PRESS = p('Shoulders', [AD, 0.5], [LD, 0.2], [TLA, 0.1], [CH, 0.1], [TM, 0.05], [UT, 0.05])
const ARNOLD = p('Shoulders', [AD, 0.45], [LD, 0.25], [TLA, 0.1], [CH, 0.1], [TM, 0.05], [UT, 0.05])
const FRONT_RAISE = p('Shoulders', [AD, 0.7], [CH, 0.15], [LD, 0.1], [SA, 0.05])
const LATERAL_RAISE = p('Shoulders', [LD, 0.75], [AD, 0.1], [UT, 0.1], [SA, 0.05])
const MACHINE_LATERAL = p('Shoulders', [LD, 0.8], [AD, 0.1], [UT, 0.1])
const LATERAL_TO_FRONT = p('Shoulders', [LD, 0.45], [AD, 0.4], [UT, 0.1], [SA, 0.05])
const IRON_CROSS = p('Shoulders', [LD, 0.6], [AD, 0.25], [UT, 0.15])
const AROUND_WORLD = p('Shoulders', [AD, 0.45], [LD, 0.25], [CH, 0.2], [SA, 0.1])
const REAR_FLY = p('Shoulders', [PD, 0.6], [MT, 0.2], [IN, 0.1], [LT, 0.1])
const REAR_ROW = p('Shoulders', [PD, 0.45], [MT, 0.25], [LAT, 0.1], [BI, 0.1], [IN, 0.05], [LT, 0.05])
const SIDE_PLANK_FLY = p('Shoulders', [PD, 0.4], [OBL, 0.3], [MT, 0.15], [ABS, 0.15])
const UPRIGHT_ROW = p('Shoulders', [LD, 0.45], [UT, 0.3], [AD, 0.1], [BI, 0.1], [BR, 0.05])
const INTERNAL_ROTATION = p('Shoulders', [AD, 0.5], [SH, 0.3], [LAT, 0.2])
const OVERHEAD_CARRY = p('Shoulders', [AD, 0.35], [LD, 0.2], [UT, 0.2], [OBL, 0.15], [TLA, 0.05], [ABS, 0.05])
const PUSH_PRESS = p('Shoulders', [AD, 0.35], [QU, 0.2], [GL, 0.15], [TLA, 0.1], [LD, 0.1], [UT, 0.1])
const SKIER = p('Shoulders', [AD, 0.4], [OBL, 0.3], [ABS, 0.15], [LD, 0.15])
const PIRATE_SHIP = p('Shoulders', [AD, 0.4], [LD, 0.3], [OBL, 0.2], [UT, 0.1])

// Back
const PULLDOWN = p('Back', [LAT, 0.55], [BI, 0.15], [LT, 0.1], [MT, 0.1], [PD, 0.05], [BR, 0.05])
const CLOSE_PULLDOWN = p('Back', [LAT, 0.6], [BI, 0.2], [LT, 0.1], [MT, 0.05], [BR, 0.05])
const CHIN_UP = p('Back', [LAT, 0.55], [BI, 0.25], [LT, 0.1], [MT, 0.05], [BR, 0.05])
const STRAIGHT_ARM = p('Back', [LAT, 0.7], [TLO, 0.15], [SH, 0.1], [ABS, 0.05])
const LAT_PULLOVER = p('Back', [LAT, 0.5], [SH, 0.25], [TLO, 0.15], [SA, 0.1])
const BENT_ROW = p('Back', [LAT, 0.35], [MT, 0.25], [PD, 0.15], [BI, 0.1], [ES, 0.1], [BR, 0.05])
const ONE_ARM_ROW = p('Back', [LAT, 0.4], [MT, 0.2], [PD, 0.15], [BI, 0.1], [ES, 0.1], [BR, 0.05])
const UNDERHAND_ROW = p('Back', [LAT, 0.4], [MT, 0.25], [BI, 0.2], [PD, 0.1], [BR, 0.05])
const SEATED_ROW = p('Back', [LAT, 0.4], [MT, 0.3], [BI, 0.15], [PD, 0.1], [ES, 0.05])
const WIDE_ROW = p('Back', [MT, 0.35], [LAT, 0.3], [PD, 0.15], [BI, 0.1], [LT, 0.05], [BR, 0.05])
const SUPPORTED_ROW = p('Back', [MT, 0.4], [LAT, 0.25], [PD, 0.15], [BI, 0.1], [LT, 0.05], [BR, 0.05])
const HIGH_ROW = p('Back', [LAT, 0.45], [MT, 0.2], [LT, 0.1], [PD, 0.1], [BI, 0.1], [BR, 0.05])
const RENEGADE_ROW = p('Back', [LAT, 0.35], [MT, 0.2], [ABS, 0.15], [OBL, 0.1], [BI, 0.1], [PD, 0.1])
const Y_RAISE = p('Back', [LT, 0.55], [MT, 0.15], [LD, 0.1], [PD, 0.1], [IN, 0.1])
const EXTERNAL_ROTATION = p('Back', [IN, 0.8], [PD, 0.2])
const CUBAN_PRESS = p('Back', [IN, 0.4], [LD, 0.2], [UT, 0.15], [PD, 0.15], [MT, 0.1])
const SHRUG = p('Back', [UT, 0.8], [MT, 0.1], [FF, 0.1])
const GRIPLESS_SHRUG = p('Back', [UT, 0.9], [MT, 0.1])
const INCLINE_SHRUG = p('Back', [MT, 0.5], [UT, 0.4], [LT, 0.1])
const HIGH_PULL = p('Back', [UT, 0.35], [LD, 0.2], [GL, 0.15], [QU, 0.1], [HA, 0.1], [ES, 0.1])
const DEADLIFT = p('Back', [ES, 0.3], [GL, 0.3], [HA, 0.2], [QU, 0.1], [UT, 0.05], [FF, 0.05])
const RACK_PULL = p('Back', [ES, 0.35], [UT, 0.2], [GL, 0.2], [HA, 0.1], [FF, 0.1], [LAT, 0.05])
const GOOD_MORNING = p('Back', [ES, 0.4], [HA, 0.35], [GL, 0.25])
const SEATED_GOOD_MORNING = p('Back', [ES, 0.6], [GL, 0.25], [HA, 0.15])
const BACK_EXTENSION = p('Back', [ES, 0.5], [GL, 0.3], [HA, 0.2])

// Biceps and forearms
const CURL = p('Biceps', [BI, 0.75], [BR, 0.15], [FF, 0.1])
const STRICT_CURL = p('Biceps', [BI, 0.8], [BR, 0.15], [FF, 0.05])
const INCLINE_CURL = p('Biceps', [BI, 0.8], [BR, 0.1], [FF, 0.1])
const HAMMER_CURL = p('Biceps', [BI, 0.5], [BR, 0.4], [FE, 0.1])
const ZOTTMAN_CURL = p('Biceps', [BI, 0.6], [BR, 0.25], [FE, 0.15])
const CURL_WITH_LEGS = p('Biceps', [BI, 0.5], [QU, 0.2], [GL, 0.15], [BR, 0.1], [HA, 0.05])
const CURL_TO_PRESS = p('Biceps', [BI, 0.45], [AD, 0.25], [LD, 0.1], [BR, 0.1], [TLA, 0.1])
const REVERSE_CURL = p('Forearms', [BR, 0.45], [BI, 0.3], [FE, 0.25])
const WRIST_CURL = p('Forearms', [FF, 1])
const REVERSE_WRIST_CURL = p('Forearms', [FE, 1])
const NEUTRAL_WRIST_CURL = p('Forearms', [BR, 0.4], [FF, 0.3], [FE, 0.3])
const FINGER_CURL = p('Forearms', [FF, 0.9], [FE, 0.1])
const PRONATION = p('Forearms', [FF, 0.8], [BR, 0.2])
const SUPINATION = p('Forearms', [FE, 0.6], [BI, 0.4])
const ROTATION = p('Forearms', [FF, 0.5], [FE, 0.5])
const FARMERS_WALK = p('Forearms', [FF, 0.5], [UT, 0.25], [FE, 0.1], [OBL, 0.1], [ABS, 0.05])

// Core
const CRUNCH = p('Core', [ABS, 0.85], [OBL, 0.15])
const REVERSE_CRUNCH = p('Core', [ABS, 0.85], [OBL, 0.15])
const SIDE_CRUNCH = p('Core', [OBL, 0.7], [ABS, 0.3])
const LEG_RAISE = p('Core', [ABS, 0.75], [QU, 0.15], [OBL, 0.1])
const PRESS_SIT_UP = p('Core', [ABS, 0.7], [AD, 0.1], [OBL, 0.1], [QU, 0.1])
const AB_WHEEL = p('Core', [ABS, 0.6], [LAT, 0.15], [OBL, 0.1], [SA, 0.1], [TLO, 0.05])
const SIDE_BEND = p('Core', [OBL, 0.75], [ABS, 0.1], [ES, 0.1], [FF, 0.05])
const TWIST = p('Core', [OBL, 0.65], [ABS, 0.35])
const WOODCHOP = p('Core', [OBL, 0.65], [ABS, 0.15], [AD, 0.1], [GL, 0.1])
const WINDMILL = p('Core', [OBL, 0.4], [HA, 0.2], [GL, 0.15], [AD, 0.15], [ABS, 0.1])
const FIGURE_8 = p('Core', [OBL, 0.4], [GL, 0.2], [HA, 0.15], [FF, 0.15], [ABS, 0.1])
const TURKISH_GET_UP = p('Core', [OBL, 0.3], [AD, 0.25], [GL, 0.2], [QU, 0.15], [ABS, 0.1])
const BENT_PRESS = p('Core', [OBL, 0.35], [AD, 0.25], [TLA, 0.15], [ABS, 0.15], [LAT, 0.1])
const SPELL_CASTER = p('Core', [OBL, 0.6], [ABS, 0.2], [AD, 0.2])
const LANDMINE_180 = p('Core', [OBL, 0.6], [ABS, 0.2], [AD, 0.1], [QU, 0.1])
const JUDO_FLIP = p('Core', [OBL, 0.5], [ABS, 0.3], [LAT, 0.2])

// Legs
const SQUAT = p('Legs', [QU, 0.45], [GL, 0.25], [ADD, 0.15], [ES, 0.1], [HA, 0.05])
const LOW_BAR_SQUAT = p('Legs', [QU, 0.4], [GL, 0.3], [ADD, 0.15], [ES, 0.1], [HA, 0.05])
const KNEELING_SQUAT = p('Legs', [GL, 0.6], [QU, 0.2], [HA, 0.1], [ADD, 0.1])
const FRONT_SQUAT = p('Legs', [QU, 0.6], [GL, 0.15], [ADD, 0.1], [ES, 0.1], [ABS, 0.05])
const GOBLET_SQUAT = p('Legs', [QU, 0.55], [GL, 0.2], [ADD, 0.1], [ABS, 0.05], [ES, 0.05], [HA, 0.05])
const SUMO_SQUAT = p('Legs', [QU, 0.35], [GL, 0.3], [ADD, 0.25], [ES, 0.05], [HA, 0.05])
const OVERHEAD_SQUAT = p('Legs', [QU, 0.45], [GL, 0.2], [ADD, 0.1], [ES, 0.1], [AD, 0.1], [ABS, 0.05])
const JUMP_SQUAT = p('Legs', [QU, 0.45], [GL, 0.3], [CA, 0.1], [ADD, 0.1], [HA, 0.05])
const SINGLE_LEG_SQUAT = p('Legs', [QU, 0.5], [GL, 0.3], [ADD, 0.05], [ABD, 0.05], [ABS, 0.05], [CA, 0.05])
const HACK_SQUAT = p('Legs', [QU, 0.65], [GL, 0.2], [ADD, 0.1], [HA, 0.05])
const LEG_PRESS = p('Legs', [QU, 0.55], [GL, 0.25], [ADD, 0.15], [HA, 0.05])
const LUNGE = p('Legs', [QU, 0.45], [GL, 0.3], [ADD, 0.1], [HA, 0.05], [ABD, 0.05], [CA, 0.05])
const SPLIT_SQUAT = p('Legs', [QU, 0.45], [GL, 0.35], [ADD, 0.1], [HA, 0.05], [ABD, 0.05])
const LATERAL_LUNGE = p('Legs', [QU, 0.4], [ADD, 0.3], [GL, 0.25], [HA, 0.05])
const STEP_UP = p('Legs', [QU, 0.45], [GL, 0.35], [HA, 0.1], [ABD, 0.05], [CA, 0.05])
const THRUSTER = p('Legs', [QU, 0.35], [AD, 0.25], [GL, 0.2], [TLA, 0.1], [LD, 0.05], [ABS, 0.05])
const LEG_EXTENSION = p('Legs', [QU, 1])
const LYING_LEG_CURL = p('Legs', [HA, 0.85], [CA, 0.1], [GL, 0.05])
const SEATED_LEG_CURL = p('Legs', [HA, 0.9], [CA, 0.1])
const KNEELING_LEG_CURL = p('Legs', [HA, 0.85], [GL, 0.1], [CA, 0.05])
const NORDIC_CURL = p('Legs', [HA, 0.9], [CA, 0.05], [GL, 0.05])
const RDL = p('Legs', [HA, 0.45], [GL, 0.3], [ES, 0.15], [ADD, 0.05], [FF, 0.05])
const SINGLE_LEG_RDL = p('Legs', [HA, 0.4], [GL, 0.4], [ES, 0.1], [ABD, 0.05], [FF, 0.05])
const SUMO_DEADLIFT = p('Legs', [GL, 0.3], [ADD, 0.2], [QU, 0.2], [HA, 0.15], [ES, 0.1], [FF, 0.05])
const TRAP_BAR_DEADLIFT = p('Legs', [GL, 0.3], [QU, 0.25], [HA, 0.15], [ES, 0.15], [UT, 0.1], [FF, 0.05])
const SUITCASE_DEADLIFT = p('Legs', [GL, 0.3], [QU, 0.2], [OBL, 0.2], [HA, 0.1], [ES, 0.1], [FF, 0.1])
const CLEAN = p('Legs', [GL, 0.3], [HA, 0.2], [UT, 0.2], [QU, 0.15], [ES, 0.1], [FF, 0.05])
const SNATCH = p('Legs', [GL, 0.3], [HA, 0.15], [QU, 0.15], [UT, 0.15], [AD, 0.15], [ES, 0.1])
const SWING = p('Legs', [GL, 0.4], [HA, 0.3], [ES, 0.15], [ABS, 0.05], [FF, 0.05], [AD, 0.05])
const GLUTE_BRIDGE = p('Legs', [GL, 0.75], [HA, 0.15], [QU, 0.05], [ADD, 0.05])
const PULL_THROUGH = p('Legs', [GL, 0.6], [HA, 0.3], [ES, 0.1])
const HIP_EXTENSION = p('Legs', [GL, 0.85], [HA, 0.15])
const REVERSE_HYPER = p('Legs', [GL, 0.55], [HA, 0.25], [ES, 0.2])
const ADDUCTION = p('Legs', [ADD, 1])
const ABDUCTION = p('Legs', [ABD, 0.8], [GL, 0.2])
const CALF_RAISE = p('Legs', [CA, 1])
const BURPEE = p('Legs', [QU, 0.3], [SH, 0.2], [GL, 0.15], [AD, 0.15], [TLA, 0.1], [ABS, 0.1])
const CYCLING = p('Legs', [QU, 0.55], [GL, 0.2], [HA, 0.15], [CA, 0.1])
const INCLINE_WALK = p('Legs', [QU, 0.35], [GL, 0.3], [CA, 0.2], [HA, 0.15])

/** Barbell-type, dumbbell-type or machine-type, for lifts weighted differently by kit. */
const kit = (name) => (/dumbbell|kettlebell/.test(name) ? 'db' : /lever|machine|cable/.test(name) ? 'machine' : 'bb')

/**
 * Picks the weighting for an exercise from its name (lower-case) and the
 * dataset's target. Order matters: specific patterns come before the general
 * ones they'd also match ("clean and press" before "clean", "rear lunge"
 * never reaching a rear-delt rule).
 */
function classify(name, target) {
  const has = (re) => re.test(name)

  // Whole-body and odd lifts first.
  if (has(/thruster/)) return THRUSTER
  if (has(/jerk|push press|clean and press/)) return PUSH_PRESS
  if (has(/snatch pull|\bclean(?![- ]grip)/)) return CLEAN
  if (has(/snatch/)) return SNATCH
  if (has(/swing/)) return SWING
  if (has(/burpee/)) return BURPEE
  if (has(/bike|cycle/)) return CYCLING
  if (has(/treadmill/)) return INCLINE_WALK
  if (has(/overhead carry/)) return OVERHEAD_CARRY
  if (has(/farmers? walk|carry/)) return FARMERS_WALK
  if (has(/turkish get up/)) return TURKISH_GET_UP
  if (has(/windmill/)) return WINDMILL
  if (has(/figure 8/)) return FIGURE_8
  if (has(/spell caster/)) return SPELL_CASTER
  if (has(/landmine 180/)) return LANDMINE_180
  if (has(/judo flip/)) return JUDO_FLIP
  if (has(/skier/)) return SKIER
  if (has(/pirate/)) return PIRATE_SHIP
  if (has(/around world/)) return AROUND_WORLD
  if (has(/bent press/)) return BENT_PRESS
  if (has(/press sit-up/)) return PRESS_SIT_UP
  if (has(/side plank/)) return SIDE_PLANK_FLY

  // Calves, forearms, isolated legs.
  if (has(/calf|toe raise/)) return CALF_RAISE
  if (has(/wrist curl/)) {
    if (has(/revers|palms down/)) return REVERSE_WRIST_CURL
    if (has(/neutral/)) return NEUTRAL_WRIST_CURL
    return WRIST_CURL
  }
  if (has(/finger curl|gripper/)) return FINGER_CURL
  if (has(/pronation/)) return PRONATION
  if (has(/supination/)) return SUPINATION
  if (has(/one arm rotate/)) return ROTATION
  if (has(/leg curl|femoral/)) {
    if (has(/inverse/)) return NORDIC_CURL
    if (has(/seated/)) return SEATED_LEG_CURL
    if (has(/kneeling/)) return KNEELING_LEG_CURL
    return LYING_LEG_CURL
  }
  if (has(/leg extension/)) return LEG_EXTENSION
  if (has(/adduction/)) return ADDUCTION
  if (has(/abduction/)) return ABDUCTION

  // Curls.
  if (has(/curl/)) {
    if (has(/lunge|squat|step up/)) return CURL_WITH_LEGS
    if (has(/press/)) return CURL_TO_PRESS
    if (has(/zottman/)) return ZOTTMAN_CURL
    if (has(/hammer|neutral/)) return HAMMER_CURL
    if (has(/revers|pronate/)) return REVERSE_CURL
    if (has(/preacher|peacher|concentration|spider|prone|lying|arm blaster/)) return STRICT_CURL
    if (has(/incline|overhead|drag/)) return INCLINE_CURL
    return CURL
  }

  // Shoulders and upper back.
  if (has(/external.*rotation/)) return EXTERNAL_ROTATION
  if (has(/internal rotation/)) return INTERNAL_ROTATION
  if (has(/cuban/)) return CUBAN_PRESS
  if (has(/y-raise/)) return Y_RAISE
  if (has(/upright row/)) return UPRIGHT_ROW
  if (has(/high pull\b/)) return HIGH_PULL // not "high pulley"
  if (has(/shrug/)) {
    if (has(/gripless/)) return GRIPLESS_SHRUG
    if (has(/incline|decline/)) return INCLINE_SHRUG
    return SHRUG
  }
  if (has(/rear delt row/)) return REAR_ROW
  if (
    has(
      /t-raise|rear (lateral|delt raise|fly)|revers[e]? fly|deltoid rear|lateral bent-over|bent arm lateral|side lying one hand raise|^dumbbell raise$/,
    )
  )
    return REAR_FLY
  if (has(/incline shoulder raise/)) return SERRATUS_RAISE
  if (has(/lateral to front/)) return LATERAL_TO_FRONT
  if (has(/iron cross/)) return IRON_CROSS
  if (has(/pullover/)) return target === 'lats' ? LAT_PULLOVER : CHEST_PULLOVER
  if (has(/front raise|forward raise|front shoulder raise|incline raise/)) return FRONT_RAISE
  if (has(/lateral raise|alternate raise/)) return has(/lever/) ? MACHINE_LATERAL : LATERAL_RAISE
  if (has(/arnold/)) return ARNOLD

  // Pulldowns and rows.
  if (has(/straight arm|incline pushdown/)) return STRAIGHT_ARM
  if (has(/chin-up|underhand|reverse grip.*pulldown/)) return CHIN_UP
  if (has(/pull-up|pulldown/)) return has(/v-bar|parallel|close grip/) ? CLOSE_PULLDOWN : PULLDOWN
  if (has(/\brow\b|twisting pull/)) { // not "narrow"
    if (has(/renegade/)) return RENEGADE_ROW
    if (has(/reverse grip|reverse t-bar|underhand/)) return UNDERHAND_ROW
    if (has(/incline|lying|cambered|chest supported/)) return SUPPORTED_ROW
    if (has(/wide-grip|wide grip/)) return WIDE_ROW
    if (has(/high row|upper row/)) return HIGH_ROW
    if (has(/one arm|alternating row|unilateral/) && !has(/seated|cable|lever/)) return ONE_ARM_ROW
    if (has(/bent over|bent-over|pendlay|t.?bar|kettlebell/)) return BENT_ROW
    return SEATED_ROW
  }

  // Triceps.
  if (has(/dip/)) return target === 'triceps' ? BENCH_DIP : CHEST_DIP
  if (has(/push.?up/)) return has(/close-grip/) ? DIAMOND_PUSH_UP : PUSH_UP
  if (has(/kickback|rear drive|bent over.*extension/)) return KICKBACK
  if (has(/pushdown/)) return has(/revers/) ? REVERSE_PUSHDOWN : PUSHDOWN
  if (has(/tate|elbow press|face press|skull/)) return LYING_EXT
  if (has(/extension|french/) && target === 'triceps') {
    if (has(/lunge/)) return LUNGE_EXT
    if (has(/lying|incline|decline|supine|concentration/) && !has(/behind/)) return LYING_EXT
    if (has(/overhead|french|behind|seated|standing|alternate|kneeling/)) return OVERHEAD_EXT
    return LYING_EXT
  }
  if (has(/press/) && target === 'triceps') return CLOSE_GRIP

  // Chest.
  if (has(/fly|flye|cross-?over|breeding/)) {
    if (has(/lever seated/)) return MACHINE_FLY
    if (has(/decline/)) return DECLINE_FLY
    if (has(/incline|upper|low fly/)) return INCLINE_FLY
    return FLY
  }
  if (has(/press/) && target === 'pectorals') {
    const k = kit(name)
    if (has(/incline/)) return k === 'bb' ? INCLINE_PRESS_BB : INCLINE_PRESS_DB
    if (has(/decline/)) return k === 'bb' ? DECLINE_PRESS_BB : DECLINE_PRESS_DB
    return k === 'bb' ? FLAT_PRESS_BB : FLAT_PRESS_DB
  }

  // Shoulder presses.
  if (has(/press|military|shoulder/) && target === 'delts') {
    return kit(name) === 'machine' ? MACHINE_SHOULDER_PRESS : SHOULDER_PRESS
  }

  // Squats, lunges, hinges.
  if (has(/leg press/)) return LEG_PRESS
  if (has(/hack squat/)) return HACK_SQUAT
  if (has(/goblet/)) return GOBLET_SQUAT
  if (has(/front squat|front chest squat|zercher|frankenstein/)) return FRONT_SQUAT
  if (has(/sumo squat|wide squat/)) return SUMO_SQUAT
  if (has(/overhead squat/)) return OVERHEAD_SQUAT
  if (has(/lateral lunge|side split squat/)) return LATERAL_LUNGE
  if (has(/step-up|step up/)) return STEP_UP
  if (has(/split squat/)) return SPLIT_SQUAT
  if (has(/lunge/)) return LUNGE
  if (has(/jump|plyo|speed squat/)) return JUMP_SQUAT
  if (has(/pistol|one leg squat|single leg squat/)) return SINGLE_LEG_SQUAT
  if (has(/squat \(on knees\)/)) return KNEELING_SQUAT
  if (has(/low bar/)) return LOW_BAR_SQUAT
  if (has(/squat/)) return SQUAT
  if (has(/rack pull/)) return RACK_PULL
  if (has(/deadlift/)) {
    if (has(/sumo/)) return SUMO_DEADLIFT
    if (has(/single leg/)) return SINGLE_LEG_RDL
    if (has(/romanian|stiff|straight leg/)) return RDL
    if (has(/side deadlift/)) return SUITCASE_DEADLIFT
    if (has(/trap bar/)) return TRAP_BAR_DEADLIFT
    return DEADLIFT
  }
  if (has(/good morning/)) return has(/seated/) ? SEATED_GOOD_MORNING : GOOD_MORNING
  if (has(/pull through/)) return PULL_THROUGH
  if (has(/glute bridge|hip raise|lifting \(on hip\)/)) return GLUTE_BRIDGE
  if (has(/reverse hyperextension/)) return REVERSE_HYPER
  if (has(/hip extension/)) return HIP_EXTENSION
  if (has(/back extension/)) return BACK_EXTENSION

  // Core.
  if (has(/rollerout|rollout/)) return AB_WHEEL
  if (has(/side crunch|side bend crunch/)) return SIDE_CRUNCH
  if (has(/reverse crunch|leg raise crunch/)) return REVERSE_CRUNCH
  if (has(/crunch/)) return CRUNCH
  if (has(/leg raise/)) return LEG_RAISE
  if (has(/side bend|side bent/)) return SIDE_BEND
  if (has(/standing lift|twist \(up-down\)/)) return WOODCHOP
  if (has(/twist/)) return TWIST

  return null
}

// --- CSV in/out ---

/** Splits CSV text into rows of fields. Handles quoted fields ("a, b" and "" for a quote). */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[++i]
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) rows.push([...row, field])
  return rows.filter((r) => r.some(Boolean))
}

const field = (value) => {
  const s = value == null ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Secondary columns, as in muscle_list.csv. */
const MAX_SECONDARY = 5

// Check every label against muscles.ts, so a typo here can't reach the app.
const musclesTs = readFileSync('src/data/muscles.ts', 'utf8')
const PARTS = new Set([...musclesTs.matchAll(/m\('\w+', '([^']+)'/g)].map((x) => x[1]))
const GROUP_LABELS = new Set([...musclesTs.matchAll(/label: '([^']+)'/g)].map((x) => x[1]))
for (const g of ['Biceps', 'Neck']) GROUP_LABELS.add(g) // whole-area muscles that act as their own group

/** Dataset typos and quirks, fixed before title-casing. */
const NAME_FIXES = [
  [/\brevers\b/g, 'reverse'],
  [/\bpeacher\b/g, 'preacher'],
  [/\bsitted\b/g, 'seated'],
  [/\bside bent\b/g, 'side bend'],
  [/\bdumbbells\b/g, 'dumbbell'],
  [/\bflyes\b/g, 'fly'],
  [/_shoulder\b/g, ''],
  [/\bv\. (\d)/g, 'v$1'],
]
const UPPER = new Set(['ez', 'jm', 'sz', 'pov'])
const SMALL = new Set(['a', 'and', 'at', 'between', 'for', 'from', 'in', 'of', 'on', 'over', 'the', 'to', 'with'])

/** "barbell close-grip bench press" -> "Barbell Close-Grip Bench Press", like the hand-written rows. */
function tidyName(raw) {
  const fixed = NAME_FIXES.reduce((s, [re, to]) => s.replace(re, to), raw.trim().toLowerCase())
  return fixed.replace(/[a-z0-9]+/g, (w, i) => {
    if (UPPER.has(w)) return w.toUpperCase()
    if (SMALL.has(w) && i > 0 && fixed[i - 1] === ' ') return w
    return w[0].toUpperCase() + w.slice(1)
  })
}

/** Two names count as the same exercise if they match ignoring case and punctuation. */
const sameName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const [header, ...rows] = parseCsv(readFileSync(input, 'utf8'))
const col = (name) => {
  const i = header.indexOf(name)
  if (i < 0) throw new Error(`${input}: missing column "${name}"`)
  return i
}
const idCol = col('id')
const nameCol = col('name')
const targetCol = col('target_muscle')

const out = [
  [
    'exercise_id',
    'exercise_name',
    'target_group',
    'target_part',
    'target_part_weight',
    ...Array.from({ length: MAX_SECONDARY }, (_, i) => [`secondary_part_${i}`, `secondary_part_weight_${i}`]).flat(),
  ],
]
const unmatched = []
const dropped = []
const counts = {}
const ids = new Set()
const names = new Map()
for (const row of rows) {
  const id = row[idCol].trim()
  const name = tidyName(row[nameCol])
  if (ids.has(id)) throw new Error(`${name}: id ${id} is used twice`)
  ids.add(id)
  // Keep the first of two same-named exercises; a list with both is just confusing.
  const twin = names.get(sameName(name))
  if (twin) {
    dropped.push(`${id} ${name} (same as ${twin})`)
    continue
  }
  names.set(sameName(name), id)

  const profile = classify(row[nameCol].trim().toLowerCase(), row[targetCol].trim().toLowerCase())
  if (!profile) {
    unmatched.push(row[nameCol])
    continue
  }
  const { group, parts } = profile
  const where = name
  if (!GROUP_LABELS.has(group)) throw new Error(`${where}: unknown group "${group}"`)
  for (const [part] of parts) if (!PARTS.has(part)) throw new Error(`${where}: unknown part "${part}"`)
  if (parts.length > MAX_SECONDARY + 1) throw new Error(`${where}: more than ${MAX_SECONDARY} secondary parts`)
  const total = parts.reduce((sum, [, w]) => sum + w, 0)
  if (Math.abs(total - 1) > 0.001) throw new Error(`${where}: weights add up to ${total}`)
  counts[group] = (counts[group] ?? 0) + 1

  const [[target, targetWeight], ...rest] = parts
  rest.sort((a, b) => b[1] - a[1])
  const secondary = Array.from({ length: MAX_SECONDARY }, (_, i) => rest[i] ?? ['', '']).flat()
  out.push([id, name, group, target, targetWeight, ...secondary])
}

writeFileSync(output, out.map((r) => r.map(field).join(',')).join('\n') + '\n')
console.log(`Wrote ${out.length - 1} of ${rows.length} exercises to ${output}`)
console.log(Object.entries(counts).map(([g, n]) => `${g} ${n}`).join(', '))
if (dropped.length) console.log(`Dropped ${dropped.length} duplicates:\n  ${dropped.join('\n  ')}`)
if (unmatched.length) console.log(`No pattern for ${unmatched.length}, left out:\n  ${unmatched.join('\n  ')}`)
