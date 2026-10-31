export default function Stamp({ children, tone = 'problem' }: { children: React.ReactNode; tone?: 'problem' | 'ok' | 'approved' }) {
  return <span className={`stamp stamp--${tone}`}>{children}</span>
}
