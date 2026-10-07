# Desktop package integration

- tRPC v11 runs through the isolated preload's `desktop:rpc` channel, not a network listener.
  Main validates the owning window, main frame, renderer URL and bounded request.
  Library snapshots and settings use the existing SQLite service, shared Zod schema,
  operation guards and change broadcasts.
- `@trpc/tanstack-react-query` shares the application's QueryClient; library data
  is updated after settings mutations and main-process broadcasts.
  The installed classic `@trpc/react-query` integration is intentionally not used.
- TanStack Router's memory history replaces the manual page-history array.
  Application state stays mounted across navigation; back/forward does not change
  the Electron shell URL.
- Launch history uses TanStack Table v9 sorting, search and TanStack Virtual
  when there are more than 50 filtered rows. Older sessions are no longer truncated
  to the first 50 entries.
- Ranger controls memory allocation and commits on release instead of sending a
  settings write for every mouse movement.

Legacy migration, native dialogs, game operations, events and authentication
retain their existing IPC paths. This is not a wholesale IPC migration.
`components/ui` is unchanged; application-specific controls live in `components/custom`.

Validation: `pnpm test:rpc`, `pnpm test:desktop-packages`,
`pnpm test:library`, `pnpm exec tsc --noEmit`, and renderer/main/preload builds.
The native test uses temporary profile data, not the user's launcher database.
