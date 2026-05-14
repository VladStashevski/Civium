import { BarChart3, LayoutDashboard } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Аналитик',
    email: 'dashboard@civium.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Civium',
      logo: BarChart3,
      plan: 'Обращения граждан',
    },
  ],
  navGroups: [
    {
      title: 'Статистика',
      items: [
        {
          title: 'Дашборд',
          url: '/',
          icon: LayoutDashboard,
        },
      ],
    },
  ],
}
