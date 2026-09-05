# Tennis group sign up sheet

A rebuild of the group's 2007 sign-up sheet, served at
`https://tharrisonny54.github.io/tennis/`.

The layout, colour coding and vocabulary are deliberately unchanged — members
read this page by position and colour, so moving things around would cost more
than it gained. What is new is the typography, contrast, focus states, sticky
headers, and the fact that the page tells a waiting member by email when a spot
opens instead of asking them to keep checking.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Sign Up Sheet ID + User Password login |
| `sheet.html` | The grid, the edit row, and the draw |
| `contact.html` | Roster with phone/email and the group email buttons |
| `help.html` | Plain-language instructions for members |
| `maint.html` | Announcement, member list, and settings (administrators only) |

Logic lives in `../src/tennis/`; there is no framework, just TypeScript modules
bundled by the site's existing Vite build.

## How the draw works

From the original Help text: a member is `A` (available) when they have signed
up "but there are not enough members to make a game". Two rules follow, and
`src/tennis/lib/draw.ts` implements exactly them:

1. **Promotion happens in complete foursomes.** Five available means four green
   and one yellow — never five green. So the number playing is always a
   multiple of `playersPerGame`, and the number beside the day code in the
   column header is `playing / playersPerGame`.
2. **Order is regulars first, then first-come first-served.** Whoever signed up
   last is the first to lose a spot when somebody drops out. Inside the
   "Days Subs Protected" window, class is ignored so a substitute who committed
   early cannot be bumped at the last minute.

`npm test` covers these rules directly.

## Running it

```bash
npm run dev      # http://localhost:5173/tennis/
npm test         # draw, date and sheet logic
npm run build    # production build into dist/
```

## Demo mode vs live

`public/tennis/config.js` decides which one runs. It is served as a plain file
and is **not** part of the build, so it can be edited on the live site without
recompiling.

- **Both values blank → demo mode.** The whole sheet lives in whoever's browser
  is looking at it, seeded with the real roster names and invented contact
  details. Nothing is shared between people and no email is delivered — the
  maintenance page shows a mail log of what *would* have been sent. This is the
  mode to show the group.
- **Both values filled in → live.** The site reads and writes Supabase.

## Going live on Supabase

1. Create a project in your Supabase org and wait for it to finish provisioning.
2. Open the SQL editor and run `supabase/schema.sql` from the repo root. It
   creates the tables, turns on row level security, and inserts the `Doubles40`
   sheet with one administrator and the two guest rows.
3. **Change the placeholder administrator login.** The seed inserts
   `CHANGE-ME-0000` as the password for the first admin. Set it to your dad's
   phone number before anyone else has the URL.
4. Copy the project URL and the anon key from *Project Settings → API* into
   `public/tennis/config.js`.
5. For email, deploy the edge function and give it a mail provider key:

   ```bash
   supabase functions deploy send-email
   supabase secrets set RESEND_API_KEY=... MAIL_FROM="MWF Group <sheet@yourdomain>"
   ```

   Until that is deployed, everything except outgoing email works; email calls
   fail and are reported, never silently swallowed.
6. Sign in as the administrator and build the roster from the maintenance page,
   using **Send Welcome** to give each member their details.

### What the security model does and does not do

The anon key is public, so nothing is protected by "only our site calls this".
Instead `tennis_login()` checks the sheet ID and password and returns a random
session token; the browser sends it as an `x-sheet-token` header, and every row
level security policy checks it. Members can only write their own sign-ups.
Only administrators can change members or settings.

The one real weakness is inherited from the original design: **passwords are
stored in the clear**, because the site emails a member their password and
shows it on the maintenance page. Any signed-in member can therefore read
another member's password, and the password is a phone number. That is
acceptable for a sheet that holds nothing but tennis availability. If it ever
holds anything more, move to Supabase Auth magic links.
