import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ChatLayout } from "./components/ChatLayout";
import { ViewportProvider } from "./components/ViewportProvider";
import { AuthProvider } from "./hooks/useAuth";
import { HomePage } from "./pages/HomePage";
import { chatPageVariants, pageVariants } from "./lib/motion";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div
              className="min-h-app"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <HomePage />
            </motion.div>
          }
        />
        <Route
          path="/r/:slug"
          element={
            <motion.div
              className="chat-page-root h-app min-h-app"
              variants={chatPageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ChatLayout />
            </motion.div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ViewportProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppShell>
              <AnimatedRoutes />
            </AppShell>
          </BrowserRouter>
        </AuthProvider>
      </ViewportProvider>
    </MotionConfig>
  );
}
