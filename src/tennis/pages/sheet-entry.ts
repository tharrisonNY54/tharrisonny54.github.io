import '../styles/tennis.css';

import { getStore, type PreferenceChange } from '../data/index.js';
import { promotionEmail } from '../lib/mail.js';
import { findPromotions } from '../lib/promotions.js';
import { buildSheetView, indexSignups, preferenceFor, type SheetView } from '../lib/sheet.js';
import { endSession, forgetLogin, readSession, requireSession, setEditingMember } from '../lib/session.js';
import type { Member, Preference, Sheet } from '../types.js';
import { fullName } from '../types.js';
import { describeError, el, hideNotice, need, showNotice } from '../ui/dom.js';
import { renderBody, renderFoot, renderHead } from '../ui/grid.js';

const store = getStore();

const titleHeading = need<HTMLHeadingElement>('#group-title');
const announcement = need<HTMLParagraphElement>('#announcement');
const notice = need<HTMLParagraphElement>('#sheet-notice');
const head = need<HTMLTableSectionElement>('#sheet-head');
const body = need<HTMLTableSectionElement>('#sheet-body');
const foot = need<HTMLTableSectionElement>('#sheet-foot');
const submitButton = need<HTMLButtonElement>('#submit-changes');
const resetButton = need<HTMLButtonElement>('#reset-changes');
const logoutButton = need<HTMLButtonElement>('#logout');
const maintLink = need<HTMLAnchorElement>('#maint-link');
const signedInAs = need<HTMLElement>('#signed-in-as');
const storeLabel = need<HTMLElement>('#store-label');

const session = requireSession();

let sheet!: Sheet;
let view!: SheetView;
let signedInMember!: Member;
let editingMemberId!: string;
/** Dropdown values that have not been submitted yet. */
let pending = new Map<string, Preference>();

if (session) void start();

async function start(): Promise<void> {
  storeLabel.textContent = store.label;
  submitButton.addEventListener('click', onSubmit);
  resetButton.addEventListener('click', onReset);
  logoutButton.addEventListener('click', onLogout);

  try {
    await reload();
  } catch (error) {
    showNotice(notice, describeError(error), 'error');
  }
}

async function reload(): Promise<void> {
  const active = readSession();
  if (!active) return;

  sheet = await store.load(active.sheetId);
  const member = sheet.members.find((candidate) => candidate.id === active.memberId);
  if (!member) {
    // The member was removed while signed in.
    onLogout();
    return;
  }

  signedInMember = member;
  editingMemberId = resolveEditingMember(active.editingMemberId);
  view = buildSheetView(sheet);
  pending = readPreferences(editingMemberId);
  render();
}

function resolveEditingMember(requested: string): string {
  if (!signedInMember.isAdmin) return signedInMember.id;
  return sheet.members.some((member) => member.id === requested) ? requested : signedInMember.id;
}

function readPreferences(memberId: string): Map<string, Preference> {
  const index = indexSignups(sheet.signups);
  return new Map(view.dates.map((date) => [date, preferenceFor(index, memberId, date)]));
}

function render(): void {
  titleHeading.textContent = sheet.settings.title;

  announcement.textContent = sheet.settings.announcement;
  announcement.dataset.blink = String(sheet.settings.announcementBlink && Boolean(sheet.settings.announcement));

  signedInAs.textContent = fullName(signedInMember);
  maintLink.hidden = !signedInMember.isAdmin;

  const editingMember =
    sheet.members.find((member) => member.id === editingMemberId) ?? signedInMember;

  renderHead(head, view);
  renderBody(body, sheet, view, {
    editingMemberId,
    canEditOthers: signedInMember.isAdmin,
    onSelectMember,
  });
  renderFoot(foot, view, contactButton(), {
    member: editingMember,
    pending,
    saved: readPreferences(editingMemberId),
    onChange: (date, preference) => pending.set(date, preference),
  });
}

function contactButton(): HTMLElement {
  return el('a', {
    className: 'button',
    text: 'Contact Information',
    attrs: { href: './contact.html' },
  });
}

function onSelectMember(memberId: string): void {
  if (hasUnsavedChanges()) {
    const confirmed = window.confirm(
      'You have changes that have not been submitted. Switching members will discard them.',
    );
    if (!confirmed) return;
  }

  editingMemberId = memberId;
  setEditingMember(memberId);
  pending = readPreferences(memberId);
  hideNotice(notice);
  render();
}

function hasUnsavedChanges(): boolean {
  return collectChanges().length > 0;
}

function collectChanges(): PreferenceChange[] {
  const saved = readPreferences(editingMemberId);
  const changes: PreferenceChange[] = [];

  for (const [date, preference] of pending) {
    if (preference === saved.get(date)) continue;
    if (view.days.get(date)?.locked) continue;
    changes.push({ memberId: editingMemberId, date, preference });
  }

  return changes;
}

async function onSubmit(): Promise<void> {
  hideNotice(notice);
  const changes = collectChanges();

  if (changes.length === 0) {
    showNotice(notice, 'Nothing has changed yet.', 'info');
    return;
  }

  submitButton.disabled = true;
  try {
    const before = view;
    const active = readSession();
    if (!active) return;

    sheet = await store.applyPreferences(active.sheetId, changes);
    view = buildSheetView(sheet);
    pending = readPreferences(editingMemberId);
    render();

    const promoted = await notifyPromotions(active.sheetId, before, view);
    showNotice(notice, summarise(changes.length, promoted), 'success');
  } catch (error) {
    showNotice(notice, describeError(error), 'error');
  } finally {
    submitButton.disabled = false;
  }
}

function summarise(changeCount: number, promoted: number): string {
  const changeText = changeCount === 1 ? '1 day updated' : `${changeCount} days updated`;
  if (promoted === 0) return `${changeText}. The draw has been recalculated.`;
  const who = promoted === 1 ? '1 member was' : `${promoted} members were`;
  return `${changeText}. ${who} moved up to playing and notified by email.`;
}

/**
 * Anyone whose A turned into a P because of this submission gets told, so they
 * do not have to keep checking the sheet to find out they are in a game.
 */
async function notifyPromotions(
  sheetId: string,
  before: SheetView,
  after: SheetView,
): Promise<number> {
  const promotions = findPromotions(before, after);
  let sent = 0;

  for (const promotion of promotions) {
    const member = sheet.members.find((candidate) => candidate.id === promotion.memberId);
    if (!member?.email) continue;

    try {
      await store.sendEmail(sheetId, promotionEmail(member, promotion.date, sheet.settings));
      sent += 1;
    } catch {
      // A mail failure must not roll back a sign-up that already saved; the
      // sheet itself is still correct and visible to everyone.
    }
  }

  return sent;
}

function onReset(): void {
  pending = readPreferences(editingMemberId);
  hideNotice(notice);
  render();
  showNotice(notice, 'Your unsubmitted changes were undone.', 'info');
}

function onLogout(): void {
  endSession();
  forgetLogin();
  window.location.assign('./index.html');
}
