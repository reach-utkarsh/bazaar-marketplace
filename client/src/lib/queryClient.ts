import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, errorMessage } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
    mutationCache: new MutationCache({
      // Mutations surface errors as toasts unless they opt out with meta.silent.
      onError: (err, _vars, _ctx, mutation) => {
        if (!mutation.meta?.silent) toast.error(errorMessage(err));
      },
    }),
  });
}
