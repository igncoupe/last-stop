// The Route 9 file: things you can find for yourself, if you look. None of them are on the schedule.
//   posters  - fourteen missing posters, one for each of them, on the bus shelters (read from your seat)
//   clippings - one a night, taped inside Teodor Varga's old locker at the depot
//   log      - Teodor's driver's log from March 1994, by your seat; one more page every night
// They're silent (no voice lines): you read them in your own time.

const LAST_SEEN = "Last seen on the Route 9 bus, March 14, 1994.";
const poster = (id, night, stop, slot, who, sign, name, lines, scrawl) => ({
  id: `poster-${id}`, kind: "poster", night, stop, slot, who, sign,
  doc: { kind: "poster", kicker: "Have you seen", title: "Missing", photo: `PERSON:${who}`, lines: [name, ...lines, LAST_SEEN], scrawl },
});

export const POSTERS = [
  // night 1
  poster("grace", 1, "Elm & 4th", 0, "grace", ["MISSING", "GRACE H., 23", "MAR 14 1994"], "GRACE HOLLOWAY, 23",
    ["Waitress, Lou's Diner, Market St.", "Left her shift early to catch the last bus."], "Gracie we miss you - everybody at Lou's"),
  poster("sam", 1, "Market St", 0, "sam", ["MISSING", "SAM W., 44", "MAR 14 1994"], "SAMUEL WHITFIELD, 44",
    ["Night janitor, Market St. Elementary.", "Gray work jacket. Always had a crossword."], "Dad we kept your plate warm"),
  poster("henry", 1, "Canal Row", 0, "henry", ["MISSING", "HENRY L., 66", "MAR 14 1994"], "HENRY LUTZ, 66",
    ["Retired machinist.", "Played chess with the night driver at Northgate."], "the board is still set up, Henry"),
  // night 2
  poster("eddie", 2, "Elm & 4th", 0, "eddie", ["MISSING", "EDDIE R., 17", "MAR 14 1994"], "EDWARD \"EDDIE\" RUIZ, 17",
    ["Dishwasher, Lou's Diner. White apron.", "Always whistling. Pays in quarters."], "mijo please call home - Mama"),
  poster("rosa", 2, "Market St", 0, "rosa", ["MISSING", "ROSA D., 58", "MAR 14 1994"], "ROSA DELGADO, 58",
    ["Seamstress. Rode the 9 home every night for twenty years.", "Green scarf."], "Mama, we are still waiting up"),
  poster("thomas", 2, "St. Agnes", 0, "thomas", ["MISSING", "TOMMY N., 19", "MAR 14 1994"], "THOMAS NGUYEN, 19",
    ["Student. Played guitar on the back seat.", "Blue jacket, a guitar case covered in stickers."], "your guitar is still here Tommy"),
  // night 3
  poster("dorothy", 3, "Elm & 4th", 0, "dorothy", ["MISSING", "D. KESSLER, 74", "MAR 14 1994"], "DOROTHY KESSLER, 74",
    ["Retired teacher, Ashgrove Elementary, 41 years.", "Carries her knitting everywhere."], "we love you Mrs. K - Room 3"),
  poster("abby", 3, "Market St", 0, "abby", ["MISSING", "ABBY C., 35", "MAR 14 1994"], "ABIGAIL CHEN, 35",
    ["Pharmacist, St. Agnes.", "Red umbrella."], "Abby call me. Please. - J"),
  poster("daniel", 3, "St. Agnes", 0, "daniel", ["MISSING", "DANIEL P., 34", "MAR 14 1994"], "DANIEL PRICE, 34",
    ["Was carrying a birthday present, wrapped in paper with balloons."], "DADDY COME HOME - Rosie"),
  // night 4
  poster("frank", 4, "Elm & 4th", 0, "frank", ["MISSING", "FRANK D., 52", "MAR 14 1994"], "FRANK DOYLE, 52",
    ["Mail carrier, Route 12. Ask anyone.", "Big laugh. Brown mailbag."], "Frankie, the dog still waits by the door"),
  poster("lena", 4, "Market St", 0, "lena", ["MISSING", "LENA M., 31", "MAR 14 1994"], "LENA MARSH, 31",
    ["Nurse, St. Agnes. Mother of one.", "Lavender cardigan."], "her little one asks for her every night"),
  poster("ivy", 4, "St. Agnes", 0, "ivy", ["MISSING", "IVY ORTIZ, 6", "MAR 14 1994"], "IVY ORTIZ, 6",
    ["Yellow raincoat with yellow buttons.", "Rings the bell at every stop."], "please bring our girls home"),
  // night 5
  poster("carmen", 5, "Elm & 4th", 0, "carmen", ["MISSING", "CARMEN O., 29", "MAR 14 1994"], "CARMEN ORTIZ, 29",
    ["Ivy's mother. Works at the Canal St. laundromat.", "Never without her daughter."], "please bring our girls home"),
  poster("marcus", 5, "Elm & 4th", 1, "marcus", ["MISSING", "MARCUS B., 26", "MAR 14 1994"], "MARCUS BELL, 26",
    ["Green jacket.", "He was carrying a ring."], "I would have said yes. - Ana"),
];

