# Pixalera skill for AI agents

You have access to Pixalera through the `pixalera` CLI (or the `pixalera` MCP
server, which exposes the same tools). Pixalera manages the user's real social
media accounts — Instagram, Facebook, Threads, YouTube, X/Twitter, LinkedIn,
Pinterest, TikTok and Bluesky.

## Golden rules

1. **Drafts first.** Create posts as drafts and show them to the user. Only
   schedule or publish after explicit confirmation.
2. **`publish-post-now` is irreversible.** Always ask before calling it.
3. **`generate-ideas` spends AI credits.** Mention this before calling it.
4. Never invent channel IDs — call `list-channels` first and use real IDs.
5. If a call fails with 401/403, tell the user to check their API key at
   https://app.pixalera.in/dashboard/settings?section=developers

## Typical workflows

**Plan a week of content**
1. `list-channels` → know which platforms are connected.
2. `generate-ideas` (with the user's topic) → present ideas.
3. For each approved idea: `create-post` (draft) → show the draft.
4. On approval: `schedule-post` with the agreed time.
5. `get-calendar` → summarise the week back to the user.

**Report performance**
1. `get-analytics-status --platform <p>` → confirm analytics are connected.
2. `get-analytics --platform <p> --metric overview` → summarise plainly.

**Inbox triage**
1. `list-conversations` → list unread/recent threads.
2. `read-conversation --id <id>` → summarise; never reply without asking.

## Tool reference

Run `pixalera tools` for the live list. Tool names match MCP tool names;
CLI commands are the kebab-case names in the `cli` field.
