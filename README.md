# ResumeForge

Build and edit resumes locally. Import PDF/DOCX files or paste text, review AI
suggestions, choose from four templates, and download a PDF. Supports Ollama,
llama.cpp, and Anthropic Claude.

## Run with Docker

Docker Desktop (or Docker Engine with Compose v2) is the only application runtime
you need. The image includes the frontend, API, and Chromium for PDF export.

### Build and run now

From a source checkout:

```bash
docker compose -f compose.yml -f compose.build.yml up --build -d --wait
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). Manual editing and PDF export
work immediately. AI needs a configured provider. The runner binds only to your
computer, runs as non-root, and keeps the container filesystem read-only.

### Run a published image

After the first container release is published, download `compose.yml` and
`.env.example` from the repository
[Releases page](https://github.com/manojisnow/resume-forge/releases) into a folder.
No source checkout or npm installation is required. Then run:

```bash
docker compose up -d --wait
```

The default image is `ghcr.io/manojisnow/resume-forge:latest`. For a predictable
version, set `RESUMEFORGE_IMAGE=ghcr.io/manojisnow/resume-forge:1.0.0` in a root
`.env` file, replacing `1.0.0` with an actually published release tag.
Images are built for Linux amd64 and arm64, including Docker on Apple Silicon.

### Configure AI in Docker

Copy the root `.env.example` to `.env` next to `compose.yml` (PowerShell:
`Copy-Item .env.example .env`). This is separate from the native app
configuration in `server/.env`; neither private file is included in the image.

- **Ollama already on your machine:** pull `llama3.2` and keep Ollama running.
  The runner connects through `host.docker.internal:11434`. On Linux, Ollama
  must listen on an interface reachable from Docker; prefer the container
  option below instead of exposing your host Ollama service.
- **Anthropic:** set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in root `.env`.
  This sends AI inputs to Anthropic.
- **llama.cpp:** set `AI_PROVIDER=llamacpp`, `LLAMACPP_BASE_URL`, and
  `LLAMACPP_MODEL`. The default host port is 8081 to avoid the app port.

To run Ollama alongside the app, also download `compose.ollama.yml` and use:

```bash
docker compose -f compose.yml -f compose.ollama.yml up -d --wait
```

For a source build, include all three files:

```bash
docker compose -f compose.yml -f compose.build.yml -f compose.ollama.yml up --build -d --wait
```

This starts Ollama on an internal Docker network and downloads the selected
`OLLAMA_MODEL` once. Model weights persist in the `ollama_data` volume. The
default CPU model needs several GB of free RAM and disk; the first download
can take several minutes. Cloud-suffixed Ollama models still use cloud inference.

### Stop, update, and preserve saves

Use the same `-f` options you started with for subsequent Compose commands:

```bash
docker compose logs --tail=100
docker compose down
docker compose pull
docker compose up -d --wait
```

For source builds, rebuild with `up --build -d --wait` instead of `pull`. After
editing `.env`, run `up -d` to recreate the app with the new configuration.
`APP_PORT` changes the local port; use that same address consistently.

Resumes remain in browser localStorage, not in the container or Ollama volume.
Download a backup from the old app at `localhost:3000`, then restore it in the
container app at `127.0.0.1:8080`; those addresses have separate browser saves.
Container upgrades and `down` do not clear browser storage. Do not use `down -v`
unless you intend to remove the downloaded model volume.

The local runner disables Chromium's internal sandbox to run without granting
the container privileged capabilities. PDF JavaScript and network requests are
still blocked; the app container is non-root, capability-restricted, and read-only.
This runner is for local use and does not add hosted authentication or quotas.

## Requirements (without Docker)

- Node.js 22.12.0 or newer, with npm.
- An AI provider for importing and rewriting: Ollama, llama.cpp, or an Anthropic
  API key. Manual editing and PDF export work without an AI provider.
- Internet access during installation: Puppeteer downloads Chromium for PDF export.

## Quick start

From the project root:

```bash
npm run install:all
cp server/.env.example server/.env
```

On Windows PowerShell, use `Copy-Item server/.env.example server/.env` instead
of `cp`. Edit `server/.env` using one of the provider options below, then run:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000). The API runs on
`127.0.0.1:3001`. Keep those ports available and retain `PORT=3001` in the server
configuration so the frontend proxy can reach it.

### Ollama (default)

Install [Ollama](https://ollama.com), then download the example model:

```bash
ollama pull llama3.2
```

Keep the Ollama app running, or run `ollama serve`. The example configuration uses:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2
```

