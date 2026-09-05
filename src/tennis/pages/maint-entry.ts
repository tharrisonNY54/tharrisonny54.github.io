import '../styles/tennis.css';

import { getStore, isDemoMode } from '../data/index.js';
import { readOutbox } from '../data/local-store.js';
import { announcementEmail, welcomeEmail } from '../lib/mail.js';
import { requireSession } from '../lib/session.js';
import type { Member, Settings, Sheet } from '../types.js';
import { fullName } from '../types.js';
import { describeError, el, need, showNotice } from '../ui/dom.js';
import {
  clearMemberForm,
  readMemberForm,
  validateMemberDraft,
  writeMemberForm,
} from '../ui/member-form.js';

const store = getStore();

const notice = need<HTMLParagraphElement>('#maint-notice');
const picker = need<HTMLSelectElement>('#member-picker');
const session = requireSession();

let sheet!: Sheet;
/** The member the detail form is currently editing; null means "new member". */
let editingId: string | null = null;

if (session) void start();

async function start(): Promise<void> {
  need<HTMLElement>('#store-label').textContent = store.label;

  try {
    sheet = await store.load(session!.sheetId);
  } catch (error) {
    showNotice(notice, describeError(error), 'error');
    return;
  }

  const signedIn = sheet.members.find((member) => member.id === session!.memberId);
  if (!signedIn?.isAdmin) {
    // Administrators only. Anyone else goes straight back to the sheet.
    window.location.replace('./sheet.html');
    return;
  }

  need<HTMLElement>('#signed-in-as').textContent = fullName(signedIn);
  wire();
  refresh();
}

function wire(): void {
  need<HTMLFormElement>('#announcement-form').addEventListener('submit', onSaveAnnouncement);
  need<HTMLButtonElement>('#email-announcement').addEventListener('click', onEmailAnnouncement);

  need<HTMLButtonElement>('#member-edit').addEventListener('click', onEditMember);
  need<HTMLButtonElement>('#member-delete').addEventListener('click', onDeleteMember);
  need<HTMLButtonElement>('#member-welcome').addEventListener('click', onSendWelcome);
  need<HTMLButtonElement>('#member-add').addEventListener('click', onAddMember);
  need<HTMLButtonElement>('#member-reset').addEventListener('click', onResetForm);
  need<HTMLFormElement>('#member-form').addEventListener('submit', onSubmitMember);

  need<HTMLFormElement>('#settings-form').addEventListener('submit', onSaveSettings);

  if (isDemoMode()) {
    need<HTMLElement>('#outbox-section').hidden = false;
    need<HTMLButtonElement>('#reset-demo').addEventListener('click', onResetDemo);
  }
}

function refresh(): void {
  need<HTMLHeadingElement>('#group-title').textContent = sheet.settings.title;
  need<HTMLInputElement>('#announcement-text').value = sheet.settings.announcement;
  need<HTMLInputElement>('#announcement-blink').checked = sheet.settings.announcementBlink;

  renderPicker();
  renderSettings();
  renderOutbox();
}

function renderPicker(): void {
  const previous = picker.value;
  picker.replaceChildren(el('option', { text: 'Select a Member', attrs: { value: '' } }));

  for (const member of sheet.members) {
    if (member.isGuestSlot) continue;
    picker.append(el('option', { text: fullName(member), attrs: { value: member.id } }));
  }

  picker.value = sheet.members.some((member) => member.id === previous) ? previous : '';
}

function renderSettings(): void {
  const { settings } = sheet;
  setNumber('#setting-days', settings.daysDisplayed);
  setNumber('#setting-players', settings.playersPerGame);
  setNumber('#setting-games', settings.maxGames);
  setNumber('#setting-max-players', settings.maxPlayers);
  setNumber('#setting-subs', settings.daysSubsProtected);
  setNumber('#setting-no-changes', settings.daysNoChanges);
  need<HTMLInputElement>('#setting-title').value = settings.title;
  need<HTMLInputElement>(
    `input[name="guestPriority"][value="${settings.guestPriority}"]`,
  ).checked = true;
}

function renderOutbox(): void {
  if (!isDemoMode()) return;

  const body = need<HTMLTableSectionElement>('#outbox-body');
  const entries = readOutbox(sheet.id);
  body.replaceChildren();

  if (entries.length === 0) {
    const row = el('tr');
    const cell = el('td', { text: 'No messages yet.' });
    cell.colSpan = 3;
    row.append(cell);
    body.append(row);
    return;
  }

  for (const entry of entries) {
    const row = el('tr');
    row.append(
      el('td', { text: new Date(entry.sentAt).toLocaleString() }),
      el('td', { text: entry.to.join(', ') || '—' }),
      el('td', { text: entry.subject }),
    );
    body.append(row);
  }
}

/* --------------------------------------------------------- announcement */

async function onSaveAnnouncement(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  await save(() =>
    store.saveSettings(sheet.id, {
      ...sheet.settings,
      announcement: need<HTMLInputElement>('#announcement-text').value.trim(),
      announcementBlink: need<HTMLInputElement>('#announcement-blink').checked,
    }),
  'The announcement has been changed.');
}

