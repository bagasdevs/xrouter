# Railway

Deploy X Router on [Railway](https://railway.com) from this repository. The
service builds from the repo `Dockerfile` and runs the Next standalone server
through `custom-server.js`.

Configuration lives in `.railway/railway.ts` (Infrastructure as Code). The old
`railway.json` / `railway.toml` format is deprecated and stops being read on
**2026-12-01**.

---

## Infrastructure as Code

The authoring file declares one service, `xrouter`, sourced from
`bagasdevs/xrouter` on branch `main`:

| Setting | Value |
|---|---|
| Builder | `DOCKERFILE` → root `Dockerfile` |
| Healthcheck | `GET /api/health`, timeout 120 s |
| Restart policy | `ON_FAILURE`, max 10 retries |
| Replicas | 1 (SQLite is single-writer) |

Preview and apply changes from the repo root:

```bash
railway login
railway link                 # project hearty-luck, environment production
npm install                  # installs the `railway` IaC SDK
railway config plan          # safe: shows the diff
railway config apply         # applies after confirmation
```

`plan` / `apply` are CLI-side operations; Railway does **not** read `.railway/`
during deploys. Changing the authoring file requires a `config apply`.

> Windows CLI quirk: `railway/iac` resolves the CLI version via `process.env._`.
> If `railway config plan` fails with *"requires Railway CLI 5.42.1 or newer"*
> even on a newer CLI, set `_` to the installed binary before running:
>
> ```powershell
> $env:_ = "$env:APPDATA\npm\node_modules\@railway\cli\bin\railway.exe"
> railway config plan
> ```
>
> The CLI itself must be ≥ 5.42.1 (`npm i -g @railway/cli`).

---

## One-time setup

1. **New project → Deploy from GitHub repo**, pick this repository (or apply
   `.railway/railway.ts` to an existing linked project).
2. Railway builds `Dockerfile`. No build command or Nixpacks config is needed.
3. **Add a volume** (Service → *Variables/Volumes* → *New Volume*) mounted at
   `/app/data`. The image already defaults `DATA_DIR=/app/data`; without the
   volume the SQLite database and credentials reset on every redeploy.
4. **Set variables** (Service → *Variables*):

   | Variable | Value | Required |
   |---|---|---|
   | `JWT_SECRET` | long random string | yes |
   | `INITIAL_PASSWORD` | dashboard password (override the default) | yes |
   | `API_KEY_SECRET` | random string | recommended |
   | `MACHINE_ID_SALT` | random string | recommended |
   | `DATA_DIR` | `/app/data` | already set by the image |
   | `PORT` | `20128` (or Railway's injected value) | see networking |
   | `BASE_URL` | `https://<your-domain>` | recommended |
   | `AUTH_COOKIE_SECURE` | `true` behind HTTPS | recommended |

5. **Networking → Generate Domain**, then set the **target port** to `20128`.
   The container listens on `$PORT`; the image default is `20128`. If you set
   `PORT` to another value, the target port must match it.

6. Open `https://<your-domain>/dashboard` and log in with `INITIAL_PASSWORD`.

---

## Healthcheck

`.railway/railway.ts` probes `GET /api/health`, which answers `{"ok":true}`
without auth. Railway keeps the old deployment live until the probe passes, so
a broken build never replaces a working one.

---

## Persistence

| Path | Contents |
|---|---|
| `/app/data/db/data.sqlite` | providers, accounts, combos, API keys, settings |
| `/app/data/db/backups/` | automatic DB backups |
| `/app/data/*` | certs, runtime configs, imported credentials |

Usage logs and `usage.json` live in the same `DATA_DIR` on Linux containers
(`custom-server.js` links `/root/.xrouter` to `/app/data-home`), so the volume
covers them too.

Back up by copying the volume, or use the dashboard's export endpoints before
changing plans.

---

## Updating

Railway redeploys on every push to the branch declared in the IaC source
(`main`). Environment variables survive redeploys; the volume survives as long
as it is attached to the service.

`NEXT_PUBLIC_*` values are inlined by `next build`, so they must be present
**during the build** to take effect. The image does not declare build args for
them; prefer the runtime `BASE_URL` / `CLOUD_URL` variables instead.

---

## Notes and limits

- The image runs as user `node`; the entrypoint chowns `/app/data` first, so a
  freshly created Railway volume is writable without manual `chmod`.
- In-memory caches (session stickiness, RAM token cache) are per replica. Run a
  single replica unless you accept cache misses across instances; the SQLite
  database is a single-writer store and does not support horizontal scaling.
- Streaming responses need no extra proxy config on Railway; the server sends
  SSE directly from `custom-server.js`.
- Builds compile native `better-sqlite3` dependencies inside the image
  (`python3`, `make`, `g++` are installed in the builder stage). Expect the
  first build to take several minutes.
