# ResumeForge

Build and edit resumes locally. Import PDF/DOCX files or paste text, review AI
suggestions, choose from four templates, and download a PDF. Supports Ollama,
llama.cpp, and Anthropic Claude.

## Requirements

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
