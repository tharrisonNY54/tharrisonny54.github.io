/** Reading, writing and validating the member detail form on the maintenance page. */

import type { Member, MemberType } from '../types.js';
import { need } from './dom.js';

export interface MemberDraft {
  firstName: string;
  lastName: string;
  loginId: string;
  email: string;
  phone: string;
  mobile: string;
  type: MemberType;
  isAdmin: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function readMemberForm(): MemberDraft {
  return {
    firstName: value('#first-name'),
    lastName: value('#last-name'),
    loginId: value('#login-id'),
    email: value('#member-email'),
    phone: value('#member-phone'),
    mobile: value('#member-mobile'),
    type: checked('input[name="memberType"][value="substitute"]') ? 'substitute' : 'regular',
    isAdmin: checked('#member-admin'),
  };
}

export function writeMemberForm(member: Member): void {
  setValue('#first-name', member.firstName);
  setValue('#last-name', member.lastName);
  setValue('#login-id', member.loginId);
  setValue('#member-email', member.email);
  setValue('#member-phone', member.phone);
  setValue('#member-mobile', member.mobile);
  need<HTMLInputElement>(`input[name="memberType"][value="${member.type}"]`).checked = true;
  need<HTMLInputElement>('#member-admin').checked = member.isAdmin;
}

export function clearMemberForm(): void {
  for (const selector of [
    '#first-name',
    '#last-name',
    '#login-id',
    '#member-email',
    '#member-phone',
    '#member-mobile',
  ]) {
    setValue(selector, '');
  }
  need<HTMLInputElement>('input[name="memberType"][value="regular"]').checked = true;
  need<HTMLInputElement>('#member-admin').checked = false;
}

/**
 * Returns the first problem with the draft, or null when it is usable.
 * The login ID is the member's password, so it has to be present and long
 * enough to not be guessable by trying a handful of numbers.
 */
export function validateMemberDraft(draft: MemberDraft): string | null {
  if (!draft.lastName.trim()) return 'Please enter a last name.';
  if (!draft.loginId.trim()) return 'Please enter a Login ID — it is the member’s password.';
  if (draft.loginId.trim().length < 6) {
    return 'The Login ID needs to be at least 6 characters, since it is used as the password.';
  }
  if (draft.email && !EMAIL_PATTERN.test(draft.email)) {
    return 'That email address does not look right.';
  }
  return null;
}

function value(selector: string): string {
  return need<HTMLInputElement>(selector).value.trim();
}

function setValue(selector: string, next: string): void {
  need<HTMLInputElement>(selector).value = next;
}

function checked(selector: string): boolean {
  return need<HTMLInputElement>(selector).checked;
}
