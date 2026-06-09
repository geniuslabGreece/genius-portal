import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Login from "./portal/pages/Login.tsx";
import ResetPassword from "./portal/pages/ResetPassword.tsx";
import PortalLayout from "./portal/PortalLayout.tsx";
import Dashboard from "./portal/pages/Dashboard.tsx";
import Admin from "./portal/pages/Admin.tsx";
import Assistant from "./portal/pages/Assistant.tsx";
import Account from "./portal/pages/Account.tsx";
import MyRoles from "./portal/pages/MyRoles.tsx";
import CategoryView from "./portal/pages/CategoryView.tsx";
import ContractDetail from "./portal/pages/ContractDetail.tsx";
import CustomerContracts from "./portal/pages/CustomerContracts.tsx";
import Support from "./portal/pages/Support.tsx";
import TicketDetail from "./portal/pages/TicketDetail.tsx";
import OrgAdmin from "./portal/pages/OrgAdmin.tsx";
import { AuthProvider } from "./portal/auth/AuthContext.tsx";
import ProtectedRoute from "./portal/auth/ProtectedRoute.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/portal"
              element={
                <ProtectedRoute>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="account" element={<Account />} />
              <Route path="contracts" element={<CategoryView />} />
              <Route path="contracts/:contractId" element={<ContractDetail />} />
              <Route path="software" element={<CategoryView category="software" title="Software" />} />
              <Route path="hardware" element={<CategoryView category="hardware" title="Hardware" />} />
              <Route path="erp" element={<CategoryView category="erp" title="ERP" />} />
              <Route path="devices" element={<CategoryView category="devices" title="Devices" />} />
              <Route path="support" element={<Support />} />
              <Route path="support/:ticketId" element={<TicketDetail />} />
              <Route
                path="org-admin"
                element={
                  <ProtectedRoute requireOrgAdmin>
                    <OrgAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/customers/:customerId"
                element={
                  <ProtectedRoute requireAdmin>
                    <CustomerContracts />
                  </ProtectedRoute>
                }
              />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
