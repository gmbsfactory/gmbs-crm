import React from 'react'
// Vitest (legacy JSX runtime) requiert React sur le scope global
globalThis.React = React
import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { StatusReasonModal } from '@/components/shared/StatusReasonModal'

const noop = () => {}

afterEach(() => {
  // Éviter toute pollution du body entre les tests
  document.body.style.pointerEvents = ''
  document.body.style.overflow = ''
})

describe('StatusReasonModal — filet anti-gel au démontage', () => {
  it('restaure body.pointerEvents / overflow si démonté alors qu\'il était ouvert', () => {
    const { unmount } = render(
      <StatusReasonModal open type="archive" onConfirm={noop} onCancel={noop} />,
    )

    // Simule le verrou que Radix pose sur <body> quand un Dialog modal est ouvert,
    // et qui reste coincé si le composant est démonté en plein vol.
    document.body.style.pointerEvents = 'none'
    document.body.style.overflow = 'hidden'

    // Démontage brutal (comme quand la ligne du tableau disparaît après archivage).
    unmount()

    expect(document.body.style.pointerEvents).toBe('')
    expect(document.body.style.overflow).toBe('')
  })

  it('ne modifie pas le body si le modal n\'a jamais été ouvert', () => {
    const { unmount } = render(
      <StatusReasonModal open={false} type="archive" onConfirm={noop} onCancel={noop} />,
    )

    document.body.style.pointerEvents = 'none'
    unmount()

    // wasOpen=false → le filet ne doit pas s'activer.
    expect(document.body.style.pointerEvents).toBe('none')
  })
})
