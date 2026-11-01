# Kiwi Windows demo

1. Install Kiwi with the newest `Kiwi-Setup-*.exe` and leave **Launch Kiwi** enabled. The lime mascot appears above the taskbar on the right, with "Hey Kiwi · mic on" once the listener is ready.
2. Move the pointer around the desktop. All eye layers track it; Kiwi breathes and blinks.
3. Click Kiwi. The dark chat card expands; ask “What can you do?”.
4. Ask “open GitHub and YouTube”, then “what time is it?”. These are deterministic desktop commands.
5. Ask a general question. qwen3:1.7b streams a reply; Kiwi speaks with the selected Windows voice.
6. Say “Hey Kiwi” without clicking anything. Wait for the moving speaker and “I’m listening…”, then say “open calculator”. Provisional words appear below the mascot; the completed command is checked locally before running.
7. Try “Hey Kiwi, set a one minute timer” in one utterance, then “Hey Kiwi” followed by a separate “what time is it?”. Wake listening is on by default; settings/tray can pause it.
8. Toggle synthesized blips, ask a short question, then try Ctrl+Shift+. to stop. Ctrl+Shift+Space opens/toggles recording.
9. Try “build a coffee shop landing page”. Inspect the confirmations. Only a new local HTML project can be saved; the builder cannot run arbitrary shell commands.
10. Collapse the panel. Use the tray menu to pause listening, show, mute or quit Kiwi.

Fallbacks: use typing if speech model/microphone is unavailable; use known fast commands if Ollama is offline. Settings has model/endpoint/key controls and a speech-model download action. Restarting clears the in-memory conversation. Do not rehearse using credentials, real invoices, private clipboard contents or other people's messages.
