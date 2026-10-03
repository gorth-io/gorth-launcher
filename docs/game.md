# Minecraft download and play

Default: **Minecraft Vanilla 1.20.1 / Eclipse Temurin 17**.

Create an instance, add/select a game account, open instance details, and choose **Tải game** or **Chơi Minecraft**. Play also installs or repairs missing files. Progress, cancellation, stop and the last 200 redacted log lines are available in **Tải xuống**.

## Supported

- Vanilla exposes all official Mojang releases from 1.7.10 onward, automatically including new releases (currently 26.3). Snapshots, pre-releases, release candidates, beta/alpha and older releases are excluded. Creation and game commands enforce the same minimum; metadata must also be classified as release by Mojang before installation. Existing unsupported instances are retained but cannot be played. Runtime selection follows metadata (Java 8 fallback; Java 16-based 1.17 uses Temurin 17). Availability of native libraries and OS/GPU compatibility still affect older supported versions.
- Custom Java must be an absolute path and pass required version, Temurin vendor and architecture checks. Default 1.20.1 uses Temurin 17; 1.21.1 uses Temurin 21.
- Automatic discovery uses JAVA_HOME and macOS java_home, followed by the launcher-managed runtime. If none matches, Adoptium supplies the matching Temurin JRE. Runtime archives are SHA-256 verified.
- Fabric profiles are composed with Mojang metadata. Forge/NeoForge use SHA-1-pinned official installers, including their client processors; patched client libraries replace the raw client on the classpath. Loader versions are persisted in SQLite and preserved by copy/trash/restore. Quilt is not offered or installed.
- Mojang version metadata, client, libraries, assets and logging configuration are downloaded from official hosts and checked against SHA-1 metadata.
- OS/architecture/feature rules, classpath, JVM/game arguments, native JAR extraction and separate instance game directories.
- Offline profile or configured Ely.by/Gorth game accounts. Alternative online auth uses a SHA-256-verified authlib-injector JAR. No Microsoft login is introduced.
- One active download/launch/game at a time. Downloads have retry, cancellation, atomic file promotion and verified cache reuse. Game starts with a shell-free child process; stop terminates only that child.
- Game tokens stay in main process; renderer receives status and redacted bounded logs. Selected account is resolved before spawning Java.

## Files

Game data is stored in `<Electron userData>/minecraft`:

The Downloads page displays this absolute path and provides buttons to open the Minecraft root or an instance's `game` directory. Folder opening is handled by trusted main-process IPC using validated instance IDs, never renderer-supplied paths. A custom `--user-data-dir` also changes this data location.

- `versions/`, `libraries/`, `assets/`: shared verified cache.
- `runtime/`: launcher-managed Temurin.
- `loaders/`: official installer cache and pinned Fabric profiles.
- `content-staging/`: temporary mod/modpack downloads; normal completion/error/cancellation cleans the operation's staging directory. Interrupted process termination can leave staging data here.
- `instances/<id>/game/`: saves, mods, options and Minecraft logs.
- `instances/<id>/natives/`: extracted native libraries.
- `instances/<id>/installed.json`: installation receipt.
- `authlib/`: verified alternative-auth Java agent.

Instance metadata and Java/RAM settings are stored in `gorth-launcher.sqlite` under Electron userData, using Drizzle with Node's built-in SQLite. The initial SQL migration is bundled with the main process and applied transactionally. Existing instance/settings cookies (including old dev-origin cookies) and older localStorage data are imported once; old data remains intact as a fallback backup. Subsequent launches use SQLite and do not re-import deleted instances.

Instance details support rename, copy and delete. Copy creates a new ID and independent game files, including worlds; shared assets/libraries remain shared. Copy rejects symbolic links rather than reading data outside the instance. Delete moves the instance directory into `minecraft/.trash/<id>` and stores its metadata in SQLite; the Library trash panel can restore it across restarts. Nothing is permanently erased by Delete, and trash continues to consume disk space. Filesystem operations are journaled for startup recovery. Copy/delete/restore are blocked during an active game/download; launching is blocked while an instance operation runs. A single launcher process owns this data directory.

Default data roots are `~/Library/Application Support/Gorth/Launcher` on macOS, `%APPDATA%/Gorth/Launcher` on Windows, and `${XDG_CONFIG_HOME:-~/.config}/Gorth/Launcher` on Linux. An explicit `--user-data-dir` overrides the root for isolated tests. Auth tokens retain the existing OS-encrypted vault; theme/display preferences retain their existing storage.

## Verification

`pnpm test:game` covers metadata rules, placeholder arguments, path/instance validation, online agent requirements, checksums, corrupt-cache repair, retries and cancellation cleanup. Actual platform rendering/GPU support still requires launching Minecraft on that platform.

