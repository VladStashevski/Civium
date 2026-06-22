import { createFileRoute } from '@tanstack/react-router'
import { PosDashboard } from '@/components/pos-dashboard'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

// База ПОS — отдельная от обращений. /pos = дашборд, /pos-table = таблица.
// validateSearch принимает (и игнорирует) ?mode=, чтобы общий переключатель
// режима/базы в шапке не ломал ссылку.
export const Route = createFileRoute('/pos')({
  validateSearch: parseAppealModeSearch,
  component: PosDashboard,
})
