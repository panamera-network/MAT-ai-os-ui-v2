import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IAmMatButton } from './IAmMatButton'

describe('IAmMatButton', () => {
  it('calls onClick when pressed', () => {
    const onClick = vi.fn()
    render(<IAmMatButton active={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'I AM MAT' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('reflects active state via aria-pressed', () => {
    const { rerender } = render(<IAmMatButton active={false} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'I AM MAT' })).toHaveAttribute('aria-pressed', 'false')
    rerender(<IAmMatButton active onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'I AM MAT' })).toHaveAttribute('aria-pressed', 'true')
  })
})
