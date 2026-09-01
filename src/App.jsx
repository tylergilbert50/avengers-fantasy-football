import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import coverImg from './assets/cover.jpg'
import { createPageCurl } from './lib/pageCurl'
import { createTapRecognizer } from './lib/tap.js'
import { prefetchAll } from './hooks/useEspn.js'
import { warmPortraits } from './lib/portraits.js'
import StandingsPage from './components/StandingsPage.jsx'
import RecordsPage from './components/RecordsPage.jsx'
import DraftPage from './components/DraftPage.jsx'
import ChampionsPage from './components/ChampionsPage.jsx'
import PollPage from './components/PollPage.jsx'
import SchedulePage from './components/SchedulePage.jsx'
import HistoryPage from './components/HistoryPage.jsx'
import ManagersPage from './components/ManagersPage.jsx'
import ManagerPage from './components/ManagerPage.jsx'
import TradesPage from './components/TradesPage.jsx'
import WaiversPage from './components/WaiversPage.jsx'
import './App.css'

import championsImg from './assets/panel-champions.webp'
import managersImg from './assets/panel-managers.webp'
import standingsImg from './assets/panel-standings.webp'
import recordsImg from './assets/panel-records.webp'
import managersPollImg from './assets/panel-managers-poll.webp'
import draftHistoryImg from './assets/panel-draft-history.webp'
import scheduleImg from './assets/panel-schedule.webp'
import historySheetImg from './assets/panel-history-sheet.webp'
import tradeHistoryImg from './assets/panel-trade-history.webp'
import waiverHistoryImg from './assets/panel-waiver-history.webp'

import championsColorImg from './assets/panel-champions-color.webp'
import managersColorImg from './assets/panel-managers-color.webp'
import standingsColorImg from './assets/panel-standings-color.webp'
import recordsColorImg from './assets/panel-records-color.webp'
import managersPollColorImg from './assets/panel-managers-poll-color.webp'
import draftHistoryColorImg from './assets/panel-draft-history-color.webp'
import scheduleColorImg from './assets/panel-schedule-color.webp'
import historySheetColorImg from './assets/panel-history-sheet-color.webp'
import tradeHistoryColorImg from './assets/panel-trade-history-color.webp'
import waiverHistoryColorImg from './assets/panel-waiver-history-color.webp'

