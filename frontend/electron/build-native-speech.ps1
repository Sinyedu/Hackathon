$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speechAssembly = [System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location
$outputDirectory = Join-Path $PSScriptRoot '..\build\speech'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$outputFile = Join-Path $outputDirectory 'kiwi-listen.exe'
if (Test-Path -LiteralPath $outputFile) { Remove-Item -LiteralPath $outputFile }
Add-Type -TypeDefinition (Get-Content -Raw (Join-Path $PSScriptRoot 'native-speech.cs')) -ReferencedAssemblies @($speechAssembly, 'System.Core.dll') -OutputAssembly $outputFile -OutputType ConsoleApplication
Write-Output "Built $outputFile"
