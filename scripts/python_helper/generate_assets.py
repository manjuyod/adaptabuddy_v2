#!/usr/bin/env python3.13
"""
Generate image assets with OpenAI image models.

Examples:
  uv run --project scripts/python_helper --python 3.13 python scripts/python_helper/generate_assets.py ^
    --prompt "Retro game title screen, orange and teal, no text" ^
    --output-dir "apps/web/public/generated" ^
    --filename-prefix "title_bg"

  uv run --project scripts/python_helper --python 3.13 python scripts/python_helper/generate_assets.py ^
    --prompt "Isometric dumbbell icon pack, flat style" ^
    --count 4 ^
    --size 1024x1024
"""

from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import os
import re
from pathlib import Path
import time
from typing import Any
import urllib.request

DEFAULT_MODEL_ALIAS = "auto"
MODEL_ALIASES = {
    "auto": ["dall-e-3", "gpt-image-latest", "gpt-image-1"],
    "dall_e3_then_gpt_image_latest": ["dall-e-3", "gpt-image-latest", "gpt-image-1"],
    "dall-e-3": ["dall-e-3", "gpt-image-latest", "gpt-image-1"],
    "gpt_image_latest": ["gpt-image-latest", "gpt-image-1"],
    "gpt-image-latest": ["gpt-image-latest", "gpt-image-1"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate image assets with OpenAI.")
    parser.add_argument("--prompt", required=True, help="Prompt used to generate image assets.")
    parser.add_argument(
        "--model",
        default=os.getenv("OPENAI_IMAGE_MODEL", DEFAULT_MODEL_ALIAS),
        help="Model name or alias (default: OPENAI_IMAGE_MODEL or auto = dall-e-3 -> gpt-image-latest).",
    )
    parser.add_argument(
        "--size",
        default=os.getenv("OPENAI_IMAGE_SIZE", "1024x1024"),
        help="Image size passed to the API (for example 1024x1024).",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=1,
        help="Total number of images to generate.",
    )
    parser.add_argument(
        "--images-per-minute",
        type=float,
        default=float(os.getenv("OPENAI_IMAGE_RATE_LIMIT_IPM", "7")),
        help="Throttle image generation requests per minute (default: 7). Set 0 to disable.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("tmp/generated_assets"),
        help="Directory where generated assets are written.",
    )
    parser.add_argument(
        "--filename-prefix",
        default=None,
        help="Optional filename prefix; if omitted, a timestamped name is used.",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path(".env"),
        help="Optional dotenv file to preload (default: .env).",
    )
    return parser.parse_args()


def resolve_model_candidates(model: str) -> list[str]:
    cleaned = model.strip()
    candidates = MODEL_ALIASES.get(cleaned)
    if candidates:
        return candidates
    return [cleaned]


def slugify(value: str) -> str:
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "asset"


def require_api_key() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit(
            "OPENAI_API_KEY is not set. Add it to your shell env or .env before running this script."
        )


def decode_image_payload(image_item: Any) -> bytes:
    b64_payload = getattr(image_item, "b64_json", None)
    if b64_payload:
        return base64.b64decode(b64_payload)

    image_url = getattr(image_item, "url", None)
    if image_url:
        with urllib.request.urlopen(image_url, timeout=30) as response:
            return response.read()

    raise ValueError("Image payload did not include `b64_json` or `url`.")


def output_path_for(
    output_dir: Path,
    filename_prefix: str | None,
    prompt: str,
    index: int,
    total: int,
) -> Path:
    if filename_prefix:
        stem = slugify(filename_prefix)
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        stem = f"{slugify(prompt)[:48]}_{timestamp}"

    if total == 1:
        return output_dir / f"{stem}.png"
    return output_dir / f"{stem}_{index:02d}.png"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if (
            len(value) >= 2
            and ((value[0] == '"' and value[-1] == '"') or (value[0] == "'" and value[-1] == "'"))
        ):
            value = value[1:-1]

        os.environ.setdefault(key, value)


def create_openai_client() -> Any:
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: install the OpenAI Python SDK with `pip install openai`."
        ) from exc
    return OpenAI()


def main() -> None:
    args = parse_args()

    if args.count < 1:
        raise SystemExit("--count must be at least 1.")
    if args.images_per_minute < 0:
        raise SystemExit("--images-per-minute must be >= 0.")

    load_env_file(args.env_file)
    require_api_key()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    model_candidates = resolve_model_candidates(args.model)
    client = create_openai_client()

    saved_paths: list[Path] = []
    used_models: list[str] = []
    min_interval = 0.0
    if args.images_per_minute > 0:
        min_interval = 60.0 / args.images_per_minute
    next_allowed_start = 0.0

    for index in range(1, args.count + 1):
        if min_interval > 0 and index > 1:
            now = time.monotonic()
            if now < next_allowed_start:
                time.sleep(next_allowed_start - now)

        request_started = time.monotonic()
        last_error: Exception | None = None
        chosen_model: str | None = None
        chosen_item: Any | None = None

        for model_index, candidate in enumerate(model_candidates):
            try:
                response = client.images.generate(
                    model=candidate,
                    prompt=args.prompt,
                    n=1,
                    size=args.size,
                )
                if not response.data:
                    raise ValueError(f"No image data returned for model `{candidate}`.")
                chosen_model = candidate
                chosen_item = response.data[0]
                if model_index > 0:
                    model_candidates.insert(0, model_candidates.pop(model_index))
                break
            except Exception as exc:
                last_error = exc

        if chosen_model is None or chosen_item is None:
            message = f"Image generation failed: {last_error}" if last_error else "Image generation failed."
            raise SystemExit(message)

        payload = decode_image_payload(chosen_item)
        output_path = output_path_for(
            output_dir=args.output_dir,
            filename_prefix=args.filename_prefix,
            prompt=args.prompt,
            index=index,
            total=args.count,
        )
        output_path.write_bytes(payload)
        saved_paths.append(output_path)
        used_models.append(chosen_model)

        if min_interval > 0:
            next_allowed_start = request_started + min_interval

    unique_models = ", ".join(sorted(set(used_models)))
    print(f"Model(s) used: {unique_models}")
    print(f"Saved {len(saved_paths)} image(s):")
    for path in saved_paths:
        print(f" - {path}")


if __name__ == "__main__":
    main()
