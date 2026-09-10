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
WEBHOOK_HINTS = {
    "top.gg": {"header": "Authorization", "voterField": "user", "eventField": "type"},
    "discordbotlist.com": {"header": "Authorization", "voterField": "id", "eventField": None},
    "botlist.me": {"header": "authorization", "voterField": "id", "eventField": None},
    "voidbots.net": {"header": "Authorization", "voterField": "user_id", "eventField": None},
    "discordlist.gg": {"header": "Authorization", "voterField": "id", "eventField": None},
    "bots.ondiscord.xyz": {"header": "Authorization", "voterField": "id", "eventField": None},
    "discords.com": {"header": "authorization", "voterField": "user_id", "eventField": None},
    "vcodes.xyz": {"header": "Authorization", "voterField": "userID", "eventField": None},
    "radarcord.net": {"header": "Authorization", "voterField": "userID", "eventField": None},
    "discordextremelist.xyz": {"header": "Authorization", "voterField": "user_id", "eventField": None},
    "disq.ink": {"header": "Authorization", "voterField": "user", "eventField": None},
    "dlist.space": {"header": "Authorization", "voterField": "user_id", "eventField": None},
}

# manual metadata for lists still running in 2026 that BotBlock marks defunct
# or that we want to document precisely. Everything here was verified against
# the list's own docs or site during the v2 rewrite.
MANUAL = {"blist.xyz": {
        "name": "Blist",
        "api_post": "https://blist.xyz/api/bots/:id/stats/",
        "api_field": "server_count",
        "api_get": "https://blist.xyz/api/bots/:id/",
        "view_bot": "https://blist.xyz/bot/:id",
        "api_docs": "https://blist.xyz/docs",
    },"bots.discordlabs.org": {
        "name": "Discord Labs",
        "api_post": "https://bots.discordlabs.org/api/bots/:id/stats",
        "api_field": "server_count",
        "api_get": "https://bots.discordlabs.org/api/bots/:id",
        "view_bot": "https://bots.discordlabs.org/bot/:id",
    },"motiondevelopment.top": {
        "name": "MotionDevelopment",
        "api_post": "https://api.motiondevelopment.top/api/v1/bots/:id/stats",
        "api_field": "servers",
        "api_get": "https://api.motiondevelopment.top/api/v1/bots/:id",
        "view_bot": "https://motiondevelopment.top/bots/:id",
        "api_docs": "https://docs.motiondevelopment.top/",
    },"topcord.xyz": {
        "name": "TopCord",
        "api_post": "https://topcord.xyz/api/bots/:id/stats",
        "api_field": "guilds",
        "view_bot": "https://topcord.xyz/bots/:id",
    },"discordbot.world": {
        "name": "Discord Bot World",
        "api_post": "https://discordbot.world/api/bots/:id/stats",
        "api_field": "server_count",
        "api_get": "https://discordbot.world/api/bots/:id",
        "view_bot": "https://discordbot.world/bots/:id",
    },"botsdatabase.com": {
        "name": "Bots Database",
        "api_post": "https://botsdatabase.com/api/bots/:id/stats",
        "api_field": "server_count",
        "view_bot": "https://botsdatabase.com/bot/:id",
    },"discordbotlist.xyz": {
        "name": "Discord Bot List XYZ",
        "api_post": "https://discordbotlist.xyz/api/bots/:id/stats",
        "api_field": "server_count",
        "view_bot": "https://discordbotlist.xyz/bots/:id",
    },"space-bot-list.xyz": {
        "name": "Space Bot List",
        "api_post": "https://space-bot-list.xyz/api/bots/:id/stats",
        "api_field": "server_count",
        "view_bot": "https://space-bot-list.xyz/bot/:id",
    },"botlist.co": {
        "name": "Botlist.Co",
        "api_post": "https://api.botlist.co/v1/bots/:id/stats",
        "api_field": "server_count",
        "view_bot": "https://botlist.co/bots/:id",
    },"discord.services": {
        "name": "Discord Services",
        "api_post": "https://api.discord.services/v1/bots/:id/stats",
        "api_field": "server_count",
        "view_bot": "https://discord.services/bot/:id",
    },"botlist.me": {"webhook": {"header": "authorization", "voterField": "id", "eventField": None}},"top.gg": {"webhook": {"header": "Authorization", "voterField": "user", "eventField": "type"}}
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