Set `OLLAMA_MODEL` to a model available in your Ollama installation. Models ending
in `-cloud` or `:cloud` use cloud inference even through a localhost endpoint.

### Anthropic Claude

Create a key in the [Anthropic console](https://console.anthropic.com/settings/api-keys)
and configure:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
```

Replace the placeholder in your local `.env` file. Resume text and AI requests
are sent to Anthropic. `ANTHROPIC_MODEL` can override the example's model.

### llama.cpp

Run your [llama.cpp](https://github.com/ggml-org/llama.cpp) model server:

```bash
llama-server -m /path/to/model.gguf --port 8080 --ctx-size 4096
```

Configure:

```env
AI_PROVIDER=llamacpp
LLAMACPP_BASE_URL=http://localhost:8080/v1
LLAMACPP_MODEL=local-model
```

Set `LLAMACPP_API_KEY` if your model server requires authentication.

## Saving and recovery

Resumes, design settings, and recent history save automatically in your browser's
localStorage. They belong to that browser profile and address; `localhost:3000`
and `127.0.0.1:3000` have separate storage. Clearing site data removes the saves.

The sidebar provides **Undo**, **Previous versions** (up to 12 snapshots per
resume), **Restore deleted resume** (last 10 deletions), and JSON backup/restore.
**Download backup** saves an independent copy; restoring adds copies and keeps
existing resumes. Browser saves and downloaded backups are unencrypted.

If saving fails, keep the tab open and download a backup. Unreadable saves pause
automatic saving and reveal recovery controls. A change from another tab also
pauses saving so you can back up your draft before loading the latest data.

## Troubleshooting

- **AI import fails:** check the selected provider is running, its model is
  available, and its URL or API key is correct in `server/.env`. Restart the app
  after configuration changes. Scanned PDFs without extractable text need text
  pasted manually.
- **PDF export fails:** run `npm rebuild puppeteer --prefix server` to install the
  required Chromium browser. On Linux, Chromium may also need system libraries
  and sandbox support; see [Puppeteer's troubleshooting guide](https://pptr.dev/troubleshooting).
- **PDF layout:** the Design tab has entry grouping and an optional page break
  before a selected entry. The page count is an estimate. Check the downloaded
  PDF; very large entries may split across pages. External images and fonts are
  blocked during export.
- **Port already in use:** stop the process using port 3000 or 3001 before starting
  the app.

## Development

```bash
npm run check         # Server/client tests and frontend build
npm run test:browser  # With npm start running on the default ports
npm run clean         # Remove build output and caches; keep dependencies and .env
```

Browser checks use an isolated Chromium profile, fictional resumes, and mocked
AI responses. GitHub Actions runs the checks and dependency audits. Use fictional
data in tests, screenshots, and issues; keep credentials in the ignored `.env`.
Commit dependency changes with the corresponding package lockfiles.

`client/` contains the React interface, `server/` the Express API and provider/PDF
adapters, and `shared/` the resume validation and print styles.

## Security and license

The app is intended for your own computer and has no authentication for public
hosting. See [SECURITY.md](SECURITY.md). Never put API keys in frontend code or
`VITE_*` variables, which are exposed to the browser.

Licensed under [Apache 2.0](LICENSE). Contributions use the same license.

## Container releases

The tag-triggered workflow tests the app and container, then publishes versioned
images to GHCR and attaches the runner files to a GitHub release. A maintainer
creates and pushes a stable `vX.Y.Z` tag on a reviewed commit when ready to release.
For the first publication, set the GHCR package visibility to Public so users can
pull without signing in. The workflow uses `GITHUB_TOKEN`; no registry password
is required. A workflow file alone does not publish an image.

Keep base images and Chromium updated by rebuilding releases regularly.
To run container checks after a source build:

```bash
docker compose -f compose.yml -f compose.build.yml exec -T app node < scripts/container-check.cjs
```

The redirection example uses a POSIX shell; GitHub Actions runs it automatically.
