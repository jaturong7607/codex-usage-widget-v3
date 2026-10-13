# Codex Usage Widget V3

Two standalone iPhone widgets for [Scriptable](https://scriptable.app/). Read your actual Codex quota directly from OpenAI, with no always-on computer, cloud server, or Tailscale connection required after setup.

This is an independent, unofficial utility. It uses an undocumented endpoint that may change without notice. It tracks **Codex only**; it does not report ordinary ChatGPT Chat quotas, API billing, or estimated token balances.

## Choose a version

| File | Appearance | Suggested widget size |
| --- | --- | --- |
| `scriptable/Codex V3.js` | Percentages, quota bars, reset timestamps | Small or medium |
| `scriptable/Codex V3 Mascot.js` | Original mint pixel robot with compact percentages | Small |

Both display **remaining** quota: `100 − used_percent`. Labels such as `5h` and `7d` follow the durations returned by the service. Missing, invalid, or unsupported data never becomes a fabricated zero or full allowance.

### Colors and freshness

Standard bars are mint above 30%, amber above 10% through 30%, and pink at 10% or below. Each window is evaluated separately.

The small mascot is mint normally, pink if either window is at 10% or below, and amber when data is stale, unavailable, or past a reported reset. `Ready` describes quota availability, not whether Codex is running a task. The medium mascot layout uses the standard bar colors.

`Updated` is the time of the last successful quota read. Failed reads retain the last snapshot with `Stale`. A passed reset shows `Awaiting update`, rather than automatically granting 100%. iOS controls Home Screen refresh timing; the requested 15-minute interval is not guaranteed. Even an older rendered widget can retain its previous status until iOS runs it again, so check the timestamp.

## Requirements

- iPhone or iPad with Scriptable and an internet connection.
- A ChatGPT account with Codex access.
- Windows with Codex CLI for the **initial dedicated OAuth login only**. The helper scripts use Windows PowerShell. The CLI can also be used manually on other operating systems with a separate `CODEX_HOME`.

No OpenAI API key is needed. A Windows relay token will not work with V3.

## 1. Create a dedicated login on Windows

Install Codex CLI from the [official Codex documentation](https://learn.chatgpt.com/docs/codex). Confirm `codex --version` works, then open PowerShell in this repository folder.

For the standard widget:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\New-OAuthSession.ps1 -Variant standard
```

Finish the browser login using the account whose Codex quota you want to see. The helper temporarily sets a separate `CODEX_HOME`; it does not replace your normal Codex login. It stores this dedicated session under `%LOCALAPPDATA%\CodexUsageWidget\oauth-v3-standard`.

Copy its setup token without printing it:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Copy-SetupToken.ps1 -Variant standard
```

For the mascot, repeat both commands with `-Variant mascot`. **Never enter the same refresh token into both widgets.** Each variant stores and rotates its own token chain. Sharing one session across them can cause one widget to lose authentication.

The script-policy override applies only to that PowerShell process; it does not change the machine's policy. If policy is centrally managed, follow your organization's approved process.

## 2. Install on iPhone

1. Create a Scriptable script named **Codex V3** or **Codex V3 Mascot**.
2. Paste the complete contents of the corresponding `.js` file. Do not put any credentials into the source code.
3. Run it inside Scriptable.
4. Transfer the dedicated refresh token through a trusted private method and paste it into the **Dedicated refresh token** secure field. Press **Save**.
5. Confirm that the preview displays actual percentages. For later manual runs, select **Keep current**.
6. Add a Scriptable Home Screen widget and select the script. Choose the appropriate size.

Use one script per variant. Avoid running duplicates of the same authenticated variant simultaneously during token renewal. Separate Keychain entries isolate the standard and mascot sessions; they do not provide a cross-process renewal lock for duplicate copies of one script.

After the first successful setup, iPhone Keychain owns the rotating access/refresh token pair. **Do not reuse that dedicated CLI session or its original setup token.** The Windows copy can become obsolete after the first refresh. Remove the dedicated `auth.json` from its session directory when setup succeeds; do not remove your normal Codex credentials. Clear the Windows clipboard with `Set-Clipboard -Value ''`, and clear the iPhone clipboard after setup. If using a clipboard history or sync service, remove the credential from that history too.

## 3. Check independence from Windows

Run the script manually on iPhone with Tailscale disconnected and the computer switched off. Confirm a new `Updated` timestamp appears and no connection error is shown. Adding the widget alone does not prove a fresh read; it may display cached data.

## Authentication and privacy

- All quota reads go to `https://chatgpt.com/backend-api/wham/usage`.
- Token refresh requests go to `https://auth.openai.com/oauth/token`.
- The public Codex OAuth client identifier in source is **not a secret or API key**.
- Access and refresh tokens are stored together in a per-variant Scriptable Keychain entry. Rotated credentials are saved immediately, before reading usage.
- An account identifier is extracted from the access token for request routing; parsing the JWT is not a cryptographic signature verification.
- A local cache contains only normalized quota fields and the observation timestamp. It contains no token, email, or account identifier.
- There is no analytics, advertising, remote image download, or credential-bearing log output.
- A refresh token provides persistent access to its OAuth session. Treat it as a password. Never paste it into chat, Git, screenshots, issue reports, or widget parameters.

The helper's temporary `auth.json` is sensitive CLI-managed data, stored outside the repository. It is not encrypted by these helpers. Keep that directory private and remove the dedicated credential file after the successful iPhone handoff. The `.gitignore` rules are a second line of defense, not a substitute for reviewing staged files.

## Troubleshooting

| Message | What to check |
| --- | --- |
| `Setup required` | Run in Scriptable and enter the dedicated refresh token for this variant. |
| `Sign in again` | Create a fresh dedicated OAuth session. An old token may have expired, rotated elsewhere, or been revoked. |
| `Access unavailable` | Confirm the account has Codex access and the internal endpoint still accepts it. |
| `Connection failed` / `Stale` | Check iPhone internet access and rerun manually. Last observed numbers remain marked stale. |
| `Quota unavailable` | The response contained no valid supported general Codex windows. No allowance is inferred. |
| `Awaiting update` | A reported reset has passed. A fresh upstream read is required. |

Token refresh is attempted before expiry. A usage response with HTTP 401 triggers at most one refresh and retry. Other failures do not enter an unlimited retry loop.

To replace an account, use a fresh dedicated session and enter its new token through **Save**. This clears the variant's cached quota. To stop using the widget, remove it from the Home Screen and remove its credentials from Scriptable Keychain; revoke the dedicated session through the account controls where available. Deleting a script alone may leave Keychain entries intact.

## Development

Node.js 22 or later is used only for local checks; there are no package dependencies to install.

```text
npm test
npm run check
npm run build
```

The scripts under `scriptable/` are complete paste-ready artifacts. `lib/` contains shared normalization and authentication code, and `tools/build.mjs` rebuilds the shared portions while retaining each file's UI.

The standard widget keeps its original `codex-direct-v2` internal Keychain prefix for compatibility with earlier Direct installations. This legacy internal name does not mean the script requires the V2 Windows relay.

Validation includes quota edge cases, rotated token persistence, one-time 401 retry, and stale-cache behavior using mocked Scriptable APIs. Live dedicated OAuth quota reads succeeded during development, and standard iPhone setup was reported successful. The mascot shares the tested reader; physical iPhone rendering and fresh reads should still be checked on your own device. Unit tests do not prove undocumented endpoint availability for every account.

## Sources

- [Official Codex app-server documentation](https://learn.chatgpt.com/docs/app-server): documented quota semantics for the separate app-server integration.
- [Open-source direct iOS approach](https://github.com/yoyocircle/codex-usage-widget): dedicated sessions and the internal usage/refresh endpoints. This project's code is independently implemented.
- [CodexBar provider documentation](https://github.com/steipete/CodexBar/blob/main/docs/codex.md): OAuth, CLI and optional dashboard sources.
- [Scriptable Keychain](https://docs.scriptable.app/keychain/) and [widget refresh behavior](https://docs.scriptable.app/listwidget/).

## Publishing

Publish **this folder only**, not the surrounding development workspace. It contains no personal account data, machine-specific URL, real access/refresh token, relay secret, or private screenshot. Review `git diff --cached` before pushing, and never add a CLI credential directory.

No distribution license has been selected yet. Choose and add a license before inviting others to reuse or redistribute the code.
