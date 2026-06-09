import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Bell,
  LogOut,
  Server,
  Cpu,
  Briefcase,
  Smartphone,
  ShieldCheck,
  Building2,
  User,
  KeyRound,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/geniusnet-logo.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/portal/auth/AuthContext";
import {
  useContracts,
  useCurrentCustomer,
  useNotifications,
  useMarkNotificationRead,
  countActiveByCategory,
} from "@/portal/data/hooks";
import { Category } from "@/portal/data/types";

const navItems: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  category?: Category;
  adminOnly?: boolean;
  customerAdminOnly?: boolean;
}> = [
  { to: "/portal", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/portal/assistant", label: "AI Σύμβουλος", icon: Sparkles },
  { to: "/portal/software", label: "Software", icon: Package, category: "software" },
  { to: "/portal/hardware", label: "Hardware", icon: Server, category: "hardware" },
  { to: "/portal/erp", label: "ERP", icon: Briefcase, category: "erp" },
  { to: "/portal/devices", label: "Devices", icon: Smartphone, category: "devices" },
  { to: "/portal/support", label: "Υποστήριξη", icon: LifeBuoy },
  { to: "/portal/my-roles", label: "Οι ρόλοι μου", icon: KeyRound },
  { to: "/portal/org-admin", label: "Διαχείριση οργανισμού", icon: Building2, customerAdminOnly: true },
  { to: "/portal/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];


export default function PortalLayout() {
  const navigate = useNavigate();
  const { profile, isAdmin, isCustomerAdmin, signOut } = useAuth();
  const { data: customer } = useCurrentCustomer();
  const { data: contracts = [] } = useContracts(profile?.customer_id);
  const { data: notifs = [] } = useNotifications(profile?.customer_id);
  const markRead = useMarkNotificationRead();

  const unread = notifs.filter((n) => !n.read).length;
  const visibleNav = navItems.filter((n) => {
    if (n.adminOnly) return isAdmin;
    if (n.customerAdminOnly) return isCustomerAdmin && !isAdmin;
    return true;
  });
  const initials = (profile?.full_name ?? profile?.email ?? "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          <button onClick={() => navigate("/portal")} className="flex items-center gap-3">
            <img src={logo} alt="GeniusNet" className="h-9 w-auto" />
            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Customer Portal
              </span>
              <span className="text-sm font-semibold text-foreground">
                {customer?.name ?? (profile?.customer_id ? "..." : "Δεν έχετε ανατεθεί σε εταιρεία")}
              </span>
            </div>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Ειδοποιήσεις</p>
                    <p className="text-xs text-muted-foreground">{unread} μη αναγνωσμένες</p>
                  </div>
                </div>
                <div className="max-h-96 divide-y divide-border overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Δεν υπάρχουν ειδοποιήσεις.
                    </div>
                  ) : (
                    notifs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.read) markRead.mutate(n.id);
                          if (n.contract_id) navigate(`/portal/contracts/${n.contract_id}`);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/60",
                          !n.read && "bg-accent/5",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            n.type === "expiring_7" || n.type === "expired"
                              ? "bg-brand-red"
                              : n.type === "expiring_30"
                                ? "bg-amber-500"
                                : "bg-accent",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-foreground">{n.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden text-left text-sm leading-tight md:block">
                    <span className="block font-medium">{profile?.full_name ?? "Χρήστης"}</span>
                    <span className="block text-xs text-muted-foreground">{profile?.email}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Ο λογαριασμός μου</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/portal/account")}>
                  <User className="mr-2 h-4 w-4" />
                  Στοιχεία λογαριασμού
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Αποσύνδεση
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="sticky top-24 flex flex-col gap-1">
            {visibleNav.map((item) => {
              const count = item.category ? countActiveByCategory(contracts, item.category) : null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {count !== null && (
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-[1.25rem] justify-center bg-background/20 px-1.5 text-[10px] group-[.bg-primary]:bg-white/20 group-[.bg-primary]:text-white"
                    >
                      {count}
                    </Badge>
                  )}
                </NavLink>
              );
            })}

            {customer?.account_manager_name && (
              <div className="mt-8 rounded-xl border border-border bg-card p-4 shadow-soft">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Account Manager
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {customer.account_manager_name}
                </p>
                {customer.account_manager_email && (
                  <a
                    href={`mailto:${customer.account_manager_email}`}
                    className="mt-1 block text-xs text-accent hover:underline"
                  >
                    {customer.account_manager_email}
                  </a>
                )}
                {customer.account_manager_phone && (
                  <a href={`tel:${customer.account_manager_phone}`} className="text-xs text-muted-foreground">
                    {customer.account_manager_phone}
                  </a>
                )}
              </div>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
