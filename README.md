# The Last Stop

A first-person horror game about the last bus of the night.

**▶ Play it: https://igncoupe.github.io/last-stop/** (on a computer with a keyboard and mouse)

You're the new driver on Route 9, the last bus of the night. Two rules: don't run late, and don't let anyone ride free. Every night a stop with no name appears on your route display, a little closer than the night before.

Be careful who you stop for. Be more careful who you don't.

- 3D, first person, with a low-poly PS1 look
- You really drive the bus. You choose who to stop for by pulling over and opening the doors.
- Every character is voiced and acted (voices created with ElevenLabs), with subtitles. Your own thoughts show up marked "(in your head)": the ones that hurt are spoken, the rest you just read
- 5 nights, about an hour, and 4 endings
- Fourteen people drowned on Route 9 in 1994. Some of them still ride it, and some flag you down where there's no stop.
- The Route 9 file: 24 things to find for yourself (missing posters on the shelters, clippings in an old locker at the depot, the 1994 driver's log on your dash). Read every poster and, if you get them home, you'll know all their names.
- A generated horror score, rain, radio static, and in-world jumpscares: the drowned, a shadow that stalks the route, and cars on the other side of the road that aren't right

> Content warning: jumpscares, loud sounds, flashing lights, and themes of death, drowning and grief. Jumpscares can be turned off on the title screen.

## Controls

| Key | Does |
| --- | --- |
| Mouse | Look around (click the game to grab the mouse) |
| `W` / `S` | Gas / brake (walk when on foot) |
| `F` | Open / close the bus doors |
| `H` | Horn (most of the time) |
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

Lines in `g.say`, `g.think` and `g.choose` must be plain `"double-quoted"` strings so the voice tools can find them. `g.muse("...")` (and `g.readQuiet`) is a thought that's only written on screen, never voiced: use it for what the driver notices, and `g.think` for what he feels.

## Making the voices

Voices created with [ElevenLabs](https://elevenlabs.io). Every character has a new voice designed from a written description (ElevenLabs Voice Design; none of them is a copy of anyone real), and every line is spoken with Eleven v4. Each line also has a performance direction in `tools/el-direction.txt`, written scene by scene from inside the character at that moment (`[terrified] [whispers]`, `[crying] [proud]`...), so the feeling changes as the story does. Teodor plays at 1.5x speed. The driver is a Black man from the city, designed with an easy African American accent (`design you`, candidate 0). Characters swear when a moment earns it. Ivy's three lines are recorded with Boson AI's Higgs Audio ([Higgs TTS 3](https://huggingface.co/bosonai/higgs-tts-3-4b)), because ElevenLabs doesn't make children's voices.

Every take is checked before it's kept: Whisper has to hear the words in the script, and a speaker-match check (SpeechBrain ECAPA) has to agree it's the same character. Takes that fail are recorded again. The API key is read from `~/.elevenlabs_key`, a file you make yourself; it never goes in this repo. After changing any lines:

```bash
node tools/extract-lines.mjs
python tools/make_voices_elevenlabs.py credits      # characters left this month
python tools/make_voices_elevenlabs.py generate     # records new or changed lines (stops at --budget)
python tools/make_voices_elevenlabs.py voices       # the same-character check (CPU Python with speechbrain)
python tools/make_voices_elevenlabs.py generate --redo
```

New lines need a direction in `tools/el-direction.txt` too (or they get a simple one). The cast is in `tools/elevenlabs-voices.json`; `design`, `audition`, `remix` and `create` make and pick voices. The Higgs tool (`make_voices_higgs.py`) and the older ones still work as fallbacks.

Want real actors instead? Record a line and save it over its file in `voices/` (the file name is in `voices/manifest.json`).

## Testing tricks

- Add `?night=3` to the URL and press New game to start on a later night.
- **Automatic playtester:** `?test&fast=10&bot=kind` plays the whole game by itself at 10x speed, silently (add `&sound` to hear it) and reports errors, dead ends and the ending in `window.__botReport` (open the browser console). Strategies: `kind` (stops for everyone), `cold` (stops for no one), `deadair` (goes for the true ending), `random`.

## Making the trailer

The Steam trailer is cut from the game itself, in `tools/trailer/`:

1. `python tools/trailer/server.py OUT_DIR` serves the game and saves what the capture sends it (raw pixels from the
   GPU become PNGs on the server side, so capture stays fast; it needs NumPy and Pillow).
2. Open a test run (`?test&fast=10&bot=...&night=N`) at a 1920x1080 window with the browser in view, then in the console
   `const S = await import("/tools/trailer/shots.js")`. When the story gets to the moment, `S.C.shoot("name", frames, { each })`
   takes over the clock and records exact 1/60 s steps (`window.__manual` and `window.__tick(dt)` do the stepping), while
   `each(t)` moves the camera (`S.aimAt`, `S.glider`, `S.C.freeCam`, `S.C.place`). `S.C.advance(done)` steps the game on
   without filming; `extra` films a second camera on the same frames.
3. With `?test&sound`, `tools/trailer/sounds.js` records the ambience, the score's moods, the effects and the voice lines
   through the game's own mix (Rhee stays on the radio). `S.C.subtitle` and `S.C.text` draw subtitles and cards in the
   game's fonts.
4. `python tools/trailer/make_trailer.py OUT_DIR "The Last Stop - Trailer.mp4"` cuts it: the edit (crossfades, whole
   lines, no jumpscares), the grade, the mix, and a 1920x1080 60 fps H.264 + AAC file for Steam (needs PyAV, Pillow,
   NumPy, SciPy and soundfile).
