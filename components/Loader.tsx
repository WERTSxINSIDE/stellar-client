"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type LoaderProps = {
  onFinished?: () => void;
  durationMs?: number;
};

export default function Loader({ onFinished, durationMs = 600 }: LoaderProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(false);
      onFinished?.();
    }, durationMs);

    return () => clearTimeout(t);
  }, [durationMs, onFinished]);

  useEffect(() => {
    if (loading) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [loading]);

  if (!loading) return null;

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          suppressHydrationWarning
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080a]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-5"
          >
            <Image src="/icon.png" width={52} height={52} alt="Stellar Client" priority />
            <span className="h-0.5 w-12 overflow-hidden rounded-full bg-white/10">
              <motion.span
                className="block h-full w-1/2 rounded-full bg-purple-400"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
              />
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
