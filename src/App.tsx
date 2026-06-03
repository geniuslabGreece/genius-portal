import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./portal/pages/Login.tsx";
import ResetPassword from "./portal/pages/ResetPassword.tsx";
import PortalLayout from "./portal/PortalLayout.tsx";
import Dashboard from "./portal/pages/Dashboard.tsx";
import CategoryView from "./portal/pages/CategoryView.tsx";
import ContractDetail from "./portal/pages/ContractDetail.tsx";
import Admin from "./portal/pages/Admin.tsx";
import OrgAdmin from "./portal/pages/OrgAdmin.tsx";
import CustomerContracts from "./portal/pages/CustomerContracts.tsx";
import Account from "./portal/pages/Account.tsx";
import Support from "./portal/pages/Support.tsx";
import TicketDetail from "./portal/pages/TicketDetail.tsx";
import Assistant from "./portal/pages/Assistant.tsx";
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
            <Route path="/site" element={<Index />} />
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
              <Route path="software" element={<CategoryView category="software" />} />
              <Route path="hardware" element={<CategoryView category="hardware" />} />
              <Route path="erp" element={<CategoryView category="erp" />} />
              <Route path="devices" element={<CategoryView category="devices" />} />
              <Route path="contracts" element={<CategoryView title="Όλα τα συμβόλαια" />} />
              <Route path="contracts/:id" element={<ContractDetail />} />
              <Route path="support" element={<Support />} />
              <Route path="support/:id" element={<TicketDetail />} />
              <Route path="assistant" element={<Assistant />} />
              <Route
                path="admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="org-admin"
                element={
                  <ProtectedRoute requireOrgAdmin>
                    <OrgAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/customers/:id"
                element={
                  <ProtectedRoute requireAdmin>
                    <CustomerContracts />
                  </ProtectedRoute>
                }
              />
              <Route path="account" element={<Account />} />
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
