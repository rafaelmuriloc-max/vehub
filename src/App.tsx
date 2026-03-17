import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Financial from "./pages/Financial";
import Tasks from "./pages/Tasks";
import CalendarView from "./pages/CalendarView";
import Obligations from "./pages/Obligations";
import Documents from "./pages/Documents";
import Invoices from "./pages/Invoices";
import Settings from "./pages/Settings";
import DocumentTypes from "./pages/DocumentTypes";
import InvoiceEmit from "./pages/InvoiceEmit";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/obligations" element={<Obligations />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/emit" element={<InvoiceEmit />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/document-types" element={<DocumentTypes />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
