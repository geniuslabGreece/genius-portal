import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
  /** If true, allows admin OR customer_admin. */
  requireOrgAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false, requireOrgAdmin = false }: Props) => {
  const { user, isAdmin, isCustomerAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Φόρτωση...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/portal" replace />;
  }
  if (requireOrgAdmin && !isAdmin && !isCustomerAdmin) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
