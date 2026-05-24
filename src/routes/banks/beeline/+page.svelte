<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { formatDate, formatSimNumber } from '$lib/beeline/utils';
	import type { PageData } from './$types';

	let {
		data,
		form
	}: {
		data: PageData;
		form?: { createSimError?: string; deleteSimError?: string };
	} = $props();

	let isCreateDialogOpen = $state(false);
</script>

<svelte:head>
	<title>Билайн · SIM-карты</title>
</svelte:head>

<main class="min-h-screen bg-background">
	<section class="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-10">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-2">
				<a class="text-sm text-muted-foreground transition hover:text-foreground" href="/banks">
					← К банкам
				</a>
				<div>
					<p class="text-sm font-medium text-primary">beeline</p>
					<h1 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Билайн</h1>
					<p class="mt-1 text-sm text-muted-foreground">Управление SIM-картами и историей платежей</p>
				</div>
			</div>

			<Dialog bind:open={isCreateDialogOpen}>
				<DialogTrigger
					class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
				>
					Добавить SIM
				</DialogTrigger>

				<DialogContent>
					<DialogHeader>
						<DialogTitle>Добавить SIM-карту</DialogTitle>
						<DialogDescription>
							Введите 10-значный номер без +7. Можно вставить номер с кодом страны — он будет нормализован.
						</DialogDescription>
					</DialogHeader>

					<form
						method="POST"
						action="?/createSim"
						class="space-y-5"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();

								if (result.type === 'success') {
									isCreateDialogOpen = false;
								}
							};
						}}
					>
						<div class="space-y-2">
							<label class="text-sm font-medium" for="number">Номер SIM</label>
							<Input
								id="number"
								name="number"
								inputmode="numeric"
								placeholder="9680659702"
								required
							/>
							{#if form?.createSimError}
								<p class="text-sm text-destructive">{form.createSimError}</p>
							{/if}
						</div>

						<DialogFooter>
							<Button type="button" variant="ghost" onclick={() => (isCreateDialogOpen = false)}>
								Отмена
							</Button>
							<Button type="submit">Добавить</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</header>

		{#if data.error}
			<Card class="border-destructive/30 bg-destructive/5">
				<CardHeader>
					<CardTitle class="text-destructive">{data.error}</CardTitle>
				</CardHeader>
			</Card>
		{:else if data.sims.length === 0}
			<Card>
				<CardHeader>
					<CardTitle class="text-muted-foreground">SIM-карты пока не добавлены</CardTitle>
				</CardHeader>
				<CardContent>
					<p class="text-sm text-muted-foreground">
						Нажмите «Добавить SIM», чтобы зарегистрировать номер для подмены в приложении Билайн.
					</p>
				</CardContent>
			</Card>
		{:else}
			{#if form?.deleteSimError}
				<p class="text-sm text-destructive">{form.deleteSimError}</p>
			{/if}

			<div class="grid gap-4" aria-label="SIM-карты">
				{#each data.sims as sim (sim.number)}
					<div class="relative">
						<a
							class="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							href={`/banks/beeline/${sim.number}`}
						>
							<Card size="sm" class="transition hover:shadow-md">
								<CardHeader>
									<div class="min-w-0 pr-24">
										<CardTitle class="text-xl">{formatSimNumber(sim.number)}</CardTitle>
										<p class="mt-1 text-sm text-muted-foreground">
											Обновлено {formatDate(sim.updatedAt)}
										</p>
									</div>
								</CardHeader>
							</Card>
						</a>

						<form
							class="absolute top-3 right-3 z-10 sm:top-4 sm:right-4"
							method="POST"
							action="?/deleteSim"
							use:enhance
							onsubmit={(event) => {
								event.stopPropagation();

								if (
									!confirm(
										`Удалить SIM ${formatSimNumber(sim.number)} и всю историю платежей?`
									)
								) {
									event.preventDefault();
								}
							}}
						>
							<input type="hidden" name="number" value={sim.number} />
							<Button type="submit" variant="destructive" size="sm">Удалить</Button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</main>
