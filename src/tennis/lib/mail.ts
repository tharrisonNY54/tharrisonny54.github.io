/**
 * Email composition.
 *
 * Two different mechanisms, on purpose:
 *
 *   - `mailto:` links for the Contact Information buttons. That reproduces the
 *     original behaviour ("compose an email message and send it to that
 *     member"), uses the sender's own mail program, and needs no server.
 *   - `store.sendEmail` for welcome, reset, promotion and announcement mail,
 *     which has to go out without a human sitting in front of the screen.
 */

import type { Member, Settings } from '../types.js';
import { dayName, monthDay } from './dates.js';
import type { EmailMessage } from '../data/store.js';

/** Recipients go in BCC so the group's addresses are not broadcast. */
export function mailtoLink(addresses: readonly string[], subject: string): string {
  const usable = addresses.filter(Boolean);
  if (usable.length === 0) return '';

  if (usable.length === 1) {
    return `mailto:${encodeURIComponent(usable[0])}?subject=${encodeURIComponent(subject)}`;
  }
  return `mailto:?bcc=${encodeURIComponent(usable.join(','))}&subject=${encodeURIComponent(subject)}`;
}

export function siteUrl(): string {
  return new URL('./index.html', window.location.href).href;
}

export function welcomeEmail(member: Member, settings: Settings, sheetId: string): EmailMessage {
  return {
    kind: 'welcome',
    to: [member.email],
    subject: `Welcome to ${settings.title}`,
    body: [
      `Hello ${member.firstName || member.lastName},`,
      '',
      `You have been added to the ${settings.title} sign up sheet.`,
      '',
      `Web site:        ${siteUrl()}`,
      `Sign Up Sheet ID: ${sheetId}`,
      `User Password:    ${member.loginId}`,
      '',
      'Sign in and use the row at the bottom of the page to set your',
      'availability for each day:',
      '',
      '  A - Available. You want to play.',
      '  N - Not available. You cannot play that day.',
      '  Open - You have not decided yet.',
      '',
      'When enough members are Available to fill a game, the sheet turns',
      'those A marks into green P marks and you are playing.',
      '',
      'There is a Help button on the sheet if you get stuck.',
    ].join('\n'),
  };
}

export function promotionEmail(
  member: Member,
  date: string,
  settings: Settings,
): EmailMessage {
  return {
    kind: 'promoted',
    to: [member.email],
    subject: `You are playing ${dayName(date)} ${monthDay(date)}`,
    body: [
      `Hello ${member.firstName || member.lastName},`,
      '',
      `A spot opened up and you are now playing on ${dayName(date)}, ${monthDay(date)}.`,
      `Your status on the ${settings.title} sheet changed from A (available)`,
      'to P (playing).',
      '',
      `Sheet: ${siteUrl()}`,
      '',
      'If you can no longer make it, please change your status to N so',
      'somebody else can take the spot.',
    ].join('\n'),
  };
}

export function announcementEmail(
  recipients: readonly Member[],
  settings: Settings,
  text: string,
): EmailMessage {
  return {
    kind: 'announcement',
    to: recipients.map((member) => member.email).filter(Boolean),
    subject: `${settings.title} announcement`,
    body: [text, '', `Sheet: ${siteUrl()}`].join('\n'),
  };
}
