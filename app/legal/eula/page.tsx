"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "1. Предоставление лицензии",
    items: [
      "Ограниченная лицензия. Правообладатель предоставляет вам неисключительную, непередаваемую, отзывную лицензию на установку и личное некоммерческое использование Программы на ваших устройствах.",
      "Собственность. Все права на интеллектуальную собственность, исходный код, дизайн и бренд Stellar Client принадлежат исключительно разработчикам Программы.",
    ],
  },
  {
    title: "2. Ограничения использования",
    intro: "Вам строго запрещается:",
    items: [
      "Копировать, распространять, продавать или сдавать Программу в аренду третьим лицам.",
      "Модифицировать, декомпилировать, деассемблировать или пытаться извлечь исходный код Программы (если это прямо не разрешено открытой лицензией отдельных компонентов).",
      "Использовать Программу для обхода правил сторонних сервисов (включая создание или использование запрещенных читов/хаков, нарушающих правила сторонних игровых серверов).",
      "Использовать Программу для совершения любых незаконных действий.",
    ],
  },
  {
    title: "3. Отказ от гарантий",
    items: [
      "«Как есть». Программа предоставляется на условиях «as is» (как есть). Разработчики не гарантируют, что Программа будет работать бесперебойно, без ошибок или будет полностью совместима с любым сторонним софтом или обновлениями сторонних игр (например, Minecraft).",
      "Риски. Вы используете Программу на свой собственный страх и риск.",
    ],
  },
  {
    title: "4. Ограничение ответственности",
    items: [
      "Ущерб. Разработчики Stellar Client ни при каких обстоятельствах не несут ответственности за любой прямой, косвенный или случайный ущерб.",
      "Блокировки. Разработчики не несут ответственности за блокировки (баны) ваших игровых аккаунтов на сторонних серверах, вызванные использованием Программы.",
    ],
  },
  {
    title: "5. Обновления и изменения",
    items: [
      "Автоматические обновления. Программа может автоматически загружать и устанавливать обновления для улучшения стабильности или добавления новых функций.",
      "Изменение условий. Разработчики оставляют за собой право изменять условия данного Соглашения в любое время. Продолжение использования Программы после изменений означает ваше согласие с новой редакцией EULA.",
    ],
  },
  {
    title: "6. Прекращение действия соглашения",
    items: [
      "Соглашение действует до момента его расторжения.",
      "Вы можете расторгнуть его в любой момент, удалив Программу со всех своих устройств.",
      "Разработчики имеют право отозвать лицензию и заблокировать доступ к Программе в случае нарушения вами любого из пунктов данного Соглашения.",
    ],
  },
];

export default function EulaPage() {
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
              className="text-3xl sm:text-4xl font-extrabold mb-4"
            >
              Лицензионное соглашение с конечным пользователем (EULA)
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 sm:p-9 space-y-8"
            >
              <div className="space-y-3 text-white/70 leading-relaxed">
                <p>Перед установкой или использованием Stellar Client внимательно ознакомьтесь с условиями настоящего Соглашения.</p>
                <p>
                  Используя, устанавливая или запуская Stellar Client (далее — «Программа»), вы соглашаетесь со всеми
                  условиями настоящего Соглашения. Если вы не согласны с условиями — не устанавливайте и не
                  используйте Программу.
                </p>
              </div>

              {sections.map((s) => (
                <div key={s.title}>
                  <h2 className="text-lg font-bold text-purple-300 mb-3">{s.title}</h2>
                  {s.intro && <p className="text-white/70 mb-2">{s.intro}</p>}
                  <div className="space-y-3">
                    {s.items.map((item) => (
                      <p key={item} className="text-white/70 leading-relaxed flex gap-2">
                        <span className="text-purple-400 shrink-0">•</span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
