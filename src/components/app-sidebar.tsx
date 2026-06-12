import * as React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
  BuildingsIcon,
  ChartBarIcon,
  DatabaseIcon,
  ListIcon,
  PresentationChartIcon,
  SquaresFourIcon,
  StethoscopeIcon,
} from '@phosphor-icons/react'

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

const data = {
  user: {
    name: 'Аналитик',
    email: 'dashboard@civium.local',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'Дашборд',
      url: '/',
      icon: <SquaresFourIcon />,
    },
    {
      title: 'Обращения',
      url: '/appeals',
      icon: <ListIcon />,
    },
    {
      title: 'Справочники',
      url: '/references',
      icon: <DatabaseIcon />,
    },
    {
      title: 'Слайды',
      url: '/slides',
      icon: <PresentationChartIcon />,
    },
  ] satisfies NavItem[],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname, search } = useLocation()
  const appealMode: AppealMode =
    pathname === '/appeals' && search.mode === 'external'
      ? 'external'
      : search.mode === 'external'
        ? 'external'
        : 'chiefDoctor'
  const currentRoute =
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
                  <ChartBarIcon
                    className="size-5! text-primary"
                    weight="duotone"
                  />
                  <span className="text-base font-semibold">Civium</span>
                </Link>
              </SidebarMenuButton>
              <div className="ml-auto flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={currentRoute}
                      search={{ mode: 'chiefDoctor' }}
                      aria-label="Обращения на имя главного врача, 07/19"
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
                      to={currentRoute}
                      search={{ mode: 'external' }}
                      aria-label="Внешние обращения, 07- и 01-"
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} mode={appealMode} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
