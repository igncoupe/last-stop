# Last Stop

A horror story game about the last bus of the night.

**▶ Play it: https://igncoupe.github.io/last-stop/**

You're the new driver on Route 9, the last bus of the night. There's a rule: don't run late, and don't let anyone ride free. Every night, a stop with no name appears on your route display, a little closer than the night before.

Be careful who you stop for. Be more careful who you don't.

- 5 nights, 4 endings
- Every choice is remembered
- Generated horror score, rain, radio static and jumpscares (no audio files)
- Best played in the dark, with headphones

> Content warning: jumpscares, loud sounds, flashing images, and themes of death, drowning and grief. Jumpscares and flashing can be turned off on the title screen.

## Controls

| Key | Does |
| --- | --- |
| Click / `Space` | Skip the typing |
| `1`–`4` | Pick a choice |
| `M` | Mute |

## How it's built

Plain HTML, CSS and JavaScript. No build step, no installs.

```
index.html          the page
css/style.css       the look: windshield view, mirror, rain, grain, captions
js/audio.js         all music and sound effects, generated with the Web Audio API
js/engine.js        runs the story: captions, choices, jumpscares, saving
js/story/setup.js   characters, routes, and the scene format (read this first)
js/story/night1-5   the story, one file per night
```

## Editing the story

Everything is in `js/story/`. The top of `setup.js` explains the scene format. The short version:

```js
n1_elm: {
  stop: "Elm & 4th",
  mood: "dread",
  lines: [
    "Narration is a plain string.",
    { who: "mara", text: "Dialogue has a speaker." },
    { scare: "face" },
  ],
  choices: [
    { text: "Wait for her.", late: 2, kind: 1, set: { maraHelped: true }, next: "n1_mara" },
  ],
},
```

You can edit right on GitHub without downloading anything. Press `.` on the repo page to open the web editor, change a file, and commit. The live game updates in about a minute.

**Testing tricks:** add `?debug` to the end of the game's URL to see the hidden state (kindness, lateness, flags). Use `?debug&scene=n3_start` to jump straight to a scene.

## Adding voice acting

Every line can have a recorded voice. Give a line a `vo` name:

```js
{ who: "mara", text: "Thank you. Oh my god, thank you.", vo: "n1_mara_1" },
```

Then upload the recording as `audio/vo/n1_mara_1.mp3`. The caption still shows, and the game waits for the clip to finish. Lines without a recording just show the caption.
