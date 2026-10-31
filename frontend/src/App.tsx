import LiveWorkspace from './pages/LiveWorkspace'

export default function App() {
  return <LiveWorkspace isDock={window.location.pathname === '/dock'} />
}
