# Microsaver — iteration 1
Windows localhost research and daily review prototype. Node.js 22+, no npm dependencies.

## Start
Run in PowerShell:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\rober\OneDrive\Documentos\ChatGPT\microsaver\Start-Microsaver.ps1"
```
Run `Microsaver-Vault.ps1 -Action setup` once to save eToro Public + User (Private) keys with Real/Read access and an OpenAI project key in Windows Credential Manager. The launcher reads them into process memory at startup. Open http://127.0.0.1:8765.
See SETUP.md for key creation and vault management.

## First test
1. Set monthly savings in USD, then Save settings. These are planning inputs, not transferred funds.
2. Refresh portfolio. Verify the timestamp, raw broker credit and direct position count against eToro. Credit is not reconciled buying power.
3. Create daily review. Allow up to two minutes. This uses OpenAI Responses with web search and incurs API charges. It sends normalized positions, credit, eligible eToro instruments and savings amount, never API keys or account identifiers in the prompt.
4. Read inline source links, unknown evidence and portfolio implications. Mark reviewed or Skip to test the inbox. Neither action places orders.
5. Enable background mode if desired. The process checks every 30 minutes and requests research when the last review is over 12 hours old. It catches up on the next timer callback after sleep. The laptop must be awake and the launcher process running. Closing the browser does not stop monitoring; closing PowerShell does.
6. Restart and verify settings and review decisions persist.

## Implemented
- Real eToro portfolio GET adapter and sanitized authentication/network diagnostics.
- Normalized direct-position snapshot, copied-portfolio count and pending record count.
- OpenAI cited web research for prices, news, filings, earnings and economic/central-bank events. Missing coverage must be stated; search coverage is not treated as verified risk evidence.
- Local daily review inbox, monthly savings inputs, audit trail and background polling.
- Per-day research and proposal-question counters in the Europe/Madrid timezone. They are informational; failed billable attempts still count. One active run per process, at most four tool calls and 3,500 output tokens per request.
- Same-origin checks, CSRF token for local mutations, JSON request size limit, strict CSP, no telemetry and no external browser assets.
- Default gpt-5-mini; OPENAI_MODEL can override it before launch.

## Storage
Settings, normalized portfolio data, up to 30 reviews and 100 audit entries persist to %LOCALAPPDATA%\Microsaver\state.json outside OneDrive. File writes are serialized and replaced atomically. This is plain local JSON under the Windows user profile, not an encrypted vault. No credentials are persisted. Back up this file if needed. Do not run multiple Microsaver processes against the same data directory. MICROSAVER_DATA_DIR is available for isolated tests.

## Deliberately incomplete
Live generation/model access must be validated with the user's keys. Search results are research, not a verified structured market-data feed. Technical indicators are not computed from real prices yet. Equity, FX, copied holdings, instrument-name lookup and exposure reconciliation remain incomplete. Trade recommendations therefore fail closed; there are no executable buy/sell proposals or broker order endpoints. Monthly savings remain research/planning inputs. No automatic Windows startup, key persistence or family quest yet. English UI only.

## Tests
```powershell
node --test
```
Tests cover risk gates, safe keys/errors, portfolio normalization, persisted reviews, counters, concurrency, background behavior, same-origin/CSRF protection and disabled trading. API calls in automated tests are mocked; eToro/OpenAI authentication was verified separately before this iteration. Browser settings persistence was checked in an isolated no-credentials preview.

## Sources
https://builders.etoro.com/learn/authentication-and-api-keys
https://builders.etoro.com/learn/portfolio-management-and-positions
https://developers.openai.com/api/docs/guides/tools-web-search
https://developers.openai.com/api/docs/models/gpt-5-mini
