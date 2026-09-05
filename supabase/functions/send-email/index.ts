/**
 * Supabase Edge Function: send-email
 *
 * The browser never holds a mail-provider key, so all outbound mail goes
 * through here. Deploy with:
 *
 *   supabase functions deploy send-email
 *   supabase secrets set RESEND_API_KEY=...  MAIL_FROM="MWF Group <sheet@yourdomain.com>"
 *
 * The caller is authenticated by the same `x-sheet-token` the rest of the app
 * uses, so a stranger with the public anon key cannot send mail to the group.
 */

// @ts-nocheck -- Deno runtime; not part of the site's TypeScript build.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_RECIPIENTS = 200;

/**
 * The sheet is served from GitHub Pages and this function from supabase.co, so
 * every call is cross-origin and the browser sends an OPTIONS preflight first.
 * Edge Functions do not answer that for you the way the REST gateway does.
 */
const ALLOWED_ORIGINS = [
  'https://tharrisonny54.github.io',
  'http://localhost:5173',
];

function corsHeaders(request) {
  const origin = request.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-sheet-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
);

Deno.serve(async (request) => {
  const cors = corsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors);
  }

  const token = request.headers.get('x-sheet-token');
  if (!token) return json({ error: 'Not signed in' }, 401, cors);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Bad request body' }, 400, cors);
  }

  const { sheetId, kind, to, subject, body } = payload ?? {};
  if (!sheetId || !subject || !body || !Array.isArray(to)) {
    return json({ error: 'Missing sheetId, to, subject or body' }, 400, cors);
  }

  // Verify the session belongs to this sheet and is still current.
  const { data: session } = await admin
    .from('sessions')
    .select('member_id, sheet_id, expires_at')
    .eq('token', token)
    .eq('sheet_id', sheetId)
    .maybeSingle();

  if (!session || new Date(session.expires_at) < new Date()) {
    return json({ error: 'Session expired' }, 401, cors);
  }

  // Announcements go to the whole group, so only administrators may send them.
  if (kind === 'announcement' || kind === 'welcome') {
    const { data: sender } = await admin
      .from('members')
      .select('is_admin')
      .eq('id', session.member_id)
      .maybeSingle();

    if (!sender?.is_admin) return json({ error: 'Administrators only' }, 403, cors);
  }

  // Only ever mail addresses that are actually on this sheet.
  const { data: members } = await admin
    .from('members')
    .select('email')
    .eq('sheet_id', sheetId);

  const allowed = new Set((members ?? []).map((m) => m.email.toLowerCase()).filter(Boolean));
  const recipients = to
    .filter((address) => typeof address === 'string' && allowed.has(address.toLowerCase()))
    .slice(0, MAX_RECIPIENTS);

  if (recipients.length === 0) return json({ error: 'No valid recipients' }, 400, cors);

  // One message per recipient, so nobody receives a copy of the group's
  // address book in the To header.
  const results = await Promise.all(
    recipients.map((address) =>
      fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('MAIL_FROM'),
          to: [address],
          subject,
          text: body,
        }),
      }).then((response) => response.ok),
    ),
  );

  const sent = results.filter(Boolean).length;
  if (sent === 0) return json({ error: 'Mail provider rejected the message' }, 502, cors);

  return json({ sent, failed: recipients.length - sent }, 200, cors);
});

function json(payload, status = 200, cors = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
