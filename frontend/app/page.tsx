import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <main className="flex flex-col items-center text-center gap-8 max-w-2xl">
        <div className="relative w-40 h-40 rounded-xl overflow-hidden shadow-xl border-4 border-white">
          <Image
            src="/piwrite-logo.jpg"
            alt="PiWrite Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-primary">
          Welcome to PiWrite
        </h1>

        <p className="text-xl text-zinc-600 dark:text-zinc-400">
          Your AI-Writing Coach for crafting amazing stories.
        </p>

        <div className="flex gap-4 mt-4">
          <a
            href="/login"
            className="rounded-full bg-primary px-8 py-3 text-white font-medium hover:bg-primary/90 transition-colors shadow-lg"
          >
            Get Started
          </a>
          <a
            href="/dashboard"
            className="rounded-full border border-zinc-300 bg-white px-8 py-3 font-medium hover:bg-zinc-50 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