// The page behind the cover, laid out from the ten panel cutouts.
//
// `rect` places each cutout — including the transparent margin baked into the
// PNG, which is why the boxes start slightly outside the visible panel and
// overlap their neighbours. The numbers were measured off the original
// full-page artwork so the assembled page matches it panel for panel, and they
// are percentages of the page, so the layout holds at any size.
//
// `clip` is that panel's outline within its own box. The panels are slanted,
// so without it a button's rectangle would cover part of its neighbour and
// swallow clicks meant for it — clip-path trims the hit area to the artwork's
// real shape, not just its bounding box. Each outline is the panel's four
// corners pushed out slightly, far enough that no artwork is cut off.
const PANELS = [
  { id: 'champions', label: 'Champions', to: 'champions', src: championsImg, color: championsColorImg, rect: { left: '0.70%', top: '0.18%', width: '45.13%', height: '40.34%' }, clip: 'polygon(1.03% 1.12%, 97.67% 1.04%, 81.06% 99.42%, 0.94% 99.39%)' },
  { id: 'managers', label: 'Managers', to: 'managers', src: managersImg, color: managersColorImg, rect: { left: '41.61%', top: '0.34%', width: '57.92%', height: '20.24%' }, clip: 'polygon(6.71% 1.67%, 99.31% 0.94%, 99.31% 95.36%, 0.22% 97.38%)' },
  { id: 'standings', label: 'Standings', to: 'standings', src: standingsImg, color: standingsColorImg, rect: { left: '37.70%', top: '20.02%', width: '62.14%', height: '20.50%' }, clip: 'polygon(6.14% 3.14%, 98.78% 1.15%, 98.79% 98.08%, 0.27% 98.43%)' },
  { id: 'records', label: 'Records', to: 'records', src: recordsImg, color: recordsColorImg, rect: { left: '0.20%', top: '39.18%', width: '38.58%', height: '23.24%' }, clip: 'polygon(2.62% 6.70%, 97.42% 6.20%, 81.31% 99.24%, 2.52% 97.39%)' },
  { id: 'managers-poll', label: "Managers' Poll", to: 'managers-poll', src: managersPollImg, color: managersPollColorImg, rect: { left: '31.70%', top: '40.11%', width: '36.73%', height: '23.13%' }, clip: 'polygon(18.91% 2.20%, 98.69% 2.09%, 81.08% 97.25%, 1.93% 95.68%)' },
  { id: 'draft-history', label: 'Draft History', to: 'draft-history', src: draftHistoryImg, color: draftHistoryColorImg, rect: { left: '61.72%', top: '40.19%', width: '37.58%', height: '23.26%' }, clip: 'polygon(18.92% 1.65%, 98.82% 1.60%, 98.92% 98.07%, 1.54% 96.24%)' },
  { id: 'schedule', label: 'Schedule', to: 'schedule', src: scheduleImg, color: scheduleColorImg, rect: { left: '0.23%', top: '62.06%', width: '54.01%', height: '20.19%' }, clip: 'polygon(1.46% 1.70%, 99.00% 4.84%, 90.23% 97.44%, 1.38% 98.55%)' },
  { id: 'history-sheet', label: 'History Sheet', to: 'history-sheet', src: historySheetImg, color: historySheetColorImg, rect: { left: '48.90%', top: '62.97%', width: '50.56%', height: '19.01%' }, clip: 'polygon(10.57% 0.43%, 99.01% 3.09%, 99.01% 97.46%, 1.13% 98.78%)' },
  { id: 'trade-history', label: 'Trade History', to: 'trade-history', src: tradeHistoryImg, color: tradeHistoryColorImg, rect: { left: '0.47%', top: '81.98%', width: '48.54%', height: '17.38%' }, clip: 'polygon(1.29% 3.43%, 99.36% 2.13%, 90.73% 99.44%, 1.13% 99.39%)' },
  { id: 'waiver-history', label: 'Waiver History', to: 'waiver-history', src: waiverHistoryImg, color: waiverHistoryColorImg, rect: { left: '44.98%', top: '81.36%', width: '54.32%', height: '18.43%' }, clip: 'polygon(8.04% 5.25%, 99.44% 4.17%, 99.37% 96.93%, 0.13% 96.89%)' },
]

/**
 * How far through the turn the panels come alive. The cover has cleared the
 * page by here and all that is left is it drifting off, so the page is fully
 * readable — but it is late enough that nothing can be pressed before the cover
 * has actually been turned. Short of 1 on purpose: a scroll that stops a
 * whisker from the bottom should not leave the page dead.
 */
const PAGE_LIVE_AT = 0.92

/**
 * @param {boolean} coverTurned  the cover has already been turned this visit,
 *   so open straight onto the page — no cover, no scroll-driven turn.
 */
