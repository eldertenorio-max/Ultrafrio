import { useEffect } from 'react'

/** Impede rolagem do painel e da sidebar enquanto um modal está aberto. */
export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return

    const root = document.documentElement
    root.classList.add('scroll-locked')

    return () => {
      root.classList.remove('scroll-locked')
    }
  }, [active])
}
