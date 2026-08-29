import { useEffect, useState } from 'react'

/**
 * A temporary read-out of what the page, the document and the viewport each
 * think their heights are, so a scroll that stalls on a phone can be measured
 * instead of guessed at.
 *
 * Development only — mounted from main.jsx behind `import.meta.env.DEV`, so it
 * can never reach the deployed site. Delete it once the stall is understood.
 */
export default function ScrollProbe() {
  const [lines, setLines] = useState([])

  useEffect(() => {
    let frame = 0
    let peak = 0

    const read = () => {
      frame = 0
      const doc = document.documentElement
      const vv = window.visualViewport
      const shell = document.querySelector('.page-shell')
      const inner = document.querySelector('.page-inner')
      const last = inner?.lastElementChild ?? null
      const style = getComputedStyle(doc)

      const y = Math.round(window.scrollY)
      const max = Math.round(doc.scrollHeight - window.innerHeight)
      peak = Math.max(peak, y)

      const box = (el) =>
        el ? `${Math.round(el.getBoundingClientRect().height)}h @${Math.round(el.getBoundingClientRect().bottom + window.scrollY)}` : '—'

      setLines([
        `y ${y}  max ${max}  left ${max - y}  peak ${peak}`,
        `doc scroll ${doc.scrollHeight}  client ${doc.clientHeight}`,
        `body scroll ${document.body.scrollHeight}  offset ${document.body.offsetHeight}`,
        `inner ${window.innerHeight}  vv ${vv ? Math.round(vv.height) : '—'} top ${vv ? Math.round(vv.offsetTop) : '—'}`,
        `shell ${box(shell)}`,
        `inner-el ${box(inner)}`,
        `last ${last?.className || '?'} ${box(last)}`,
        `html of ${style.overflowX}/${style.overflowY} osb ${style.overscrollBehaviorY}`,
        `scroller ${document.scrollingElement === doc ? 'html' : (document.scrollingElement?.tagName ?? '?')}`,
      ])
    }

    const onEvent = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }

    read()
    window.addEventListener('scroll', onEvent, { passive: true })
    window.addEventListener('resize', onEvent)
    window.visualViewport?.addEventListener('resize', onEvent)
    window.visualViewport?.addEventListener('scroll', onEvent)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onEvent)
      window.removeEventListener('resize', onEvent)
      window.visualViewport?.removeEventListener('resize', onEvent)
      window.visualViewport?.removeEventListener('scroll', onEvent)
    }
  }, [])

  return (
    <pre
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        margin: 0,
        padding: '4px 6px',
        background: 'rgba(0, 0, 0, 0.82)',
        color: '#5cff8a',
        font: '600 10px/1.35 ui-monospace, Menlo, Consolas, monospace',
        whiteSpace: 'pre',
        pointerEvents: 'none',
      }}
    >
      {lines.join('\n')}
    </pre>
  )
}
