/**
 * Renders the sign-up grid.
 *
 * Column order, the week gaps, the repeated date headers at the foot and the
 * single edit row at the bottom all match the original sheet, because members
 * navigate this page by muscle memory.
 */

import type { Member, Preference, Sheet } from '../types.js';
import { fullName } from '../types.js';
import { dayCode, dayName, monthDay } from '../lib/dates.js';
import { effectiveType } from '../lib/draw.js';
import type { DayView, SheetView } from '../lib/sheet.js';
import { el } from './dom.js';

export interface GridOptions {
  editingMemberId: string;
  /** Administrators may point the edit row at any member. */
  canEditOthers: boolean;
  onSelectMember(memberId: string): void;
}

export interface EditRowOptions {
  member: Member;
  /** Date -> the value currently chosen in the dropdown, saved or not. */
  pending: Map<string, Preference>;
  /** Date -> what is actually stored, used to flag unsaved changes. */
  saved: Map<string, Preference>;
  onChange(date: string, preference: Preference): void;
}

const PREFERENCE_LABELS: ReadonlyArray<[Preference, string, string]> = [
  ['O', 'O', 'Open — no preference'],
  ['A', 'A', 'Available — I want to play'],
  ['N', 'N', 'Not available'],
];

export function renderHead(head: HTMLTableSectionElement, view: SheetView): void {
  head.replaceChildren();

  const dateRow = el('tr');
  const dayRow = el('tr');

  // One header cell per column. A single cell spanning both would let its own
  // content decide how the two sticky columns are shared, and the offsets the
  // stylesheet pins them at would stop matching.
  const seatCorner = el('th', { className: 'seat-head' });
  seatCorner.rowSpan = 2;
  seatCorner.setAttribute('aria-hidden', 'true');

  const corner = el('th', { className: 'members-head', text: 'MEMBERS' });
  corner.rowSpan = 2;
  corner.scope = 'col';
  dateRow.append(seatCorner, corner);

  appendDateColumns(dateRow, dayRow, view);
  head.append(dateRow, dayRow);
}

export function renderBody(
  body: HTMLTableSectionElement,
  sheet: Sheet,
  view: SheetView,
  options: GridOptions,
): void {
  body.replaceChildren();

  for (const member of sheet.members) {
    const row = el('tr', {
      className: 'member-row',
      dataset: {
        memberId: member.id,
        editing: String(member.id === options.editingMemberId),
      },
    });

    row.append(seatCell(member, view, options), nameCell(member));

    forEachColumn(view, (date) => {
      row.append(statusCell(member, sheet, view.days.get(date)));
    }, () => row.append(gapCell('td')));

    body.append(row);
  }
}

export function renderFoot(
  foot: HTMLTableSectionElement,
  view: SheetView,
  contactButton: HTMLElement,
  edit: EditRowOptions,
): void {
  foot.replaceChildren();

  const dateRow = el('tr');
  const dayRow = el('tr');

  const contactCell = el('td', { className: 'row-label' });
  contactCell.colSpan = 2;
  contactCell.append(contactButton);
  dateRow.append(contactCell);

  const spacer = el('td', { className: 'row-label' });
  spacer.colSpan = 2;
  dayRow.append(spacer);

  appendDateColumns(dateRow, dayRow, view);
  foot.append(dateRow, dayRow, editRow(view, edit));
}

/* ------------------------------------------------------------------ cells */

function seatCell(member: Member, view: SheetView, options: GridOptions): HTMLTableCellElement {
  const cell = el('td', { className: 'seat-cell' });
  const isLastSignup = view.lastSignupMemberId === member.id;

  const button = el('button', {
    className: 'seat',
    text: String(member.seat),
    dataset: { lastSignup: String(isLastSignup) },
    attrs: {
      type: 'button',
      'aria-label': options.canEditOthers
        ? `Edit ${fullName(member)}`
        : `Row ${member.seat}, ${fullName(member)}`,
    },
  });

  if (isLastSignup) {
    button.title = 'Last member to sign up for the next day of play';
  }

  // Only administrators can point the edit row at somebody else.
  if (options.canEditOthers) {
    button.addEventListener('click', () => options.onSelectMember(member.id));
  } else {
    button.disabled = true;
  }

  cell.append(button);
  return cell;
}

