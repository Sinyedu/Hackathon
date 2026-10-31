import { PairCard, Upload } from '../components/StartPanels'
import Verdict, { Questions } from '../components/Verdict'
import type { Session } from '../services/session'
import type { Reconciliation } from '../types/reconciliation'

interface Props { session: Session; result: Reconciliation | null; refresh: (id: string) => Promise<void>; onError: (message: string) => void; isDock?: boolean }

/** The full comparison: both documents, evidence, claim and recovery. Also the dock phone's view. */
export default function DetailsPage({ session, result, refresh, onError, isDock = false }: Props) {
  if (!result) {
    return <>
      {!isDock && <div className="intro"><h1>Nothing compared yet.</h1><p>Add both documents here, or ask the agent to open your files.</p></div>}
      <div className="start">
        <Upload session={session} isDock={isDock} onError={onError} />
        {!isDock && <PairCard session={session} />}
      </div>
    </>
  }
  return <>
    <Questions session={session} result={result} refresh={refresh} onError={onError} />
    <Verdict key={result.id} session={session} result={result} refresh={refresh} onError={onError} isDock={isDock} />
  </>
}
