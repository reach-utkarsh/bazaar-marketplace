import { Route, Routes } from 'react-router';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminPayoutsPage from './pages/admin/AdminPayoutsPage';
import AdminRefundsPage from './pages/admin/AdminRefundsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminVendorsPage from './pages/admin/AdminVendorsPage';
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
import ProductFormPage from './pages/vendor/ProductFormPage';
import VendorLayout from './pages/vendor/VendorLayout';
import VendorOrdersPage from './pages/vendor/VendorOrdersPage';
import VendorOverviewPage from './pages/vendor/VendorOverviewPage';
import VendorPayoutsPage from './pages/vendor/VendorPayoutsPage';
import VendorProductsPage from './pages/vendor/VendorProductsPage';

export default function App() {
  return (
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
  );
}
