import { useAuth } from "./AuthContext";

/**
 * Action-level permissions for portal actions.
 * The DB enforces RLS; these flags are UI-side defense-in-depth so non-admins
 * never see (or successfully click) admin-only actions.
 */
export type Action =
  | "customers.create"
  | "customers.update"
  | "customers.delete"
  | "users.assign_customer"
  | "users.change_role"
  | "users.reset_password"
  | "products.create"
  | "products.update"
  | "products.delete"
  | "products.import_csv"
  | "contracts.create"
  | "contracts.update"
  | "contracts.delete"
  | "softone.configure"
  | "softone.sync";

/**
 * Returns a `can(action)` helper based on the current user's roles.
 * Currently: admin → all actions; everyone else → read-only.
 * Extend the matrix below as new roles get write capabilities.
 */
export function usePermissions() {
  const { isAdmin, roles } = useAuth();

  const can = (action: Action): boolean => {
    if (isAdmin) return true;

    // customer_admin: future scope (managing own users in own customer).
    // For now, no write actions outside of admin role.
    if (roles.includes("customer_admin")) {
      return false;
    }
    return false;
  };

  return { can, isAdmin, roles };
}

/** Reason text shown when a non-admin tries to perform an admin action. */
export const NO_PERMISSION_MESSAGE =
  "Δεν έχετε δικαίωμα για αυτή την ενέργεια. Απαιτείται ρόλος Portal Admin.";