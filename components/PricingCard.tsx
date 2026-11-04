"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

type PricingCardProps = {
  title: string;
  price: string;
  image?: string;
  href?: string;
  onClick?: () => void;
};

export default function PricingCard({
  title,
  price,
  href,
  onClick,
}: PricingCardProps) {
  const { t } = useI18n();
  const cardContent = (
    <div className="group flex h-full w-full flex-col rounded-xl border border-white/[0.08] bg-[#111114]/70 p-5 transition-colors hover:border-purple-400/30 hover:bg-[#141418]">
      <h3 className="text-sm font-medium text-white/55">{title}</h3>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-white">
        {price}
        <span className="ml-1 text-base font-normal text-white/45">₽</span>
      </p>

      <div className="mt-6 flex h-10 items-center justify-center rounded-lg bg-purple-600 text-sm font-medium text-white transition-colors group-hover:bg-purple-500">
        {t("nav.buy")}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.3 }}
      className="w-full max-w-[230px]"
    >
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
          {cardContent}
        </a>
      ) : (
        <div onClick={onClick} className="h-full">
          {cardContent}
        </div>
      )}
    </motion.div>
  );
}
