# late-micro-chat — Agent Notes

## What this is
- React micro-frontend (chat + voice rooms). Built as an ESM bundle that the
  late.kodingvibes.com app shell mounts into `<div id="micro-chat-root">` on
  the `/irc` route.
- Build output: `dist/entry.js` + `dist/style.css`.

## Build & deploy
After ANY change to `src/`:

1. Bump `version` in `package.json` (current: 0.1.2).
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
