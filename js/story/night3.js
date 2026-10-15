/* ===================================================================
   NIGHT 3 — "A storm is coming in off the river."
   The radio plays a broadcast from 1994. Room 4B. A little girl
   at the stop with no name wants to ring the bell.
   Kindness available: comfort Jun (+1), visit Room 4B (+1), let Ivy ride (+1)
   =================================================================== */
Object.assign(SCENES, {

  n3_start: {
    night: 3, stop: "Depot", mood: "uneasy", fx: "storm", mirror: "oldman", amb: { rain: 1, engine: 0.3 },
    lines: (s) => [
      { sfx: "thunder", pause: 1400 },
      "11:40 PM. Route 9. Third night.",
      "Rain hammers the depot roof so hard it sounds like applause.",
      ...(s.flags.gaveJacket ? [
        "Your jacket is hanging on the hook behind the driver's seat.",
        "You left it soaked on a seat on Canal Row last night. Now it's here. Dry. Folded. It smells like the river.",
      ] : []),
      "The old man is in the back row. He looks worse tonight. Grayer. Thinner. Like a photo left too long in the sun.",
      "The stop with no name sits on your display right after St. Agnes.",
      { who: "rhee", text: s.late === 0 ? "Two perfect nights, driver. Don't spoil it in the rain." : `You're ${minutes(s.late)} behind this week, driver. In weather like this, drivers make mistakes. Don't.` },
      ...(s.warn > 0 ? [{ who: "rhee", text: "And I haven't forgotten about the free ride." }] : []),
    ],
    choices: [{ text: "Turn the wipers on full. Pull out.", next: "n3_elm" }],
  },

  n3_elm: {
    stop: "Elm & 4th",
    lines: (s) => s.flags.maraHelped ? [
      { sfx: "door" },
      "Mara bangs on the door before it's fully open, soaked to the skin, hood useless.",
      { who: "mara", text: "God, it's like the sky's falling. Thank you." },
      "She doesn't sit down. She stands next to you, holding the pole, dripping.",
      { who: "mara", text: "Can I ask you something and you don't think I'm crazy?" },
      { who: "mara", text: "Mr. Varga. Room 4B. He's getting worse. Tonight or tomorrow, the doctors say." },
      { who: "mara", text: "And he's stopped asking if Route 9 is running. Now he asks for the driver. The new driver. By name. Your name." },
      { pause: 1000 },
      { who: "mara", text: "I never told him your name." },
      { who: "mara", text: "Would you come up? On your break at St. Agnes? Just for a minute. I think he's waiting for you." },
    ] : [
      "Elm & 4th. The shelter's empty. Rain sheets sideways through it.",
      "Mara isn't here tonight. Maybe she took the early bus. Maybe she quit.",
      "Someone's left a nurse's lanyard hanging on the shelter hook. It sways in the wind.",
    ],
    onEnter: (s) => { if (s.flags.maraHelped) s.flags.maraAsked = true; },
    choices: (s) => s.flags.maraHelped ? [
      { text: "“I'll try.”", next: "n3_market" },
      { text: "“I don't get breaks on Route 9.”", set: { maraRefused: true }, next: "n3_market" },
    ] : [{ text: "Drive on.", next: "n3_market" }],
  },

  n3_market: {
    stop: "Market St",
    lines: (s) => {
      if (s.flags.junRode) return [
        { sfx: "door" },
        "Jun is waiting under the shelter with his hood up. When he gets on, his face is white.",
        { who: "jun", text: "I almost didn't come. I didn't want to ride tonight." },
        { who: "jun", text: "But Mom's working, and the trains are down, and..." },
        "He looks at the back row. Then he looks at you.",
        { who: "jun", text: "Are they real? The people in the back? Please don't tell me I'm crazy." },
      ];
      if (s.flags.calledMom) return [
        "Market St. The missing poster is still on the glass, but someone's pasted a strip across it.",
        { text: "FOUND SAFE.", big: true },
        { sfx: "door" },
        "A woman in a cleaning uniform gets on, shaking out an umbrella. She stops dead when she sees you.",
        { who: "junmom", text: "You. You're the driver who called." },
        { who: "junmom", text: "The police found him on the road to Northgate. Halfway there. In the dark. He was walking to me." },
        { who: "junmom", text: "He's home. He's asleep in his bed right now. Because you called." },
        "She sits right behind you and doesn't say anything else. She doesn't have to.",
      ];
      return [
        "Market St. The missing poster is still on the glass. It's pulped by the rain now. The face has run.",
        "Next to it, a second poster. A third. Someone has been looking for him all week.",
        { pause: 800 },
        { mirror: "full", sfx: "whisper", pause: 500 },
        "In the mirror, for a moment, there's a kid with a huge backpack in the back row.",
        { mirror: "oldman", pause: 300 },
        "You turn around. It's just a bag someone left behind. Soaked through.",
        "You don't remember anyone leaving it.",
      ];
    },
    onEnter: (s) => { if (s.flags.calledMom) s.flags.junFound = true; },
    choices: (s) => s.flags.junRode ? [
      { text: "“They're real. Sit up front with me. You're safe up here.”", kind: 1, set: { junComforted: true }, next: "n3_jun" },
      { text: "“It's just the storm. Sit down.”", next: "n3_radio" },
    ] : [{ text: "Drive on.", next: "n3_radio" }],
  },

  n3_jun: {
    stop: "Market St",
    mood: "grief",
    lines: [
      "He sits on the step next to your seat with his backpack in his lap, like a little kid.",
      { who: "jun", text: "Okay. Okay. Real. That's... better, actually? Than being crazy?" },
      { who: "jun", text: "They don't look mean. They look sad. Like when you wait for someone at the airport and they never come out." },
      { pause: 700 },
      { who: "jun", text: "Can I stay up here till Northgate?" },
      { who: "you", text: "As long as you want." },
    ],
    choices: [{ text: "Drive on.", next: "n3_radio" }],
  },

  n3_radio: {
    stop: "Market St",
    mood: "dread",
    onEnter: (s) => { s.flags.heardBroadcast = true; s.flags.knowsVarga = true; },
    lines: [
      "You're pulling out from Market St when the radio changes channel by itself.",
      { sfx: "static", args: [1.6], pause: 1700 },
      "A man's voice, thin and crackling, like a tape played too many times.",
      { who: "radio94", text: "...repeating our top story. At 12:31 this morning, the Ashgrove bridge collapsed during the storm..." },
      { who: "radio94", text: "...a Route 9 city bus was crossing at the time. Divers have recovered fourteen..." },
      { sfx: "static", args: [0.6], pause: 500 },
      { who: "radio94", text: "...the driver, Teodor Varga, fifty-eight, was pulled from the river alive and is in critical condition at St. Agnes..." },
      { who: "radio94", text: "...dispatch records show the bus was running eleven minutes behind sched—" },
      { sfx: "static", args: [0.4] },
      { who: "rhee", text: "That's enough of that." },
      { pause: 1200 },
      "In the mirror, the old man in the back row is looking at the radio.",
      { text: "Varga, you think. Teodor Varga.", after: 300 },
      "He looks at you, and nods. Very slightly.",
    ],
    choices: [{ text: "Drive on to St. Agnes.", next: "n3_stagnes" }],
  },

  n3_stagnes: {
    stop: "St. Agnes",
    lines: (s) => [
      "St. Agnes. The hospital is a lighthouse in the storm.",
      ...(s.flags.maraAsked ? [
        "Mara stops at the door and looks back at you.",
        { who: "mara", text: "Fourth floor. Room 4B. Please." },
        { who: "rhee", text: "Driver. You have no scheduled break at St. Agnes." },
      ] : [
        "Up on the fourth floor, the window is lit again.",
        "The thin figure is pressing one hand flat against the glass.",
        "It doesn't move until you've driven away.",
      ]),
    ],
    choices: (s) => s.flags.maraAsked ? [
      { text: "Go up to Room 4B.", hint: "+6 min", late: 6, kind: 1, set: { visitedVarga: true }, next: "n3_ward" },
      { text: "Stay on schedule. Drive on.", next: "n3_mystery" },
    ] : [{ text: "Drive on.", next: "n3_mystery" }],
  },

  n3_ward: {
    stop: "St. Agnes",
    fx: "flicker",
    mood: "grief",
    mirror: "empty",
    amb: { rain: 0.3, engine: 0 },
    lines: [
      "The fourth floor smells like bleach and old flowers. The lights hum and stutter.",
      "Mara walks you to 4B and waits in the doorway.",
      "The man in the bed is the old man from the back row.",
      "Same thin hands. Same wet-looking eyes. Tubes in his arm. A monitor counting his heartbeat, slow.",
      { sfx: "heartbeat", args: [5, 52] },
      { who: "mara", text: "He hasn't moved in three days." },
      "You go to the window. Down in the street, your bus is idling in the rain.",
      { mirror: "oldman", pause: 900 },
      "In the back window of the bus, a thin figure is sitting in the back row. Looking up at you.",
      { mirror: "empty", pause: 700 },
      "You turn back to the bed.",
      { pause: 900 },
      { scare: "hands" },
      "His hand closes around your wrist. Cold. Wet. Impossibly strong.",
      { mood: "terror", who: "teodor", text: "Don't let him make you late." },
      { who: "teodor", text: "The man on the radio. Don't listen to him. He told me to make up the time and I listened." },
      { who: "teodor", text: "Fourteen. I listened, and it was fourteen." },
      { mood: "grief", pause: 800 },
      "His hand goes slack. His eyes close. The monitor keeps counting, slow.",
      "Mara is crying in the doorway, very quietly, like someone who has had a lot of practice.",
      { who: "mara", text: "He's been waiting thirty years for somebody to stop." },
    ],
    choices: [{ text: "Go back down to the bus.", next: "n3_mystery" }],
  },

  n3_mystery: {
    stop: "???",
    fx: "storm",
    mood: "dread",
    mirror: "oldman",
    amb: { rain: 1, engine: 0.3 },
    lines: [
      "Two blocks past St. Agnes, the bus slows on its own.",
      "The shelter is there. Yellow light. Rain falling inside it harder than the storm.",
      { sfx: "door", pause: 400 },
      { text: "The doors open by themselves.", after: 600 },
      { sfx: "knock", args: [4], pause: 900 },
      "Knocking. Not at the doors. Under the floor. Under your feet.",
      { sfx: "knock", args: [6], shake: true, pause: 600 },
      "Like people trapped in something, beating on the walls.",
      { who: "rhee", text: "CLOSE THE DOORS. Driver, CLOSE THEM." },
      { pause: 700 },
      "A little girl steps out of the shelter and stands at the bottom of your steps. Seven, maybe. Yellow raincoat. Barefoot.",
      { who: "ivy", text: "Is it time yet?" },
      { who: "teodor", text: "Not tonight, Ivy. Soon. I promise. Soon." },
      { who: "ivy", text: "Can I sit up front? Mister Teodor always let me ring the bell." },
    ],
    choices: [
      { text: "“Just for a minute. Go ahead.”", kind: 1, set: { ivyRode: true }, next: "n3_ivy" },
      { text: "Close the doors.", next: "n3_ivy_no" },
    ],
  },

  n3_ivy: {
    stop: "???",
    mood: "grief",
    lines: [
      "She climbs the steps carefully, the way kids do, both feet on each one.",
      "She sits in the front seat and swings her legs. Water drips from her raincoat in a steady patter.",
      "She reaches up and pulls the stop cord.",
      { sfx: "coin", pause: 700 },
      "Ding.",
      { who: "ivy", text: "That's my stop. That's always my stop." },
      "She smiles at you. Her lips are blue.",
      { pause: 900 },
      "You blink, and she's back in the shelter, waving.",
      "The front seat is soaking wet. On it, a tiny yellow button.",
      { sfx: "door" },
      "The doors close themselves. The knocking under the floor has stopped.",
      { who: "rhee", text: "...You'll regret that, driver." },
    ],
    choices: [{ text: "Drive on.", next: "n3_canal" }],
  },

  n3_ivy_no: {
    stop: "???",
    mood: "terror",
    lines: [
      "You pull the lever. The doors fold shut between you and her.",
      "She doesn't cry. She just puts her small hand flat on the glass.",
      { pause: 600 },
      "Then another hand presses against the glass beside hers. And another. And another.",
      { pause: 600 },
      { scare: "hands" },
      { sfx: "bang", shake: true },
      "Every window on the bus is covered in hands. Gray, wrinkled, pressing.",
      { sfx: "bang", shake: true, pause: 400 },
      "You floor it. The hands slide off one by one as the bus pulls away.",
      { mood: "dread", who: "rhee", text: "Good. Good driver." },
      "You don't feel like a good driver.",
    ],
    choices: [{ text: "Keep driving.", next: "n3_canal" }],
  },

  n3_canal: {
    stop: "Canal Row",
    fx: "flood",
    amb: { water: 0.9 },
    lines: [
      "Canal Row is a river now. The flood comes up to the second step.",
      { sfx: "splash" },
      "The bus pushes through it like a boat. Water sloshes against the doors.",
      "Daniel's shelter is underwater up to the bench. Someone has tied a balloon to the sign. It bobs, half-deflated, in the storm.",
      { sfx: "thunder", pause: 800 },
      "In the lightning flash, you see faces under the water. Looking up.",
      { pause: 600 },
      "In the next flash, there's nothing.",
    ],
    choices: [{ text: "Get to Northgate.", next: "n3_northgate" }],
  },

  n3_northgate: {
    stop: "Northgate",
    fx: "storm",
    mood: "uneasy",
    amb: { water: 0 },
    lines: (s) => [
      "Northgate. You've never been so happy to see a concrete box.",
      ...(s.flags.junRode ? [
        { who: "jun", text: s.flags.junComforted ? "Thanks for... you know. Believing me." : "Night. Be careful, okay?" },
        "His mom is waiting at the depot door with an umbrella. She pulls him under it and looks at you over his head, a long look, like she's memorizing your face.",
      ] : []),
      ...(s.flags.junFound ? [
        { who: "junmom", text: "This is me. Jun wants to meet you, you know. The driver who called. He thinks you're some kind of hero." },
        "She squeezes your shoulder on the way out and runs for the depot door.",
      ] : []),
      "The back row is empty. The coin on the seat is warm.",
      { sfx: "coin" },
      { who: "rhee", text: lateTonight(s) === 0 ? "On time in a storm. I'm impressed, driver." : `${minutes(lateTonight(s))} late tonight. In a storm. Does that remind you of anything?` },
      "There's a sheet of paper tucked under your windshield wiper, soaked but readable.",
      { text: "NOTICE: Route 9 radio moves to CHANNEL 4 starting tomorrow. Channel 9 has been out of service since 1994. — Dana, Night Dispatch", big: true },
      { pause: 900 },
      { who: "rhee", text: "Ignore that." },
      { sfx: "static", args: [0.9] },
      { text: "On the display, the stop with no name has moved again. Right after Market St now.", after: 300 },
    ],
    choices: [{ text: "End your shift.", next: "n4_start" }],
  },
});
