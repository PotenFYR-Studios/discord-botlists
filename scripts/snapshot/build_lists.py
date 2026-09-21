#!/usr/bin/env python3
"""Build src/data/lists.generated.ts from the BotBlock snapshot.

Run from the repo root:  python3 scripts/snapshot/build_lists.py
The snapshot JSON is committed so the generated file is reproducible.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SNAPSHOT = os.path.join(ROOT, "scripts", "snapshot", "botblock-lists.json")
OUT = os.path.join(ROOT, "src", "data", "lists.generated.ts")

# extra token header knowledge that BotBlock does not expose.
# key: botblock list id, value: header the list expects the token in.
AUTH_OVERRIDE = {
    "top.gg": "Authorization",
    "botlist.me": "authorization",
    "discordbotlist.com": "Authorization",
    "discord.bots.gg": "Authorization",
    "discords.com": "authorization",
    "voidbots.net": "Authorization",
    "vcodes.xyz": "Authorization",
    "radarcord.net": "Authorization",
    "discordextremelist.xyz": "Authorization",
    "bots.ondiscord.xyz": "Authorization",
    "discordlist.gg": "Authorization",
    "disforge.com": "Authorization",
    "disq.ink": "Authorization",
    "dlist.space": "Authorization",
    "cybralist.com": "Authorization",
    "discord.rovelstars.com": "authorization",
    "yabl.xyz": "Authorization",
    "justdiscord.org": "Authorization",
    "omniplex.gg": "Authorization",
    "discover.fluxpoint.dev": "Authorization",
    "carbonitex.net": "key",
}

# vote webhook knowledge per list: [header that carries the secret, body field holding the voter id]
# Audited against each list's official docs in September 2026:
# - discordextremelist.xyz REMOVED: their v2 API docs document no vote webhook
#   at all (upvotes/downvotes are stored, never delivered).
# - bots.ondiscord.xyz REMOVED: site is live but no webhook is publicly
#   documented (none in their API docs, sitemap or archives) - do not claim
#   support for an undocumented payload.
# - discords.com voter field is `user` (docs.botsfordiscord.com).
# - disq.ink delivers `user` as an OBJECT: the id is `user.id`
#   (docs.disq.ink/webhooks/overview); the parser flattens nested objects.
# - botlist.me voter field is `user`, type is "Upvote"/"Test"
#   (docs.botlist.me/Webhooks/Vote_Webhooks).
# - radarcord.net voter field is `user` (docs.radarcord.net/api/bots).
# - voidbots.net voter field is `user`, type "vote"/"test"
#   (docs.voidbots.net/docs/webhooks.md).
# - vcodes.xyz delivers `user` as an OBJECT (`user.id`); vote notification is
#   primarily a websocket gateway, the HTTP webhook is undocumented.
# - discordlist.gg's body is a HS256 JWT whose claims are
#   {user_id, bot_id, is_test}; the SDK verifies it with the webhook secret.
# - topbot.gg votes POST {event, flagged, user} signed with
#   x-topbot-signature (hmac of "<x-topbot-timestamp>.<raw body>").
# - discordforge.org webhooks v2 POST {id, type:"vote.created", created_at,
#   bot_id, data:{voter_id, streak, total_votes, weekly_votes}} signed with
#   X-Forge-Signature: sha256=<hex hmac of raw body>.
WEBHOOK_HINTS = {
    "top.gg": {"header": "Authorization", "voterField": "user", "eventField": "type"},
    "discordbotlist.com": {"header": "Authorization", "voterField": "id", "eventField": None},
    "botlist.me": {"header": "authorization", "voterField": "user", "eventField": None},
    "voidbots.net": {"header": "Authorization", "voterField": "user", "eventField": None},
    "discordlist.gg": {"header": "Authorization", "voterField": "user_id", "eventField": None},
    "discords.com": {"header": "authorization", "voterField": "user", "eventField": None},
    "vcodes.xyz": {"header": "Authorization", "voterField": "user.id", "eventField": None},
    "radarcord.net": {"header": "Authorization", "voterField": "user", "eventField": None},
    "disq.ink": {"header": "Authorization", "voterField": "user.id", "eventField": None},
    "dlist.space": {"header": "Authorization", "voterField": "user_id", "eventField": None},
    "topbot.gg": {"header": "x-topbot-signature", "voterField": "user", "eventField": "event"},
    "discordforge.org": {"header": "X-Forge-Signature", "voterField": "voter_id", "eventField": "type"},
}

# lists verified operational in September 2026 that the stale BotBlock
# snapshot does not know about. Same shape as a snapshot record.
NEW_LISTS = {
    "topbot.gg": {
        "name": "TopBot",
        "url": "https://topbot.gg/",
        "api_docs": "https://topbot.gg/en/developers/api",
        "api_post": "https://topbot.gg/api/v1/bots/:id/stats",
        "api_field": "serverCount",
        "api_shard_count": "shardCount",
        "api_get": "https://topbot.gg/api/v1/bots/:id",
        "view_bot": "https://topbot.gg/en/bots/:id",
        "bot_widget": "https://topbot.gg/api/widget/:id",
    },
    "discordforge.org": {
        "name": "DiscordForge",
        "url": "https://discordforge.org/",
        "api_docs": "https://discordforge.org/support/developers",
        "api_post": "https://discordforge.org/api/bots/stats",
        "api_field": "server_count",
        "api_shard_count": "shard_count",
        "api_get": "https://discordforge.org/api/bots/:id",
        "view_bot": "https://discordforge.org/bot/:id",
    },
}

# manual metadata for lists still running in 2026 that BotBlock marks defunct
# or that we want to document precisely. Everything here was verified against
# the list's own docs or site during the v2 rewrite. Lists dropped September
# 2026 after their domains died (registrar parking pages, gambling squatters
# or NXDOMAIN): blist.xyz, botlist.co, botsdatabase.com, discord.services,
# discordbot.world, motiondevelopment.top, space-bot-list.xyz, topcord.xyz.
MANUAL = {"bots.discordlabs.org": {
        "name": "Discord Labs",
        "api_post": "https://bots.discordlabs.org/api/bots/:id/stats",
        "api_field": "server_count",
        "api_get": "https://bots.discordlabs.org/api/bots/:id",
        "view_bot": "https://bots.discordlabs.org/bot/:id",
    },"discordbotlist.xyz": {
        "name": "Discord Bot List XYZ",
        "api_post": "https://discordbotlist.xyz/api/bots/:id/stats",
        "api_field": "server_count",
        "view_bot": "https://discordbotlist.xyz/bots/:id",
    },"botlist.me": {"webhook": {"header": "authorization", "voterField": "user", "eventField": None}},"top.gg": {"webhook": {"header": "Authorization", "voterField": "user", "eventField": "type"}}
}

CAMEL = re.compile(r"[^a-zA-Z0-9]+")


def ident(key: str) -> str:
    parts = CAMEL.split(key)
    name = "".join(p[:1].upper() + p[1:] for p in parts if p)
    return name or "Unknown"


def ts_str(v) -> str:
    if v is None:
        return "null"
    return json.dumps(str(v))


def main() -> None:
    with open(SNAPSHOT, encoding="utf-8") as fh:
        raw = json.load(fh)

    # drop lists that are dead in the snapshot and have no manual override
    raw = {k: v for k, v in raw.items() if not v.get("defunct") or k in MANUAL}
    # merge in lists the stale BotBlock snapshot does not know about
    raw.update(NEW_LISTS)

    lines = [
        "// Generated from scripts/snapshot/botblock-lists.json by scripts/snapshot/build_lists.py.",
        "// Do not edit by hand: run the generator instead.",
        "import type { BotlistRecord } from '../types.js';",
        "",
        "export const BOTLISTS: readonly BotlistRecord[] = [",
    ]
    for key in sorted(raw):
        r = raw[key]
        manual = MANUAL.get(key, {})
        webhook = manual.get("webhook") or WEBHOOK_HINTS.get(key)
        fields = {
            "id": json.dumps(key),
            "name": ts_str(manual.get("name", r.get("name"))),
            "website": ts_str(r.get("url")),
            "apiDocs": ts_str(r.get("api_docs")),
            "apiPost": ts_str(manual.get("api_post", r.get("api_post"))),
            "postField": ts_str(manual.get("api_field", r.get("api_field"))),
            "postMethod": ts_str(manual.get("api_post_method", r.get("api_post_method")) or "POST"),
            "shardField": ts_str(manual.get("api_shard_count", r.get("api_shard_count"))),
            "shardIdField": ts_str(r.get("api_shard_id")),
            "shardsArrayField": ts_str(r.get("api_shards")),
            "apiGet": ts_str(manual.get("api_get", r.get("api_get"))),
            "viewBot": ts_str(manual.get("view_bot", r.get("view_bot"))),
            "widget": ts_str(r.get("bot_widget")),
            "authHeader": ts_str(AUTH_OVERRIDE.get(key, "Authorization")),
            "tokenEnvKey": json.dumps("DBL_" + ident(key).upper()),
            "webhook": "null"
            if not webhook
            else "{ header: %s, voterField: %s, eventField: %s }"
            % (ts_str(webhook.get("header")), ts_str(webhook.get("voterField")), ts_str(webhook.get("eventField"))),
            "supports": "{ post: %s, get: %s, widget: %s, webhook: %s }"
            % (
                "true" if (manual.get("api_post", r.get("api_post"))) else "false",
                "true" if (manual.get("api_get", r.get("api_get"))) else "false",
                "true" if r.get("bot_widget") else "false",
                "true" if webhook else "false",
            ),
        }
        lines.append("  {")
        for fk, fv in fields.items():
            lines.append(f"    {fk}: {fv},")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    lines.append("export const BOTLIST_COUNT = %d;" % len(raw))
    lines.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print("wrote", OUT, "with", len(raw), "lists")


if __name__ == "__main__":
    main()
