import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, orThrow, type User } from '@/api/client';

export const usersKey = ['users'] as const;

// listUsers, page by page with the API's cursor.
export function useUsers(limit = 20) {
  return useInfiniteQuery({
    queryKey: [...usersKey, { limit }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => orThrow(await api.GET('/v1/users', { params: { query: { limit, cursor: pageParam } } })),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

// createUser; the list refetches after a success.
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; displayName: string }): Promise<User> => orThrow(await api.POST('/v1/users', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}
