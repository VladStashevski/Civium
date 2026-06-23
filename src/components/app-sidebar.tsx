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
              <div className="ml-auto flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={appealsRoute}
                      search={{ mode: 'chiefDoctor' }}
                      aria-label="Обращения на имя главного врача, 07/19"
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        !isPos &&
                          appealMode === 'chiefDoctor' &&
                          'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
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
                        'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        !isPos &&
                          appealMode === 'external' &&
                          'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
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
                        'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isPos &&
                          'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
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
