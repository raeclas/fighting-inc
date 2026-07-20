# gen_icons.py — one ability-icon candidate per skill in skills.json.
# Icons are small abstract emblems: one candidate at low steps is enough;
# the skill-bar letter stays as fallback for any that miss.
# Usage: .venv/Scripts/python gen_icons.py [skillId ...]
import json
import sys
from pathlib import Path

import torch
from diffusers import StableDiffusionXLPipeline

HERE = Path(__file__).parent
RAW = HERE / "out" / "icons_raw"

STYLE = ("pixel art ability icon, 16-bit RPG spell icon, dark fantasy, "
         "single glowing emblem centered, flat dark square background, no text, no border")
NEG = "text, letters, watermark, photorealistic, 3d render, frame, border"

def main():
    skills = json.loads((HERE / "skills.json").read_text())
    ids = sys.argv[1:]
    if ids:
        skills = [s for s in skills if s["id"] in ids]

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
    ).to("cuda")
    pipe.load_lora_weights("nerijs/pixel-art-xl")

    RAW.mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(skills):
        out = RAW / f"{s['id']}.png"
        if out.exists() and not ids:
            continue  # resumable across interrupted runs
        g = torch.Generator("cuda").manual_seed(7000 + i)
        img = pipe(
            prompt=f"{STYLE}, {s['name']}", negative_prompt=NEG,
            num_inference_steps=16, guidance_scale=6.0,
            width=512, height=512, generator=g,
        ).images[0]
        img.save(out)
        print(f"[{i + 1}/{len(skills)}] {s['id']}", flush=True)

if __name__ == "__main__":
    main()
