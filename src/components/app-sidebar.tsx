import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  ChartBarIcon,
  DatabaseIcon,
  ListIcon,
  PresentationChartIcon,
  SquaresFourIcon,
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
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/">
                <ChartBarIcon className="size-5!" weight="duotone" />
                <span className="text-base font-semibold">Civium</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
