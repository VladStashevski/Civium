import type { ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { AppealMode } from '@/lib/api'

export type NavItem = {
  title: string
  url:
    | '/'
    | '/appeals'
    | '/references'
    | '/slides'
    | '/experiments'
    | '/pos'
    | '/pos-table'
  icon?: ReactNode
}

function isNavItemActive(item: NavItem, pathname: string) {
  if (item.url === '/') return pathname === '/'

  return pathname === item.url || pathname.startsWith(`${item.url}/`)
}

export function NavMain({
  items,
  mode,
}: {
  items: NavItem[]
  mode: AppealMode
}) {
  const { pathname } = useLocation()
  const activeUrl = items.find((item) => isNavItemActive(item, pathname))?.url

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = activeUrl === item.url

            return (
              <SidebarMenuItem key={item.title} className="w-fit max-w-full">
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                  className="w-fit max-w-full transition-[background-color,color,font-weight] duration-250 ease-out motion-reduce:transition-none"
                >
                  <Link
                    to={item.url}
                    search={{ mode }}
                    activeOptions={{ exact: item.url === '/' }}
                    activeProps={{ 'data-active': 'true' }}
                    style={{ fontWeight: isActive ? 600 : 440 }}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
