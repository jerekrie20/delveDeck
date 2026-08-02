# Questions for the owner

**Temporary.** Answer, fold each into the doc that owns it, delete the row. When this
file is empty, delete the file.

Fourteen of the original fifteen are answered and folded in (2026-08-01). One is left,
restated below because the first version of it wasn't clear.

Nothing here blocks Stage 1.

---

## Q15 · Who removes a leaderboard entry, and how?

**Restated, because "moderation path" was too vague.**

The server already makes *fabricated* scores impossible: the client submits a choice
list, the server re-runs the sim and computes the score itself, so there is no number
a client can send. That defence is complete and it is not what this question is about.

**The gap is that "verified" is not the same as "legitimately played."** A run can
replay perfectly and still be something you'd want off the board:

- Someone runs the sim offline through a search and submits the solved line. It is a
  real choice list. It replays. It is also not a person playing a four-minute puzzle.
- Someone posts the optimal line in the comments at 00:05 UTC and forty people paste
  it. Every one of those entries is genuine and identical.
- A bug in an ability lets a loadout do something the design never intended, and
  today's top ten is all that loadout.
- An account exists only to hold a top score.

**The question: when an entry needs to come off the board, what takes it off, and who
presses the button?** Pick one — they aren't exclusive, but the first one that ships
decides the shape.

| | Option | Costs | Note |
|---|---|---|---|
| **A** | **Nothing. Live with it.** | Zero | The Daily board resets every day, so a bad entry ages out in 24 hours on its own. Honest answer for a hobby project; bad answer if it happens weekly. |
| **B** | **Subreddit mods can remove an entry** | One mod-only menu action, a removal key, a test against the Devvit mock | Fits Reddit: it is *their* community's board. Also means you never adjudicate anything. |
| **C** | **Only you can remove an entry** | Same, gated to the app owner | You keep control and you inherit every report. |
| **D** | **The server suppresses automatically** | Real work — heuristics, thresholds, false positives | e.g. flag identical choice lists across accounts, or submissions faster than the run is playable. Can be wrong about a real player, which is worse than the problem. |

**A recommendation, since you asked what this even was:** ship **A**, and add **B** the
first time it actually happens. A daily reset is a strong defence on its own, and a
removal path with nothing to remove is a feature about an imagined problem. What is
worth doing *now* is cheap and unrelated to any of the four: make sure a removal is
*possible* later — a board entry keyed by `{day, subreddit, username}` can be deleted
without touching anything else, which the current `run.ts` key shape already allows.

There is one sub-question underneath, and it is a **design** call rather than a
moderation one: **is solving the day's shaft offline cheating, or is it the game?**
The whole pitch is *a puzzle everyone shares, solvable by reasoning* — and a comment
thread full of people arguing about the optimal line is the stated goal. If the answer
is "that's the game", most of the table above stops mattering and only the bug case
(row 3) needs a path.

*Owns it once answered:* `MODES.md` § The Daily, plus a `CODING_BIBLE.md` §5 rule if a
removal endpoint ships.
