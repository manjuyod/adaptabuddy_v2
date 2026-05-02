# Python Helper

This folder contains the image asset generator CLI:

- `generate_assets.py`

## Prerequisites

- `uv` installed
- Python `3.13` available to `uv`
- `OPENAI_API_KEY` set in your repo `.env` (or shell env)

## Quick Start (from this directory)

```powershell
cd scripts/python_helper
uv sync --python 3.13
uv run --python 3.13 python generate_assets.py --prompt "your prompt"
```

## Example Command

```powershell
uv run --python 3.13 python generate_assets.py `
  --prompt "HD-2D pixel diorama fantasy village, clean center for login UI, stylized pixel-art, no text" `
  --size 1792x1024 `
  --count 3 `
  --output-dir ..\..\assets\login `
  --filename-prefix login_bg_hd2d `
  --env-file ..\..\.env
```

Note: model selection defaults to `dall-e-3` first, then falls back to `gpt-image-latest`.

## Run From Repo Root (optional)

```powershell
uv sync --project scripts/python_helper --python 3.13
uv run --project scripts/python_helper --python 3.13 python scripts/python_helper/generate_assets.py --prompt "your prompt"
```
