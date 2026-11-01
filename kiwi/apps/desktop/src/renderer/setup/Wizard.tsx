import { useState } from 'react';
import { useSettings } from '../chat/use-settings';
import { useSetup } from './use-setup';

const SELF_TEST_MS = 10_000;

function ModelsStep() {
  const { status, progress, pull, refresh } = useSetup();
  const { change } = useSettings();
  if (!status) return <p>Checking your computer…</p>;
  if (!status.ollamaRunning) {
    return (
      <>
        <p>Kiwi uses Ollama to think locally. It is not running yet.</p>
        <p>
          Install it from <strong>ollama.com/download</strong>, start it, then check again. Simple
          commands like “open github” work without it.
        </p>
        <button className="btn" type="button" onClick={refresh}>
          Check again
        </button>
      </>
    );
  }
  const wanted = [...new Set(Object.values(status.recommended))];
  return (
    <>
      <p>
        You have {status.ramGb} GB of memory. Recommended models: {wanted.join(', ')}.
      </p>
      <ul className="wizard-models">
        {wanted.map((model) => {
          const installed = status.installedModels.includes(model);
          const item = progress[model];
          return (
            <li key={model}>
              <span>{model}</span>
              {installed ? (
                <span>Installed</span>
              ) : item?.error ? (
                <span role="alert">{item.error}</span>
              ) : item ? (
                <progress
                  max={100}
                  value={item.percent ?? undefined}
                  aria-label={`Downloading ${model}`}
                />
              ) : (
                <button className="btn btn--small" type="button" onClick={() => pull(model)}>
                  Download
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        className="btn btn--ghost"
        type="button"
        onClick={() =>
          change({
            fastModel: status.recommended.fast,
            planningModel: status.recommended.planning,
            visionModel: status.recommended.vision,
          })
        }
      >
        Use the recommended models
      </button>
    </>
  );
}

function SelfTest() {
  const [result, setResult] = useState<'idle' | 'running' | 'pass' | 'fail'>('idle');
  const run = (): void => {
    setResult('running');
    const stop = window.kiwi.onAgentEvent((event) => {
      if (event.type === 'receipt' && event.status === 'DONE') finish('pass');
      if (event.type === 'receipt' && event.status === 'FAILED') finish('fail');
    });
    const timer = setTimeout(() => finish('fail'), SELF_TEST_MS);
    function finish(outcome: 'pass' | 'fail'): void {
      clearTimeout(timer);
      stop();
      setResult(outcome);
    }
    window.kiwi.chat.send('open github');
  };
  return (
    <>
      <p>Self-test: Kiwi will say “open github” to itself. A browser tab will open.</p>
      <button className="btn" type="button" onClick={run} disabled={result === 'running'}>
        {result === 'running' ? 'Testing…' : 'Run self-test'}
      </button>
      {result === 'pass' && <p role="status">It worked.</p>}
      {result === 'fail' && (
        <p role="alert">That did not work within 10 seconds. Check the chat for the reason.</p>
      )}
    </>
  );
}

export function Wizard({ onDone }: { onDone: () => void }) {
  const { settings, change } = useSettings();
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Welcome',
      body: <p>Hi, I'm Kiwi. Let's get you set up. It takes a minute and you can skip any step.</p>,
    },
    { title: 'Models', body: <ModelsStep /> },
    {
      title: 'Voice',
      body: settings && (
        <>
          <p>
            To say “Hey Kiwi”, allow the microphone. A “Mic” badge shows whenever I listen. Audio is
            never saved.
          </p>
          <label>
            <input
              type="checkbox"
              checked={settings.wakeWord}
              onChange={(e) => change({ wakeWord: e.target.checked })}
            />
            Turn on “Hey Kiwi”
          </label>
          <p>
            Open Kiwi with <kbd>{settings.panelShortcut}</kbd>; tap to talk with{' '}
            <kbd>{settings.talkShortcut}</kbd>.
          </p>
        </>
      ),
    },
    { title: 'Self-test', body: <SelfTest /> },
  ];
  const current = steps[step];
  const last = step === steps.length - 1;
  const finish = (): void => {
    change({ setupDone: true });
    onDone();
  };

  return (
    <section className="wizard" aria-label="First-run setup">
      <h2>
        {current?.title}{' '}
        <small>
          ({step + 1}/{steps.length})
        </small>
      </h2>
      {current?.body}
      <div className="panel-actions">
        <button className="btn btn--ghost" type="button" onClick={finish}>
          Skip setup
        </button>
        {step > 0 && (
          <button className="btn btn--ghost" type="button" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button className="btn" type="button" onClick={last ? finish : () => setStep(step + 1)}>
          {last ? 'Finish' : 'Next'}
        </button>
      </div>
    </section>
  );
}
