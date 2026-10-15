/* ===================================================================
   NIGHT 1 — "Your first run on Route 9."
   Meet the old man, Mara and Jun. Choose who to stop for.
   Something is waiting at Canal Row. A stop with no name appears.
   Kindness available: Mara (+1), Jun (+1), stopping at Canal Row (+1)
   =================================================================== */
Object.assign(SCENES, {

  n1_start: {
    night: 1, stop: "Depot", mood: "calm", amb: { engine: 0.3 }, mirror: "empty",
    lines: [
      { pause: 600 },
      "11:40 PM.",
      "The depot lights buzz overhead like they're tired too. Somewhere in the garage, water drips into a puddle that never quite dries.",
      "Route 9. The last bus of the night, Depot to Northgate.",
      "It's your first time driving it. Nobody else wanted the shift. When you asked why, the day drivers just looked at each other.",
      { who: "rhee", text: "Evening, new driver. This is Rhee, night dispatch. You'll be hearing a lot of me." },
      { who: "rhee", text: "Route 9 runs forty minutes, end to end. Two rules. You don't run late. And you don't let anyone ride free." },
      { who: "rhee", text: "The cameras see everything. So do I." },
      { pause: 500 },
      "You adjust the rear-view mirror before you pull out.",
      { mirror: "oldman", sfx: "breath", pause: 900 },
      "There's an old man in the back row. Hands folded on top of a cane. Coat buttoned to the throat.",
      { text: "You didn't see him get on.", after: 600 },
    ],
    choices: [
      { text: "“Sorry, sir, where are you headed?”", next: "n1_oldman" },
      { text: "Leave him be. Pull out of the depot.", next: "n1_elm" },
    ],
  },

  n1_oldman: {
    stop: "Depot",
    lines: [
      "You turn around in your seat.",
      "Up close he's older than you thought. Ninety, maybe. His skin is thin as paper. His shoes are wet, though the depot floor is dry.",
      { who: "teodor", text: "End of the line." },
      { who: "you", text: "Northgate, then." },
      { who: "teodor", text: "If you say so." },
      "He shuffles up the aisle and drops a coin in the fare box.",
      { sfx: "coin", pause: 400 },
      "It's heavy. Worn smooth. Not any money you recognize.",
      { who: "teodor", text: "You've got kind eyes. That's going to make this harder for you." },
      "He goes back to his seat before you can ask what he means.",
    ],
    choices: [{ text: "Pull out of the depot.", next: "n1_elm" }],
  },

  n1_elm: {
    stop: "Elm & 4th",
    lines: [
      "Elm & 4th. The shelter's empty. A plastic bag turns slow circles in the wind.",
      "You're about to close the doors when you see her in the side mirror.",
      "A woman in blue scrubs, sprinting down the block, waving one arm over her head. She's half a block back. Maybe more.",
      { who: "rhee", text: "You're exactly on schedule, driver. Let's keep it that way." },
    ],
    choices: [
      { text: "Wait for her.", hint: "+2 min", late: 2, kind: 1, set: { maraHelped: true }, next: "n1_mara" },
      { text: "Close the doors and go.", next: "n1_mara_left" },
    ],
  },

  n1_mara: {
    stop: "Elm & 4th",
    lines: [
      "You wait. The clock on the dash ticks over. Once. Twice.",
      { sfx: "door" },
      "She takes the steps two at a time, gasping, a lanyard swinging around her neck.",
      { who: "mara", text: "Thank you. Oh my god, thank you. I'm Mara. If I'm late one more time they'll take me off nights, and I can't afford days." },
      { who: "mara", text: "St. Agnes. Twelve-hour shifts. You get used to the quiet. Mostly." },
      "She drops into the seat behind the driver's partition and looks out at the dark.",
      { who: "mara", text: "You're new. The last guy quit after a week. Said the bus was always cold. Said he kept hearing people in the back." },
      { who: "mara", text: "He was kind of a weirdo, though." },
      "She laughs. You laugh too. In the mirror, the old man in the back row doesn't move at all.",
      { who: "mara", text: "You know this route used to go farther? Past Northgate, all the way out to Ashgrove. Before the bridge." },
    ],
    choices: [
      { text: "“What happened to the bridge?”", next: "n1_mara_bridge" },
      { text: "“Hold on. Next stop's Market.”", next: "n1_market" },
    ],
  },

  n1_mara_bridge: {
    stop: "Elm & 4th",
    mood: "uneasy",
    lines: [
      { who: "mara", text: "A storm took it out. Way before I was born. My mom says they never found all the—" },
      "She stops.",
      "She's looking past you. At the old man in the back row.",
      "He's looking right back at her.",
      { pause: 800 },
      { who: "mara", text: "...Never mind. It's a sad story for a bus at midnight." },
    ],
    choices: [{ text: "Drive on.", next: "n1_market" }],
  },

  n1_mara_left: {
    stop: "Elm & 4th",
    mood: "uneasy",
    lines: [
      { sfx: "door" },
      "The doors hiss shut. You pull away from the curb.",
      "In the side mirror, she stops running. She stands under the streetlight with her hands on her knees, breathing hard, watching the bus go.",
      "She doesn't look angry.",
      { text: "She looks like she expected it.", after: 500 },
      { who: "rhee", text: "Good. That's how it's done." },
    ],
    choices: [{ text: "Drive on.", next: "n1_market" }],
  },

  n1_market: {
    stop: "Market St",
    lines: [
      "Market St. The shops are shuttered. One flickering sign: OPEN 24 HRS, with the 2 burned out.",
      "A kid sits alone on the bench. Fifteen, maybe. His backpack looks big enough to live out of.",
      { sfx: "door" },
      "He climbs on and pats his pockets. Then pats them again, slower, like the money might appear if he believes hard enough.",
      { who: "jun", text: "I don't... I don't have the fare. I just need to get to Northgate. Please. I'll pay you back tomorrow, I swear." },
      { who: "rhee", text: "Reminder, driver. No. Free. Rides." },
    ],
    choices: [
      { text: "“Sit down. This one's on me.”", kind: 1, warn: 1, set: { junRode: true }, next: "n1_jun" },
      { text: "“Sorry, kid. Rules.”", set: { junLeft: true }, next: "n1_jun_left" },
    ],
  },

  n1_jun: {
    stop: "Market St",
    onEnter: (s) => { s.flags.junNamed = true; },
    lines: [
      "His shoulders drop like he'd been holding them up for hours.",
      { who: "jun", text: "Thanks. I'm Jun. In case you need it for, like, a report." },
      "He sits halfway back. Then he looks at the old man, and moves two rows closer to you.",
      { who: "jun", text: "Is he... okay? He's not blinking." },
      { who: "rhee", text: "I saw that, driver. That's your one warning." },
    ],
    choices: [{ text: "Drive on.", next: "n1_stagnes" }],
  },

  n1_jun_left: {
    stop: "Market St",
    lines: [
      "He nods like he's heard it before, and steps back off.",
      { sfx: "door" },
      "As you pull away, he sits back down on the bench and pulls his hood up and stares at the road.",
      "It's six miles to Northgate.",
      { text: "It's a long walk in the dark.", after: 400 },
    ],
    choices: [{ text: "Drive on.", next: "n1_stagnes" }],
  },

  n1_stagnes: {
    stop: "St. Agnes",
    lines: (s) => s.flags.maraHelped ? [
      "St. Agnes Hospital. Every window lit, like the building's afraid of the dark.",
      { who: "mara", text: "Made it with a minute to spare. You're a lifesaver. Literally, probably. Same bus tomorrow?" },
      "She's out the door before you can answer.",
      "Halfway up the steps she turns and looks back at the bus. Not at you. At the back row.",
      "Then she's gone inside.",
    ] : [
      "St. Agnes Hospital. Every window lit, like the building's afraid of the dark.",
      "Nobody gets on. Nobody gets off.",
      "Up on the fourth floor, someone is standing at a window, looking down at the bus.",
      { pause: 600 },
      "When you look again, the window's empty.",
    ],
    choices: [{ text: "Drive on.", next: "n1_canal" }],
  },

  n1_canal: {
    stop: "Canal Row",
    mood: "uneasy",
    amb: { water: 0.25 },
    lines: [
      "Canal Row. The old warehouses. The streetlights here are the orange kind, and half of them are out.",
      "The stop is empty.",
      "There's water pooled across the road, shining under the lights. It hasn't rained all week.",
      { sfx: "drip" },
      "Your route sheet says nobody ever gets on at Canal Row.",
      "Someone's scratched something into the shelter glass. You can't read it from here.",
    ],
    choices: [
      { text: "Stop anyway, just in case.", hint: "+1 min", late: 1, kind: 1, set: { metWet: true }, next: "n1_wet" },
      { text: "Nobody's there. Keep going.", next: "n1_canal_skip" },
    ],
  },

  n1_wet: {
    stop: "Canal Row",
    mood: "dread",
    lines: [
      { sfx: "door" },
      "You open the doors. Cold air pours in. It smells like river mud.",
      "Nothing.",
      "You lean over to read the scratches on the shelter glass.",
      { text: "STOP FOR THEM", big: true, after: 600 },
      { pause: 900 },
      { scare: "face" },
      "A man is standing in the doorway.",
      "You didn't hear him. You didn't see him cross the street. He's just there, one foot on your bottom step.",
      "His suit is soaked through. Water runs off his cuffs and spreads across the floor of the bus.",
      { who: "wet", text: "Ashgrove, please." },
      { who: "you", text: "This bus doesn't go to Ashgrove." },
      { pause: 700 },
      { who: "wet", text: "No. I suppose it doesn't. Not anymore." },
      "He sits in the seat right behind you. You can hear him dripping.",
      { mirror: "wet", sfx: "drip", pause: 600 },
      "At the next red light you check the mirror. He's staring at the back of your head.",
      { sfx: "drip", pause: 900 },
      { mirror: "oldman", sfx: "lightsout", pause: 400 },
      "You look again. His seat is empty.",
      { text: "Just a puddle, spreading.", after: 600 },
    ],
    choices: [{ text: "Drive. Don't think about it.", next: "n1_northgate" }],
  },

  n1_canal_skip: {
    stop: "Canal Row",
    mood: "dread",
    lines: [
      "You roll past without slowing down.",
      "You glance at the side mirror as you pass the shelter.",
      { pause: 800 },
      { scare: "face" },
      "Someone's face, pressed right up against your window. Pale. Wet. Mouth open.",
      "You swerve. The tires hiss through the water.",
      { pause: 600 },
      "When you look again there's nothing there. Just a smear of water on the glass, in the shape of a hand.",
      "On the inside.",
      { pause: 900 },
      { who: "rhee", text: "Watch the road, driver. You're drifting." },
    ],
    choices: [{ text: "Grip the wheel. Keep driving.", next: "n1_northgate" }],
  },

  n1_northgate: {
    stop: "Northgate",
    mood: "uneasy",
    amb: { water: 0 },
    lines: (s) => [
      "Northgate. End of the line. The depot here is a concrete box with one light on.",
      ...(s.flags.junRode ? [
        { who: "jun", text: "Thanks. Seriously. I'll pay you back." },
        "He hops off and runs toward the depot, backpack bouncing.",
        "Halfway there, he stops and looks back. Not at you. At the back row of the bus. Then he runs faster.",
      ] : []),
      "The old man is still in the back row.",
      { who: "you", text: "End of the line, sir." },
      { pause: 900 },
      { who: "teodor", text: "Not yet, it isn't." },
    ],
    choices: [{ text: "Look at the route display.", next: "n1_reveal" }],
  },

  n1_reveal: {
    stop: "Northgate",
    mood: "dread",
    lines: [
      { sfx: "static", args: [1.4], pause: 300 },
      "The route display crackles. Static crawls across the screen like insects.",
      { set: { sawMystery: true }, sfx: "whisper", pause: 600 },
      { text: "When it clears, there's a new stop at the end of Route 9.", after: 300 },
      "After Northgate. Past where the road ends.",
      { text: "It doesn't have a name. Just three question marks, flickering.", after: 600 },
      { who: "rhee", text: "Driver. Your display is malfunctioning. Ignore it." },
      { who: "rhee", text: "Whatever it shows you. Ignore it." },
    ],
    choices: [{ text: "Look back at the old man.", next: "n1_end" }],
  },

  n1_end: {
    stop: "Northgate",
    mirror: "empty",
    lines: (s) => [
      "His seat is empty.",
      "You didn't hear the doors.",
      { sfx: "coin", pause: 500 },
      "Where he sat, there's a single coin. Heavy. Worn smooth. And the seat is soaking wet.",
      { who: "rhee", text: lateTonight(s) === 0 ? "Clean run, driver. Right on time. You might last." : `${minutes(lateTonight(s))} late on your first night. The last driver started like that.` },
      ...(s.flags.junRode ? [{ who: "rhee", text: "And no more free rides. I mean it." }] : []),
      { who: "rhee", text: "Get some sleep. Same time tomorrow." },
      { pause: 500 },
      "You sit in the dark depot for a long time before you drive home.",
      "You leave the radio off. You keep checking the mirror anyway.",
    ],
    choices: [{ text: "End your shift.", next: "n2_start" }],
  },
});
