import { Link, Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout-inner">
        <Link to="/" className="auth-brand">
          Steamn&apos;t
        </Link>

        <Outlet />
      </div>
    </div>
  );
}

export default AuthLayout;