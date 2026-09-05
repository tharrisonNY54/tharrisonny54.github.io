import '../styles/tennis.css';

import { getStore, isDemoMode } from '../data/index.js';
import { DEMO_ADMIN_PASSWORD, DEMO_SHEET_ID } from '../data/seed.js';
import {
  forgetLogin,
  readRememberedLogin,
  readSession,
  rememberLogin,
  startSession,
} from '../lib/session.js';
import { describeError, hideNotice, need, showNotice } from '../ui/dom.js';

const store = getStore();

const form = need<HTMLFormElement>('#login-form');
const sheetInput = need<HTMLInputElement>('#sheet-id');
const passwordInput = need<HTMLInputElement>('#password');
const rememberInput = need<HTMLInputElement>('#remember');
const loginButton = need<HTMLButtonElement>('#login-button');
const errorNotice = need<HTMLParagraphElement>('#login-error');

initialise();

function initialise(): void {
  // Already signed in for this browser session: go straight to the sheet.
  if (readSession()) {
    window.location.replace('./sheet.html');
    return;
  }

  const remembered = readRememberedLogin();
  if (remembered) {
    sheetInput.value = remembered.sheetId;
    passwordInput.value = remembered.password;
    rememberInput.checked = true;
  } else if (isDemoMode()) {
    sheetInput.value = DEMO_SHEET_ID;
  }

  if (isDemoMode()) {
    const hint = need<HTMLParagraphElement>('#demo-hint');
    hint.textContent = `Demo sheet — Sign Up Sheet ID "${DEMO_SHEET_ID}", password ${DEMO_ADMIN_PASSWORD} signs you in as Darel Harrison (administrator).`;
    hint.hidden = false;
  }

  form.addEventListener('submit', onLogin);
}

async function onLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  hideNotice(errorNotice);

  const sheetId = sheetInput.value.trim();
  const password = passwordInput.value.trim();

  if (!sheetId || !password) {
    showNotice(errorNotice, 'Please enter both the Sign Up Sheet ID and your password.', 'error');
    return;
  }

  loginButton.disabled = true;
  try {
    const member = await store.authenticate(sheetId, password);
    if (!member) {
      showNotice(
        errorNotice,
        'That Sign Up Sheet ID and password did not match. Please check them and try again.',
        'error',
      );
      return;
    }

    if (rememberInput.checked) rememberLogin(sheetId, password);
    else forgetLogin();

    startSession(sheetId, member.id);
    window.location.assign('./sheet.html');
  } catch (error) {
    showNotice(errorNotice, describeError(error), 'error');
  } finally {
    loginButton.disabled = false;
  }
}
