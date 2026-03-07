# GARZA Tools — Unified MCP Gateway

The single, secure entry point for all GARZA OS services, tools, and automations. Every route is exposed as an MCP tool for AI agent consumption.

## Live Endpoints

| Environment | URL |
|---|---|
| **Production** | `https://garza-tools-main-fb2210a.zuplo.app` |
| **MCP Endpoint** | `https://garza-tools-main-fb2210a.zuplo.app/mcp` |
| **Dev Portal** | `https://garza-tools-main-fb2210a.zuplo.site` |

## MCP Config

```json
{
  "garza-tools": {
    "url": "https://garza-tools-main-fb2210a.zuplo.app/mcp",
    "transport": "http",
    "headers": {
      "Authorization": "Bearer <GARZA_OS_API_KEY>"
    }
  }
}
```

## GARZA OS API Key

```
<GARZA_OS_API_KEY>
```

Consumer: `garza-os-agent` | Bucket: `production`

## 20 MCP Tools

### Zuplo API (7 tools)
- `zuplo_who_am_i` — Returns authenticated Zuplo account identity
- `zuplo_list_buckets` — Lists all API key buckets
- `zuplo_list_consumers` — Lists all API key consumers
- `zuplo_create_consumer` — Creates a new API key consumer
- `zuplo_delete_consumer` — Deletes an API key consumer
- `zuplo_list_keys` — Lists API keys for a consumer
- `zuplo_create_key` — Creates a new API key
- `zuplo_delete_key` — Deletes an API key

### n8n Automation (3 tools)
- `n8n_trigger_workflow` — Triggers an n8n workflow by ID
- `n8n_list_workflows` — Lists all active n8n workflows
- `n8n_get_executions` — Gets recent workflow executions

### GARZA Memory (2 tools)
- `garza_memory_store` — Stores a memory/fact in the GARZA OS knowledge base
- `garza_memory_recall` — Recalls stored memories/facts

### Nomad Internet (3 tools)
- `nomad_subscriber_lookup` — Looks up a Nomad subscriber by ID
- `nomad_financial_summary` — Returns Nomad Internet financial summary
- `nomad_onboard_customer` — Orchestrates full customer onboarding

### GARZA OS (5 tools)
- `garza_pulse_brief` — Returns GARZA Pulse latest execution status
- `send_telegram_alert` — Sends an alert to Jaden via Telegram
- `garza_os_status` — Health check for all GARZA OS services
- `garza_daily_brief` — Comprehensive morning intelligence brief

## Required Environment Variables

Set these in the Zuplo portal: **Settings → Environment Variables**

| Variable | Type | Value |
|---|---|---|
| `N8N_INSTANCE_URL` | Plain | `https://primary-production-f10f7.up.railway.app` |
| `N8N_API_KEY` | **Secret** | *(from vault: "n8n API Key (Manus Sandbox)")* |
| `ZUPLO_API_KEY` | **Secret** | `<ZUPLO_DEVELOPER_API_KEY>` |
| `TELEGRAM_BOT_TOKEN` | **Secret** | *(from vault: Telegram Bot Token)* |
| `TELEGRAM_CHAT_ID` | Plain | *(Jaden's Telegram chat ID)* |

## Security

- All routes protected by Zuplo API key authentication
- Rate limited: 300 req/min sustained, 30 req/10s burst
- API keys stored as encrypted Zuplo secrets
- All traffic over HTTPS/TLS

## Architecture

```
AI Agent (Manus/Claude/GPT)
    ↓ MCP Protocol (HTTP)
garza-tools.zuplo.app/mcp
    ↓ API Key Auth + Rate Limiting
    ├── Zuplo API → dev.zuplo.com
    ├── n8n Automation → railway.app
    ├── GARZA Memory → n8n webhook
    ├── Nomad Internet → n8n webhook
    └── GARZA OS → internal handlers
```
