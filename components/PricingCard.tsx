"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import TiltCard from "./TiltCard";
import { useI18n } from "@/lib/i18n";

type PricingCardProps = {
  title: string;
  price: string;
  image: string;
  href?: string;
  onClick?: () => void;
};

export default function PricingCard({
  title,
  price,
  image,
  href,
  onClick,
}: PricingCardProps) {
  const { t } = useI18n();
  const cardContent = (
    <div
      className="
        group
        bg-[#1a1a1a]/60
        backdrop-blur-xl
        rounded-3xl
        p-6
        w-full
        flex flex-col
        shadow-xl shadow-black/40
        border border-white/10
        hover:border-purple-400/40
        transition-colors
        cursor-pointer
      "
    >
      <div className="rounded-2xl overflow-hidden mb-5">
        <Image
          src={image}
          alt={title}
          width={400}
          height={400}
          className="rounded-2xl w-full h-auto transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <h2 className="text-xl font-semibold text-white mb-1">{title}</h2>
      <p className="text-sm text-white/60 mb-6">{t("pricing.price", { price })}</p>

      <div
        className="
          w-full py-3 rounded-xl bg-purple-600 text-white font-medium
          group-hover:bg-purple-500 transition-colors text-center
        "
      >
        {t("nav.buy")}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", damping: 18, stiffness: 160 }}
      viewport={{ once: true, amount: 0.3 }}
    >
      <TiltCard max={9} className="w-full max-w-[300px]">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {cardContent}
          </a>
        ) : (
          <div onClick={onClick}>{cardContent}</div>
        )}
      </TiltCard>
    </motion.div>
  );
}
