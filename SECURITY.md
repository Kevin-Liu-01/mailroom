# Security

Mailroom touches a mailbox, so it is built to do as little as possible with it:

- Metadata only. Headers, labels, and snippets are read; message bodies are never fetched, stored, or sent anywhere.
- Never sends mail, never unsubscribes, never deletes permanently. Trash is Gmail's own Trash with 30-day recovery.
- Every run previews first, writes a receipt, and can be undone.
- OAuth tokens and TypeSafe keys are encrypted at rest with AES-256-GCM. Disconnect revokes the Google token and deletes the account's rows.
- Every response carries a strict Content Security Policy and the usual hardening headers; state-changing API calls must be same-origin.

The hosted instance at mailroom.kevinliu.studio is a personal deployment and is not Google-verified (see `docs/casa.md` for why).

To report a vulnerability, email k.bowen.liu@gmail.com. Please do not open a public issue for security reports.
