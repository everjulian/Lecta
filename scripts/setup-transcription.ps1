param([string]$PythonPath = "")

$ErrorActionPreference = "Stop"
$runtimeDirectory = Join-Path $env:APPDATA "lecta\runtime"
$requirements = Join-Path $PSScriptRoot "..\workers\transcription-worker\requirements.txt"

if (-not $PythonPath) {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCommand) {
    $PythonPath = $pythonCommand.Source
  } else {
    throw "Python no está instalado. Instala Python 3.11 o 3.12 y vuelve a ejecutar pnpm setup:transcription."
  }
}

& $PythonPath -m venv $runtimeDirectory
$runtimePython = Join-Path $runtimeDirectory "Scripts\python.exe"
& $runtimePython -m pip install --upgrade pip
& $runtimePython -m pip install -r $requirements
Write-Output "Runtime de transcripción instalado en $runtimeDirectory"
