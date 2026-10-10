<script setup lang="ts">
// In ontwikkeling draaien de apps op eigen poorten; in productie op /tourpool/beheer/ en /tourpool/deelnemen/.
const userUrl = import.meta.env.VITE_USER_URL || "http://localhost:5174/";
const adminUrl = import.meta.env.VITE_ADMIN_URL || "http://localhost:5173/";
const base = import.meta.env.BASE_URL;
</script>

<template>
  <main class="mx-auto max-w-5xl p-3 md:p-6">
    <header
      class="flex items-center justify-between gap-4 rounded-2xl border border-yellow-700 bg-amber-800 px-4 py-3 align-middle">
      <div class="mt-4 rounded-2xl border border-yellow-700 bg-amber-300 p-4 px-8 text-center">
      <img :src="`${base}tour_logo.png`" alt="Jota" class="p-4h-14 w-auto md:h-20" />
      </div>
      <div class="items-center text-center">
        <h1 class="text-shadow-2xs text-3xl font-extrabold text-yellow-100 md:text-6xl">
          Jota's Tourpool
        </h1>
        <p class="mt-1 text-yellow-100 md:text-lg">
          Stel je eigen tourploeg samen en strijd mee om de punten
        </p>
      </div>
      <div class="mt-4 rounded-2xl border border-yellow-700 bg-yellow-100 p-4 px-8 text-center">
      <img :src="`${base}tour_logo.png`" alt="Jota" class="p-4h-14 w-auto md:h-20" />
      </div>
    </header>

    <section class="my-6 grid gap-4 md:grid-cols-2">
      <article
        class="flex flex-col rounded-xl border border-yellow-700 bg-yellow-100 p-5">
        <h2 class="mb-2 text-2xl font-bold">Meedoen</h2>
        <p class="mb-4 flex-1">
          Schrijf je in voor een pool, kies je renners en druk het
          inschrijfformulier af. Dat kan met een account, of zonder account
          door alleen het formulier in te vullen en in te leveren.
        </p>
        <a :href="userUrl" class="btn self-start px-4 py-2 text-lg">
          Naar de deelnemerspagina
        </a>
      </article>

      <article
        class="flex flex-col rounded-xl border border-yellow-700 bg-yellow-100 p-5">
        <h2 class="mb-2 text-2xl font-bold">Beheer</h2>
        <p class="mb-4 flex-1">
          Voor de organisatie en poolbeheerders: deelnemers en betalingen
          beheren, uitslagen invoeren en standen afdrukken.
        </p>
        <a :href="adminUrl" class="btn self-start px-4 py-2 text-lg">
          Naar het beheer
        </a>
      </article>
    </section>

    <footer class="text-center text-sm text-slate-600">
      &copy; Jota Services
    </footer>
  </main>
</template>
