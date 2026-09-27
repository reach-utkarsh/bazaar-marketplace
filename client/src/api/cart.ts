import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { Address, Cart, Order, PaymentInit } from '../lib/types';

export const cartKey = ['cart'] as const;

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: cartKey,
    queryFn: () => api<Cart>('/cart'),
    enabled: user?.role === 'CUSTOMER',
  });
}

function useCartMutation<V>(fn: (vars: V) => Promise<Cart>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (cart) => qc.setQueryData(cartKey, cart) });
}

export const useAddToCart = () =>
  useCartMutation((v: { productId: string; quantity: number }) => api<Cart>('/cart/items', { method: 'POST', body: v }));

export const useUpdateCartItem = () =>
  useCartMutation((v: { productId: string; quantity: number }) =>
    api<Cart>(`/cart/items/${v.productId}`, { method: 'PATCH', body: { quantity: v.quantity } }),
  );

export const useRemoveCartItem = () =>
  useCartMutation((productId: string) => api<Cart>(`/cart/items/${productId}`, { method: 'DELETE' }));

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (address: Address) => api<{ order: Order; payment: PaymentInit }>('/orders/checkout', { method: 'POST', body: { address } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKey });
      qc.invalidateQueries({ queryKey: ['catalog'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
