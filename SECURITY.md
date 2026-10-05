# Security

ResumeForge is intended for use on your own computer. The API binds to
127.0.0.1 and has no user authentication. Do not expose it or the Vite development
server to the internet. A hosted edition needs authentication, authorization,
rate limits, document parsing isolation, and deployment hardening first.

Resume data is saved in browser localStorage, without encryption. Uploaded files
are processed in memory. When Anthropic is selected, resume text, improvement
requests, and tailoring inputs are sent to Anthropic. Local providers can also
send data off the machine if their base URLs point to a remote service. Ollama
cloud models can also send text off the machine through a localhost endpoint.
The provider indicator flags remote endpoints and recognized cloud model names;
custom model aliases may hide their remote origin, so verify the model configuration.

Snapshots, deleted-resume recovery, and JSON backups also contain personal data.
Downloaded backups are unencrypted. Save them somewhere appropriate for private
documents and do not upload them to issues or commit them to the repository.

PDF export disables page JavaScript and blocks external resource requests. It
uses Chromium's default sandbox. External images and web fonts are unavailable
during export; use inline styles and embedded assets.

## Reporting vulnerabilities

Use the repository's Security tab to privately report a
vulnerability if private reporting is enabled. If it is unavailable, open an
issue requesting a private contact channel without exploit details, credentials,
or personal data.
