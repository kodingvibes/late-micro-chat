# late-micro-chat — Agent Notes

## What this is
- React micro-frontend (chat + voice rooms). Built as an ESM bundle that the
  late.kodingvibes.com app shell mounts into `<div id="micro-chat-root">` on
  the `/irc` route.
- Build output: `dist/entry.js` + `dist/style.css`.

## Build & deploy
After ANY change to `src/`:

1. Bump `version` in `package.json` (current: 0.1.4).
2. Commit + push.
3. Run the shell-side deploy script (it reads the version, builds, and
   rsyncs to `/var/www/html/micro/chat/v$VERSION/` + updates the `latest`
   symlink and `latest.json`):

   ```bash
   bash /root/late.kodingvibes.com/scripts/build-micro-chat.sh
   ```

The script:
- Runs `npm run build` (= `tsc --noEmit && vite build`).
- `rsync -a --delete dist/ /var/www/html/micro/chat/v$VERSION/`.
- `ln -sfn v$VERSION /var/www/html/micro/chat/latest`.
- Writes `{"version":"$VERSION","name":"chat"}` to
  `/var/www/html/micro/chat/latest.json` so the shell's UpdateNotice can
  detect the new version while the user is on the page.

**Never deploy by hand-copying `dist/`** — the versioned path + symlink +
`latest.json` are what the shell reads. Skipping any of them breaks upgrades.

## Day-to-day
- Typecheck only: `npm run lint` (= `tsc --noEmit`).
- Full build: `npm run build`.
- Dev server: `npm run dev` (port 5182).
- AudioContext for notification sounds is created lazily on a user gesture
  (see `src/lib/notification-sound.ts`) — iOS Safari won't play the buzz
  otherwise.

## Backend coupling
- The chat API lives in `late.kodingvibes.com/services/chat-bridge/`
  (FastAPI + SQLite). `GET /api/chat/channels` is implemented in
  `repositories/channels.py::list_channels`. It returns only channels the
  user is a member of — public channels you're not in are NOT included.
  To list them for an "Otros canales" / discover UI you must change the
  SQL (`OR c.is_public = 1`) and have the response carry a `joined` flag
  so the client can tell them apart. Don't assume the client can fix this
  on its own: the server has to send the rows first.
- Channel admin actions (delete, manage members) are gated by
  `my_role` returned by the same endpoint. The client trusts it; the
  server re-checks at the PATCH/DELETE handlers in
  `routers/channels.py` and `routers/members.py`. Admin can act on a
  channel they're not a member of, as long as `my_role === 'admin'`
  for that channel.
- Deploy: the `build-micro-chat.sh` script only builds the
  micro-frontend. Backend changes need a separate deploy of
  `late.kodingvibes.com` (out of scope for this script). The flow
  for changes that touch both is:

  1. Edit + commit + push in `late.kodingvibes.com` (backend).
  2. `cd /root/late.kodingvibes.com && bash scripts/deploy.sh`
     (or whatever the shell-side deploy command is — check
     `late.kodingvibes.com/AGENTS.md`).
  3. Bump `package.json` in this repo, commit, push.
  4. `bash /root/late.kodingvibes.com/scripts/build-micro-chat.sh`.

  Step 1+2 has to land BEFORE step 4, otherwise the new
  micro-frontend will hit a server that still has the old contract
  (e.g. the `joined` flag missing) and render broken.

## Lessons learned
- The micro-frontend's `ChatClient` sets `joined: true` for every row
  the server returns. So before the server change above, the client
  had no way to render non-joined channels — the field was hard-coded.
  Any feature that needs the distinction (discover list, "Unirse"
  button, etc.) requires both sides to agree on a `joined` flag.
- The shell owns the version bump + symlink + `latest.json` dance.
  The micro-frontend is purely a versioned asset; the shell detects
  upgrades via `latest.json` and shows the UpdateNotice.
