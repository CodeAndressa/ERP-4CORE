// Menu em árvore com galhos desenhados até o item ativo. Porte para TypeScript do BranchedMenu do React Bits (MIT),
// adaptado ao Lastro: itens são links de verdade (href + navegação pelo onSelect), o ativo é controlado pela rota
// (`value`), a seção do item ativo abre sozinha, cada item aceita um complemento à direita (código, ponto de etapa)
// e o ícone é qualquer elemento React (lucide-react no projeto). Sem Hugeicons e sem itens de exemplo.
import { isValidElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import './BranchedMenu.css'

export interface ItemRamo { value: string; label: ReactNode; href?: string; icon?: ReactNode; extra?: ReactNode; title?: string }
export interface SecaoRamo { label: string; value?: string; href?: string; children?: ItemRamo[] }

const PAD = 6
const MARK = 16

const renderIcon = (icon: ReactNode) => (isValidElement(icon) ? icon : null)
const toSet = (open: number | number[]) => new Set(Array.isArray(open) ? open : open >= 0 ? [open] : [])
/** As seções abertas são guardadas pela chave (value ou label), não pela posição: a lista pode crescer depois. */
const chave = (it: SecaoRamo) => it.value ?? it.label
/** Clique comum navega pelo app; com Ctrl/Shift/meio, o navegador abre o link como sempre. */
const cliqueComum = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export interface PropsBranchedMenu {
  items: SecaoRamo[]
  /** item ativo (controlado, ex.: a rota atual); sem ele, o menu guarda o seu próprio */
  value?: string
  defaultActive?: string
  defaultOpen?: number | number[]
  onSelect?: (value: string, item: ItemRamo | SecaoRamo) => void
  onToggle?: (index: number, open: boolean) => void
  color?: string
  mutedColor?: string
  accentColor?: string
  activeColor?: string
  lineColor?: string
  rowHeight?: number
  indent?: number
  trunk?: number
  radius?: number
  lineWidth?: number
  fontSize?: number
  drawDuration?: number
  foldDuration?: number
  className?: string
}

export default function BranchedMenu({
  items, value, defaultActive = '', defaultOpen = 0, onSelect, onToggle,
  color = '#FFFFFF', mutedColor = '#C3CDF2', accentColor = '#40EB4F', activeColor = '#FFFFFF', lineColor = '#2A3B78',
  rowHeight = 34, indent = 34, trunk = 10, radius = 9, lineWidth = 1.5, fontSize = 13,
  drawDuration = 400, foldDuration = 300, className = '',
}: PropsBranchedMenu) {
  const [open, setOpen] = useState(() => new Set([...toSet(defaultOpen)].map((i) => items[i]).filter(Boolean).map(chave)))
  const [proprio, setProprio] = useState(defaultActive)
  const active = value ?? proprio
  const raizRef = useRef<HTMLDivElement>(null)
  const heads = useRef<(HTMLElement | null)[]>([])
  const markerRef = useRef<HTMLSpanElement>(null)
  const latest = useRef({ onSelect, onToggle })
  latest.current = { onSelect, onToggle }

  const activeSection = items.findIndex((it) => it.children?.some((kid) => kid.value === active))
  // a seção do item ativo abre sozinha quando a rota muda
  const chaveAtiva = activeSection >= 0 ? chave(items[activeSection]) : null
  useEffect(() => {
    if (!chaveAtiva) return
    setOpen((prev) => (prev.has(chaveAtiva) ? prev : new Set(prev).add(chaveAtiva)))
  }, [chaveAtiva])

  const markerShown = !!chaveAtiva && open.has(chaveAtiva)
  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const m = markerRef.current
      const el = heads.current[activeSection]
      if (!m) return
      const on = markerShown && el
      if (!glide) m.style.transition = 'none'
      if (on) m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`
      m.toggleAttribute('data-on', Boolean(on))
      if (!glide) { void m.offsetHeight; m.style.transition = '' }
    }
    place(true)
    let first = true
    const ro = new ResizeObserver(() => { if (first) { first = false; return } place(false) })
    if (raizRef.current) ro.observe(raizRef.current)
    return () => ro.disconnect()
  }, [activeSection, markerShown, items, fontSize, rowHeight])

  const select = (v: string, item: ItemRamo | SecaoRamo) => {
    setProprio(v)
    latest.current.onSelect?.(v, item)
  }
  const toggle = (i: number) => {
    const k = chave(items[i])
    setOpen((prev) => {
      const next = new Set(prev)
      const isOpen = !next.has(k)
      if (isOpen) next.add(k); else next.delete(k)
      latest.current.onToggle?.(i, isOpen)
      return next
    })
  }

  const r = Math.min(radius, rowHeight / 2 - 2)
  const endX = indent - 8
  const rowY = (k: number) => PAD + k * rowHeight + rowHeight / 2
  const branch = (k: number) => `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`
  const reach = (k: number) => `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`
  const length = (k: number) => rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r)

  return (
    <div ref={raizRef} className={`branched-menu${className ? ` ${className}` : ''}`}
      style={{
        '--bm-ink': color, '--bm-muted': mutedColor, '--bm-accent': accentColor, '--bm-active': activeColor, '--bm-line': lineColor,
        '--bm-font': `${fontSize}px`, '--bm-row': `${rowHeight}px`, '--bm-indent': `${indent}px`, '--bm-trunk': `${trunk}px`,
        '--bm-line-w': lineWidth, '--bm-draw': `${drawDuration}ms`, '--bm-fold': `${foldDuration}ms`,
      } as CSSProperties}>
      <span ref={markerRef} className="branched-menu__marker" aria-hidden="true" />
      {items.map((item, i) => {
        const kids = item.children
        const isOpen = kids ? open.has(chave(item)) : false
        const leafValue = item.value ?? item.label
        const leafActive = !kids && leafValue === active
        const bodyH = kids ? PAD * 2 + kids.length * rowHeight : 0
        return (
          <div key={item.value ?? item.label} className="branched-menu__section" data-open={isOpen ? '' : undefined}>
            {kids && item.href ? (
              <a ref={(el) => { heads.current[i] = el }} href={item.href} className="branched-menu__head"
                aria-expanded={isOpen} aria-current={item.value === active ? 'page' : undefined}
                data-active={item.value === active ? '' : undefined}
                onClick={(e) => {
                  if (!cliqueComum(e)) return;
                  e.preventDefault();
                  if (isOpen && item.value === active) { toggle(i); return; }
                  if (!isOpen) toggle(i);
                  select(item.value ?? item.label, item);
                }}>
                {item.label}
              </a>
            ) : kids ? (
              <button ref={(el) => { heads.current[i] = el }} type="button" className="branched-menu__head"
                aria-expanded={isOpen} onClick={() => toggle(i)}>
                {item.label}
              </button>
            ) : (
              <a ref={(el) => { heads.current[i] = el }} href={item.href} className="branched-menu__head"
                aria-current={leafActive ? 'page' : undefined} data-active={leafActive ? '' : undefined}
                onClick={(e) => { if (!cliqueComum(e)) return; e.preventDefault(); select(leafValue, item) }}>
                {item.label}
              </a>
            )}
            {kids ? (
              <div className="branched-menu__body">
                {/* `inert` tira a secao fechada da navegacao por teclado e de leitor de
                    tela. Os tipos do React aqui sao anteriores ao atributo, entao ele
                    entra pelo spread: o DOM entende, o TypeScript nao reclama, e o
                    comportamento e o mesmo. */}
                <div className="branched-menu__fold" {...(!isOpen ? { inert: '' } : {})}>
                  <div className="branched-menu__tree" style={{ height: bodyH }}>
                    <svg className="branched-menu__lines" width={indent} height={bodyH} aria-hidden="true">
                      <path className="branched-menu__base" d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`} />
                      {kids.map((kid, k) => <path key={kid.value} className="branched-menu__base" d={branch(k)} />)}
                      {kids.map((kid, k) => (
                        <path key={kid.value} className="branched-menu__reach" d={reach(k)}
                          style={{ strokeDasharray: length(k), strokeDashoffset: kid.value === active ? 0 : length(k) }} />
                      ))}
                    </svg>
                    {kids.map((kid) => {
                      const ativo = kid.value === active
                      return (
                        <a key={kid.value} href={kid.href} className="branched-menu__item" title={kid.title}
                          aria-current={ativo ? 'page' : undefined} data-active={ativo ? '' : undefined}
                          onClick={(e) => { if (!cliqueComum(e)) return; e.preventDefault(); select(kid.value, kid) }}>
                          {kid.icon ? <span className="branched-menu__icon" aria-hidden="true">{renderIcon(kid.icon)}</span> : null}
                          <span className="branched-menu__label">{kid.label}</span>
                          {kid.extra ? <span className="branched-menu__extra">{kid.extra}</span> : null}
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
