import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Bookings from "./pages/Bookings";
import bookmeLogo from "./assets/BookMe_logo.png";
import SalonDetails from "./pages/SalonDetails";
import Login from "./pages/Login";
import MyBookings from "./pages/MyBookings";
import Register from "./pages/Register";
import AddReview from "./pages/AddReview";
import AdminPanel from "./pages/AdminPanel";
import OwnerPanel from "./pages/OwnerPanel";
import RequireRole from "./components/RequireRole";
import Schedule from "./pages/Schedule";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  const location = useLocation();
  const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password"].includes(
    location.pathname
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      {!isAuthPage && (
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-teal-200/70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.35),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(249,115,22,0.28),_transparent_55%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,rgba(148,163,184,0.25)_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>
      )}

      {isAuthPage ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <>
          <header className="sticky top-0 z-20">
            <div className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-4 sm:pt-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/60 px-3 py-3 shadow-sm backdrop-blur sm:rounded-3xl sm:px-5 sm:py-4">
                <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
                  <img
                    src={bookmeLogo}
                    alt="BookME logo"
                    className="h-12 w-12 rounded-2xl object-contain shadow-sm sm:h-14 sm:w-14"
                  />
                  <div className="min-w-0 text-sm font-semibold leading-tight text-slate-900 sm:text-lg">
                    BookME - System rezerwacji wizyt
                  </div>
                </Link>

                <Navbar />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur sm:rounded-3xl sm:p-6">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/add-review" element={<AddReview />} />
                <Route
                  path="/admin"
                  element={
                    <RequireRole roles={["ADMIN"]}>
                      <AdminPanel />
                    </RequireRole>
                  }
                />
                <Route
                  path="/owner"
                  element={
                    <RequireRole roles={["OWNER", "ADMIN"]}>
                      <OwnerPanel />
                    </RequireRole>
                  }
                />
                <Route
                  path="/schedule"
                  element={
                    <RequireRole roles={["OWNER", "ADMIN"]}>
                      <Schedule />
                    </RequireRole>
                  }
                />
                <Route path="/salons/:id" element={<SalonDetails />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </>
      )}
    </div>
  );
}
