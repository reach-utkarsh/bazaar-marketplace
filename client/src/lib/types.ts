export type Role = 'CUSTOMER' | 'VENDOR' | 'ADMIN';
export type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type SubOrderStatus = 'PLACED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED';
export type PayoutStatus = 'PENDING' | 'PAID';

export interface VendorSummary {
  id: string;
  storeName: string;
  slug: string;
  status: VendorStatus;
  rejectionReason?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  vendor: VendorSummary | null;
}

export interface Session {
  user: User;
  accessToken: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  avgRating: number;
  reviewCount: number;
  createdAt: string;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  vendor: { id: string; storeName: string; slug: string };
  images: ProductImage[];
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface CartLine {
  productId: string;
  quantity: number;
  lineTotal: number;
  available: boolean;
  product: Pick<Product, 'id' | 'title' | 'slug' | 'price' | 'stock' | 'isActive' | 'images'>;
}

export interface CartGroup {
  vendor: { id: string; storeName: string; slug: string };
  items: CartLine[];
  subtotal: number;
}

export interface Cart {
  groups: CartGroup[];
  itemCount: number;
  total: number;
}

export interface Address {
  shippingName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  product?: { slug: string };
}

export interface SubOrderEvent {
  id: string;
  status: SubOrderStatus;
  note: string | null;
  createdAt: string;
}

export interface RefundRequest {
  id: string;
  subOrderId: string;
  reason: string;
  amount: number;
  status: RefundStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface SubOrder {
  id: string;
  orderId: string;
  vendorId: string;
  status: SubOrderStatus;
  subtotal: number;
  commissionRateBps: number;
  commissionAmount: number;
  vendorEarnings: number;
  trackingNumber: string | null;
  carrier: string | null;
  cancelReason: string | null;
  refundedAmount: number;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  vendor?: { id: string; storeName: string; slug: string };
  items: OrderItem[];
  events?: SubOrderEvent[];
  refundRequests?: RefundRequest[];
}

export interface Order extends Address {
  id: string;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  subOrders: SubOrder[];
  customer?: { id: string; name: string; email: string };
  payment?: { provider: 'RAZORPAY' | 'MOCK'; status: string; providerOrderId: string; failureReason: string | null } | null;
}

export interface PaymentInit {
  provider: 'RAZORPAY' | 'MOCK';
  keyId: string | null;
  providerOrderId: string;
  amount: number;
  currency: string;
  orderId: string;
}

export interface Payout {
  id: string;
  vendorId: string;
  amount: number;
  status: PayoutStatus;
  reference: string | null;
  createdAt: string;
  paidAt: string | null;
  vendor?: { id: string; storeName: string };
  _count?: { subOrders: number };
}
