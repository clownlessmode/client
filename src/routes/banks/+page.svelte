<script lang="ts">
	import { Card, CardHeader, CardTitle } from '$lib/components/ui/card';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Банки</title>
</svelte:head>

<main class="bg-background min-h-screen">
	<section class="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 sm:py-16">
		<header class="max-w-2xl space-y-3">
			<h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">Банки</h1>
			<p class="text-muted-foreground text-lg">Выберите банк из доступных для работы с ним.</p>
		</header>

		{#if data.error}
			<Card class="border-destructive/30 bg-destructive/5">
				<CardHeader>
					<CardTitle class="text-destructive">{data.error}</CardTitle>
				</CardHeader>
			</Card>
		{:else if data.banks.length === 0}
			<Card>
				<CardHeader>
					<CardTitle class="text-muted-foreground">Банки пока не найдены.</CardTitle>
				</CardHeader>
			</Card>
		{:else}
			<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Банки">
				{#each data.banks as bank (bank.id)}
					<a href={`/banks/${bank.code}`} class="block rounded-4xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
						<Card class="h-full transition hover:-translate-y-1 hover:shadow-xl">
							<CardHeader>
								<CardTitle role="heading" aria-level={2} class="text-2xl">{bank.name}</CardTitle>
							</CardHeader>
						</Card>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</main>
