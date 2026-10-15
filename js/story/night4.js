/* ===================================================================
   NIGHT 4 — "Channel 9 is still broadcasting."
   The real dispatcher. Who Rhee is. The clipping in the visor.
   The passengers board. The bus tries to drive itself into the river.
   Kindness available: brake at the bridge (+1), take Daniel's gift (+1)
   =================================================================== */
Object.assign(SCENES, {

  n4_start: {
    night: 4, stop: "Depot", mood: "uneasy", mirror: "empty", amb: { rain: 0.2, engine: 0.3 },
    lines: [
      { pause: 600 },
      "11:40 PM. Route 9. Fourth night.",
      "The back row is empty. No old man. Just a dark, wet stain on the seat that never dries.",
      "You do what the notice said. You turn the radio dial to Channel 4.",
      { sfx: "static", args: [0.8], pause: 900 },
      { who: "dana", text: "—Route 9? Route 9, is that you? Oh thank god. This is Dana, night dispatch." },
      { who: "dana", text: "Where have you been all week? We've had zero contact from your bus. Your GPS keeps dropping out at a spot that isn't on any map." },
      { who: "you", text: "I've been checking in every night. With Rhee. Night dispatch." },
      { pause: 1300 },
      { who: "dana", text: "...Rhee?" },
      { who: "dana", text: "Harold Rhee was dispatch here in the nineties. He ran Route 9 the night the bridge went down." },
      { who: "dana", text: "He died in '95. After the inquiry. They found him in the dispatch office with the radio still on." },
      { pause: 1000 },
      { mood: "dread", sfx: "static", args: [0.5] },
      { who: "rhee", text: "Hello, Dana." },
      { who: "dana", text: "Who is th—" },
      { sfx: "static", args: [1.2], pause: 1200 },
      "Channel 4 goes dead. The dial clicks back to 9 on its own.",
      { who: "rhee", text: "You don't need Channel 4, driver. You've got me." },
    ],
    choices: [
      { text: "Turn the radio off.", set: { radioOff: true }, next: "n4_radio_off" },
      { text: "Leave it. Don't make him angry. Drive.", next: "n4_elm" },
    ],
  },

  n4_radio_off: {
    stop: "Depot",
    lines: [
      "You twist the power knob until it clicks. The radio's display goes black.",
      { pause: 1400 },
      { who: "rhee", text: "That doesn't work, driver." },
      "The voice is coming from the speaker. The radio is off. There's no light on it at all.",
      { who: "rhee", text: "It didn't work for Teodor either." },
    ],
    choices: [{ text: "Pull out. Just get through tonight.", next: "n4_elm" }],
  },

  n4_elm: {
    stop: "Elm & 4th",
    lines: (s) => s.flags.maraHelped ? [
      { sfx: "door" },
      "Mara gets on. She's not in scrubs. She's in a coat, eyes red.",
      { who: "mara", text: "I'm not working tonight. I'm going in anyway. It's Mr. Varga. They think tonight. Maybe tomorrow." },
      ...(s.flags.visitedVarga ? [
        { who: "mara", text: "He woke up for about a minute after you left. He said, give this to the driver." },
        "She presses something into your hand. A brass name badge, the pin bent, the letters worn soft by a thumb.",
        { text: "T. VARGA — ROUTE 9", big: true },
      ] : [
        { who: "mara", text: "He keeps saying fourteen. Just the number. Over and over." },
      ]),
      "She sits behind you. Neither of you talks. The streetlights slide past.",
      "A glare from the next streetlight catches you full in the eyes. You pull down the sun visor.",
      "Something falls out of it into your lap.",
    ] : [
      "Elm & 4th. Nobody at the stop. Nobody at all.",
      "A glare from the streetlight catches you full in the eyes. You pull down the sun visor.",
      "Something falls out of it into your lap.",
    ],
    choices: [
      { text: "Read it.", set: { rheeTruth: true }, next: "n4_clipping" },
      { text: "Don't. Tuck it back. Drive.", next: "n4_market" },
    ],
  },

  n4_clipping: {
    stop: "Elm & 4th",
    mood: "dread",
    lines: [
      "A newspaper clipping, yellow and soft as cloth. Folded small. Someone kept it for a long time.",
      { text: "INQUIRY: DISPATCHER ORDERED BUS ONTO BRIDGE", big: true },
      "“Route 9 driver Teodor Varga radioed dispatch at 12:19 a.m. asking permission to wait out the storm at Northgate.”",
      "“Dispatcher Harold Rhee refused. Recordings show Rhee told Varga, eleven minutes behind schedule, to ‘make up the time’ by taking the Ashgrove bridge.”",
      "“Asked by the inquiry whether he regretted the order, Rhee said: ‘The schedule always comes first. That's the job.’”",
      { pause: 900 },
      "Under the article, in shaky pencil, someone has written one word over and over until the paper tore.",
      { text: "STOP STOP STOP STOP STOP STOP", big: true },
      { pause: 800 },
      { who: "rhee", text: "Put that away, driver." },
      { who: "rhee", text: "Teodor kept that for thirty years. Look where it got him." },
    ],
    choices: [{ text: "Fold it into your pocket. Drive.", next: "n4_market" }],
  },

  n4_market: {
    stop: "Market St",
    lines: (s) => (s.flags.junRode || s.flags.junFound) ? [
      "Market St. Jun is at the stop, but he doesn't get on. He's holding a thermos.",
      { sfx: "door" },
      { who: "jun", text: "From my mom. Soup. She says you look like you don't eat." },
      "He doesn't let go of it right away.",
      { who: "jun", text: "Don't go past Market tonight. Please. I had a dream. The bus was in the river and you were driving and all the windows were full of faces." },
      { who: "jun", text: "Just... if something tells you to go faster? Don't." },
    ] : [
      "Market St. The posters are gone. Torn down, or washed off.",
      "The bench is empty except for a soaked backpack nobody has claimed.",
      "You don't stop. You don't want to know if it's still there tomorrow.",
    ],
    choices: [{ text: "Drive on.", next: "n4_mystery" }],
  },

  n4_mystery: {
    stop: "???",
    mood: "dread",
    mirror: "empty",
    amb: { rain: 0.8 },
    lines: [
      "One block past Market St, the bus stops dead. The engine is still running.",
      "The shelter. Yellow light. Rain only inside it.",
      { sfx: "door" },
      "The doors open by themselves. This time, they don't wait for you.",
      "They get on.",
      { mirror: "full", sfx: "drip", pause: 600 },
      "One by one. A woman in a nurse's cardigan. A man with a wrapped present. A little girl in a yellow raincoat. Old people. Young people. A man in a work uniform with his lunchbox.",
      "Fourteen.",
      "They don't pay. They don't look at you. They sit, and they drip, and the floor of the bus starts to fill.",
      { fx: "flood", amb: { water: 0.6 }, pause: 600 },
      "Water. Around your shoes. Rising.",
      { who: "rhee", text: "There we go. Full bus. Just like the old days." },
      { who: "rhee", text: "You're eleven minutes late, driver." },
      "You're not. The clock says you're not.",
      { who: "rhee", text: "MAKE UP THE TIME." },
      { mood: "terror", amb: { engine: 1 }, shake: true },
      "The pedal sinks under your foot by itself. The bus lurches forward.",
      "You're not on the street anymore. The road is narrowing. The buildings are gone.",
      "Ahead, in the headlights, the ruins of a bridge reach out over black water.",
      { sfx: "heartbeat", args: [8, 120] },
      { who: "rhee", text: "Faster. FASTER. The schedule always comes first." },
    ],
    choices: [
      { text: "Stand on the brake with everything you've got.", kind: 1, set: { brakedN4: true }, next: "n4_brake" },
      { if: (s) => s.flags.rheeTruth, text: "“You said that to him too.” Brake, and don't let go.", kind: 1, set: { brakedN4: true, defiedRhee: true }, next: "n4_brake" },
      { text: "Do what the voice says. Floor it.", set: { obeyedN4: true }, next: "n4_obey" },
    ],
  },

  n4_brake: {
    stop: "???",
    lines: [
      { sfx: "brake", shake: true },
      "You stand on the brake. You put your whole body into it. The wheel fights you.",
      "The tires scream. The bus slews sideways. The black water fills the windshield.",
      { pause: 900 },
      { amb: { engine: 0.2 }, mood: "dread" },
      "It stops.",
      "The front wheels are on the last slab of the broken bridge. Under you, there's nothing. Just the river, waiting.",
      { pause: 1100 },
      { who: "voices", text: "...he stopped..." },
      { who: "voices", text: "...he stopped this time..." },
      "Behind you, fourteen people let out a breath they've been holding for thirty years.",
      { pause: 900 },
      { mirror: "face" },
      "You look up at the mirror.",
      { pause: 700 },
      { scare: "face" },
      { mirror: "empty", fx: "none", amb: { water: 0, rain: 0.2 } },
      "You're parked outside St. Agnes. The bus is dry. The engine ticks as it cools.",
      "There is a small box on the dashboard, wrapped in soggy paper printed with balloons.",
      "A tag on it, the ink run: FOR ROSIE. LOVE, DAD.",
      "Underneath, newer, in shaky handwriting: she waits at Elm & 4th. she doesn't know why.",
    ],
    onEnter: (s) => { s.flags.hasPresent = true; },
    choices: [
      { text: "Keep the present safe. You'll find her.", kind: 1, set: { keptPresent: true }, next: "n4_stagnes" },
      { text: "Leave it on the dash. This isn't your problem.", next: "n4_stagnes" },
    ],
  },

  n4_obey: {
    stop: "???",
    lines: [
      "You press down. The engine roars. The bus leaps forward.",
      { who: "rhee", text: "GOOD. GOOD DRIVER." },
      "The bridge rushes at you. The passengers don't scream. They've done this before.",
      { pause: 600 },
      { scare: "face" },
      { fx: "dark", amb: { engine: 0, water: 1 }, sfx: "splash", mood: "terror" },
      "Black. Cold. Water in your mouth, your nose, your lungs.",
      { sfx: "heartbeat", args: [4, 40], pause: 2600 },
      { fx: "none", amb: { water: 0 }, mood: "uneasy" },
      "You wake up coughing. You're parked outside St. Agnes. The bus is bone dry.",
      "Your clothes are soaked through.",
      { who: "rhee", text: "That's how it's done. You'll do it properly next time." },
    ],
    choices: [{ text: "Drive on.", next: "n4_stagnes" }],
  },

  n4_stagnes: {
    stop: "St. Agnes",
    mood: "grief",
    lines: (s) => [
      "St. Agnes.",
      ...(s.flags.maraHelped ? [
        "Mara gets off. On the bottom step she stops and turns around.",
        { who: "mara", text: s.flags.brakedN4 ? "You look like you saw something. Whatever it was... you did the right thing. I can tell." : "You're soaked. How are you soaked? It isn't even raining." },
        { who: "mara", text: "If it's tonight, I'll be with him. He won't be alone. I promise." },
      ] : []),
      "Up on the fourth floor, the window of 4B is lit. The light is very dim now.",
      "As you watch, the thin figure in the window raises one hand. Not waving.",
      "Holding up one finger.",
      { text: "One more night.", after: 400 },
    ],
    choices: [{ text: "Drive on.", next: "n4_canal" }],
  },

  n4_canal: {
    stop: "Canal Row",
    mood: "uneasy",
    lines: (s) => [
      "Canal Row. The flood is gone. The road is dry, cracked, ordinary.",
      "The balloon is gone from the sign.",
      "Someone has scratched new words into the shelter glass, under the old ones.",
      { text: s.flags.brakedN4 ? "THANK YOU" : "NEXT TIME", big: true },
    ],
    choices: [{ text: "Drive on.", next: "n4_northgate" }],
  },

  n4_northgate: {
    stop: "Northgate",
    mood: "dread",
    lines: (s) => [
      "Northgate. Your hands won't stop shaking on the wheel.",
      { sfx: "static", args: [0.6] },
      { who: "dana", text: "Route 9! Route 9, come in. Your bus went dark for six minutes. GPS put you in the middle of the river. Are you okay?" },
      { who: "you", text: "I'm okay. I think." },
      { who: "dana", text: "Listen to me. Whatever you're hearing on Channel 9, it isn't us. Nobody is supposed to be on that channel. Nobody's been on it since—" },
      { sfx: "static", args: [1] },
      { who: "rhee", text: "Since me." },
      { pause: 900 },
      { who: "rhee", text: lateTonight(s) > 0 ? `${minutes(lateTonight(s))} late tonight. Tomorrow you'll make up all of it.` : "On time. Tomorrow you'll prove it when it counts." },
      { who: "rhee", text: "Tomorrow's the last run, driver. The stop is coming to you." },
      { sfx: "whisper", pause: 600 },
      { text: "On the display, the stop with no name sits right after Elm & 4th. Second stop on the route.", after: 400 },
      { text: "Tomorrow, it'll be waiting.", big: true },
    ],
    choices: [{ text: "End your shift.", next: "n5_start" }],
  },
});
