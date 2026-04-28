import { BrowserRouter, Navigate, Route, Routes, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import CategoryListing from "./pages/CategoryListing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Account from "./pages/Account";
import Wishlist from "./pages/Wishlist";
import Trending from "./pages/Trending";
import Shop from "./pages/Shop";
import Orders from "./pages/Orders";
import ProductDetail from "./pages/ProductDetail";
import Admin from "./pages/Admin";
import Layout from "./Layout";
import { createPageUrl } from "./lib/pages";
import ErrorBoundary from "./components/ErrorBoundary";

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container">
        <div className="section">
          <p className="p">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={createPageUrl("Login")} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="section">
          <p className="p">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={createPageUrl("Home")} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path={createPageUrl("Home")} element={<Home />} />
              <Route path={createPageUrl("CategoryListing")} element={<CategoryListing />} />
              <Route path={createPageUrl("Shop")} element={<Shop />} />
              <Route path={createPageUrl("Trending")} element={<Trending />} />
              <Route path={createPageUrl("ProductDetail")} element={<ProductDetail />} />
              <Route path={createPageUrl("Cart")} element={<Cart />} />
              <Route path={createPageUrl("Wishlist")} element={<Wishlist />} />
              <Route element={<RequireAuth />}>
                <Route path={createPageUrl("Checkout")} element={<Checkout />} />
                <Route path={createPageUrl("Account")} element={<Account />} />
                <Route path={createPageUrl("Orders")} element={<Orders />} />
                <Route path={createPageUrl("Admin")} element={<Admin />} />
              </Route>
            </Route>
            <Route
              path={createPageUrl("Login")}
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path={createPageUrl("Signup")}
              element={
                <RedirectIfAuthed>
                  <Signup />
                </RedirectIfAuthed>
              }
            />
            <Route path="*" element={<Navigate to={createPageUrl("Home")} replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AuthProvider>
  );
}
