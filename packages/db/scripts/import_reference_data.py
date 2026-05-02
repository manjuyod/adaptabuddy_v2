#!/usr/bin/env python3
"""
Generate idempotent SQL upserts for Adaptabuddy_v2 reference data from CSV exports.

Usage examples:
  python packages/db/scripts/import_reference_data.py ^
    --muscle-groups-csv "C:\\path\\muscle_groups.csv" ^
    --exercises-csv "C:\\path\\exercises.csv" ^
    --templates-csv "C:\\path\\templates.csv" ^
    --output "tmp\\migration\\reference_upsert.sql"

Notes:
  - JSON fields must be valid JSON or empty; otherwise the script fails.
  - Exercise muscle mapping is generated from primary/secondary muscle columns if present.
  - Program slots are generated from templates.template_json (split/exercises).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


JSON_EMPTY_LIST = "[]"
JSON_EMPTY_OBJECT = "{}"


def sql_literal(value: Optional[str]) -> str:
    if value is None:
        return "NULL"
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def sql_json(value: Any) -> str:
    payload = json.dumps(value, separators=(",", ":"), ensure_ascii=True)
    return f"'{payload}'::jsonb"


def parse_bool(value: Optional[str], default: bool) -> bool:
    if value is None:
        return default
    text = value.strip().lower()
    if text in ("", "null", "none"):
        return default
    if text in ("true", "t", "1", "yes", "y"):
        return True
    if text in ("false", "f", "0", "no", "n"):
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def parse_int(value: Optional[str], default: Optional[int] = None) -> Optional[int]:
    if value is None:
        return default
    text = value.strip()
    if text == "" or text.lower() in ("null", "none"):
        return default
    return int(text)


def parse_optional_json(value: Optional[str], default: Any, field: str, row_id: str) -> Any:
    if value is None:
        return default
    text = value.strip()
    if text == "" or text.lower() in ("null", "none"):
        return default
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON for {field} in row {row_id}: {text}") from exc


def parse_secondary_ids(value: Optional[str]) -> List[int]:
    if value is None:
        return []
    text = value.strip()
    if text == "" or text.lower() in ("null", "none", "{}"):
        return []
    if text.startswith("["):
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            raise ValueError(f"secondary_muscle_group_ids is not a list: {text}")
        return [int(item) for item in parsed]
    if text.startswith("{") and text.endswith("}"):
        inner = text[1:-1].strip()
        if inner == "":
            return []
        return [int(item.strip()) for item in inner.split(",") if item.strip()]
    return [int(item.strip()) for item in text.split(",") if item.strip()]


def slugify(value: str) -> str:
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "unnamed"


def parse_range(value: Any, default_min: int, default_max: int) -> Tuple[int, int]:
    if value is None:
        return (default_min, default_max)
    if isinstance(value, (int, float)):
        val = int(value)
        return (val, val)
    text = str(value).strip()
    if text == "":
        return (default_min, default_max)
    numbers = [int(num) for num in re.findall(r"\d+", text)]
    if not numbers:
        return (default_min, default_max)
    if len(numbers) == 1:
        return (numbers[0], numbers[0])
    return (min(numbers), max(numbers))


@dataclass
class MuscleGroupRow:
    id: Optional[int]
    slug: str
    name: str


@dataclass
class ExerciseRow:
    id: Optional[int]
    slug: str
    name: str
    movement_pattern: str
    equipment: List[str]
    is_bodyweight: bool
    aliases: List[str]
    tags: List[str]
    media: Dict[str, Any]
    contraindications: List[str]
    is_active: bool
    primary_muscle_group_id: Optional[int]
    secondary_muscle_group_ids: List[int]


@dataclass
class ProgramRow:
    slug: str
    name: str
    program_type: str
    min_days_per_week: int
    max_days_per_week: int
    default_days_per_week: int
    description: Optional[str]
    metadata: Dict[str, Any]


@dataclass
class ProgramDayRow:
    program_slug: str
    day_index: int
    name: str
    theme_tags: List[str]


@dataclass
class ProgramSlotRow:
    program_slug: str
    day_index: int
    slot_index: int
    slot_type: str
    lock_type: str
    locked_exercise_slug: Optional[str]
    movement_pattern: Optional[str]
    equipment_allowed: List[str]
    tags_required: List[str]
    tags_blocked: List[str]
    sets_min: int
    sets_max: int
    reps_min: int
    reps_max: int
    rir_min: Optional[int]
    rir_max: Optional[int]
    muscle_targets: Dict[str, float]
    prescription: Dict[str, Any]
    is_optional: bool


def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def load_muscle_groups(path: Path) -> Tuple[List[MuscleGroupRow], Dict[int, str]]:
    rows = read_csv(path)
    muscle_groups: List[MuscleGroupRow] = []
    id_to_slug: Dict[int, str] = {}
    for row in rows:
        slug = row.get("slug") or slugify(row.get("name") or "")
        name = row.get("name") or slug.replace("_", " ").title()
        row_id = parse_int(row.get("id"))
        muscle_groups.append(MuscleGroupRow(id=row_id, slug=slug, name=name))
        if row_id is not None:
            id_to_slug[row_id] = slug
    return muscle_groups, id_to_slug


def load_exercises(path: Path) -> Tuple[List[ExerciseRow], Dict[str, ExerciseRow]]:
    rows = read_csv(path)
    exercises: List[ExerciseRow] = []
    by_name: Dict[str, ExerciseRow] = {}
    for row in rows:
        row_id = str(row.get("id") or row.get("slug") or row.get("name") or "unknown")
        slug = row.get("slug") or slugify(row.get("name") or row_id)
        name = row.get("name") or slug.replace("_", " ").title()
        movement_pattern = row.get("movement_pattern") or "unknown"
        equipment = parse_optional_json(row.get("equipment"), [], "equipment", row_id)
        aliases = parse_optional_json(row.get("aliases"), [], "aliases", row_id)
        tags = parse_optional_json(row.get("tags"), [], "tags", row_id)
        media = parse_optional_json(row.get("media"), {}, "media", row_id)
        contraindications = parse_optional_json(row.get("contraindications"), [], "contraindications", row_id)
        is_bodyweight = parse_bool(row.get("is_bodyweight"), False)
        is_active = parse_bool(row.get("is_active"), True)
        primary_id = parse_int(row.get("primary_muscle_group_id"))
        secondary_ids = parse_secondary_ids(row.get("secondary_muscle_group_ids"))
        exercise = ExerciseRow(
            id=parse_int(row.get("id")),
            slug=slug,
            name=name,
            movement_pattern=movement_pattern,
            equipment=equipment,
            is_bodyweight=is_bodyweight,
            aliases=aliases,
            tags=tags,
            media=media,
            contraindications=contraindications,
            is_active=is_active,
            primary_muscle_group_id=primary_id,
            secondary_muscle_group_ids=secondary_ids,
        )
        exercises.append(exercise)
        by_name[name.strip().lower()] = exercise
        by_name[slug.strip().lower()] = exercise
    return exercises, by_name


def load_templates(path: Path) -> List[Dict[str, Any]]:
    rows = read_csv(path)
    templates: List[Dict[str, Any]] = []
    for row in rows:
        row_id = str(row.get("id") or row.get("slug") or row.get("name") or "unknown")
        template_json = parse_optional_json(row.get("template_json"), {}, "template_json", row_id)
        templates.append(
            {
                "id": parse_int(row.get("id")),
                "slug": row.get("slug") or slugify(row.get("name") or row_id),
                "name": row.get("name") or row.get("slug") or row_id,
                "template_json": template_json,
            }
        )
    return templates


def build_programs_from_templates(templates: List[Dict[str, Any]]) -> List[ProgramRow]:
    programs: List[ProgramRow] = []
    for template in templates:
        meta = template["template_json"].get("meta", {}) if isinstance(template["template_json"], dict) else {}
        frequency = meta.get("frequency_per_week")
        if isinstance(frequency, str) and frequency.isdigit():
            frequency = int(frequency)
        if not isinstance(frequency, int):
            frequency = None
        split = template["template_json"].get("split", []) if isinstance(template["template_json"], dict) else []
        inferred_days = len(split) if isinstance(split, list) else 0
        days = frequency or inferred_days or 3
        programs.append(
            ProgramRow(
                slug=template["slug"],
                name=template["name"],
                program_type="slot_based",
                min_days_per_week=days,
                max_days_per_week=days,
                default_days_per_week=days,
                description=None,
                metadata={"source_template_id": template.get("id"), "meta": meta},
            )
        )
    return programs


def build_program_days_and_slots(
    templates: List[Dict[str, Any]],
    exercise_lookup: Dict[str, ExerciseRow],
    muscle_id_to_slug: Dict[int, str],
) -> Tuple[List[ProgramDayRow], List[ProgramSlotRow]]:
    program_days: List[ProgramDayRow] = []
    program_slots: List[ProgramSlotRow] = []

    for template in templates:
        template_json = template["template_json"]
        split = template_json.get("split", []) if isinstance(template_json, dict) else []
        if not isinstance(split, list):
            continue
        for day_index, split_day in enumerate(split):
            day_name = split_day.get("day") or f"Day {day_index + 1}"
            program_days.append(
                ProgramDayRow(
                    program_slug=template["slug"],
                    day_index=day_index,
                    name=day_name,
                    theme_tags=[],
                )
            )
            exercises = split_day.get("exercises", []) if isinstance(split_day, dict) else []
            if not isinstance(exercises, list):
                continue
            for slot_index, slot in enumerate(exercises):
                canonical_name = str(slot.get("canonical_name") or slot.get("name") or "").strip()
                lookup_key = canonical_name.lower()
                exercise = exercise_lookup.get(lookup_key)
                if exercise is None and canonical_name:
                    exercise = exercise_lookup.get(slugify(canonical_name))
                movement_pattern = exercise.movement_pattern if exercise else None
                locked_exercise_slug = exercise.slug if exercise else None

                sets_min, sets_max = parse_range(slot.get("sets"), 2, 4)
                reps_min, reps_max = parse_range(slot.get("reps"), 6, 12)
                rir_min, rir_max = parse_range(slot.get("rir"), 0, 0)
                if slot.get("rir") is None or str(slot.get("rir")).strip() == "":
                    rir_min = None
                    rir_max = None

                muscle_targets: Dict[str, float] = {}
                if exercise and exercise.primary_muscle_group_id and exercise.primary_muscle_group_id in muscle_id_to_slug:
                    primary_slug = muscle_id_to_slug[exercise.primary_muscle_group_id]
                    muscle_targets[primary_slug] = 1.0
                if exercise:
                    for secondary_id in exercise.secondary_muscle_group_ids:
                        if secondary_id in muscle_id_to_slug:
                            muscle_targets[muscle_id_to_slug[secondary_id]] = 0.5

                program_slots.append(
                    ProgramSlotRow(
                        program_slug=template["slug"],
                        day_index=day_index,
                        slot_index=slot_index,
                        slot_type="accessory",
                        lock_type="flex",
                        locked_exercise_slug=locked_exercise_slug,
                        movement_pattern=movement_pattern,
                        equipment_allowed=[],
                        tags_required=[],
                        tags_blocked=[],
                        sets_min=sets_min,
                        sets_max=sets_max,
                        reps_min=reps_min,
                        reps_max=reps_max,
                        rir_min=rir_min,
                        rir_max=rir_max,
                        muscle_targets=muscle_targets,
                        prescription={
                            "sets": slot.get("sets"),
                            "reps": slot.get("reps"),
                            "rir": slot.get("rir"),
                        },
                        is_optional=False,
                    )
                )

    return program_days, program_slots


def emit_muscle_groups_sql(rows: List[MuscleGroupRow]) -> List[str]:
    statements: List[str] = []
    for row in rows:
        columns = ["slug", "name"]
        values = [sql_literal(row.slug), sql_literal(row.name)]
        if row.id is not None:
            columns.insert(0, "id")
            values.insert(0, str(row.id))
        statements.append(
            "insert into public.muscle_groups ({cols}) values ({vals}) "
            "on conflict (slug) do update set name = excluded.name;".format(
                cols=", ".join(columns),
                vals=", ".join(values),
            )
        )
    return statements


def emit_exercises_sql(rows: List[ExerciseRow]) -> List[str]:
    statements: List[str] = []
    for row in rows:
        columns = [
            "slug",
            "name",
            "movement_pattern",
            "equipment",
            "is_bodyweight",
            "aliases",
            "tags",
            "media",
            "contraindications",
            "is_active",
        ]
        values = [
            sql_literal(row.slug),
            sql_literal(row.name),
            sql_literal(row.movement_pattern),
            sql_json(row.equipment),
            "true" if row.is_bodyweight else "false",
            sql_json(row.aliases),
            sql_json(row.tags),
            sql_json(row.media),
            sql_json(row.contraindications),
            "true" if row.is_active else "false",
        ]
        if row.id is not None:
            columns.insert(0, "id")
            values.insert(0, str(row.id))
        statements.append(
            "insert into public.exercises ({cols}) values ({vals}) "
            "on conflict (slug) do update set "
            "name = excluded.name, "
            "movement_pattern = excluded.movement_pattern, "
            "equipment = excluded.equipment, "
            "is_bodyweight = excluded.is_bodyweight, "
            "aliases = excluded.aliases, "
            "tags = excluded.tags, "
            "media = excluded.media, "
            "contraindications = excluded.contraindications, "
            "is_active = excluded.is_active;".format(
                cols=", ".join(columns),
                vals=", ".join(values),
            )
        )
    return statements


def emit_exercise_muscle_map_sql(
    exercises: List[ExerciseRow], muscle_id_to_slug: Dict[int, str]
) -> List[str]:
    statements: List[str] = []
    for exercise in exercises:
        if exercise.primary_muscle_group_id and exercise.primary_muscle_group_id in muscle_id_to_slug:
            muscle_slug = muscle_id_to_slug[exercise.primary_muscle_group_id]
            statements.append(
                "insert into public.exercise_muscle_map (exercise_id, muscle_group_id, role, contribution) "
                "values ("
                "(select id from public.exercises where slug = {exercise_slug}), "
                "(select id from public.muscle_groups where slug = {muscle_slug}), "
                "'primary', 1.0) "
                "on conflict (exercise_id, muscle_group_id) do update set "
                "role = excluded.role, contribution = excluded.contribution;".format(
                    exercise_slug=sql_literal(exercise.slug),
                    muscle_slug=sql_literal(muscle_slug),
                )
            )
        for secondary_id in exercise.secondary_muscle_group_ids:
            if secondary_id in muscle_id_to_slug:
                muscle_slug = muscle_id_to_slug[secondary_id]
                statements.append(
                    "insert into public.exercise_muscle_map (exercise_id, muscle_group_id, role, contribution) "
                    "values ("
                    "(select id from public.exercises where slug = {exercise_slug}), "
                    "(select id from public.muscle_groups where slug = {muscle_slug}), "
                    "'secondary', 0.5) "
                    "on conflict (exercise_id, muscle_group_id) do update set "
                    "role = excluded.role, contribution = excluded.contribution;".format(
                        exercise_slug=sql_literal(exercise.slug),
                        muscle_slug=sql_literal(muscle_slug),
                    )
                )
    return statements


def emit_programs_sql(programs: List[ProgramRow]) -> List[str]:
    statements: List[str] = []
    for program in programs:
        statements.append(
            "insert into public.programs "
            "(slug, name, program_type, min_days_per_week, max_days_per_week, default_days_per_week, description, metadata) "
            "values ({slug}, {name}, {ptype}, {min_days}, {max_days}, {default_days}, {description}, {metadata}) "
            "on conflict (slug) do update set "
            "name = excluded.name, "
            "program_type = excluded.program_type, "
            "min_days_per_week = excluded.min_days_per_week, "
            "max_days_per_week = excluded.max_days_per_week, "
            "default_days_per_week = excluded.default_days_per_week, "
            "description = excluded.description, "
            "metadata = excluded.metadata;".format(
                slug=sql_literal(program.slug),
                name=sql_literal(program.name),
                ptype=sql_literal(program.program_type),
                min_days=program.min_days_per_week,
                max_days=program.max_days_per_week,
                default_days=program.default_days_per_week,
                description=sql_literal(program.description) if program.description else "NULL",
                metadata=sql_json(program.metadata),
            )
        )
    return statements


def emit_program_days_sql(program_days: List[ProgramDayRow]) -> List[str]:
    statements: List[str] = []
    for day in program_days:
        statements.append(
            "insert into public.program_days (program_id, day_index, name, theme_tags) "
            "values ("
            "(select id from public.programs where slug = {program_slug}), "
            "{day_index}, {name}, {theme_tags}) "
            "on conflict (program_id, day_index) do update set "
            "name = excluded.name, theme_tags = excluded.theme_tags;".format(
                program_slug=sql_literal(day.program_slug),
                day_index=day.day_index,
                name=sql_literal(day.name),
                theme_tags=sql_json(day.theme_tags),
            )
        )
    return statements


def emit_program_slots_sql(program_slots: List[ProgramSlotRow]) -> List[str]:
    statements: List[str] = []
    for slot in program_slots:
        locked_exercise_clause = (
            "(select id from public.exercises where slug = {slug})".format(
                slug=sql_literal(slot.locked_exercise_slug)
            )
            if slot.locked_exercise_slug
            else "NULL"
        )
        statements.append(
            "insert into public.program_slots ("
            "program_day_id, slot_index, slot_type, lock_type, locked_exercise_id, "
            "movement_pattern, equipment_allowed, tags_required, tags_blocked, "
            "sets_min, sets_max, reps_min, reps_max, rir_min, rir_max, "
            "muscle_targets, prescription, is_optional"
            ") values ("
            "(select id from public.program_days where program_id = "
            "(select id from public.programs where slug = {program_slug}) "
            "and day_index = {day_index}), "
            "{slot_index}, {slot_type}, {lock_type}, {locked_exercise_id}, "
            "{movement_pattern}, {equipment_allowed}, {tags_required}, {tags_blocked}, "
            "{sets_min}, {sets_max}, {reps_min}, {reps_max}, {rir_min}, {rir_max}, "
            "{muscle_targets}, {prescription}, {is_optional}"
            ") on conflict (program_day_id, slot_index) do update set "
            "slot_type = excluded.slot_type, "
            "lock_type = excluded.lock_type, "
            "locked_exercise_id = excluded.locked_exercise_id, "
            "movement_pattern = excluded.movement_pattern, "
            "equipment_allowed = excluded.equipment_allowed, "
            "tags_required = excluded.tags_required, "
            "tags_blocked = excluded.tags_blocked, "
            "sets_min = excluded.sets_min, "
            "sets_max = excluded.sets_max, "
            "reps_min = excluded.reps_min, "
            "reps_max = excluded.reps_max, "
            "rir_min = excluded.rir_min, "
            "rir_max = excluded.rir_max, "
            "muscle_targets = excluded.muscle_targets, "
            "prescription = excluded.prescription, "
            "is_optional = excluded.is_optional;".format(
                program_slug=sql_literal(slot.program_slug),
                day_index=slot.day_index,
                slot_index=slot.slot_index,
                slot_type=sql_literal(slot.slot_type),
                lock_type=sql_literal(slot.lock_type),
                locked_exercise_id=locked_exercise_clause,
                movement_pattern=sql_literal(slot.movement_pattern)
                if slot.movement_pattern
                else "NULL",
                equipment_allowed=sql_json(slot.equipment_allowed),
                tags_required=sql_json(slot.tags_required),
                tags_blocked=sql_json(slot.tags_blocked),
                sets_min=slot.sets_min,
                sets_max=slot.sets_max,
                reps_min=slot.reps_min,
                reps_max=slot.reps_max,
                rir_min="NULL" if slot.rir_min is None else slot.rir_min,
                rir_max="NULL" if slot.rir_max is None else slot.rir_max,
                muscle_targets=sql_json(slot.muscle_targets),
                prescription=sql_json(slot.prescription),
                is_optional="true" if slot.is_optional else "false",
            )
        )
    return statements


def write_sql(output_path: Path, statements: Iterable[str]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        handle.write("-- Generated by packages/db/scripts/import_reference_data.py\n")
        handle.write("begin;\n\n")
        for statement in statements:
            handle.write(statement)
            handle.write("\n")
        handle.write("\ncommit;\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate SQL upserts for reference data.")
    parser.add_argument("--muscle-groups-csv", type=Path, default=None)
    parser.add_argument("--exercises-csv", type=Path, default=None)
    parser.add_argument("--templates-csv", type=Path, default=None)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    statements: List[str] = []
    muscle_id_to_slug: Dict[int, str] = {}

    muscle_groups: List[MuscleGroupRow] = []
    if args.muscle_groups_csv:
        muscle_groups, muscle_id_to_slug = load_muscle_groups(args.muscle_groups_csv)
        statements.extend(emit_muscle_groups_sql(muscle_groups))

    exercises: List[ExerciseRow] = []
    exercise_lookup: Dict[str, ExerciseRow] = {}
    if args.exercises_csv:
        exercises, exercise_lookup = load_exercises(args.exercises_csv)
        statements.extend(emit_exercises_sql(exercises))
        if muscle_id_to_slug:
            statements.extend(emit_exercise_muscle_map_sql(exercises, muscle_id_to_slug))

    templates: List[Dict[str, Any]] = []
    if args.templates_csv:
        templates = load_templates(args.templates_csv)
        programs = build_programs_from_templates(templates)
        program_days, program_slots = build_program_days_and_slots(
            templates, exercise_lookup, muscle_id_to_slug
        )
        statements.extend(emit_programs_sql(programs))
        statements.extend(emit_program_days_sql(program_days))
        statements.extend(emit_program_slots_sql(program_slots))

    if not statements:
        raise SystemExit("No input CSVs provided; nothing to generate.")

    write_sql(args.output, statements)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
