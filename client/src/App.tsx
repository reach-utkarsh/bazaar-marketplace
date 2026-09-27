import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import ProtectedRoute from './auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import OrderDetailPage from './pages/account/OrderDetailPage';
import OrdersPage from './pages/account/OrdersPage';
import SellPage from './pages/account/SellPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import CartPage from './pages/shop/CartPage';
import CheckoutPage from './pages/shop/CheckoutPage';
import HomePage from './pages/shop/HomePage';
import ProductDetailPage from './pages/shop/ProductDetailPage';
import StorePage from './pages/shop/StorePage';
import { PageLoader } from './components/ui/Spinner';

// Vendor and admin areas (and Recharts) are split into their own chunks.
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminPayoutsPage = lazy(() => import('./pages/admin/AdminPayoutsPage'));
const AdminRefundsPage = lazy(() => import('./pages/admin/AdminRefundsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminVendorsPage = lazy(() => import('./pages/admin/AdminVendorsPage'));
const ProductFormPage = lazy(() => import('./pages/vendor/ProductFormPage'));
const VendorLayout = lazy(() => import('./pages/vendor/VendorLayout'));
const VendorOrdersPage = lazy(() => import('./pages/vendor/VendorOrdersPage'));
const VendorOverviewPage = lazy(() => import('./pages/vendor/VendorOverviewPage'));
const VendorPayoutsPage = lazy(() => import('./pages/vendor/VendorPayoutsPage'));
const VendorProductsPage = lazy(() => import('./pages/vendor/VendorProductsPage'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="stores/:slug" element={<StorePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="sell" element={<SellPage />} />
        <Route path="cart" element={<ProtectedRoute roles={['CUSTOMER']}><CartPage /></ProtectedRoute>} />
        <Route path="checkout" element={<ProtectedRoute roles={['CUSTOMER']}><CheckoutPage /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute roles={['CUSTOMER']}><OrdersPage /></ProtectedRoute>} />
        <Route path="orders/:id" element={<ProtectedRoute roles={['CUSTOMER']}><OrderDetailPage /></ProtectedRoute>} />

        <Route
          path="vendor"
          element={
            <ProtectedRoute approvedVendor>
              <VendorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<VendorOverviewPage />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id" element={<ProductFormPage />} />
          <Route path="orders" element={<VendorOrdersPage />} />
          <Route path="payouts" element={<VendorPayoutsPage />} />
        </Route>

        <Route
          path="admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="refunds" element={<AdminRefundsPage />} />
          <Route path="payouts" element={<AdminPayoutsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
