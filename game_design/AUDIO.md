# Audio — synthesised, never shipped

> **Docs own shape, code owns numbers.** Frequencies, envelopes and mix levels live
> in the audio module.

## The rule

> ### Synthesise everything. Ship no audio files.
> ### An audio library is a sprite library with a different extension.

This project exists because its predecessor died inside an **asset pipeline** —
sprite strips, origins, anchor tables, work that compounds and that never quite
finishes. `ART.md` answered that for pictures. This file answers it for sound, and
the answer is the same shape: **generate it in code.**

Web Audio makes the entire soundscape — drones, impacts, the lantern, the descent —
from oscillators, filtered noise and envelopes, in a few KB of source. That buys three
things a folder of `.ogg` files cannot:

1. **No pipeline.** A new stratum costs zero new assets. No exports, no loudness
   matching, no library to keep consistent, no format to re-encode.
2. **No weight.** This renders inside a Reddit feed. A megabyte of ambience is a
   megabyte someone downloads to play four minutes.
3. **Parameterisation by depth** — the thing files fundamentally can't do. The deep
   doesn't play a *different track*; it plays the *same instrument, lower, slower and
   thinner*. Depth 40 sounds deeper than depth 12 because it literally is.

---

## The two hard rules

**1 · It plays in a feed. Default to muted.**
Remember the choice. Never surprise anyone. Someone scrolling Reddit at work who gets
a dungeon drone is someone who uninstalls the app and tells people why. A small,
obvious, persistent speaker toggle — and silence until it's pressed.

**2 · Browsers require a user gesture before audio starts.**
The AudioContext cannot be created until the player taps something. **The first tap
gates it** — the "DESCEND" button on the feed post is the natural moment, since it is
already the first tap in the entire game. If a context is created before a gesture it
lands suspended, and everything after it silently does nothing.

---

## The palette

One synth voice family, retuned per stratum. **The instrument never changes — the
tuning does.** That is what makes descent feel continuous rather than like changing
rooms.

| Stratum | Drone | Texture | Feels like |
|---|---|---|---|
| **Surface — the camp** | Warm, mid, slow-moving | Fire crackle *(filtered noise bursts)* | The last warm light |
| **The Warrens** | A touch lower, restless | Skitters — short, dry, off-beat | Something else lives here |
| **The Hold** | Low, with a pulse | Distant knocks, irregular | Someone is working nearby |
| **The Crypt** | Very low, almost still | Long room tone, huge reverb | Nobody has spoken here in a long time |
| **The Abyss** | Sub-bass, barely a pitch | Near-silence, and a rhythm | You are not alone and it is not hiding |

**Depth is a continuous parameter, not a switch.** Base frequency drops, filter cutoff
closes, reverb lengthens, and the top end thins as you descend. Crossing a stratum
boundary re-tunes the same voice rather than starting a new one.

### The rhythm below

The canon's central image — *a rhythm, far below, patient as tide* — should be
**audible before it is ever written down**, and it should arrive so quietly that the
first few times a player notices it they aren't sure. Deep strata only. It never
speeds up, it never resolves, and it is never acknowledged by any UI element.

That is the single best thing synthesis buys this game: a sound that is *always the
same tempo* no matter how deep you go, so the player works out on their own that they
are getting closer to it rather than it getting closer to them.

---

## Combat sounds

Short, dry, percussive. Every one of these is an envelope over a filtered oscillator
or a noise burst — no samples.

| Event | Sound |
|---|---|
| **Cast — physical** | Dry click with a fast attack. Pitch varies by archetype. |
| **Cast — spell** | Softer attack, longer tail, element-tinted (fire wider, frost thinner) |
| **Hit lands on the enemy** | Short thud; deeper the bigger the number |
| **Blocked** | Muted tap, no tail — *the sound of nothing happening* |
| **PERFECT BLOCK** | A clean bell, and it should be genuinely satisfying |
| **HP lost** | A dull, low knock. No scream, no gore. |
| **Rage fills** | A rising tone that **stops** at full — the silence after is the tell |
| **Ultimate** | The loudest thing in the game. It has earned it. |
| **Threat is lethal** | A low pulse under the track, not an alarm |
| **A lantern slot unlights** | A small extinguish. The mix gets emptier and stays emptier. |
| **Depth cleared** | One note, short |
| **Death** | Everything stops except the drone, which continues, indifferent |

**The lantern is an audible presence.** A faint hum that sits under everything — and
as slots unlight in the deep, the hum thins out. When a player notices the mix has got
lonelier before they notice the UI, the sound design is doing the design's job.

---

## What audio is not allowed to become

| | |
|---|---|
| **A file library** | The moment there is a `public/audio/` folder there is a pipeline, a naming convention, and a consistency problem. |
| **Voice** | No narration, no grunts. The fiction is *found text*; a voice would name what must stay unnamed. |
| **Music that loops audibly** | A loop point is a reminder that this is software. Generated ambience has no seam. |
| **Anything tied to animation** | Sound is free of the art rule because it has no frames. Keep it that way — no timing-locked sequences. |

**Authored music remains a deliberate future exception**, not a default: if it ever
ships, it is a fixed number of loops with a stated file budget, decided explicitly the
way frame-animated rare cards were once scoped and declined.

---

## What has to exist early

| Need | Stage | Why |
|---|---|---|
| The mute toggle + persisted preference | with the first sound | It is the thing that stops the feature being a liability |
| Gesture-gated AudioContext creation | same | A context made too early is silently dead |
| Depth as an audio parameter | same | Retrofitting continuous depth onto per-stratum switching is a rewrite |

**Audio ships late** — it is not on the path to the Stage 4 gate, and a silent game is
a complete game. But when it arrives it should arrive whole, because half a soundscape
is worse than none.

## Open

- **Does the Daily get audio at all?** It is the mode most likely to be played in
  public, on a feed, at work. A case exists for the Daily being silent by design and
  sound being an Endless pleasure.
- **Accessibility.** Every sound that carries information — lethal warnings, perfect
  block, rage full — must already be visible. Sound may *reinforce*, never *inform*.
- **Reduced motion has an audio analogue.** `prefers-reduced-motion` doesn't cover
  sound, but the instinct behind it does: offer a "quiet" mode that keeps the
  informational cues and drops the ambience.
