import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import Financial from "./pages/Financial";
import CalendarView from "./pages/CalendarView";
import Obligations from "./pages/Obligations";
import Invoices from "./pages/Invoices";
import Settings from "./pages/Settings";
import DocumentTypes from "./pages/DocumentTypes";
import InvoiceEmit from "./pages/InvoiceEmit";
import Fiscal from "./pages/Fiscal";
import Chat from "./pages/Chat";
import ChatPopup from "./pages/ChatPopup";
import Email from "./pages/Email";
import Drive from "./pages/Drive";
import Dashboard from "./pages/Dashboard";
import ScheduledMessages from "./pages/ScheduledMessages";
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
            <Route path="/chat/popup" element={<ChatPopup />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Financial />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/obligations" element={<Obligations />} />
              <Route path="/invoices/emit" element={<InvoiceEmit />} />
              <Route path="/fiscal" element={<Fiscal />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/email" element={<Email />} />
              <Route path="/drive" element={<Drive />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scheduled-messages" element={<ScheduledMessages />} />
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
