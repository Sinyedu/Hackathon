$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$fixtureDirectory = Join-Path $PSScriptRoot '..\fixtures\voice'
New-Item -ItemType Directory -Force -Path $fixtureDirectory | Out-Null
$fixturePath = Join-Path $fixtureDirectory 'hey-kiwi-open-github.wav'
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice.SetOutputToWaveFile($fixturePath)
  $voice.Speak('Hey Kiwi, open GitHub.')
} finally { $voice.Dispose() }
Write-Output $fixturePath
