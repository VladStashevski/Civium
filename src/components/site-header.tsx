import { useLocation } from '@tanstack/react-router'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { UploadExcelButton } from '@/components/upload-excel-button'
import { UploadPosExcelButton } from '@/components/pos-upload-excel-button'
import { PrintSlidesButton } from '@/components/print-slides-button'

const TITLES: Record<string, string> = {
  '/': 'Дашборд',
  '/appeals': 'Все обращения',
  '/references': 'Справочники',
  '/slides': 'Слайды',
  '/pos': 'Дашборд ПОС',
  '/pos-table': 'Сообщения ПОС',
}

export function SiteHeader() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Civium'

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        {pathname === '/appeals' && (
          <div className="ml-auto">
            <UploadExcelButton />
          </div>
        )}
        {pathname === '/pos-table' && (
          <div className="ml-auto">
            <UploadPosExcelButton />
          </div>
        )}
        {pathname === '/slides' && (
          <div className="ml-auto">
            <PrintSlidesButton />
          </div>
        )}
      </div>
    </header>
  )
}
