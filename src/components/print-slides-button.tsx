import { PrinterIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export function PrintSlidesButton() {
  const print = () => {
    document.body.dataset.print = 'slides'
    const cleanup = () => {
      delete document.body.dataset.print
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    // let the print attribute apply before opening the dialog
    setTimeout(() => window.print(), 50)
  }

  return (
    <Button variant="outline" size="sm" onClick={print}>
      <PrinterIcon />
      Распечатать слайды
    </Button>
  )
}