`pnpm test:library` covers durable migration/settings, rename, independent copies, reversible deletion, restart recovery, busy-operation guards, path validation and symlink rejection.

## Curated loaders

| Loader | Minecraft | Loader version |
| --- | --- | --- |
| Forge | 1.20.1 | 47.4.10 |
| Forge | 1.19.2 | 43.5.0 |
| NeoForge (legacy) | 1.20.1 | 47.1.106 |
| NeoForge | 1.21.1 | 21.1.217 |
| Fabric | 1.20.1 | 0.16.14 |
| Fabric | 1.21.1 | 0.19.3 or 0.16.14 |

The catalog is explicit in `lib/game/catalog.ts`; it never follows a moving latest channel. Forge pins follow [official recommended promotions](https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json). Fabric 0.19.3 is pinned by the release manifest for [Fabulously Optimized 6.5.0](https://modrinth.com/modpack/fabulously-optimized/version/6.5.0). Legacy NeoForge 1.20.1 uses the `net.neoforged:forge` artifact family, not the modern `net.neoforged:neoforge` family. These pins are not a promise that arbitrary mod collections are mutually compatible.

## Modrinth / CurseForge

Open **Mod & modpack** to search, page through projects, select a release and install. Mods target an existing supported modded instance; required dependencies are resolved with cycle/conflict guards. Existing differently-versioned tracked mods and conflicting filenames are not overwritten. This is not an automatic mod-update/uninstall system or a general mod-conflict solver.

The catalog includes mod, modpack, shader and texture-pack categories. Opening a result shows its official project website in a central Electron webview, keeps the launcher sidebar, and presents project details/releases/install controls in a right panel. The install dialog selects a compatible release; successful modpack import creates a SQLite instance and offers a shortcut to the library. Play then uses the existing Minecraft/Java download-and-launch flow. Shader and texture ZIPs go into `game/shaderpacks` and `game/resourcepacks`; shader rendering still requires a compatible Iris/OptiFine installation.

Project webviews use an isolated, nonpersistent session, sandboxing and no Node/preload/launcher bridge. Main verifies attachment URLs and options, denies permissions/popups/direct website downloads, and permits only HTTPS project pages on the two provider hosts. The website stays tied to the selected project so the install panel cannot point at an unrelated project. Dialogs temporarily hide the guest surface. See [Electron webview security](https://www.electronjs.org/docs/latest/tutorial/security).

`node scripts/smoke-content-webview.mjs --install` exercises live Modrinth project rendering, guest isolation, the install dialog and Fabulously Optimized 6.5.0 import into SQLite/library. Run only against an isolated launcher profile with remote debugging port 9338. The script downloads pack files but does not launch Java or execute mods.

Modpacks create a new instance only after downloading/checking the full payload. Both online archives and local `.mrpack` / CurseForge `.zip` exports are supported. Exact manifest Minecraft/loader requirements must match the curated catalog; no silent loader replacement. Client-unsupported and optional files are skipped. Common overrides apply before client overrides; server overrides are ignored. Import rejects traversal, symlinks, duplicate paths, unsupported runtimes and oversized archives. Downloads use provider hashes and an explicit host allowlist. Additional external mrpack download hosts may require a deliberate allowlist extension.

CurseForge requires your own `CURSEFORGE_API_KEY` in the Electron main-process environment; `.env.example` documents it. It is neither exposed to renderer nor passed to Java. This app does not automatically load `.env.local`. The [official CurseForge API](https://docs.curseforge.com/rest-api/) controls third-party distribution. Missing/blocked download URLs are reported with the project/file page; no guessed CDN URLs or bypass proxies are used. A blocked required file stops import, without creating a half-installed instance. CurseForge fixtures are tested, but live authenticated testing requires a configured key.

Format reference: [official Modrinth mrpack specification](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack).

`pnpm test:content` covers manifests, exact loader policy, ZIP traversal, client overrides, dependency resolution, checksum-backed mod installation, overwrite/symlink rejection and CurseForge distribution restrictions. Mod/pack installation is mutually exclusive with game/instance mutation, exposes progress/cancel via narrow IPC, and never executes downloaded mods during import.

Integration checks on macOS x64: actual game startup for Forge 1.20.1/1.19.2, NeoForge 1.20.1/1.21.1, Fabric 1.20.1/1.21.1; live Modrinth Fabric API installation; Fabulously Optimized 6.5.0 import into SQLite and startup with 151 loaded mods (run with explicit user approval); historical Vanilla 1.5.2 with Temurin 8 (legacy upstream networking/audio warnings remain). Windows/Linux and every historical Vanilla release have not been individually exercised. These are startup smoke tests, not full gameplay/world-generation or multiplayer certification.
