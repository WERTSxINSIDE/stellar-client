"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";

const sectionsRu = [
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

const sectionsEn = [
  {
    title: "Actions with your device:",
    items: [
      "1.1 You agree that programs will be installed which are kept outside the game itself and protect the Minecraft add-on from attempts to crack/extract the cheat's source code.",
      "1.2 We are not responsible for your device in case of ignorance/violation of this user agreement.",
    ],
  },
  {
    title: "Actions in case of client malfunction/breakage:",
    items: [
      "2.1 Do not ask for help from strangers who are not affiliated with the client; support is listed on the website.",
      "2.2 You may write directly to the client owner to get the full reason; their contact details are also listed on the website.",
      "2.3 Check the minimum system requirements for comfortable performance. If you bought the client and experience lag, it does not mean poor optimization — it means your PC simply cannot handle the game adequately.",
    ],
  },
  {
    title: "Accounts/account protection/account penalties:",
    items: [
      "3.1 The administration is not obliged to provide a specific reason for an account block.",
      "3.2 If your account was stolen, contact support immediately, otherwise it may end very badly.",
      "3.3 Transferring/selling accounts in the client is prohibited.",
      "3.4 Multi-accounts in the client are prohibited.",
    ],
  },
  {
    title: "Finances/refunds:",
    items: [
      "4.1 Money for the client can be refunded only if you have full evidence and purchase screenshots, and if the purchase was made no more than 14 days ago.",
      "4.2 If you are blacklisted or banned in the client, funds are not refunded.",
    ],
  },
];

export default function UserAgreementPage() {
  const { t, lang } = useI18n();
  const sections = lang === "en" ? sectionsEn : sectionsRu;

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
              <ArrowLeft size={16} /> {t("support.backHome")}
            </Link>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl font-extrabold mb-10"
            >
              {t("legal.userAgreementTitle")}
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
                {lang === "en"
                  ? "By using the Stellar Client website and client, you confirm that you have read and agree to this agreement."
                  : "Используя сайт и клиент Stellar Client, вы подтверждаете, что прочитали и согласны с данным соглашением."}
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
