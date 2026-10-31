import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatPanel } from '../chat/ChatPanel';
import { useChat } from '../chat/use-chat';
import { useMascotState } from '../mascot/use-mascot-state';
import { useVoiceState } from '../mascot/use-voice-state';
import '../styles/tokens.css';

function Panel() {
  const chat = useChat();
  const { state } = useMascotState();
  const voice = useVoiceState();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      window.kiwi.stopAll();
      window.kiwi.panel.hide();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <ChatPanel
      state={state}
      micActive={voice.micOn}
      voice={{ engineNote: voice.engineNote, devices: voice.devices, latencies: voice.latencies }}
      messages={chat.messages}
      busy={chat.busy}
      confirming={chat.pending !== null}
      onSend={chat.send}
      onConfirm={chat.confirm}
      onUndo={chat.undo}
      onCancel={chat.cancel}
    />
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
