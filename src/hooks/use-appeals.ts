import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAppeals,
  fetchDashboard,
  fetchReferences,
  patchAppeal,
  uploadExcel,
  type AppealPatch,
} from '@/lib/api'

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
}

export function useAppeals() {
  return useQuery({ queryKey: ['appeals'], queryFn: fetchAppeals })
}

export function useReferences() {
  return useQuery({ queryKey: ['references'], queryFn: fetchReferences })
}

function useInvalidateAppeals() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['appeals'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function usePatchAppeal() {
  const invalidate = useInvalidateAppeals()
  return useMutation({
    mutationFn: (body: AppealPatch) => patchAppeal(body),
    onSuccess: invalidate,
  })
}

export function useUploadExcel() {
  const invalidate = useInvalidateAppeals()
  return useMutation({
    mutationFn: (file: File) => uploadExcel(file),
    onSuccess: invalidate,
  })
}
