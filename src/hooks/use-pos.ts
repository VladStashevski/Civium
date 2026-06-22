import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPos,
  patchPos,
  uploadPosExcel,
  type PosMessage,
  type PosPatch,
  type PosResponse,
} from '@/lib/api'
import { syncPosAnnotationTimestamps } from '../../scripts/pos-annotations.mjs'

export function usePos() {
  return useQuery({
    queryKey: ['pos'],
    queryFn: fetchPos,
  })
}

export function usePatchPos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PosPatch) => patchPos(body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['pos'] })
      const snapshots = qc.getQueriesData<PosResponse>({ queryKey: ['pos'] })
      qc.setQueriesData<PosResponse>({ queryKey: ['pos'] }, (current) =>
        applyOptimisticPosPatch(current, body),
      )
      return { snapshots }
    },
    onError: (_error, _body, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
    },
    onSuccess: ({ item }) => {
      qc.setQueriesData<PosResponse>({ queryKey: ['pos'] }, (current) =>
        replacePosInCache(current, item),
      )
    },
  })
}

function applyOptimisticPosPatch(
  current: PosResponse | undefined,
  patch: PosPatch,
): PosResponse | undefined {
  if (!current) return current
  return {
    ...current,
    items: current.items.map((item) =>
      item.uid === patch.uid ? applyPosManualPatch(item, patch) : item,
    ),
  }
}

function replacePosInCache(
  current: PosResponse | undefined,
  message: PosMessage,
): PosResponse | undefined {
  if (!current) return current
  return {
    ...current,
    items: current.items.map((item) =>
      item.uid === message.uid ? { ...item, ...message } : item,
    ),
  }
}

function applyPosManualPatch(message: PosMessage, patch: PosPatch): PosMessage {
  const now = new Date().toISOString()
  const manualFields = { ...(message.manualFields ?? {}) }

  if (patch.isJustified === null) {
    delete manualFields.isJustified
  } else if (patch.isJustified !== undefined) {
    manualFields.isJustified = patch.isJustified
  }

  for (const key of ['notes', 'issues'] as const) {
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

  syncPosAnnotationTimestamps(manualFields, now)

  return { ...message, manualFields }
}

export function useUploadPosExcel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadPosExcel(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos'] }),
  })
}
