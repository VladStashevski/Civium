import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAppeals,
  fetchDashboard,
  fetchReferences,
  fetchSession,
  login,
  patchAppeal,
  uploadExcel,
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
