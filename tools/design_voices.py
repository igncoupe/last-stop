"""New characters' voices, designed from a written description with Qwen3-TTS VoiceDesign (Apache 2.0):
new voices, not copies of anyone's. Each one says the same reference text as the other characters'
reference clips, and Higgs (tools/make_voices_higgs.py) then clones it for every line they speak.
Usage: python tools/design_voices.py [eddie dorothy ...]      (writes tools/refs/<who>.wav)
"""
import sys
from pathlib import Path

import soundfile as sf
import torch

REFS = Path(__file__).resolve().parent / "refs"
TEXT = ("I used to take the last bus home every night. The city gets so quiet at that hour. "
        "You can hear the rain on the roof, and you start thinking about the people you lost, "
        "and whether they ever really made it home.")
VOICES = {
    "eddie": "A seventeen-year-old Latino boy from a working-class city neighborhood, whose voice has already broken. "
             "A friendly young male voice, a light baritone. Talks quickly and cheerfully, a little tired after a late shift.",
    "dorothy": "An elderly woman in her mid-seventies, a retired schoolteacher. A low, warm, gentle old woman's voice "
               "with the soft rasp of age. Clear, careful diction, kind and a little amused.",
    "frank": "A big man in his early fifties, a mail carrier. A deep, low-pitched, husky baritone with a working-class "
             "American accent. Easygoing and warm, slightly out of breath.",
    "carmen": "A young Latina woman in her late twenties, a tired young mother. A soft, warm alto, speaking quietly, "
              "worried but gentle.",
    "marcus": "A young Black man in his mid-twenties. A smooth, warm baritone. Nervous and excited, like he's smiling "
              "while he talks.",
}


def main():
    # python tools/design_voices.py eddie frank --seeds 7,42,99   -> tools/refs/candidates/<who>_<seed>.wav to choose from
    args = sys.argv[1:]
    seeds = None
    if "--seeds" in args:
        i = args.index("--seeds")
        seeds = [int(s) for s in args[i + 1].split(",")]
        args = args[:i] + args[i + 2:]
    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
    (REFS / "candidates").mkdir(exist_ok=True)
    for who in args or list(VOICES):
        for seed in seeds or [1994]:
            torch.manual_seed(seed)
            wavs, sr = model.generate_voice_design(text=TEXT, language="English", instruct=VOICES[who])
            out = REFS / "candidates" / f"{who}_{seed}.wav" if seeds else REFS / f"{who}.wav"
            sf.write(out, wavs[0], sr)
            print(f"designed {out.name}: {len(wavs[0]) / sr:.1f}s", flush=True)


if __name__ == "__main__":
    main()
