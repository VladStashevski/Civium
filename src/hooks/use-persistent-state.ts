import * as React from 'react'

// Все ключи живут под одним префиксом, чтобы не путаться с чужими записями
// localStorage и легко вычищать настройки приложения скопом.
const PREFIX = 'civium:'

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    // битый JSON / приватный режим — откатываемся на значение по умолчанию
    return fallback
  }
}

/**
 * useState, синхронизированный с localStorage. API совпадает с useState, поэтому
 * подставляется на место обычного состояния без правки обработчиков.
 *
 * Ключ может меняться по ходу жизни компонента (например, режим таблицы зашит в
 * ключ, а сам компонент при смене режима не перемонтируется) — тогда значение
 * нового ключа перечитывается СИНХРОННО в рендере, без кадра со старым стейтом.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(() => read(key, defaultValue))
  const [prevKey, setPrevKey] = React.useState(key)

  if (key !== prevKey) {
    setPrevKey(key)
    setState(read(key, defaultValue))
  }

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(state))
    } catch {
      // переполнение квоты / приватный режим — настройку просто не сохраняем
    }
  }, [key, state])

  return [state, setState]
}
