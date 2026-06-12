import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
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
  url: '/' | '/appeals' | '/references' | '/slides'
  icon?: ReactNode
}

export function NavMain({
  items,
  mode,
}: {
  items: NavItem[]
  mode: AppealMode
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title} className="w-fit max-w-full">
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                className="w-fit max-w-full"
              >
                <Link
                  to={item.url}
                  search={{ mode }}
                  activeOptions={{ exact: item.url === '/' }}
                  activeProps={{ 'data-active': 'true' }}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
