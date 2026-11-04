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

const sectionsEn = [
  {
    title: "1. License grant",
    items: [
      "Limited license. The rights holder grants you a non-exclusive, non-transferable, revocable license to install and personally use the Program for non-commercial purposes on your devices.",
      "Ownership. All intellectual property rights, source code, design and the Stellar Client brand belong exclusively to the developers of the Program.",
    ],
  },
  {
    title: "2. Usage restrictions",
    intro: "You are strictly prohibited from:",
    items: [
      "Copying, distributing, selling or renting the Program to third parties.",
      "Modifying, decompiling, disassembling or attempting to extract the source code of the Program (unless expressly permitted by the open license of individual components).",
      "Using the Program to circumvent third-party service rules (including creating or using prohibited cheats/hacks that violate third-party game server rules).",
      "Using the Program to commit any illegal actions.",
    ],
  },
  {
    title: "3. Disclaimer of warranties",
    items: [
      "“As is”. The Program is provided on an “as is” basis. The developers do not guarantee that the Program will operate uninterrupted, error-free, or be fully compatible with any third-party software or updates of third-party games (for example, Minecraft).",
      "Risks. You use the Program entirely at your own risk.",
    ],
  },
  {
    title: "4. Limitation of liability",
    items: [
      "Damages. The Stellar Client developers are under no circumstances liable for any direct, indirect or incidental damages.",
      "Bans. The developers are not liable for bans of your game accounts on third-party servers caused by the use of the Program.",
    ],
  },
  {
    title: "5. Updates and changes",
    items: [
      "Automatic updates. The Program may automatically download and install updates to improve stability or add new features.",
      "Changes to terms. The developers reserve the right to change the terms of this Agreement at any time. Continued use of the Program after changes means you agree to the new version of the EULA.",
    ],
  },
  {
    title: "6. Termination",
    items: [
      "The Agreement is effective until terminated.",
      "You may terminate it at any time by deleting the Program from all your devices.",
      "The developers have the right to revoke the license and block access to the Program if you violate any clause of this Agreement.",
    ],
  },
];

export default function EulaPage() {
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
              className="text-3xl sm:text-4xl font-extrabold mb-4"
            >
              {lang === "en"
                ? "End User License Agreement (EULA)"
                : "Лицензионное соглашение с конечным пользователем (EULA)"}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 sm:p-9 space-y-8"
            >
              <div className="space-y-3 text-white/70 leading-relaxed">
                {lang === "en" ? (
                  <>
                    <p>
                      Please read the terms of this Agreement carefully before installing or
                      using Stellar Client.
                    </p>
                    <p>
                      By using, installing or launching Stellar Client (the “Program”), you agree
                      to all terms of this Agreement. If you do not agree to the terms, do not
                      install or use the Program.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Перед установкой или использованием Stellar Client внимательно ознакомьтесь
                      с условиями настоящего Соглашения.
                    </p>
                    <p>
                      Используя, устанавливая или запуская Stellar Client (далее — «Программа»), вы
                      соглашаетесь со всеми условиями настоящего Соглашения. Если вы не согласны с
                      условиями — не устанавливайте и не используйте Программу.
                    </p>
                  </>
                )}
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
