# Kiwi Windows demo

1. Double-click Kiwi-Portable-0.1.0.exe. The lime mascot appears above the taskbar on the right.
2. Move the pointer around the desktop. All eye layers track it; Kiwi breathes and blinks.
3. Click Kiwi. The dark chat card expands; ask “What can you do?”.
4. Ask “open GitHub and YouTube”, then “what time is it?”. These are deterministic desktop commands.
5. Ask a general question. qwen3:1.7b streams a reply; Kiwi speaks with the selected Windows voice.
6. Click the microphone, say “open calculator”, click again. The local speech sidecar recognizes the recording.
7. In settings, enable wake listening. Say “Hey Kiwi, set a one minute timer” or “Hey Kiwi, open GitHub”. The wake phrase and request belong in the same utterance.
8. Toggle synthesized blips, ask a short question, then try Ctrl+Shift+. to stop. Ctrl+Shift+Space opens/toggles recording.
9. Try “build a coffee shop landing page”. Inspect the confirmations. Only a new local HTML project can be saved; the builder cannot run arbitrary shell commands.
10. Collapse the panel. Use the tray menu to pause listening, show, mute or quit Kiwi.

Fallbacks: use typing if speech model/microphone is unavailable; use known fast commands if Ollama is offline. Settings has model/endpoint/key controls and a speech-model download action. Restarting clears the in-memory conversation. Do not rehearse using credentials, real invoices, private clipboard contents or other people's messages.
