"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "Действия с вашим устройством:",
    items: [
      "1.1 Вы соглашаетесь с тем, что будут установлены программы, которые не держатся внутри самой игры, а вне ее, и защищают дополнение на майнкрафт от попытки крякнуть/вытащить исходный код чита.",
      "1.2 За ваше устройство мы не несем ответственности при незнании/нарушении данного пользовательского соглашения.",
    ],
  },
  {
    title: "Действия при неполадке/поломке клиента:",
    items: [
      "2.1 Не просить помощи у незнакомых людей, которые не связаны с клиентом, поддержка указана на сайте.",
      "2.2 Можно написать напрямую овнеру клиента для расписания полной причины, его контактные данные будут указаны также на сайте.",
      "2.3 Просматривайте минимальные системные требования для комфортной работы клиента. Если вы купили клиент и у вас лаги, это не значит плохая оптимизация — это значит, что ваш ПК просто задыхается из-за невозможности адекватно тянуть игру.",
    ],
  },
  {
    title: "Аккаунты/защита аккаунтов/наказания аккаунтов:",
    items: [
      "3.1 Администрация не должна предоставлять конкретную причину блокировки аккаунта.",
      "3.2 Если у вас украли аккаунт — пишите в поддержку незамедлительно, иначе это может очень печально обернуться.",
      "3.3 Передача/продажа аккаунтов в клиенте запрещена.",
      "3.4 Мультиаккаунты в клиенте запрещены.",
    ],
  },
  {
    title: "Финансы/возврат средств:",
    items: [
      "4.1 Деньги за клиент можно вернуть только в том случае, если у вас есть полные доказательства и скрины покупки, и если покупка была совершена не больше 14 дней назад.",
      "4.2 Если вы находитесь в ЧС или вас забанили в клиенте — средства не возвращаются.",
    ],
  },
];

export default function UserAgreementPage() {
  return (
    <>
      <Header />

      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-40">
          <Image src="/fluid1.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-30 opacity-30">
          <Image src="/fluid2.png" alt="" fill className="object-cover" priority />
        </div>

        <section className="relative z-10 pt-40 pb-32 px-6">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-8"
            >
              <ArrowLeft size={16} /> На главную
            </Link>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl font-extrabold mb-10"
            >
              Пользовательское соглашение
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 sm:p-9 space-y-8"
            >
              {sections.map((s) => (
                <div key={s.title}>
                  <h2 className="text-lg font-bold text-purple-300 mb-3">{s.title}</h2>
                  <div className="space-y-3">
                    {s.items.map((item) => (
                      <p key={item} className="text-white/70 leading-relaxed">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-white/40 text-sm border-t border-white/10 pt-6">
                Используя сайт и клиент Stellar Client, вы подтверждаете, что прочитали и согласны с данным
                соглашением.
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
