import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";

interface ToastNotificationProps {
  message: string | null;
}

export default function ToastNotification({ message }: ToastNotificationProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-[100] glass rounded-xl px-4 py-3 border border-yellow-500/30 bg-yellow-500/5 shadow-lg max-w-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
            <p className="text-xs text-white/90 leading-snug">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
