"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.3 }}
      className="w-full"
    >
      <div className="group h-full rounded-xl border border-white/[0.08] bg-[#111114]/60 p-5 transition-colors hover:border-white/[0.16] hover:bg-[#141418]">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-purple-300">
            {icon}
          </span>
          <h3 className="text-base font-medium text-white">{title}</h3>
        </div>

        <p className="text-sm leading-relaxed text-white/55">{description}</p>
      </div>
    </motion.div>
  );
}
