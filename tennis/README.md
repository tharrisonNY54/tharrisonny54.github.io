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

- **`url` and `anonKey` blank → demo mode.** The whole sheet lives in whoever's
  browser is looking at it. Everybody on the demo roster is **invented** — the
  file is compiled into the public bundle, so it deliberately contains no real
  person's name, phone number or address. It keeps the real sheet's *shape*
  (32 members plus two guest rows, 13 substitutes, 3 administrators) so the
  draw behaves the way the group will see.
- **Both filled in → live.** The site reads and writes Supabase.

## Where the real roster lives

The published site is public and so is this repository, so the 32 members'
phone numbers and email addresses are **only ever in the Supabase `members`
table**, behind the login. They are not in this repo, not in `dist/`, and not
in the JavaScript bundle. Making the repo private would not change that —
GitHub Pages serves the built site publicly either way.

Load them from a seed kept outside the repository (see "Going live" step 3),
and delete that file once it has run.

## Outbound email is off by default

`emailEnabled` in `config.js` must read exactly `true` before a single message
is delivered. This is not paranoia about a button: **promotion notices are sent
automatically whenever the draw changes**, so a sheet pointed at a real roster
with mail switched on can email 32 people without anyone asking it to.

While it is off:

- every message the site composes is recorded and listed under **Mail Log** on
  the Website Maintenance page,
- nothing reaches a mail provider,
- the footer of every page reads `Live · email off`,
- the sheet stops claiming that promoted members "were notified by email".

## Going live on Supabase

1. Create a project and wait for it to finish provisioning.
2. Open the SQL editor and run `supabase/schema.sql`. It creates the tables,
   turns on row level security, and inserts the `Doubles40` sheet with a
   placeholder administrator (`CHANGE-ME-0000`) and the two guest rows.
3. Run the roster seed kept outside the repo. It upserts the 32 real members,
   sets each one's password to their own phone number with the formatting
   stripped, and **deletes the `admin1` placeholder** — until it does,
   `CHANGE-ME-0000` is still a working administrator login. Then delete the
   seed file.
4. Copy the project URL and the publishable key from *Project Settings → API*
   into `public/tennis/config.js`. Leave `emailEnabled: false`.
5. Sign in and check the roster, the play days and the announcement. Nothing
   sends mail at this stage, so this is the safe time to get it wrong.
6. Only when that all looks right, set up email:

   ```bash
   supabase functions deploy send-email
   supabase secrets set RESEND_API_KEY=... MAIL_FROM="MWF Group <sheet@yourdomain>"
   ```

   `supabase/config.toml` sets `verify_jwt = false` for that function, which is
   required: callers authenticate with the sheet's own session token, not a
   Supabase Auth JWT.

7. Set `emailEnabled: true`, then use **Send Welcome** on your own row first and
   confirm it arrives before touching anybody else's.

### What the security model does and does not do

The publishable key is public, so nothing is protected by "only our site calls
this". Instead `tennis_login()` checks the sheet ID and password and returns a
random session token; the browser sends it as an `x-sheet-token` header, and
every row level security policy checks it. Members can only write their own
sign-ups. Only administrators can change members or settings.

The one real weakness is inherited from the original design: **passwords are
stored in the clear**, because the site emails a member their password and
shows it on the maintenance page. Any signed-in member can therefore read
another member's password — and since the password is that member's phone
number, the real trust boundary here is "signed-in member", not
"administrator". That is acceptable for a sheet that holds nothing but tennis
availability and a roster the group already circulates. If it ever holds
anything more, move to Supabase Auth magic links.
