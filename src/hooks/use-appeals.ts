import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAppeals,
  fetchDashboard,
  fetchReferences,
  fetchSession,
  login,
  patchAppeal,
  uploadExcel,
  type AppealMode,
  type AppealPatch,
} from '@/lib/api'

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
    queryFn: () => fetchDashboard(mode),
  })
}

export function useAppeals(mode: AppealMode) {
  return useQuery({
    queryKey: ['appeals', mode],
    queryFn: () => fetchAppeals(mode),
  })
}

export function useReferences(mode: AppealMode) {
  return useQuery({
    queryKey: ['references', mode],
    queryFn: () => fetchReferences(mode),
  })
}

function useInvalidateAppeals() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['appeals'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['references'] })
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
