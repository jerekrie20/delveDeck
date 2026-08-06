// Screen 14 — what a settled Endless run LEFT you.
//
// Split off `endless.ts` at Stage 6b-2, on the seam `SCREENS.md` already draws: that file
// owns the RUN — opening it, resuming it, stepping it, handing it in — and this owns the
// one screen that is about the run being over. They change for different reasons. A
// checkpoint rule moves when the mode's safety story does; this moves when what a delve is
// WORTH does, which is every stage that adds a currency.
//
// **This is the screen that decides whether players stay** (`GAME_DESIGN.md` § The second
// cliff). The one thing you must not break: **it is a receipt, never a scold.** It is
// itemised on both faces — what burned AND what was kept — because the mode's actual
// promise is *you moved sideways, not backwards*, and a promise is only worth something if
// it is legible at the moment it costs you.

import { itemName } from '../shared/sim';
import type { EndlessSummary } from '../server/core/endless';
import { affixSummary, rarityClass } from './gear';
import { escapeHtml, inShell } from './shell';

/**
 * The haul, itemised — **and it is the same list on both faces of the receipt.**
 *
 * `GAME_DESIGN.md` § The second cliff calls THE LOSS the beat that decides whether
 * players stay, and what makes it a receipt rather than a scold is that it is specific:
 * not *"you lost your haul"* but *"you lost the Rare Coat you found at 14 and were
 * wearing."* A death strikes every row through, including the worn ones, because wearing
 * one never saved it — and saying so here is cheaper than a player discovering it.
 *
 * **The mockup's *"gear is always kept"* is overridden and does not appear**
 * (`MODES.md` § The haul).
 */
function itemReceipt(receipt: EndlessSummary, died: boolean): string {
  if (receipt.items.length === 0) return '';
  const rows = receipt.items
    .map((item, i) => {
      const worn = receipt.itemsWorn[i] === true;
      return (
        `<div class="haulrow ${rarityClass(item)}${died ? ' gone' : ''}">` +
        `<span class="n">${escapeHtml(itemName(item))}</span>` +
        `<span class="d">${escapeHtml(affixSummary(item))}</span>` +
        `<span class="w">${worn ? 'WORN' : `D${item.depth}`}</span></div>`
      );
    })
    .join('');
  const scrapped =
    receipt.overflowed > 0
      ? `<div class="dnote">${receipt.overflowed} would not fit your stash and ` +
        `<b>scrapped for ${receipt.overflowShards} shards</b>.</div>`
      : '';
  return (
    `<div class="${died ? 'lost' : 'kept'}">` +
    `<div class="k">${receipt.items.length} ` +
    `${receipt.items.length === 1 ? 'ITEM' : 'ITEMS'} ` +
    `${died ? 'LOST &mdash; WORN OR NOT' : 'BANKED TO YOUR STASH'}</div>` +
    `<div class="haullist">${rows}</div>${scrapped}</div>`
  );
}

/**
 * What the run earned toward the delver. Offline it names the number and says plainly
 * that nothing received it — the same contract the shard line above keeps, and for the
 * same reason: printing `LVL 1` for a delver that does not exist is the one kind of lie
 * the offline fallback is built to avoid.
 */
function xpReceipt(receipt: EndlessSummary, offline: boolean): string {
  const label = offline
    ? 'XP EARNED &mdash; NO DELVER TO KEEP IT'
    : receipt.levelledUp
      ? `LEVEL ${receipt.level} &mdash; LEVELLED UP`
      : `LEVEL ${receipt.level}`;
  return (
    `<div class="kept"><div class="v">&plus;${receipt.xpEarned} XP</div>` +
    `<div class="k">${label}</div></div>`
  );
}

/**
 * Screen 14 — the death, and its mirror for the run that got out.
 *
 * At 6a the haul was shards only. The item half landed at 6b and the XP pair at 6b-2: the
 * rule does not change, the list it applies to does. **The mockup's "gear is always kept"
 * is overridden** and does not appear here (`MODES.md` § The haul).
 *
 * The run's own banner and its offline flag are **passed in, not imported**. They are
 * facts about the session that produced this receipt, and a screen that reached back into
 * the module driving it is the seam this split exists to keep clean.
 */
export function outcomeScreen(
  receipt: EndlessSummary,
  session: { banner: string; offline: boolean }
): string {
  const died = receipt.outcome === 'died';
  // A surfacing that did not reach the total is an OFFLINE one, and the line says so
  // rather than printing `+0` beside a haul the player is looking at. It is written as
  // a general rule instead of an offline flag because a partial bank is exactly what a
  // future "a portion of the haul survives" affix produces (`MODES.md` § The haul).
  const unbanked = !died && receipt.banked < receipt.haul;
  const burned = died
    ? `<div class="lost"><div class="v">${receipt.haul}</div>` +
      '<div class="k">SHARDS LOST &mdash; NEVER BANKED</div></div>'
    : `<div class="kept"><div class="v">&plus;${unbanked ? receipt.haul : receipt.banked}</div>` +
      `<div class="k">SHARDS ${unbanked ? 'SURFACED &mdash; NOT BANKED' : 'BANKED'}</div></div>`;
  const items = itemReceipt(receipt, died);
  const again = died
    ? `SURFACE AT ${Math.max(1, receipt.cleared)} NEXT TIME?`
    : 'THE SHAFT IS STILL THERE';
  const total = unbanked
    ? 'Your delver is unchanged. Nothing was written down &mdash; there is no server ' +
      'behind this one.'
    : `Your delver is unchanged and <b>${receipt.shardTotal} banked shards</b> are ` +
      `untouched. ${
        died
          ? 'The dark keeps only what you were carrying.'
          : 'The haul is yours.'
      }`;
  const body =
    session.banner +
    '<div class="deathwrap">' +
    `<div><div class="eyebrow">${died ? 'THE LANTERN WENT OUT AT' : 'YOU CAME BACK UP FROM'}` +
    `</div><div class="big${died ? '' : ' out'}">DEPTH ${receipt.depth}</div></div>` +
    burned +
    items +
    // **The record and the XP are a PAIR, side by side, and on both faces of the screen.**
    // A death burns the haul and keeps the record — so it keeps what that record earned.
    // Together they are the line that makes *"you moved sideways, not backwards"* a number
    // rather than a claim, printed at exactly the moment it is hardest to believe.
    //
    // They share a row rather than stacking because this screen is the tallest in the
    // game: at 320×568 a seventh stacked block put DELVE AGAIN eight pixels below the
    // fold, and a receipt whose only forward action needs a scroll is a receipt that reads
    // as an ending (`CODING_BIBLE` §6).
    '<div class="keptrow">' +
    `<div class="kept"><div class="v">D${receipt.best} ` +
    `&middot; ${receipt.newRecord ? 'NEW' : 'KEPT'}</div>` +
    '<div class="k">DEPTH RECORD</div></div>' +
    xpReceipt(receipt, session.offline) +
    '</div>' +
    `<div class="dnote">${total}</div></div>` +
    '<div class="act"><button class="btn small" data-action="camp">CAMP</button>' +
    '<button class="btn go" data-action="endless-again">DELVE AGAIN' +
    `<span class="sub">${again}</span></button></div>`;
  return inShell({ shell: 'abyss' }, body);
}
