import '../styles/tennis.css';

import { getStore } from '../data/index.js';
import { dayName, monthDay } from '../lib/dates.js';
import { mailtoLink } from '../lib/mail.js';
import { buildSheetView, type SheetView } from '../lib/sheet.js';
import { requireSession } from '../lib/session.js';
import type { Member, Sheet } from '../types.js';
import { fullName } from '../types.js';
import { describeError, el, need, showNotice } from '../ui/dom.js';

const store = getStore();

const titleHeading = need<HTMLHeadingElement>('#group-title');
const tableBody = need<HTMLTableSectionElement>('#contact-body');
const notice = need<HTMLParagraphElement>('#contact-notice');
const nextDayNote = need<HTMLParagraphElement>('#next-day-note');

const session = requireSession();

let sheet!: Sheet;
let view!: SheetView;

if (session) void start();

async function start(): Promise<void> {
  try {
    sheet = await store.load(session!.sheetId);
    view = buildSheetView(sheet);
    titleHeading.textContent = sheet.settings.title;
    renderRoster();
    wireEmailButtons();
  } catch (error) {
    showNotice(notice, describeError(error), 'error');
  }
}

function renderRoster(): void {
  tableBody.replaceChildren();

  for (const member of contactableMembers()) {
    const row = el('tr', { attrs: { role: 'row' } });

    const selectCell = cell('Select');
    const checkbox = el('input', {
      attrs: { type: 'checkbox', 'aria-label': `Select ${fullName(member)}` },
      dataset: { memberId: member.id },
    });
    checkbox.disabled = !member.email;
    selectCell.append(checkbox);

    row.append(
      selectCell,
      cell('Row', String(member.seat)),
      nameCell(member),
      cell('Phone', member.phone || '—'),
      cell('Mobile', member.mobile || '—'),
      emailCell(member),
    );

    tableBody.append(row);
  }

  const nextDate = view.dates[0];
  nextDayNote.textContent = nextDate
    ? `"Playing" and "Available" refer to the next day of play, ${dayName(nextDate)} ${monthDay(nextDate)}.`
    : 'No upcoming days of play are scheduled.';
}

/** The guest rows are placeholders, not people with contact details. */
function contactableMembers(): Member[] {
  return sheet.members.filter((member) => !member.isGuestSlot);
}

/**
 * `data-label` is what the narrow-screen stylesheet prints in front of the
 * value once the six columns stack into one block per member; the explicit
 * role keeps the cell in the accessibility tree when the table stops being
 * laid out as a table.
 */
function cell(label?: string, text?: string): HTMLTableCellElement {
  const node = el('td', { text, attrs: { role: 'cell' } });
  if (label) node.dataset.label = label;
  return node;
}

function nameCell(member: Member): HTMLTableCellElement {
  const node = cell('Member', fullName(member));
  node.style.fontWeight = '600';
  node.style.color = member.isAdmin
    ? 'var(--name-admin)'
    : member.type === 'substitute'
      ? 'var(--name-substitute)'
      : 'var(--name-regular)';
  return node;
}

function emailCell(member: Member): HTMLTableCellElement {
  const node = cell('Email');
  if (!member.email) {
    node.textContent = '—';
    return node;
  }

  node.append(
    el('a', {
      text: member.email,
      attrs: { href: mailtoLink([member.email], `${sheet.settings.title}`) },
    }),
  );
  return node;
}

function wireEmailButtons(): void {
  need<HTMLButtonElement>('#email-all').addEventListener('click', () => {
    compose(contactableMembers(), 'all members');
  });

  need<HTMLButtonElement>('#email-selected').addEventListener('click', () => {
    compose(selectedMembers(), 'the members you selected');
  });

  need<HTMLButtonElement>('#email-playing').addEventListener('click', () => {
    compose(membersWithStatus('P'), 'everyone playing');
  });

  need<HTMLButtonElement>('#email-available').addEventListener('click', () => {
    compose(membersWithStatus('A'), 'the available members');
  });
}

function selectedMembers(): Member[] {
  const checked = new Set(
    [...tableBody.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map(
      (input) => input.dataset.memberId,
    ),
  );
  return contactableMembers().filter((member) => checked.has(member.id));
}

function membersWithStatus(status: 'P' | 'A'): Member[] {
  const nextDate = view.dates[0];
  const day = nextDate ? view.days.get(nextDate) : undefined;
  if (!day) return [];
  return contactableMembers().filter((member) => day.statuses.get(member.id) === status);
}

/**
 * Opens the member's own mail program with the group in BCC, which is how the
 * original site worked and keeps everyone's address off the To line.
 */
function compose(members: readonly Member[], description: string): void {
  const addresses = members.map((member) => member.email).filter(Boolean);

  if (addresses.length === 0) {
    showNotice(notice, `There is nobody to email for ${description} right now.`, 'error');
    return;
  }

  showNotice(
    notice,
    `Opening your email program with ${addresses.length} recipient${addresses.length === 1 ? '' : 's'} in BCC.`,
    'success',
  );
  window.location.href = mailtoLink(addresses, sheet.settings.title);
}