function nameCell(member: Member): HTMLTableCellElement {
  return el('td', {
    className: 'name-cell',
    text: fullName(member),
    dataset: { kind: member.isAdmin ? 'admin' : member.type },
  });
}

function statusCell(member: Member, sheet: Sheet, day: DayView | undefined): HTMLTableCellElement {
  const status = day?.statuses.get(member.id) ?? 'O';
  const cell = el('td', {
    className: 'status',
    // Open cells stay blank, exactly as on the original sheet.
    text: status === 'O' ? '' : status,
    dataset: { status, kind: effectiveType(member, sheet.settings) },
  });

  if (day) {
    cell.setAttribute(
      'aria-label',
      `${fullName(member)}, ${dayName(day.date)} ${monthDay(day.date)}: ${describeStatus(status)}`,
    );
  }
  return cell;
}

function describeStatus(status: string): string {
  if (status === 'P') return 'playing';
  if (status === 'A') return 'available';
  if (status === 'N') return 'not available';
  return 'no preference entered';
}

function editRow(view: SheetView, edit: EditRowOptions): HTMLTableRowElement {
  const row = el('tr', { className: 'edit-row' });

  const label = el('td', { className: 'row-label', text: fullName(edit.member) });
  label.colSpan = 2;
  row.append(label);

  forEachColumn(
    view,
    (date) => {
      const day = view.days.get(date);
      const cell = el('td');
      cell.append(editSelect(date, day, edit));
      row.append(cell);
    },
    () => row.append(gapCell('td')),
  );

  return row;
}

function editSelect(date: string, day: DayView | undefined, edit: EditRowOptions): HTMLSelectElement {
  const select = el('select', { className: 'edit-select' });
  const current = edit.pending.get(date) ?? 'O';

  select.setAttribute(
    'aria-label',
    `${dayName(date)} ${monthDay(date)} status for ${fullName(edit.member)}`,
  );

  for (const [value, short, description] of PREFERENCE_LABELS) {
    const option = el('option', { text: short, attrs: { value, title: description } });
    if (value === current) option.selected = true;
    select.append(option);
  }

  if (day?.locked) {
    select.disabled = true;
    select.title = 'This day is closed for changes.';
  }

  select.dataset.changed = String(current !== (edit.saved.get(date) ?? 'O'));
  select.addEventListener('change', () => {
    edit.onChange(date, select.value as Preference);
    select.dataset.changed = String(select.value !== (edit.saved.get(date) ?? 'O'));
  });

  return select;
}

/* ---------------------------------------------------------------- layout */

function appendDateColumns(
  dateRow: HTMLTableRowElement,
  dayRow: HTMLTableRowElement,
  view: SheetView,
): void {
  forEachColumn(
    view,
    (date) => {
      const day = view.days.get(date);
      dateRow.append(el('th', { className: 'date-head', text: monthDay(date) }));

      const dayCell = el('th', {
        className: 'day-head',
        dataset: { games: String(day?.games ?? 0) },
      });
      dayCell.append(
        document.createTextNode(`${dayCode(date)} `),
        el('span', { className: 'game-count', text: String(day?.games ?? 0) }),
      );
      dayCell.title = `${dayName(date)} ${monthDay(date)} — ${describeGames(day?.games ?? 0)}`;
      dayRow.append(dayCell);
    },
    () => {
      dateRow.append(gapCell('th'));
      dayRow.append(gapCell('th'));
    },
  );
}

function describeGames(games: number): string {
  if (games === 0) return 'no games yet';
  return games === 1 ? '1 game' : `${games} games`;
}

/**
 * Walks the columns week by week, calling `onGap` between weeks so every row
 * gets the same spacer cells and the columns stay aligned.
 */
function forEachColumn(
  view: SheetView,
  onDate: (date: string) => void,
  onGap: () => void,
): void {
  for (const [index, week] of view.weeks.entries()) {
    if (index > 0) onGap();
    for (const date of week) onDate(date);
  }
}

function gapCell(tag: 'td' | 'th'): HTMLTableCellElement {
  const cell = el(tag, { className: 'week-gap' });
  cell.setAttribute('aria-hidden', 'true');
  return cell;
}