function ComicBook({ onOpen, coverTurned }) {
  const stageRef = useRef(null)
  const bookRef = useRef(null)
  const canvasRef = useRef(null)

  // The panels sit underneath the cover the whole way through the turn, and
  // both the cover sheet and the WebGL canvas are pointer-events: none — so
  // without this they can be clicked, and tabbed to, straight through it.
  // Arriving with the cover already turned starts them live.
  const [pageLive, setPageLive] = useState(coverTurned)

  // Opening a panel is driven off the pointer rather than left to `click`
  // alone — see src/lib/tap.js for why a touch screen can decline to produce
  // one, which is what made panels need tapping twice.
  const tap = useMemo(
    () =>
      createTapRecognizer((panel) => {
        if (panel.to) onOpen(panel.to)
      }),
    [onOpen],
  )

  // Which panel is under a finger right now, and the only thing that paints the
  // pressed look.
  //
  // `:active` would be the obvious way to write this, but on a touch screen the
  // press states the browser owns — :active, an emulated :hover, focus — can
  // outlive the panel that earned them and get handed to the fresh one that
  // takes its place on the way back. React state can't: coming back mounts a
  // new ComicBook and this starts at null, so the page always arrives cold.
  const [pressed, setPressed] = useState(null)

  // Cleared from the window rather than the panel, so a release that lands
  // somewhere else still ends the press: a finger that slides off the artwork
  // before lifting, a mouse released outside, or a touch the browser takes back
  // for a scroll.
  useEffect(() => {
    if (pressed == null) return undefined
    const clear = () => setPressed(null)
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
      window.removeEventListener('pointerup', clear)
      window.removeEventListener('pointercancel', clear)
    }
  }, [pressed])

  useEffect(() => {
    // Nothing to drive when the cover isn't there: no sheet to peel, no canvas
    // to draw it on, and no scroll distance to read a turn out of.
    if (coverTurned) return undefined

    const stage = stageRef.current
    const book = bookRef.current
    const canvas = canvasRef.current
    if (!stage || !book || !canvas) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let curl = null
    let frame = 0
    let cancelled = false

    // Measured against the document's own scroll range rather than a vh-based
    // guess, so the turn starts at exactly 0 at the top and reaches exactly 1
    // at the bottom — no leftover scroll on either side, whatever a mobile
    // address bar is doing to the viewport height.
    const readProgress = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const y = window.scrollY || doc.scrollTop || 0
      const raw = max > 0 ? y / max : 1
      return Math.min(1, Math.max(0, raw))
    }

    const update = () => {
      frame = 0
      const progress = readProgress()
      stage.style.setProperty('--p', progress.toFixed(4))
      stage.classList.toggle('is-done', progress > 0.995)
      // Cheap to call every frame: React drops the update when the value is
      // unchanged, so this only re-renders on the one frame it flips.
      setPageLive(progress > PAGE_LIVE_AT)
      if (curl) curl.setProgress(progress)
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    const onResize = () => {
      if (curl) curl.resize()
      onScroll()
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    // The DOM cover stays up until WebGL is ready, so there is never a flash of
    // a missing page. Reduced motion keeps the plain CSS turn instead.
    if (!reduced) {
      const image = new Image()
      image.src = coverImg
      const start = () => {
        if (cancelled) return
        const measure = () => {
          const stageBox = stage.getBoundingClientRect()
          const bookBox = book.getBoundingClientRect()
          return {
            width: stageBox.width,
            height: stageBox.height,
            pageWidth: bookBox.width,
            pageHeight: bookBox.height,
          }
        }
        curl = createPageCurl(canvas, image, measure)
        if (!curl) return // no WebGL — the CSS turn stays in place
        stage.classList.add('is-gl')
        update()
      }
      const decoded = image.decode ? image.decode() : Promise.resolve()
      decoded.then(start, () => {
        if (image.complete) start()
        else image.addEventListener('load', start, { once: true })
      })
    }

    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(onResize)
      observer.observe(book)
    }

    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (observer) observer.disconnect()
      if (curl) curl.destroy()
    }
  }, [coverTurned])

  return (
    <div className={`track${coverTurned ? ' is-open' : ''}`}>
      <div
        className="stage"
        ref={stageRef}
        // With no turn to drive it, --p is pinned to its finished value so the
        // page reads as fully uncovered.
        style={coverTurned ? { '--p': 1 } : undefined}
      >
        <div className="book" ref={bookRef}>
          {/* The page underneath — revealed as the cover peels off it */}
          <div className="sheet sheet-under">
            {/* `inert` rather than pointer-events alone: it takes the panels out
                of the tab order and out of the accessibility tree too, so the
                cover can't be bypassed with a keyboard or a screen reader
                either. */}
            <div className="page" inert={!pageLive}>
              {PANELS.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  className={`panel${pressed === panel.id ? ' is-pressed' : ''}`}
                  style={{ ...panel.rect, clipPath: panel.clip }}
                  data-panel={panel.id}
                  onPointerDown={(event) => {
                    setPressed(panel.id)
                    tap.pointerDown(event)
                  }}
                  onPointerUp={(event) => {
                    // The press is over and the panel is about to be replaced by
                    // the page it opens. Dropping focus here means there is no
                    // focused panel for the browser to restore this view to.
                    event.currentTarget.blur()
                    tap.pointerUp(event, panel)
                  }}
                  onPointerCancel={(event) => {
                    setPressed(null)
                    tap.pointerCancel(event)
                  }}
                  onClick={() => tap.click(panel)}
                >
                  <img className="panel-art" src={panel.src} alt="" />
                  <img className="panel-art panel-art-color" src={panel.color} alt="" />
                  <span className="sr-only">{panel.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Flat cover: what you see before WebGL takes over, and the
              fallback turn when WebGL or motion isn't available */}
          {!coverTurned && (
            <div className="sheet sheet-cover">
              <img className="cover" src={coverImg} alt="The Avengers Assembled comic book cover" />
              <div className="cover-shade" />
            </div>
          )}
        </div>

        {!coverTurned && <canvas className="curl-canvas" ref={canvasRef} aria-hidden="true" />}

        {!coverTurned && (
          <div className="scroll-hint" aria-hidden="true">
            {/* Both verbs ship; the phone breakpoint picks one. The gesture is
                the same scroll either way, so this is wording, not behaviour. */}
            <span>
              <span className="hint-verb-pointer">Scroll</span>
              <span className="hint-verb-touch">Swipe</span> to turn the page
            </span>
            <span className="chevron" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Which view is on screen, kept in the URL hash.
 *
 * The hash rather than a path so the static host needs no rewrite rules, and
 * through history so the browser's back button leaves a standings page the same
 * way the on-page button does.
 */
const VIEWS = new Set(['standings', 'records', 'draft-history', 'champions', 'managers-poll', 'schedule', 'history-sheet', 'managers', 'trade-history', 'waiver-history'])

/**
 * The one view that carries something with it: `#/managers/brett-gilbert` is a
 * manager's own page, and the slug is how it knows whose.
 */
function readHash() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [head, ...rest] = hash.split('/')

  if (head === 'managers' && rest.length > 0 && rest[0]) {
    return { view: 'manager', slug: rest.join('/') }
  }
  return { view: VIEWS.has(hash) ? hash : 'comic', slug: null }
}

function App() {
  const [route, setRoute] = useState(readHash)
  const { view, slug } = route

  // Turning the cover is an arrival, not navigation — you do it once on the way
  // in and coming back from a page shouldn't ask for it again. Held in plain
  // state on purpose, with nothing persisted: a reload or a new visit starts a
  // new arrival and the cover is closed again.
  const [coverTurned, setCoverTurned] = useState(false)

  useEffect(() => {
    const onPop = () => setRoute(readHash())
    window.addEventListener('hashchange', onPop)
    return () => window.removeEventListener('hashchange', onPop)
  }, [])

  // Every payload the site draws is warmed the moment the app boots, while the
  // cover is still being turned. Turning it and reading the panels is several
  // seconds; a fetch is under one. Spending the arrival on them is what lets
  // every page open on its content instead of on a loading line.
  useEffect(() => {
    prefetchAll()
    warmPortraits()
  }, [])

  const open = useCallback((next) => {
    // Leaving the comic means the cover is already behind you. Recorded here
    // rather than when the turn finishes, so it can't flip mid-view and take
    // the cover off the screen while it's still being read.
    if (next !== 'comic') setCoverTurned(true)
    window.location.hash = next === 'comic' ? '' : `/${next}`
    setRoute(readHash())
  }, [])

  // The comic drives its page turn off document scroll, so a scroll position
  // carried over from the other view would land it mid-turn. Both views start
  // at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  if (view === 'standings') {
    return <StandingsPage />
  }

  if (view === 'records') {
    return <RecordsPage />
  }

  if (view === 'draft-history') {
    return <DraftPage />
  }

  if (view === 'champions') {
    return <ChampionsPage />
  }

  if (view === 'managers-poll') {
    return <PollPage />
  }

  if (view === 'schedule') {
    return <SchedulePage />
  }

  if (view === 'history-sheet') {
    return <HistoryPage />
  }

  if (view === 'trade-history') {
    return <TradesPage />
  }

  if (view === 'waiver-history') {
    return <WaiversPage />
  }

  if (view === 'managers') {
    return <ManagersPage onOpen={open} />
  }

  if (view === 'manager') {
    return <ManagerPage slug={slug} />
  }

  return <ComicBook onOpen={open} coverTurned={coverTurned} />
}

export default App
