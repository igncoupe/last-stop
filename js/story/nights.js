// The five nights, the four endings, and the credits.
import { night1 } from "./night1.js";
import { night2 } from "./night2.js";
import { night3 } from "./night3.js";
import { night4 } from "./night4.js";
import { night5 } from "./night5.js";

export const NIGHTS = {
  1: { subtitle: "Your first run on Route 9.", run: night1 },
  2: { subtitle: "The stop with no name has moved.", run: night2 },
  3: { subtitle: "A storm is coming in off the river.", run: night3 },
  4: { subtitle: "Channel 9 is still broadcasting.", run: night4 },
  5: { subtitle: "Last stop.", run: night5 },
};

export const ENDINGS = {
  ontime:  { number: 1, title: "On Schedule", blurb: "You were never late again. Not once, in thirty-one years.", hint: "They're still waiting. Stop for them." },
  notyet:  { number: 2, title: "Not Yet", blurb: "Ashgrove will be waiting again tomorrow night.", hint: "Be the driver who stops. Every time." },
  home:    { number: 3, title: "Home", blurb: "Fourteen fares, paid at last. But Channel 9 is still on the air.", hint: "Something on the radio is still waiting." },
  deadair: { number: 4, title: "Dead Air", blurb: "Fifteen fares. Everyone gets a ride home.", hint: "The true ending. Thank you for stopping." },
};

export const CREDITS = `
  <h2>LAST STOP</h2>
  <p><strong>A game by</strong>igncoupe</p>
  <p><strong>Built with</strong>Claude</p>
  <p><strong>Voices</strong>Created with ElevenLabs</p>
  <p><strong>Ivy's voice</strong>Boson AI's Higgs Audio</p>
  <p><strong>3D</strong>three.js</p>
  <p><strong>Music and sound</strong>Generated live in your browser</p>
  <p><strong>Inspired by</strong>Fears to Fathom</p>
  <p style="margin-top:80px">In memory of everyone who never got a ride home.</p>
  <p style="margin-top:120px;color:#ffb54a">Thank you for stopping.</p>
`;
