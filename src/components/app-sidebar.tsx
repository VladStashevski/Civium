import * as React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
  BuildingsIcon,
  ChatsCircleIcon,
  DatabaseIcon,
  FlaskIcon,
  ListIcon,
  PresentationChartIcon,
  SquaresFourIcon,
  StethoscopeIcon,
} from '@phosphor-icons/react'

import { CiviumLogo } from '@/components/civium-logo'
import { NavMain, type NavItem } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AppealMode } from '@/lib/api'

const user = {
  name: 'Аналитик',
  email: 'dashboard@civium.local',
  avatar: '/avatars/shadcn.jpg',
}

// Левое меню зависит от выбранной в шапке базы: обращения vs ПОС.
const appealsNav: NavItem[] = [
  { title: 'Дашборд', url: '/', icon: <SquaresFourIcon /> },
  { title: 'Обращения', url: '/appeals', icon: <ListIcon /> },
  { title: 'Справочники', url: '/references', icon: <DatabaseIcon /> },
  { title: 'Слайды', url: '/slides', icon: <PresentationChartIcon /> },
  { title: 'Экспериментальные функции', url: '/experiments', icon: <FlaskIcon /> },
]

const posNav: NavItem[] = [
  { title: 'Дашборд', url: '/pos', icon: <SquaresFourIcon /> },
  { title: 'Сообщения', url: '/pos-table', icon: <ListIcon /> },
]

const sourceToggleButtonClass =
  'relative z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-300 ease-out motion-reduce:transition-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

const sourceToggleActiveClass =
  'text-sidebar-primary-foreground hover:bg-transparent hover:text-sidebar-primary-foreground'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname, search } = useLocation()
  const isPos = pathname === '/pos' || pathname === '/pos-table'
  const appealMode: AppealMode =
    search.mode === 'external' ? 'external' : 'chiefDoctor'
  // Куда ведут иконки обращений: остаёмся на текущем разделе обращений, а из базы
  // ПОС возвращаемся на дашборд обращений.
  const appealsRoute =
    pathname === '/appeals' ||
    pathname === '/references' ||
    pathname === '/slides'
      ? pathname
      : '/'
  const sourceToggleActiveIndex = isPos
    ? 2
    : appealMode === 'external'
      ? 1
      : 0

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <SidebarMenuButton
                asChild
                className="w-fit max-w-full data-[slot=sidebar-menu-button]:p-1.5!"
              >
                <Link to="/" search={{ mode: appealMode }}>
                  <CiviumLogo className="size-5! text-primary" />
                  <span className="text-base font-semibold">Civium</span>
                </Link>
              </SidebarMenuButton>
              <div className="relative ml-auto flex items-center gap-0.5">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 z-0 size-7 rounded-md bg-sidebar-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{
                    transform: `translate3d(calc(${sourceToggleActiveIndex} * (1.75rem + 0.125rem)), 0, 0)`,
                  }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={appealsRoute}
                      search={{ mode: 'chiefDoctor' }}
                      aria-label="Обращения на имя главного врача, 07/19"
                      className={cn(
                        sourceToggleButtonClass,
                        !isPos &&
                          appealMode === 'chiefDoctor' &&
                          sourceToggleActiveClass,
                      )}
                    >
                      <StethoscopeIcon className="size-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    На имя главного врача (07/19)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={appealsRoute}
                      search={{ mode: 'external' }}
                      aria-label="Внешние обращения, 07- и 01-"
                      className={cn(
                        sourceToggleButtonClass,
                        !isPos &&
                          appealMode === 'external' &&
                          sourceToggleActiveClass,
                      )}
                    >
                      <BuildingsIcon className="size-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Внешние обращения (07-/01-)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/pos"
                      search={{ mode: appealMode }}
                      aria-label="Платформа обратной связи (ПОС)"
                      className={cn(
                        sourceToggleButtonClass,
                        isPos && sourceToggleActiveClass,
                      )}
                    >
                      <ChatsCircleIcon className="size-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    ПОС — «Госуслуги. Решаем вместе»
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={isPos ? posNav : appealsNav} mode={appealMode} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