async function onEmailAnnouncement(): Promise<void> {
  const text = need<HTMLInputElement>('#announcement-text').value.trim();
  if (!text) {
    showNotice(notice, 'Type an announcement before emailing it.', 'error');
    return;
  }

  const recipients = sheet.members.filter((member) => !member.isGuestSlot && member.email);
  if (recipients.length === 0) {
    showNotice(notice, 'No members have an email address on file.', 'error');
    return;
  }

  if (!window.confirm(`Email this announcement to ${recipients.length} members?`)) return;

  try {
    await store.sendEmail(sheet.id, announcementEmail(recipients, sheet.settings, text));
    renderOutbox();
    showNotice(notice, `The announcement was sent to ${recipients.length} members.`, 'success');
  } catch (error) {
    showNotice(notice, describeError(error), 'error');
  }
}

/* ------------------------------------------------------------- members */

function selectedMember(): Member | null {
  return sheet.members.find((member) => member.id === picker.value) ?? null;
}

function onEditMember(): void {
  const member = selectedMember();
  if (!member) {
    showNotice(notice, 'Choose a member from the list first.', 'error');
    return;
  }

  editingId = member.id;
  writeMemberForm(member);
  showNotice(notice, `Editing ${fullName(member)}. Change the fields, then Submit Changes.`, 'info');
}

function onAddMember(): void {
  editingId = null;
  picker.value = '';
  clearMemberForm();
  showNotice(notice, 'Fill in the new member’s details, then Submit Changes.', 'info');
}

function onResetForm(): void {
  const member = selectedMember();
  if (member) writeMemberForm(member);
  else clearMemberForm();
  showNotice(notice, 'The form was reset.', 'info');
}

async function onSubmitMember(event: SubmitEvent): Promise<void> {
  event.preventDefault();

  const draft = readMemberForm();
  const problem = validateMemberDraft(draft);
  if (problem) {
    showNotice(notice, problem, 'error');
    return;
  }

  const existing = editingId
    ? sheet.members.find((member) => member.id === editingId)
    : undefined;

  const member: Member = {
    ...(existing ?? {
      id: `m${Date.now().toString(36)}`,
      seat: sheet.members.length + 1,
      isGuestSlot: false,
    }),
    ...draft,
  } as Member;

  await save(() => store.saveMember(sheet.id, member), `${fullName(member)} has been saved.`);
  editingId = member.id;
  picker.value = member.id;
}

async function onDeleteMember(): Promise<void> {
  const member = selectedMember();
  if (!member) {
    showNotice(notice, 'Choose a member from the list first.', 'error');
    return;
  }

  const confirmed = window.confirm(
    `Delete ${fullName(member)}? Their sign ups will be removed from every day on the sheet.`,
  );
  if (!confirmed) return;

  await save(() => store.removeMember(sheet.id, member.id), `${fullName(member)} has been deleted.`);
  editingId = null;
  clearMemberForm();
}

async function onSendWelcome(): Promise<void> {
  const member = selectedMember();
  if (!member) {
    showNotice(notice, 'Choose a member from the list first.', 'error');
    return;
  }
  if (!member.email) {
    showNotice(notice, `${fullName(member)} has no email address on file.`, 'error');
    return;
  }

  try {
    await store.sendEmail(sheet.id, welcomeEmail(member, sheet.settings, sheet.id));
    renderOutbox();
    showNotice(notice, `A welcome message was sent to ${member.email}.`, 'success');
  } catch (error) {
    showNotice(notice, describeError(error), 'error');
  }
}

/* ------------------------------------------------------------ settings */

async function onSaveSettings(event: SubmitEvent): Promise<void> {
  event.preventDefault();

  const next: Settings = {
    ...sheet.settings,
    title: need<HTMLInputElement>('#setting-title').value.trim() || sheet.settings.title,
    daysDisplayed: number('#setting-days', sheet.settings.daysDisplayed),
    playersPerGame: number('#setting-players', sheet.settings.playersPerGame),
    maxGames: number('#setting-games', sheet.settings.maxGames),
    maxPlayers: number('#setting-max-players', sheet.settings.maxPlayers),
    daysSubsProtected: number('#setting-subs', sheet.settings.daysSubsProtected),
    daysNoChanges: number('#setting-no-changes', sheet.settings.daysNoChanges),
    guestPriority: need<HTMLInputElement>('input[name="guestPriority"]:checked').value as Settings['guestPriority'],
  };

  if (next.playersPerGame < 2 || next.maxGames < 1) {
    showNotice(notice, 'Players per Game must be at least 2 and Max Games at least 1.', 'error');
    return;
  }
  if (next.maxPlayers < sheet.members.length) {
    showNotice(
      notice,
      `Max Players cannot be below the ${sheet.members.length} members already on the sheet.`,
      'error',
    );
    return;
  }

  await save(() => store.saveSettings(sheet.id, next), 'The website settings have been saved.');
}

/* --------------------------------------------------------------- demo */

async function onResetDemo(): Promise<void> {
  if (!store.resetDemoData) return;
  if (!window.confirm('Restore the original demo roster and sign ups?')) return;
  await save(() => store.resetDemoData!(sheet.id), 'The demo data has been restored.');
}

/* -------------------------------------------------------------- shared */

async function save(action: () => Promise<Sheet>, successMessage: string): Promise<void> {
  try {
    sheet = await action();
    refresh();
    showNotice(notice, successMessage, 'success');
  } catch (error) {
    showNotice(notice, describeError(error), 'error');
  }
}

function number(selector: string, fallback: number): number {
  const parsed = Number.parseInt(need<HTMLInputElement>(selector).value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function setNumber(selector: string, value: number): void {
  need<HTMLInputElement>(selector).value = String(value);
}
