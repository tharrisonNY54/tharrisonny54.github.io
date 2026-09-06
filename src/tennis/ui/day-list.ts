/**
 * Renders the day-by-day layout.
 *
 * The grid is unusable on a phone: a name column beside twenty date columns
 * leaves roughly one readable day on a 375px screen, and the edit row sits at
 * the bottom of a table taller than the screen. This view turns the sheet
 * ninety degrees instead — one card per day of play, your own choice at the top
 * of the card, everybody else's status folded away underneath. The vocabulary
 * and the colours are the ones the group already reads: O, A, N, P, grey,
 * yellow, green.
 */

import type { DisplayStatus, Member, Preference, Sheet } from '../types.js';
import { fullName } from '../types.js';
import { dayName, monthDay } from '../lib/dates.js';
import { effectiveType } from '../lib/draw.js';
import { rosterForDay, type DayRoster, type DayView, type SheetView } from '../lib/sheet.js';
import { el } from './dom.js';

export interface DayListOptions {
  /** Whose sign-ups the cards edit; an admin may be editing somebody else. */
  member: Member;
  /** Date -> the value currently chosen, saved or not. */
  pending: Map<string, Preference>;
  /** Date -> what is actually stored, used to flag unsaved changes. */
  saved: Map<string, Preference>;
  onChange(date: string, preference: Preference): void;
  /**
   * False when the page already names the member somewhere else, so the lead
   * line does not repeat what the administrator's member picker just said.
   */
  showMemberName: boolean;
}

/** The same three choices as the grid's dropdown, in the same order. */
const CHOICES: ReadonlyArray<[Preference, string, string]> = [
  ['O', 'O', 'No answer'],
  ['A', 'A', 'Available'],
  ['N', 'N', 'Not available'],
];

const STATUS_TEXT: Record<DisplayStatus, string> = {
  O: 'No answer yet',
  N: 'Not available',
  A: 'Available — waiting for a game',
  P: 'Playing',
};

export function renderDayList(
  container: HTMLElement,
  sheet: Sheet,
  view: SheetView,
  options: DayListOptions,
): void {
  container.replaceChildren();

  if (view.dates.length === 0) {
    container.append(
      el('p', { className: 'notice', text: 'No upcoming days of play are scheduled.' }),
    );
    return;
  }

  const instruction = 'Choose your days, then Submit Changes at the bottom.';
  container.append(
    el('p', {
      className: 'day-list__lead',
      text: options.showMemberName
        ? `Signing up ${fullName(options.member)}. ${instruction}`
        : instruction,
    }),
  );

  for (const date of view.dates) {
    container.append(dayCard(date, sheet, view.days.get(date), options));
  }
}

/* ------------------------------------------------------------------ cards */

function dayCard(
  date: string,
  sheet: Sheet,
  day: DayView | undefined,
  options: DayListOptions,
): HTMLElement {
  const locked = Boolean(day?.locked);
  const shown = day?.statuses.get(options.member.id) ?? 'O';

  const card = el('article', {
    className: 'day-card',
    dataset: { status: shown, locked: String(locked) },
  });

  const note = el('p', { className: 'day-card__note' });

  /**
   * Repaints the "not submitted yet" line in place. A full re-render would be
   * wrong here: P and A are only recalculated when changes are submitted, so
   * the status pill must not move until the sheet has actually been saved.
   */
  const refreshNote = (): void => {
    const chosen = options.pending.get(date) ?? 'O';
    const unsaved = !locked && chosen !== (options.saved.get(date) ?? 'O');

    card.dataset.unsaved = String(unsaved);
    if (locked) {
      note.textContent = 'This day is closed for changes.';
    } else if (unsaved) {
      note.textContent = `Not submitted yet: ${wordFor(chosen)}.`;
    } else {
      note.textContent = '';
    }
    note.hidden = note.textContent === '';
  };

  card.append(
    cardHead(date, day),
    el('p', {
      className: 'day-card__status',
      text: STATUS_TEXT[shown],
      dataset: { status: shown },
    }),
    choiceGroup(date, locked, options, refreshNote),
    note,
    rosterDetails(sheet, day),
  );

  refreshNote();
  return card;
}

function cardHead(date: string, day: DayView | undefined): HTMLElement {
  const games = day?.games ?? 0;
  const head = el('header', { className: 'day-card__head' });

  head.append(
    el('h3', { className: 'day-card__date', text: `${dayName(date)} ${monthDay(date)}` }),
    el('span', {
      className: 'day-card__games',
      text: describeGames(games),
      dataset: { games: String(games) },
    }),
  );

  return head;
}

function choiceGroup(
  date: string,
  locked: boolean,
  options: DayListOptions,
  onPicked: () => void,
): HTMLElement {
  const group = el('fieldset', { className: 'day-choice' });
  const current = options.pending.get(date) ?? 'O';

  group.append(
    el('legend', {
      className: 'visually-hidden',
      text: `${fullName(options.member)} — ${dayName(date)} ${monthDay(date)}`,
    }),
  );

  for (const [value, letter, word] of CHOICES) {
    const option = el('label', { className: 'day-choice__option', dataset: { value } });
    const input = el('input', {
      attrs: { type: 'radio', name: `preference-${date}`, value },
    });

    input.checked = value === current;
    input.disabled = locked;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      options.onChange(date, value);
      onPicked();
    });

    const mark = el('span', { className: 'day-choice__mark' });
    mark.append(input, el('span', { className: 'day-choice__letter', text: letter }));

    option.append(mark, el('span', { className: 'day-choice__word', text: word }));
    group.append(option);
  }

  return group;
}

/* ----------------------------------------------------------------- roster */

function rosterDetails(sheet: Sheet, day: DayView | undefined): HTMLElement {
  const roster = rosterForDay(sheet.members, day);
  const details = el('details', { className: 'day-roster' });

  details.append(el('summary', { className: 'day-roster__summary', text: summarise(roster) }));
  appendGroup(details, sheet, 'Playing', 'P', roster.playing);
  appendGroup(details, sheet, 'Available', 'A', roster.available);
  appendGroup(details, sheet, 'Not available', 'N', roster.unavailable);

  return details;
}

function appendGroup(
  parent: HTMLElement,
  sheet: Sheet,
  label: string,
  status: DisplayStatus,
  members: readonly Member[],
): void {
  if (members.length === 0) return;

  parent.append(
    el('h4', { className: 'day-roster__heading', text: `${label} (${members.length})` }),
  );

  const list = el('ul', { className: 'day-roster__list', dataset: { status } });
  for (const member of members) {
    list.append(
      el('li', {
        className: 'day-roster__name',
        text: fullName(member),
        // Substitutes who are playing keep the lighter green of the grid.
        dataset: { play: effectiveType(member, sheet.settings) },
      }),
    );
  }
  parent.append(list);
}

/* ------------------------------------------------------------------ words */

function summarise(roster: DayRoster): string {
  const parts: string[] = [];
  if (roster.playing.length > 0) parts.push(`${roster.playing.length} playing`);
  if (roster.available.length > 0) parts.push(`${roster.available.length} waiting`);
  if (roster.unavailable.length > 0) parts.push(`${roster.unavailable.length} out`);

  return parts.length === 0 ? 'Nobody has answered yet' : `Everyone: ${parts.join(' · ')}`;
}

function describeGames(games: number): string {
  if (games === 0) return 'No games yet';
  return games === 1 ? '1 game' : `${games} games`;
}

function wordFor(preference: Preference): string {
  return CHOICES.find(([value]) => value === preference)?.[2] ?? 'No answer';
}
