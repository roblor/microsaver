# Connect your accounts

## eToro
Log in to eToro and locate Settings → Trading → API Key Management. Create credentials for the **Real** environment with **Read** permission only. Copy the Public API Key and User Key. Account eligibility and menu wording may vary.

Official guide: https://builders.etoro.com/learn/authentication-and-api-keys

## OpenAI
Create a project API key at https://platform.openai.com/api-keys . Use your own project key, not your ChatGPT password. Configure API billing in the platform before enabling future analysis. Restricted keys need access to list models for the connection check; future analysis will require Responses access.

Authentication reference: https://developers.openai.com/api/reference/overview

## Save credentials locally

Run this once in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\rober\OneDrive\Documentos\ChatGPT\microsaver\Microsaver-Vault.ps1" -Action setup
```

Paste the three keys at the hidden prompts. Microsaver saves them as generic credentials in Windows Credential Manager, encrypted for your Windows user. The values are not written to the project, OneDrive, browser storage, or command history. You can verify only their presence with `-Action status`, or remove all three with `-Action remove`.

## Start Microsaver
Open PowerShell and run:

```powershell
& 'C:\Users\rober\OneDrive\Documentos\ChatGPT\microsaver\Start-Microsaver.ps1'
```

The launcher reads the credentials from Windows Credential Manager into its process memory and defaults to real read-only eToro access. Node.js 22+ is needed; the launcher can use the existing bundled Node installation.

Open http://127.0.0.1:8765 and use **Refresh portfolio** and **Check OpenAI**. Keys loaded is not the same as authentication verified. If port 8765 is occupied, stop the existing Microsaver server with Ctrl+C first. If PowerShell blocks local scripts, run this script through a one-process invocation: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\rober\OneDrive\Documentos\ChatGPT\microsaver\Start-Microsaver.ps1"`.

The OpenAI connection check only lists models. The separate Create daily review button runs paid research with web search. Settings, normalized portfolio snapshots and research history persist outside OneDrive under %LOCALAPPDATA%\Microsaver. Real-price technical indicators, reconciled equity and executable proposals remain unavailable; all orders are disabled. See README.md for the first-test checklist.

Troubleshooting: missing keys → rerun launcher; rejected credentials → replace/check keys; access denied → check environment, permissions and account access; rate limited → wait before retrying. Never paste keys into chat.
