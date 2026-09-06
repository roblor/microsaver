param(
    [ValidateSet('setup','status','remove')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$vaultTargets = [ordered]@{
    ETORO_API_KEY  = 'Microsaver/eToro/PublicApiKey'
    ETORO_USER_KEY = 'Microsaver/eToro/UserKey'
    OPENAI_API_KEY = 'Microsaver/OpenAI/ProjectApiKey'
}

function Initialize-MicrosaverCredentialApi {
    if ('MicrosaverCredentialNative' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MicrosaverCredentialNative {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public UInt32 Flags;
        public UInt32 Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }
    [DllImport("Advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);
    [DllImport("Advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);
    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);
    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr credential);
    public static byte[] ReadBlob(string target, out int error) {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer)) {
            error = Marshal.GetLastWin32Error();
            return null;
        }
        try {
            CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
            byte[] result = new byte[credential.CredentialBlobSize];
            if (result.Length > 0) { Marshal.Copy(credential.CredentialBlob, result, 0, result.Length); }
            error = 0;
            return result;
        } finally { CredFree(pointer); }
    }
}
'@
}

function Get-MicrosaverVaultSecret([string]$Name) {
    Initialize-MicrosaverCredentialApi
    $target = $vaultTargets[$Name]
    $code = 0
    $bytes = [MicrosaverCredentialNative]::ReadBlob($target, [ref]$code)
    if ($null -eq $bytes) {
        if ($code -eq 1168) { return $null }
        throw "Windows Credential Manager could not read $Name (error $code)."
    }
    try {
        if ($bytes.Length -eq 0) { return $null }
        return [Text.Encoding]::Unicode.GetString($bytes)
    } finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}

function Set-MicrosaverVaultSecret([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { throw "$Name cannot be empty." }
    Initialize-MicrosaverCredentialApi
    $targetPointer = [Runtime.InteropServices.Marshal]::StringToCoTaskMemUni($vaultTargets[$Name])
    $bytes = [Text.Encoding]::Unicode.GetBytes($Value)
    $blobPointer = [Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
    try {
        [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blobPointer, $bytes.Length)
        $credential = New-Object MicrosaverCredentialNative+CREDENTIAL
        $credential.Type = 1
        $credential.TargetName = $targetPointer
        $credential.CredentialBlobSize = $bytes.Length
        $credential.CredentialBlob = $blobPointer
        $credential.Persist = 2
        if (-not [MicrosaverCredentialNative]::CredWrite([ref]$credential, 0)) {
            throw "Windows Credential Manager could not save $Name (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))."
        }
    } finally {
        if ($blobPointer -ne [IntPtr]::Zero) {
            $zeroes = New-Object byte[] $bytes.Length
            [Runtime.InteropServices.Marshal]::Copy($zeroes, 0, $blobPointer, $zeroes.Length)
            [Runtime.InteropServices.Marshal]::FreeCoTaskMem($blobPointer)
        }
        if ($targetPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeCoTaskMem($targetPointer) }
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}

function Remove-MicrosaverVaultSecret([string]$Name) {
    Initialize-MicrosaverCredentialApi
    if (-not [MicrosaverCredentialNative]::CredDelete($vaultTargets[$Name], 1, 0)) {
        $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($code -ne 1168) { throw "Windows Credential Manager could not remove $Name (error $code)." }
    }
}

function Get-MicrosaverVaultStatus {
    $status = [ordered]@{}
    foreach ($name in $vaultTargets.Keys) { $status[$name] = -not [string]::IsNullOrEmpty((Get-MicrosaverVaultSecret $name)) }
    return [PSCustomObject]$status
}

function Read-MicrosaverVaultValue([string]$Label) {
    $secureValue = Read-Host $Label -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secureValue.Dispose() }
}

if ($MyInvocation.InvocationName -ne '.') {
    switch ($Action) {
        'setup' {
            Write-Host 'Microsaver stores these secrets in Windows Credential Manager for this Windows user.'
            $publicKey = Read-MicrosaverVaultValue 'eToro Public API Key'
            $userKey = Read-MicrosaverVaultValue 'eToro User/Private Key (Real, Read permission)'
            $openAiKey = Read-MicrosaverVaultValue 'OpenAI project API key'
            try {
                Set-MicrosaverVaultSecret 'ETORO_API_KEY' $publicKey
                Set-MicrosaverVaultSecret 'ETORO_USER_KEY' $userKey
                Set-MicrosaverVaultSecret 'OPENAI_API_KEY' $openAiKey
                Write-Host 'Saved. Keys were not displayed.'
            } finally {
                $publicKey = $null; $userKey = $null; $openAiKey = $null
            }
        }
        'status' { Get-MicrosaverVaultStatus | Format-Table -AutoSize }
        'remove' {
            foreach ($name in $vaultTargets.Keys) { Remove-MicrosaverVaultSecret $name }
            Write-Host 'Microsaver credentials removed from Windows Credential Manager.'
        }
    }
}
