# Companion chat server

The app uses **OpenAI only**. Beta chat goes to this Cloudflare Worker, which
adds the OpenAI API key and streams the reply back. The provider key belongs in
Cloudflare secrets, never inside the installer or GitHub.

## Current privacy boundary

Before the first chat, the app explains sharing. Only sending a message starts
an AI request. Up to16 recent conversation messages and local time are sent;
task lists, profile names, growth, saved notes and fetched calendar events are
not automatically added. All speech is local in this beta.

The Worker does not log message contents. It keeps device usage counters with
about a two-day expiry. Provider/hosting retention is separate. OpenAI saved
Responses retrieval is disabled with `store: false`; this is not Zero Data
Retention. See `../site/privacy.html` and the release checklist.

A shared app token is not individual user authentication. Existing device
counters can fail open and undercount simultaneous requests; they are not a
reliable total spending ceiling. Stronger access/cost controls and live account
verification remain beta launch blockers.

## Routes

- `GET /health`: service health.
- `POST /v1/responses`: OpenAI chat, with only web search allowed as a tool.
- The retired `/v1/messages` chat route returns 404. No fallback provider exists.
- `POST /v1/tts`: legacy Google speech route, not used by the current app.

## Configuration and controlled rollout

Run commands from `proxy/`. Deployments and spending require Gayathri's approval.

1. Sign in to Cloudflare using `npx wrangler login` if needed.
2. Configure the `RATE` KV binding in `wrangler.toml`.
3. Gayathri enters her key privately with `npx wrangler secret put OPENAI_API_KEY`.
4. Set `APP_TOKEN` as a Worker secret, and use the same token in the gitignored
   `electron/beta-config.json`. Never paste secret values into chat or GitHub.
5. Build configuration contains `proxyUrl` and `appToken`; the app always uses
   OpenAI. Any old provider selector is ignored.
6. Run the offline tests with `npm test`.
7. Only after approval, run `npx wrangler deploy` and verify the actual installed
   app against the live server. Tests with simulated responses are not proof of
   a successful real OpenAI request.

`OPENAI_ALLOWED_MODELS` lists permitted models; `OPENAI_OUTPUT_CAP` caps reply
and reasoning tokens. `DAILY_LIMIT=0` pauses server-backed chat after deployment.
Daily counters use UTC dates. Changing local settings alone does not update the
live service. Budget alerts alone do not enforce a spending cutoff.

## Key removal

Delete an obsolete Worker secret with `npx wrangler secret delete SECRET_NAME`,
only when the owner has authorized that specific deletion. This changes the live
Worker's secret binding. Removing a secret is not the same as revoking the key
at its provider. Do not revoke company credentials used by other projects.

Personal development keys are stored in the app's private data folder; only
OpenAI keys are accepted. No environment fallback to another provider exists.

## Tests

`npm test` runs31 offline tests: authentication, models/tools, retention settings,
limits, headers, errors, streaming/citations, real OpenAI SDK compatibility with
simulated replies, rejection of the retired route, and legacy speech-route
checks. No paid API requests are made.
