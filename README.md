# garza-tools

GARZA OS Notion Worker — custom tools and data syncs for Notion agents.

## Tools

| Tool | Sprint | Description | API |
|------|--------|-------------|-----|
| `healthCheck` | 0 | Ping key endpoints, return UP/DOWN + latency | HTTP HEAD |
| `tailscaleDevices` | 1 | List all devices on the tailnet | Tailscale |
| `tailscaleDNS` | 1 | Get DNS nameserver config | Tailscale |
| `tailscaleDeviceStatus` | 1 | Get detailed status for one device | Tailscale |
| `githubFetchFile` | 1 | Fetch file contents from a repo | GitHub |
| `githubRepoInfo` | 1 | Get repo metadata | GitHub |
| `githubListRepos` | 1 | List repos for an org/user | GitHub |
| `scrapeURL` | 1 | Fetch and extract text from web page | HTTP |
| `summarizeText` | 1 | Prepare text for agent summarization | Local |
| `getCustomerStatus` | 3 | Look up Nomad customer by email | Chargebee |
| `checkRefundEligibility` | 3 | Check 90-day refund eligibility | Chargebee |
| `sendSMS` | 3 | Send text message via Twilio | Twilio |

## Setup

```bash
# Install CLI
npm i -g ntn

# Login
ntn login

# Set secrets
ntn workers env set TAILSCALE_API_KEY=...
ntn workers env set GITHUB_TOKEN=...
ntn workers env set CHARGEBEE_API_KEY=...
ntn workers env set CHARGEBEE_SITE=nomad-internet
ntn workers env set TWILIO_ACCOUNT_SID=...
ntn workers env set TWILIO_AUTH_TOKEN=...
ntn workers env set TWILIO_PHONE_NUMBER=...

# Test locally
ntn workers exec healthCheck --local

# Deploy
ntn workers deploy
```

## Architecture

Part of GARZA OS — see Notion workspace for full adoption plan and architecture docs.
