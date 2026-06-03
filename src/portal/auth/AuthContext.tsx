import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "customer_admin" | "customer_user";

export interface ProfileWithCustomer {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  customer_id: string | null;
  provider: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: ProfileWithCustomer | null;
  roles: Role[];
  isAdmin: boolean;
  isCustomerAdmin: boolean;
  /** All customer_ids this user has admin access to (mapping table + profile fallback). */
  adminCustomerIds: string[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileWithCustomer | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [adminCustomerIds, setAdminCustomerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (uid: string) => {
    const [{ data: profileData }, { data: rolesData }, { data: mappingData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_customer_admins").select("customer_id").eq("user_id", uid),
    ]);
    setProfile((profileData as ProfileWithCustomer) ?? null);
    const userRoles = ((rolesData ?? []) as { role: Role }[]).map((r) => r.role);
    setRoles(userRoles);
    const ids = new Set<string>(((mappingData ?? []) as { customer_id: string }[]).map((r) => r.customer_id));
    // Legacy: customer_admin via profile.customer_id
    if (userRoles.includes("customer_admin") && (profileData as any)?.customer_id) {
      ids.add((profileData as any).customer_id);
    }
    setAdminCustomerIds(Array.from(ids));
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid deadlock inside the callback
        setTimeout(() => loadProfileAndRoles(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadProfileAndRoles(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setAdminCustomerIds([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isAdmin: roles.includes("admin"),
        isCustomerAdmin: roles.includes("customer_admin") || adminCustomerIds.length > 0,
        adminCustomerIds,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