const clipping = (night, kicker, title, lines, photo, caption = "") => ({
  id: `clipping-${night}`, kind: "clipping", night,
  doc: { kind: "clipping", kicker: `The Harbor Ledger · ${kicker}`, title, lines, photo, caption },
});

export const CLIPPINGS = [
  clipping(1, "March 15, 1994", "Ashgrove Bridge Collapses in Storm; Route 9 Bus Lost", [
    "The Ashgrove bridge gave way at 12:31 a.m. as a city bus crossed it in the worst storm in forty years.",
    "Divers searched the river through the night. The driver was pulled from the water alive.",
    "Fourteen passengers are missing.",
  ], "BRIDGE", "The Ashgrove bridge at first light"),
  clipping(2, "March 17, 1994", "Lou's Diner Closes for a Day of Mourning", [
    "Two of Lou's own were on the last bus: waitress Grace Holloway, 23, and dishwasher Eddie Ruiz, 17, who had worked his first double shift that night.",
    "\"He was saving up to buy his mother a car,\" said owner Lou Pappas. \"He kept his tips in a coffee can. Quarters, mostly.\"",
  ], "PERSON:eddie"),
  clipping(3, "March 19, 1994", "Ashgrove Mourns Its Teacher", [
    "Dorothy Kessler taught third grade at Ashgrove Elementary for forty-one years. Hundreds of her former students lined the river road with candles.",
    "One of them, nurse Lena Marsh, 31, was on the bus with her. Friends say they sat together every night.",
  ], "PERSON:dorothy"),
  clipping(4, "March 22, 1994", "Letters From the River", [
    "Mail carrier Frank Doyle, 52, was riding home with his mailbag. Divers brought it up the next day.",
    "His co-workers dried every letter by hand and delivered them all. All but one.",
    "\"There was one we never found,\" said his supervisor. \"Frank would have hated that.\"",
  ], "PERSON:frank"),
  clipping(5, "March 30, 1994", "A Ring in the River", [
    "A diver searching below the Ashgrove bridge found a small velvet box, still closed. Inside was an engagement ring, engraved: ANA, ALWAYS.",
    "Ana Torres says Marcus Bell, 26, had been nervous all week. \"I knew,\" she said. \"I just wanted him to ask.\"",
  ], "PERSON:marcus"),
];

const page = (night, title, lines, scrawl) => ({
  id: `log-${night}`, kind: "log", night,
  doc: { kind: "log", kicker: "Route 9 · Driver's log · T. Varga", title, lines, scrawl },
});

export const LOG = [
  page(1, "Thursday, March 10, 1994", [
    "11:40 out. Rain. Eddie from Lou's flagged me down past Market again, counting his quarters. Says he'll have the car by summer.",
    "Mrs. Kessler knitting a scarf. Says it's for me. Little Ivy rang the bell at every stop. Her mother said sorry four times.",
    "Told her it's what the bell is for. 12:20 Northgate. On time.",
  ]),
  page(2, "Friday, March 11, 1994", [
    "Two minutes late at St. Agnes. Waited for Lena, she came running off the ward with her shoes in her hand. H.R. on the radio about it for five minutes.",
    "Lena showed me a drawing her kid did. A bus, and me in it, big hat. I'm keeping it.",
    "River's high under Ashgrove. Told dispatch the bridge rattles. Dispatch says it always rattles.",
  ]),
  page(3, "Saturday, March 12, 1994", [
    "Frank Doyle rode the whole way telling jokes I've heard. His dog waits at the door every night, he says. Like a person.",
    "Daniel Price on, quiet, planning his little girl's birthday. Monday. Asked me to get him home before she's asleep. Told him I always do.",
    "H.R. says if I'm late again it's a write-up.",
  ]),
  page(4, "Sunday, March 13, 1994", [
    "Storm warning for tomorrow night. Asked H.R. about holding at Northgate if the river comes up. He said the schedule doesn't wait for weather. Said that's the job.",
    "Young fellow, Marcus, kept checking his coat pocket the whole way. Grinning. I didn't ask. Some things you let a man tell you himself.",
  ]),
  page(5, "Monday, March 14, 1994", [
    "11:40 out. Rain like nails. Full bus by Market.",
    "12:08 river over the road at Canal.",
    "12:19 Northgate. Called dispatch. Asked to hold till it passes. Denied. Eleven minutes down. H.R. says take the bridge and make up the time.",
    "Fourteen on board. I know every one of their names. I'm going to wait. I'm going to",
  ], "I'm sorry I'm sorry I'm sorry"),
];

export const FILE_ITEMS = [...POSTERS, ...CLIPPINGS, ...LOG];
export const FILE_TOTAL = FILE_ITEMS.length;
