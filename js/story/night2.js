/* ===================================================================
   NIGHT 2 — "The stop with no name has moved."
   Second chances with Mara and Jun. The flood on Canal Row.
   Daniel. The lights go out. The shelter full of wet people.
   Kindness available: apologize to Mara (+1), Jun talk OR call his mom (+1),
                       jacket for Daniel (+1), open the doors at ??? (+1)
   =================================================================== */
Object.assign(SCENES, {

  n2_start: {
    night: 2, stop: "Depot", mood: "uneasy", mirror: "oldman", amb: { engine: 0.3 },
    lines: [
      { pause: 600 },
      "11:40 PM. Route 9. Second night.",
      "You barely slept. Every time you closed your eyes you heard dripping.",
      "The old man is in the back row again. Same seat. Same folded hands. Same wet shoes.",
      "You checked the depot cameras before your shift. They show you getting on the bus alone.",
      "On your route display, the stop with no name is still there. But it's moved.",
      { text: "It's not past Northgate anymore. It's between Canal Row and Northgate.", after: 500 },
      { who: "rhee", text: "Evening, driver. Northgate by 12:20. And your display is still broken, so don't look at it." },
    ],
    choices: [
      { text: "Ask the old man about the new stop.", next: "n2_oldman" },
      { text: "Don't look at him. Just drive.", next: "n2_elm" },
    ],
  },

  n2_oldman: {
    stop: "Depot",
    onEnter: (s) => { s.flags.knowsAshgrove = true; },
    lines: [
      "You walk down the aisle. It's colder at the back. Your breath fogs.",
      { who: "teodor", text: "You saw it, then." },
      "He turns a coin over and over in his fingers. His knuckles are swollen and his nails are blue.",
      { who: "teodor", text: "There was a stop past Northgate once. Ashgrove. Little houses by the river. Kids who'd wave at the bus." },
      { who: "teodor", text: "The bridge went down in March of '94. In a storm. With the last bus of the night on it." },
      { who: "you", text: "Which route?" },
      { pause: 1200 },
      "He looks at you for a long time. His eyes are wet.",
      { who: "teodor", text: "This one." },
    ],
    choices: [{ text: "Go back to your seat. Pull out.", next: "n2_elm" }],
  },

  n2_elm: {
    stop: "Elm & 4th",
    lines: (s) => s.flags.maraHelped ? [
      "Elm & 4th. Mara's already at the stop this time. Early. Holding two paper cups.",
      { sfx: "door" },
      { who: "mara", text: "Figured I owe you a coffee. It's terrible. Hospital coffee always is." },
      { who: "mara", text: "Also, heads up. A water main burst on Canal Row. The whole street's flooded. Cut down Lindell Ave and you'll save yourself the trouble." },
    ] : [
      "Elm & 4th. Mara's at the stop. Early tonight. Arms crossed.",
      { sfx: "door" },
      "She gets on without looking at you and sits as far forward as she can.",
      { who: "mara", text: "I got written up. One more and I'm off nights. So thanks for that." },
      "She stares out the window. Her reflection stares back at you in the glass.",
    ],
    choices: [
      { if: (s) => s.flags.maraHelped && !s.flags.maraForgave, text: "“Thanks. Same bus tomorrow?”", set: { maraTip: true }, next: "n2_mara" },
      { if: (s) => !s.flags.maraHelped, text: "“I'm sorry. I should have waited.”", kind: 1, set: { maraHelped: true, maraForgave: true }, next: "n2_mara_sorry" },
      { if: (s) => !s.flags.maraHelped, text: "Say nothing. Drive.", next: "n2_market" },
    ],
  },

  n2_mara_sorry: {
    stop: "Elm & 4th",
    lines: [
      "She doesn't answer for a whole block.",
      { who: "mara", text: "...Yeah. Okay. Everybody's got a schedule. I get it." },
      { who: "mara", text: "Hey. Canal Row's flooded tonight. Water main. Cut down Lindell if you don't want to sit in it." },
      "It's not forgiveness exactly. But it's close.",
    ],
    onEnter: (s) => { s.flags.maraTip = true; },
    choices: [{ text: "“Thanks, Mara.”", next: "n2_mara" }],
  },

  n2_mara: {
    stop: "Elm & 4th",
    mood: "grief",
    lines: [
      { who: "mara", text: "Wouldn't miss it." },
      "Somewhere between stops she starts talking, the way people do at midnight when they're too tired to stop themselves.",
      { who: "mara", text: "There's a man on my ward. Room 4B. Ninety-one years old. No visitors. Ever." },
      { who: "mara", text: "He barely talks. But every night, right around this time, he opens his eyes and asks me two things." },
      { who: "mara", text: "What time is it. And is Route 9 running yet." },
      { pause: 900 },
      { who: "mara", text: "I always tell him yes. It seems to help." },
      "You look in the mirror.",
      "In the back row, the old man has his eyes closed.",
      { text: "He might be smiling.", after: 400 },
    ],
    choices: [{ text: "Drive on.", next: "n2_market" }],
  },

  n2_market: {
    stop: "Market St",
    lines: (s) => s.flags.junRode ? [
      "Market St. Jun's on the bench again. This time he's holding exact change, counted out in his palm like it's precious.",
      { sfx: "door" },
      { sfx: "coin" },
      { who: "jun", text: "I'm paying tonight. And here's yesterday's. Don't want you getting in trouble." },
      "He sits closer to the front than last time. He doesn't look at the back row at all.",
    ] : [
      "Market St. The bench is empty.",
      "On the shelter glass there's a new poster. The tape is still shiny.",
      { text: "MISSING. JUN PARK, 15. LAST SEEN MARKET ST, AROUND MIDNIGHT.", big: true },
      "In the photo he's smiling, wearing the same huge backpack.",
      "There's a phone number at the bottom. Underneath it, in handwriting: PLEASE. ANYTHING.",
    ],
    choices: [
      { if: (s) => s.flags.junRode, text: "“Why do you ride to Northgate every night?”", kind: 1, set: { junTalked: true }, next: "n2_jun" },
      { if: (s) => s.flags.junRode, text: "Nod and drive on.", next: "n2_stagnes" },
      { if: (s) => !s.flags.junRode, text: "Call the number.", hint: "+2 min", late: 2, kind: 1, set: { calledMom: true }, next: "n2_call" },
      { if: (s) => !s.flags.junRode, text: "It's not your business. Drive on.", next: "n2_stagnes" },
    ],
  },

  n2_jun: {
    stop: "Market St",
    lines: [
      { who: "jun", text: "My mom cleans the Northgate depot. Nights. She works two jobs, so nights are... kind of the only time I see her." },
      { who: "jun", text: "She gets off at 12:30. If I'm there before then, we walk home together." },
      "He shrugs like it's nothing. It isn't nothing.",
      { pause: 600 },
      { who: "jun", text: "Can I ask you something weird?" },
      { who: "jun", text: "Last night. When we got to Northgate. Did you count how many people got off?" },
      { who: "you", text: "Just you." },
      { pause: 900 },
      { who: "jun", text: "Yeah. That's what I thought." },
      { who: "jun", text: "There were six people in the back when I got off. All wet. All looking at you." },
      { mirror: "full", sfx: "whisper", pause: 700 },
      "You look in the mirror. For one frame, every seat is full.",
      { mirror: "oldman", pause: 300 },
      "Then it's just the old man.",
    ],
    choices: [{ text: "Drive on. Don't look again.", next: "n2_stagnes" }],
  },

  n2_call: {
    stop: "Market St",
    lines: [
      "You dial with the bus idling. It rings once.",
      { who: "junmom", text: "Hello? Jun? Jun, is that you?" },
      { who: "you", text: "No, I'm sorry. I'm the Route 9 driver. I saw him. Last night, at Market St. He was trying to get to Northgate." },
      { pause: 900 },
      "There's a sound on the line like someone sitting down very hard.",
      { who: "junmom", text: "Northgate. He was coming to me. I work at the Northgate depot. He was walking to me." },
      { who: "junmom", text: "Thank you. Thank you. I'll call the police, I'll tell them, thank you—" },
      "She hangs up. Your hands are shaking a little.",
      { who: "rhee", text: "Driver. Personal calls are not on the schedule." },
    ],
    choices: [{ text: "Drive on.", next: "n2_stagnes" }],
  },

  n2_stagnes: {
    stop: "St. Agnes",
    lines: (s) => s.flags.maraHelped ? [
      "St. Agnes. Mara crumples her cup and stands.",
      { who: "mara", text: "Hey. Weird question. If you ever see a stop that isn't supposed to be there..." },
      "She hesitates on the bottom step.",
      { who: "mara", text: "My mom used to say the drowned don't want to scare you. They just want a ride home." },
      { who: "mara", text: "...Forget it. I'm tired. See you tomorrow." },
      "Up on the fourth floor, one window is lit while the ones around it are dark.",
    ] : [
      "St. Agnes. Mara gets off without a word. She doesn't look back.",
      "Up on the fourth floor, one window is lit while the ones around it are dark.",
      "Someone is standing in it again. Very still. Very thin.",
    ],
    choices: [{ text: "Drive on.", next: "n2_canal" }],
  },

  n2_canal: {
    stop: "Canal Row",
    mood: "dread",
    amb: { water: 0.6 },
    fx: (s) => (s.flags.maraTip ? "none" : "flood"),
    onEnter: (s) => { if (!s.flags.maraTip) s.late += 4; },
    lines: (s) => s.flags.maraTip ? [
      "Lindell Ave is coming up on the left.",
      "Straight ahead, Canal Row shines like a river under the orange lights. The water's up past the curbs.",
      "Something is standing in it. Far down the street. Not moving.",
    ] : [
      "You turn onto Canal Row and don't see the water until you're in it.",
      { sfx: "splash", shake: true },
      "The bus lurches. The engine coughs, chokes, and dies.",
      { amb: { engine: 0 }, pause: 1200 },
      "Silence. Just water lapping at the doors.",
      "By the time the engine turns over again, you've lost four minutes.",
      { amb: { engine: 0.3 }, pause: 800 },
      { sfx: "knock" },
      { text: "Someone knocks on the doors.", after: 500 },
    ],
    choices: [
      { if: (s) => s.flags.maraTip, text: "Take Lindell. Stay on schedule.", next: "n2_lindell" },
      { if: (s) => s.flags.maraTip, text: "Go down Canal Row anyway.", hint: "+3 min", late: 3, next: "n2_flood" },
      { if: (s) => !s.flags.maraTip, text: "Open the doors.", next: "n2_wet" },
      { if: (s) => !s.flags.maraTip, text: "Keep them shut.", next: "n2_wet_shut" },
    ],
  },

  n2_flood: {
    stop: "Canal Row",
    fx: "flood",
    lines: [
      { sfx: "splash" },
      "You ease the bus into the water. It's deeper than it looks. Black. Cold. It swallows the headlights.",
      "You crawl along at walking speed. The figure in the street gets closer.",
      "Then it isn't in the street anymore.",
      { pause: 900 },
      { sfx: "knock" },
      { text: "Someone knocks on the doors.", after: 500 },
    ],
    choices: [
      { text: "Open the doors.", next: "n2_wet" },
      { text: "Keep them shut.", next: "n2_wet_shut" },
    ],
  },

  n2_wet: {
    stop: "Canal Row",
    onEnter: (s) => { s.flags.knowsDaniel = true; },
    lines: (s) => [
      { sfx: "door" },
      s.flags.metWet ? "It's him. The man from last night. His suit still soaked through, his hair plastered to his forehead." : "A man in a suit, soaked through. Water runs off him in sheets, though the flood only reaches your tires.",
      "He's holding a small box wrapped in paper with balloons on it. The paper has gone soft and gray.",
      { who: "wet", text: "Ashgrove, please." },
      s.flags.knowsAshgrove ? { who: "you", text: "The bridge is gone. It's been gone a long time." } : { who: "you", text: "This bus doesn't go there." },
      { who: "wet", text: "Everyone keeps telling me." },
      { who: "wet", text: "I'm Daniel. My daughter's Rosie. She turns six tonight. I promised her I'd be home before she fell asleep." },
      { who: "wet", text: "I think I'm very late." },
      "He's shivering so hard his teeth click.",
    ],
    choices: [
      { text: "Give him your jacket.", kind: 1, set: { gaveJacket: true }, next: "n2_jacket" },
      { text: "Point him to a seat.", next: "n2_wet_sit" },
    ],
  },

  n2_jacket: {
    stop: "Canal Row",
    lines: [
      "He holds it like he's forgotten what a jacket is for. Then he puts it on, slowly, carefully, over the wet suit.",
      { who: "wet", text: "You're kind. He was kind too, the driver." },
      { who: "wet", text: "He wanted to wait out the storm. We could all hear him arguing on the radio." },
      { who: "wet", text: "But the man on the radio kept saying make up the time. Make up the time. Make up the time." },
      { pause: 1000 },
      { fx: "dark", sfx: "lightsout", amb: { engine: 0 }, mood: "terror" },
      { text: "The lights go out.", after: 800 },
      { sfx: "breath", pause: 1600 },
      "Something wet touches the back of your neck.",
      { pause: 700 },
      { scare: "eyes" },
      { fx: "flood", sfx: "lightsout", amb: { engine: 0.3 }, mood: "dread", mirror: "oldman" },
      "The lights flicker back on.",
      "Daniel is gone. Your jacket is folded neatly on his seat. Soaked through. Still warm.",
    ],
    choices: [{ text: "Drive. Get out of the water.", next: "n2_mystery" }],
  },

  n2_wet_sit: {
    stop: "Canal Row",
    lines: [
      "He sits where you point and stares straight ahead, dripping.",
      { who: "wet", text: "The man on the radio told him to make up the time. Did you know that? He wanted to wait." },
      { pause: 900 },
      { fx: "dark", sfx: "lightsout", amb: { engine: 0 }, mood: "terror" },
      { text: "The lights go out.", after: 900 },
      { sfx: "drip" }, { sfx: "drip", pause: 500 }, { sfx: "drip", pause: 500 },
      { scare: "eyes" },
      { fx: "flood", sfx: "lightsout", amb: { engine: 0.3 }, mood: "dread", mirror: "oldman" },
      "The lights come back. The seat is empty, and dark with water.",
    ],
    choices: [{ text: "Drive. Get out of the water.", next: "n2_mystery" }],
  },

  n2_wet_shut: {
    stop: "Canal Row",
    mood: "terror",
    lines: [
      "You keep your hand off the door lever.",
      "The knocking stops.",
      { pause: 1400 },
      "Then a palm presses flat against the door glass. Gray. Wrinkled from the water.",
      "Then another.",
      { pause: 700 },
      { scare: "hands" },
      { sfx: "bang", shake: true },
      "The glass shudders in its frame. You stamp on the pedal and the bus surges through the flood.",
      "In the mirror, a man in a soaked suit stands in the middle of Canal Row with a small wrapped box in his hands, watching you go.",
      { mood: "dread", text: "He doesn't look angry. He looks like he's been left behind before." },
    ],
    choices: [{ text: "Keep driving.", next: "n2_mystery" }],
  },

  n2_lindell: {
    stop: "Canal Row",
    lines: [
      "You swing onto Lindell. Dry road. Right on time.",
      "Just before the corner, you catch the side mirror.",
      "A man in a soaked suit is standing knee-deep in the flood on Canal Row, holding a small wrapped box. Watching your bus go.",
      { sfx: "whisper", pause: 800 },
      { who: "voices", text: "...didn't stop..." },
      { who: "rhee", text: "Nice time, driver. That's what I like to see." },
    ],
    choices: [{ text: "Drive on.", next: "n2_mystery" }],
  },

  n2_mystery: {
    stop: "???",
    fx: "none",
    mood: "dread",
    amb: { water: 0, rain: 0.5 },
    lines: [
      "The bus slows down.",
      "You didn't touch the brake.",
      { pause: 900 },
      "There's a bus shelter on the right where there has never been a bus shelter. It's lit the yellow of old photographs.",
      "It's raining inside it. Only inside it.",
      "People are standing in the shelter. A dozen, maybe more. Coats dark with water. Hair stuck to their faces.",
      "Waiting.",
      { who: "rhee", text: "Driver. Do NOT open those doors." },
      { who: "rhee", text: "They are not on the manifest." },
      { pause: 600 },
      "In the back row, the old man leans forward.",
      { who: "teodor", text: "It's not their night yet. But you could let them see you." },
    ],
    choices: [
      { text: "Open the doors.", hint: "+1 min", late: 1, kind: 1, set: { openedN2: true }, next: "n2_mystery_open" },
      { text: "Do what dispatch says. Keep driving.", next: "n2_mystery_pass" },
    ],
  },

  n2_mystery_open: {
    stop: "???",
    mood: "grief",
    onEnter: (s) => { s.flags.knowsLena = true; },
    lines: [
      { sfx: "door" },
      "The doors fold open. Cold, wet air rolls in. It smells like the river.",
      "Nobody boards.",
      "A woman at the front of the shelter looks at you for a long moment. She's wearing a nurse's cardigan from another decade.",
      { who: "woman", text: "Not yet. Not tonight." },
      { who: "woman", text: "I'm Lena. You're the first one who's opened the doors in a very long time." },
      "She looks past you, at the back row.",
      { who: "woman", text: "He's still riding, isn't he? Every night." },
      { who: "woman", text: "Tell him we don't blame him. We never did." },
      { pause: 1200 },
      "In the mirror, the old man has his face in his hands.",
      { who: "rhee", text: "Driver. Close. The. Doors." },
    ],
    choices: [{ text: "Close the doors.", next: "n2_northgate" }],
  },

  n2_mystery_pass: {
    stop: "???",
    lines: [
      "You press the pedal. The yellow light slides along the windows.",
      "Every face in the shelter turns to follow the bus. All at once. Like birds.",
      "A little girl at the front raises her hand. Waving. The way kids used to wave at buses.",
      "Then the light is gone.",
      { pause: 700 },
      { who: "rhee", text: "Good. Good driver." },
      "In the back row, the old man watches the dark until there's nothing left to watch.",
    ],
    choices: [{ text: "Drive on.", next: "n2_northgate" }],
  },

  n2_northgate: {
    stop: "Northgate",
    mood: "uneasy",
    amb: { rain: 0 },
    lines: (s) => [
      "Northgate.",
      ...(s.flags.junRode ? [
        { who: "jun", text: "Night, driver." },
        s.flags.junTalked ? "He runs toward the depot, where a woman in a cleaning uniform is waiting by the door. She waves at the bus." : "He jogs off toward the depot lights.",
      ] : []),
      "The back row is empty again. Another coin on the seat. Another dark wet stain.",
      { sfx: "coin" },
      { who: "rhee", text: lateTonight(s) === 0 ? "On time again. You're getting the hang of Route 9." : `${minutes(lateTonight(s))} late tonight. That's adding up, driver.` },
      { who: "rhee", text: "Storm's coming in off the river tomorrow. Big one. Like the old days." },
      { who: "rhee", text: "You'll want to make up the time." },
      { pause: 700 },
      { sfx: "static", args: [1] },
      "As you log out, the route display flickers.",
      { text: "The stop with no name has moved again. Now it sits between St. Agnes and Canal Row.", after: 400 },
      { text: "It's getting closer.", big: true },
    ],
    choices: [{ text: "End your shift.", next: "n3_start" }],
  },
});
