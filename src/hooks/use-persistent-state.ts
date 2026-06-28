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
 * ключ, а сам компонент при смене режима не перемонтируется). Состояние хранит
 * ключ, которому оно принадлежит, чтобы при переключении режима не записать
 * старые настройки в новый localStorage-ключ.
 */
type PersistedState<T> = {
  key: string
  value: T
}

export function usePersistentState<T>(
  key: string,
  defaultValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [persisted, setPersisted] = React.useState<PersistedState<T>>(() => ({
    key,
    value: read(key, defaultValue),
  }))

  const value =
    persisted.key === key ? persisted.value : read(key, defaultValue)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (persisted.key !== key) return
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(persisted.value))
    } catch {
      // переполнение квоты / приватный режим — настройку просто не сохраняем
    }
  }, [key, persisted.key, persisted.value])

  const setState = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (updater) => {
      setPersisted((current) => {
        const currentValue =
          current.key === key ? current.value : read(key, defaultValue)
        const nextValue =
          typeof updater === 'function'
            ? (updater as (previous: T) => T)(currentValue)
            : updater
        return { key, value: nextValue }
      })
    },
    [key, defaultValue],
  )

  return [value, setState]
}
