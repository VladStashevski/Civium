import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  fetchAppeals,
  fetchDashboard,
  fetchReferences,
  fetchSession,
  login,
  patchAppeal,
  uploadExcel,
  type Appeal,
  type AppealMode,
  type AppealPatch,
  type AppealsResponse,
} from '@/lib/api'
import { syncAnnotationTimestamps } from '../../scripts/appeal-annotations.mjs'

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (session) => qc.setQueryData(['session'], session),
  })
}

export function useDashboard(mode: AppealMode) {
  return useQuery({
    queryKey: ['dashboard', mode],
    queryFn: ({ signal }) => fetchDashboard(mode, signal),
  })
}

export function useAppeals(mode: AppealMode) {
  return useQuery({
    queryKey: ['appeals', mode],
    queryFn: ({ signal }) => fetchAppeals(mode, signal),
  })
}

export function useReferences(mode: AppealMode) {
  return useQuery({
    queryKey: ['references', mode],
    queryFn: ({ signal }) => fetchReferences(mode, signal),
  })
}

async function refreshAppealQueriesAfterImport(qc: QueryClient) {
  await Promise.all([
    qc.cancelQueries({ queryKey: ['appeals'] }),
    qc.cancelQueries({ queryKey: ['dashboard'] }),
    qc.cancelQueries({ queryKey: ['references'] }),
  ])

  qc.removeQueries({ queryKey: ['appeals'], type: 'inactive' })
  qc.removeQueries({ queryKey: ['dashboard'], type: 'inactive' })
  qc.removeQueries({ queryKey: ['references'], type: 'inactive' })

  await Promise.all([
    qc.invalidateQueries({ queryKey: ['appeals'], refetchType: 'active' }),
    qc.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' }),
    qc.invalidateQueries({ queryKey: ['references'], refetchType: 'active' }),
  ])
}

export function usePatchAppeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AppealPatch) => patchAppeal(body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['appeals'] })
      const snapshots = qc.getQueriesData<AppealsResponse>({
        queryKey: ['appeals'],
      })

      qc.setQueriesData<AppealsResponse>(
        { queryKey: ['appeals'] },
        (current) => applyOptimisticAppealPatch(current, body),
      )

      return { snapshots }
    },
    onError: (_error, _body, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
    },
    onSuccess: ({ item }) => {
      qc.setQueriesData<AppealsResponse>(
        { queryKey: ['appeals'] },
        (current) => replaceAppealInCache(current, item),
      )
      qc.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'inactive' })
      qc.invalidateQueries({ queryKey: ['references'], refetchType: 'inactive' })
    },
  })
}

function applyOptimisticAppealPatch(
  current: AppealsResponse | undefined,
  patch: AppealPatch,
): AppealsResponse | undefined {
  if (!current) return current

  return {
    ...current,
    items: current.items.map((item) =>
      item.uid === patch.uid ? applyManualPatch(item, patch) : item,
    ),
  }
}

function replaceAppealInCache(
  current: AppealsResponse | undefined,
  appeal: Appeal,
): AppealsResponse | undefined {
  if (!current) return current

  return {
    ...current,
    items: current.items.map((item) =>
      item.uid === appeal.uid ? { ...item, ...appeal } : item,
    ),
  }
}

function applyManualPatch(appeal: Appeal, patch: AppealPatch): Appeal {
  const now = new Date().toISOString()
  const manualFields = { ...(appeal.manualFields ?? {}) }

  if (patch.isJustified === null) {
    delete manualFields.isJustified
  } else if (patch.isJustified !== undefined) {
    manualFields.isJustified = patch.isJustified
  }

  for (const key of ['notes', 'issues', 'inspection'] as const) {
    if (patch[key] === undefined) continue
    const value = patch[key]?.trim()
    if (value) {
      manualFields[key] = patch[key]
    } else {
      delete manualFields[key]
    }
  }

  if (patch.departments !== undefined) {
    const departments = patch.departments
      .map((department) => department.trim())
      .filter(Boolean)
    if (departments.length) {
      manualFields.departments = departments
    } else {
      delete manualFields.departments
    }
  }

  syncAnnotationTimestamps(manualFields, now)

  return { ...appeal, manualFields }
}

export function useUploadExcel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadExcel(file),
    onSuccess: () => refreshAppealQueriesAfterImport(qc),
  })
}
