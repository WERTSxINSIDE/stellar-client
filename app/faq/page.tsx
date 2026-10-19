"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FAQCard from "@/components/FAQCard";

export default function FAQPage() {
  return (
    <>
      <Header />

      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-40">
          <Image
            src="/fluid1.png"
            alt="Background Shape"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="absolute inset-0 -z-30 opacity-30">
          <Image
            src="/fluid2.png"
            alt="Background Shape 2"
            fill
            className="object-cover"
          />
        </div>

        <section className="relative z-10 pt-40 pb-32 flex flex-col items-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl font-extrabold mb-16 text-center"
          >
            FAQ
          </motion.h1>

          <FAQCard
            question="Как запустить клиент?"
            answer="Сначала скачайте лаунчер и откройте его. В появившемся окне вы увидите поле, где можно задать выделение оперативной памяти. Рекомендуем выделять не больше 8 ГБ. После этого нажмите кнопку «Старт» и дождитесь загрузки клиента."
          />

          <FAQCard
            question="Как загрузить конфиг в клиент?"
            answer="Чтобы загрузить конфиг, сначала запустите клиент хотя бы один раз. Затем перейдите в директорию: C:\\stellar\\configs и поместите ваш файл конфига .euphoria в эту папку."
          />

          <FAQCard
            question="Как создать собственный скрипт для клиента?"
            answer="Чтобы создать свой скрипт, сначала нужно прочитать документацию. В ней есть примеры использования, хуки событий и описание API. Обязательно следуйте рекомендациям по разработке, чтобы обеспечить совместимость."
          />

          <FAQCard
            question="Как связаться с техподдержкой?"
            answer="Есть 2 способа связаться с поддержкой: написать овнеру клиента в личку в Telegram, либо написать в поддержку на сайте."
          />
        </section>
      </main>

      <Footer />
    </>
  );
}
