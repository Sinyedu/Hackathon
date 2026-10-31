import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FileSlot from './FileSlot'
import StatusBadge from './StatusBadge'
import Tabs from './Tabs'

describe('StatusBadge', () => {
  it.each([
    ['ready', 'Ready for approval'],
    ['needs_review', 'Needs review'],
    ['approved', 'Approved'],
    ['failed', 'Failed'],
  ])('labels %s', (status, label) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows an unknown status as-is rather than hiding it', () => {
    render(<StatusBadge status="weird" />)
    expect(screen.getByText('weird')).toBeInTheDocument()
  })
})

describe('Tabs', () => {
  const tabs = [{ id: 'a', label: 'Compare' }, { id: 'b', label: 'Originals', dot: true }]

  it('marks the active tab and reports clicks', async () => {
    const onChange = vi.fn()
    render(<Tabs tabs={tabs} value="a" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'Compare' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: /Originals/ }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('flags tabs that need attention', () => {
    render(<Tabs tabs={tabs} value="a" onChange={() => {}} />)
    expect(screen.getByLabelText('needs attention')).toBeInTheDocument()
  })
})

describe('FileSlot', () => {
  it('offers camera and file choices when empty', () => {
    render(<FileSlot title="Purchase order" hint="hint" file={null} onChange={() => {}} disabled={false} />)
    expect(screen.getByRole('button', { name: /scan with camera/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /choose file/i })).toBeEnabled()
  })

  it('disables choices while busy', () => {
    render(<FileSlot title="Purchase order" hint="hint" file={null} onChange={() => {}} disabled />)
    expect(screen.getByRole('button', { name: /choose file/i })).toBeDisabled()
  })

  it('shows the chosen file and lets the user remove it', async () => {
    const onChange = vi.fn()
    const file = new File(['x'], 'po.pdf', { type: 'application/pdf' })
    render(<FileSlot title="Purchase order" hint="hint" file={file} onChange={onChange} disabled={false} />)
    expect(screen.getByText('po.pdf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Purchase order' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('previews images', () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    const file = new File(['x'], 'po.png', { type: 'image/png' })
    render(<FileSlot title="Purchase order" hint="hint" file={file} onChange={() => {}} disabled={false} />)
    expect(screen.getByAltText('Purchase order preview')).toHaveAttribute('src', 'blob:preview')
  })

  it('passes a picked file to onChange', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileSlot title="Purchase order" hint="hint" file={null} onChange={onChange} disabled={false} />)
    const input = container.querySelector('input[type=file]:not([capture])') as HTMLInputElement
    const file = new File(['x'], 'dn.png', { type: 'image/png' })
    await userEvent.upload(input, file)
    expect(onChange).toHaveBeenCalledWith(file)
  })
})
