# gen.py — batch sprite candidate generator.
# SDXL base + pixel-art LoRA (nerijs/pixel-art-xl), fp16 on CUDA.
# Usage:
#   .venv/Scripts/python gen.py            # all manifest assets
#   .venv/Scripts/python gen.py kiln slag  # just these ids
#   .venv/Scripts/python gen.py --n 6      # candidates per asset (default 4)
# Raw 1024px candidates land in out/raw/<id>_<n>.png; run pixelize.py next.
import argparse
import json
import sys
from pathlib import Path

import torch
from diffusers import StableDiffusionXLPipeline

HERE = Path(__file__).parent
RAW = HERE / "out" / "raw"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="asset ids from manifest.json (default: all)")
    ap.add_argument("--n", type=int, default=4, help="candidates per asset")
    ap.add_argument("--seed", type=int, default=17, help="base seed (asset+index offsets)")
    args = ap.parse_args()

    m = json.loads((HERE / "manifest.json").read_text())
    assets = [a for a in m["assets"] if not args.ids or a["id"] in args.ids]
    if not assets:
        sys.exit(f"no assets matched {args.ids}")

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
    ).to("cuda")
    pipe.load_lora_weights("nerijs/pixel-art-xl")
    # ponytail: no compile/offload tuning — 4070S does ~2s/img as-is

    RAW.mkdir(parents=True, exist_ok=True)
    for ai, a in enumerate(assets):
        prompt = f"{m['style']}, {a['prompt']}"
        for i in range(args.n):
            g = torch.Generator("cuda").manual_seed(args.seed + ai * 100 + i)
            img = pipe(
                prompt=prompt, negative_prompt=m["negative"],
                num_inference_steps=28, guidance_scale=7.0,
                width=1024, height=1024, generator=g,
            ).images[0]
            p = RAW / f"{a['id']}_{i}.png"
            img.save(p)
            print(f"[{a['id']}] {i + 1}/{args.n} -> {p.name}", flush=True)

if __name__ == "__main__":
    main()
