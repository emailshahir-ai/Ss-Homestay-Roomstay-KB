# Project memory

## Product intent & audience

- **SS Homestay** promotional web app built with Vite + React.
- Core goal: enable sharing homestay promotional content via WhatsApp with image + clickable link.
- Audience: homestay operators/owners managing and sharing promotional links.

## Brand personality & voice

- App UI and assistant communication in **Bahasa Melayu (Malay)**.
- Tone: helpful, instructional, straightforward.

## Visual design & UX direction

- Admin Panel includes a **"Kongsi Pautan WhatsApp"** section for configuring public URLs.
- Two distinct sharing outputs:
  - **"Kongsi Logo + Pautan"**: sends promotional image + message + clickable URL (via WhatsApp share intent).
  - **"Buka di WhatsApp"**: produces a URL preview card (Open Graph style) only.
- Promotional image updated from old 512×512 logo to newer promotional material.
- Panel instructions distinguish between the two sharing modes clearly.

## Decisions, constraints & rationale

- Public URL must be published before WhatsApp sharing works correctly.
- Sharing combines image + text + URL in a single WhatsApp share action.
- Admin Panel instructions were updated to remove outdated Cloud Run references and clarify the two sharing modes.
- Build verified after changes; user instructed to test post-publish.

## Open questions & assumptions

- Deployment platform not fully confirmed (Cloud Run mentioned in old instructions; current deployment target unclear).
- Assumed the promotional image asset is the correct/latest one matching user's example.
- OG meta tags for URL preview cards assumed to be configured but not explicitly confirmed.
- No `.bolt/prompt` authoritative instructions exist yet.