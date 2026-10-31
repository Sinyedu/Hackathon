export default function LiveDot({ label, active = false }: { label: string; active?: boolean }) {
  return <span className="live-status"><i className={active ? 'live-dot live-dot--active' : 'live-dot'} />{label}</span>
}
