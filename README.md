# Last Stop

A first-person horror game about the last bus of the night.

**▶ Play it: https://igncoupe.github.io/last-stop/** (on a computer with a keyboard and mouse)

You're the new driver on Route 9, the last bus of the night. Two rules: don't run late, and don't let anyone ride free. Every night a stop with no name appears on your route display, a little closer than the night before.

Be careful who you stop for. Be more careful who you don't.

- 3D, first person, with a low-poly PS1 look
- You really drive the bus. You choose who to stop for by pulling over and opening the doors.
- Every character is voiced (voices created with Boson AI's Higgs Audio), with subtitles
- 5 nights, about an hour, and 4 endings
- A generated horror score, rain, radio static, and in-world jumpscares: the drowned, a shadow that stalks the route, and cars on the other side of the road that aren't right

> Content warning: jumpscares, loud sounds, flashing lights, and themes of death, drowning and grief. Jumpscares can be turned off on the title screen.

## Controls

| Key | Does |
| --- | --- |
| Mouse | Look around (click the game to grab the mouse) |
| `W` / `S` | Gas / brake (walk when on foot) |
| `F` | Open / close the bus doors |
| `E` | Interact |
| `1`–`3` | Pick a dialogue option |
| `Esc` | Pause |

## How it's built

Plain HTML and JavaScript with [three.js](https://threejs.org) loaded from a CDN. No build step. Every model, texture and sound is generated in code; the only files are the voice lines.

```
index.html             the page
css/style.css          subtitles, menus, jumpscares
js/main.js             starts everything and plays the nights in order
js/core/               PS1-style rendering, generated textures, input, UI
js/world/              the route, the city, stops, the bus, people, the hospital and bridge
js/game/               driving, the player, and the director (the story toolbox)
js/audio.js            generated music + sound effects, and the voice player
js/story/cast.js       every character: subtitle color, voice effect, AI voice
js/story/night1-5.js   the story, one file per night
voices/                one MP3 per line, plus manifest.json
tools/                 scripts that make the voices
```

## Editing the story

Each night is a script. It reads like a screenplay:

```js
const stopped = await g.arrive("Elm & 4th");      // wait until the bus stops there (or drives past)
if (stopped && (await openUp(g))) {
  await g.say("mara", "Thank you. Oh my god, thank you.");
  const c = await g.choose(["“Sit down.”", "[Say nothing]"]);
  await g.scare("face");
}
```

Lines in `g.say`, `g.think` and `g.choose` must be plain `"double-quoted"` strings so the voice tools can find them.

## Making the voices

Voices created with Boson AI's Higgs Audio: every line is recorded with [Higgs TTS 3](https://huggingface.co/bosonai/higgs-tts-3-4b), under Boson AI's Creator Use Grant. Each character keeps their own voice, cloned from a short reference clip in `tools/refs/` (made earlier with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx)). The driver (you) was designed with [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) from a written description, a new voice and not a copy of anyone's, in three deliveries (weary, scared, terrified) kept in `tools/refs/driver_*.wav`; each of his lines uses the delivery that fits it.

Every take is checked twice before it's kept: Whisper has to hear the words in the script, and a speaker-match check (SpeechBrain ECAPA, plus pitch) has to agree it's the same person as the reference, so a line can't come out in someone else's voice. Takes that fail are recorded again. After changing any lines:

```bash
node tools/extract-lines.mjs
python tools/make_voices_higgs.py generate          # GPU Python with Higgs (see the script for setup)
python tools/make_voices_higgs.py voices            # CPU Python with speechbrain: the voice check
python tools/make_voices_higgs.py generate --redo   # records again whatever failed
```

Only new or changed lines get recorded. The older tools (`make_voices.py` for Chatterbox, `make_voices_kokoro.py`, `make_driver_voice.py`) still work as fallbacks.

Want real actors instead? Record a line and save it over its file in `voices/` (the file name is in `voices/manifest.json`).

## Testing tricks

- Add `?night=3` to the URL and press New game to start on a later night.
- **Automatic playtester:** `?test&fast=10&bot=kind` plays the whole game by itself at 10x speed, silently (add `&sound` to hear it) and reports errors, dead ends and the ending in `window.__botReport` (open the browser console). Strategies: `kind` (stops for everyone), `cold` (stops for no one), `deadair` (goes for the true ending), `random`.
