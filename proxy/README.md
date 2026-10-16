# Companion chat proxy

A tiny "middleman" that runs on Cloudflare (free). Beta testers' apps send chat
messages here. It adds your AI key and passes the chat on to ChatGPT (OpenAI)
or Claude (Anthropic), whichever the app build uses.
**Your key only ever lives on Cloudflare. It is never inside the app.**

It also:
- only lets in requests from the Companion app (a shared app password),
- only allows the models you list,
- caps how long a reply can be,
- limits each device to a number of chats per day (60 by default),
- never logs or saves what anyone says. It only keeps one number per device per
  day (how many chats they've sent), and deletes it after 2 days.

## One-time setup (about 10 minutes)

You type each command in **Terminal**, then press Enter. If Terminal asks
"Need to install the following packages... Ok to proceed?", type `y` and press Enter.

1. **Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up
   and confirm your email.

2. **Go to this folder in Terminal:**
   ```
   cd ~/Desktop/"Companion app"/proxy
   ```

3. **Log in to Cloudflare:**
   ```
   npx wrangler login
   ```
   A browser page opens. Click **Allow**, then come back to Terminal.

4. **Create the chat counter storage:**
   ```
   npx wrangler kv namespace create RATE
   ```
   It prints a line like `id = "a1b2c3..."`. If it asks whether to add it to
   your config for you, type `y`. Otherwise open `wrangler.toml` in this folder,
   replace `REPLACE_ME` with that id (keep the quote marks), and save.

5. **Save your Claude API key on Cloudflare:**
   ```
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
   Paste your key (from https://console.anthropic.com → API Keys) and press
   Enter. Nothing shows while you paste. That's normal. If it asks to create
   a Worker called `companion-proxy`, type `y`.

6. **Save the app password.** First make a random one:
   ```
   openssl rand -hex 24
   ```
   Copy what it prints, then run:
   ```
   npx wrangler secret put APP_TOKEN
   ```
   and paste it. **Give this same password to Claude** so it can go into the app.

7. **Put the proxy online:**
   ```
   npx wrangler deploy
   ```
   If it asks you to pick a `workers.dev` subdomain, choose any name. At the end
   it prints your address, like `https://companion-proxy.yourname.workers.dev`.
   **Give that address to Claude.**

8. **Check that it works:** open `https://companion-proxy.yourname.workers.dev/health`
   (with your address) in a browser. You should see `{"ok":true}`.

9. **Strongly recommended:** in https://console.anthropic.com go to
   **Settings → Limits** and set a monthly spend limit. The daily chat limit
   protects you from normal overuse. The spend limit is your real safety net.

## Everyday changes

**Change the daily chat limit:** open `wrangler.toml`, change the number in
`DAILY_LIMIT = "60"`, save, then run `npx wrangler deploy`. Setting it to `"0"`
pauses chat for everyone (an emergency off switch). Limits reset at midnight
UTC (5:30 AM in India).

**Allow a different model / longer replies:** edit `ALLOWED_MODELS` or
`MAX_TOKENS_CAP` in `wrangler.toml` the same way, then `npx wrangler deploy`.

**Use ChatGPT (your own OpenAI account):**
1. At https://platform.openai.com sign in, add a card under Billing, then
   API keys → Create new secret key. (A ChatGPT Plus plan doesn't include this.)
2. Run `npx wrangler secret put OPENAI_API_KEY` and paste the key.
3. Run `npx wrangler deploy` (only needed once, to load the ChatGPT route).
4. Tell Claude: the next app build then talks to ChatGPT. Replies are never
   stored at OpenAI (the proxy forces `store: false`) and only web search is
   allowed as a tool. Models: `OPENAI_ALLOWED_MODELS` in `wrangler.toml`.

**Replace your Claude API key** (if it leaks, or just to be safe):
1. Make a new key at https://console.anthropic.com → API Keys.
2. Run `npx wrangler secret put ANTHROPIC_API_KEY` and paste the new key.
   It takes effect straight away. Testers don't need to update anything.
3. Delete the old key in the Anthropic console.

**Change the app password (`APP_TOKEN`):** only do this together with an app
update, because old copies of the app will stop being able to chat.

## Good to know

- The free Cloudflare plan allows about 1,000 counter updates a day, which is
  about 1,000 chat messages a day across all testers. If you go over, chat
  keeps working, but the daily limits stop being counted until the next day.
  The $5/month Workers plan removes this limit.
- To run the automatic tests (no account needed): `npm test` in this folder.
