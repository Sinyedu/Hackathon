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

# Clearly labelled synthetic phrases for button-free wake/follow-up diagnostics.
foreach ($entry in @(@('hey-kiwi-time.wav', 'Hey Kiwi. What time is it?'), @('ordinary-talk.wav', 'We should take a walk after lunch. The weather looks nice today.'))) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try { $synth.SetOutputToWaveFile((Join-Path $fixtureDirectory $entry[0])); $synth.Speak($entry[1]) } finally { $synth.Dispose() }
}
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synth.SetOutputToWaveFile((Join-Path $fixtureDirectory 'hey-kiwi-then-time.wav'))
  $prompt = New-Object System.Speech.Synthesis.PromptBuilder
  $prompt.AppendText('Hey Kiwi.')
  $prompt.AppendBreak([TimeSpan]::FromMilliseconds(1800))
  $prompt.AppendText('What time is it?')
  $synth.Speak($prompt)
} finally { $synth.Dispose() }
