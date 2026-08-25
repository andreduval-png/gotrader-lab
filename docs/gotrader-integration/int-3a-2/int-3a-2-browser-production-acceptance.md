# Browser Production Acceptance

Server: Vite development server at `http://127.0.0.1:4192`, process launched from the isolated INT-3A.1 worktree. Port 4191 was already occupied by an existing server, so this verification used the next available port. The old `int3a1Fixture=conflict` parameter returns the ordinary dashboard (HTTP 200) and no longer paints a final snapshot.

Desktop 1440x1100:

- HTTP 200
- conflict banner visible
- both candidate cards visible
- no probability tile
- no horizontal overflow
- zero page/console errors

Mobile 390x844: same assertions passed.

Screenshots: [desktop](desktop.png), [mobile](mobile.png).
