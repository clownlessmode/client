<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardAction,
		CardContent,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
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
	import type { DetalizationTransaction, Payment, PaymentDirection } from '$lib/beeline/types';
	import {
		calcCommission,
		calcTotal,
		capitalizeFirst,
		formatDate,
		formatMoney,
		formatSimNumber,
		formatTransactionAmount,
		getCurrentDateTimeLocal,
		getTransactionChangeValue,
		getPaymentForTransaction,
		getTransactionKey,
		getTransactionSourceLabel,
		isBeelineTransaction,
		mergePaymentsIntoTransactions,
		RECEIVER_CARD_HTML_PATTERN,
		RECEIVER_CARD_TITLE,
		splitTransactionsByDirection,
		toDateTimeLocal
	} from '$lib/beeline/utils';
	import type { PageData } from './$types';
	import { cn } from '$lib/utils';

	type HistoryTab = 'outgoing' | 'incoming';

	let {
		data,
		form
	}: {
		data: PageData;
		form?: { paymentError?: string; simError?: string; transactionError?: string };
	} = $props();

	let isCreatePaymentDialogOpen = $state(false);
	let newPaymentDirection = $state<PaymentDirection>('outgoing');
	let newPaymentAmount = $state('');
	let newPaymentPaidAt = $state(getCurrentDateTimeLocal());
	let historyTab = $state<HistoryTab>('outgoing');
	let visibleOutgoingCount = $state(50);
	let visibleIncomingCount = $state(50);

	const selectClass =
		'h-9 w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm leading-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30';

	const previewAmount = $derived(Number(newPaymentAmount));
	const previewCommission = $derived(
		newPaymentDirection === 'outgoing' && Number.isFinite(previewAmount)
			? calcCommission(previewAmount)
			: 0
	);
	const previewTotal = $derived(
		newPaymentDirection === 'outgoing' && Number.isFinite(previewAmount)
			? calcTotal(previewAmount, 'outgoing')
			: Number.isFinite(previewAmount)
				? previewAmount
				: 0
	);

	const getPaymentSourceLabel = (payment: Payment) =>
		payment.source === 'payment_flow' ? 'Авто' : 'Вручную';

	const getPaymentSubtitle = (payment: Payment) => {
		if (payment.direction !== 'outgoing') {
			return null;
		}

		return {
			commission: formatMoney(payment.commission),
			total: formatMoney(payment.total)
		};
	};

	const formatPeriod = (start: string, end: string) => {
		const startDate = formatDate(start);
		const endDate = formatDate(end);

		return startDate === endDate ? startDate : `${startDate} — ${endDate}`;
	};

	const resetCreatePaymentForm = () => {
		newPaymentAmount = '';
		newPaymentDirection = 'outgoing';
		newPaymentPaidAt = getCurrentDateTimeLocal();
	};

	$effect(() => {
		if (isCreatePaymentDialogOpen) {
			newPaymentPaidAt = getCurrentDateTimeLocal();
		}
	});

	$effect(() => {
		const tab = page.url.searchParams.get('tab');

		if (tab === 'incoming' || tab === 'outgoing') {
			historyTab = tab;
		}
	});
</script>

<svelte:head>
	<title>{formatSimNumber(data.number)} · Билайн</title>
</svelte:head>

<main class="min-h-screen bg-background">
	<section class="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-10">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-2">
				<a class="text-sm text-muted-foreground transition hover:text-foreground" href="/banks/beeline">
					← К SIM-картам
				</a>
				<div>
					<p class="text-sm font-medium text-primary">beeline</p>
					<h1 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						{formatSimNumber(data.number)}
					</h1>
				</div>
			</div>

			<form
				method="POST"
				action="?/deleteSim"
				use:enhance
				onsubmit={(event) => {
					if (
						!confirm(
							`Удалить SIM ${formatSimNumber(data.number)} и всю историю платежей?`
						)
					) {
						event.preventDefault();
					}
				}}
			>
				<Button type="submit" variant="destructive" size="sm">Удалить SIM</Button>
			</form>
		</header>

		{#if form?.simError}
			<p class="text-sm text-destructive">{form.simError}</p>
		{/if}

		{#if data.error || !data.config}
			<Card class="border-destructive/30 bg-destructive/5">
				<CardHeader>
					<CardTitle class="text-destructive">{data.error ?? 'SIM-карта не найдена'}</CardTitle>
				</CardHeader>
			</Card>
		{:else}
			<section aria-label="Баланс SIM">
				<Card size="sm" class="bg-primary text-primary-foreground">
					<CardHeader>
						<CardTitle class="text-xs uppercase tracking-[0.22em] opacity-80">
							Текущий баланс
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-6">
						{#await data.detalization}
							<p class="text-4xl font-semibold tracking-tight">
								{formatMoney(data.config.balance)}
							</p>
							<div class="text-xs text-primary-foreground/70">
								<p>Обновлено</p>
								<p class="mt-1 font-medium text-primary-foreground">
									{formatDate(data.config.updatedAt)}
								</p>
							</div>
						{:then detalizationResult}
							<p class="text-4xl font-semibold tracking-tight">
								{formatMoney(detalizationResult.data?.balance ?? data.config.balance)}
							</p>
							<div class="text-xs text-primary-foreground/70">
								<p>Обновлено</p>
								<p class="mt-1 font-medium text-primary-foreground">
									{formatDate(
										detalizationResult.data?.updatedAt ?? data.config.updatedAt
									)}
								</p>
							</div>
						{/await}
					</CardContent>
				</Card>
			</section>

			<section aria-labelledby="history-title">
				<Card size="sm">
					<CardHeader>
						<div class="space-y-1">
							<CardTitle id="history-title">История</CardTitle>
							{#await data.detalization then detalizationResult}
								{#if detalizationResult.data}
									<p class="text-xs text-muted-foreground">
										Период: {formatPeriod(
											detalizationResult.data.periodStart,
											detalizationResult.data.periodEnd
										)}
									</p>
								{/if}
							{/await}
						</div>
						<CardAction>
							<Dialog bind:open={isCreatePaymentDialogOpen}>
								<DialogTrigger
									class="inline-flex h-6 items-center justify-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/80"
								>
									Добавить
								</DialogTrigger>

								<DialogContent>
									<DialogHeader>
										<DialogTitle>Добавить платёж</DialogTitle>
										<DialogDescription>
											Списание — мобильная коммерция на карту. Пополнение — зачисление на баланс SIM.
										</DialogDescription>
									</DialogHeader>

									<form
										method="POST"
										action="?/createPayment"
										class="space-y-5"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();

												if (result.type === 'success' || result.type === 'redirect') {
													isCreatePaymentDialogOpen = false;
													resetCreatePaymentForm();
												}
											};
										}}
									>
										<input type="hidden" name="direction" value={newPaymentDirection} />

										<div class="space-y-2">
											<label class="text-sm font-medium" for="direction">Тип операции</label>
											<select
												id="direction"
												class={selectClass}
												bind:value={newPaymentDirection}
												required
											>
												<option value="outgoing">Списание (outgoing)</option>
												<option value="incoming">Пополнение (incoming)</option>
											</select>
										</div>

										<div class="grid gap-4 sm:grid-cols-2">
											<div class="space-y-2">
												<label class="text-sm font-medium" for="amount">Сумма</label>
												<Input
													id="amount"
													name="amount"
													type="number"
													min={newPaymentDirection === 'outgoing' ? 924 : 1}
													step="1"
													placeholder={newPaymentDirection === 'outgoing' ? '13000' : '5000'}
													bind:value={newPaymentAmount}
													required
												/>
											</div>

											<div class="space-y-2">
												<label class="text-sm font-medium" for="paidAt">Дата и время</label>
												<Input
													id="paidAt"
													name="paidAt"
													type="datetime-local"
													bind:value={newPaymentPaidAt}
													required
												/>
											</div>
										</div>

										{#if newPaymentDirection === 'outgoing'}
											<div class="space-y-2">
												<label class="text-sm font-medium" for="receiverCard">
													Карта получателя
												</label>
												<Input
													id="receiverCard"
													name="receiverCard"
													placeholder="220094**0028"
													pattern={RECEIVER_CARD_HTML_PATTERN}
													title={RECEIVER_CARD_TITLE}
													required
												/>
												<p class="text-xs text-muted-foreground">Формат: 6 цифр + ** + 4 цифры</p>
											</div>

											<div class="rounded-3xl bg-muted/60 p-4 text-sm">
												<div class="flex justify-between">
													<span class="text-muted-foreground">Комиссия (6.5%)</span>
													<span>{formatMoney(previewCommission)}</span>
												</div>
												<div class="mt-2 flex justify-between font-semibold">
													<span>Итого списание</span>
													<span>{formatMoney(previewTotal)}</span>
												</div>
											</div>
										{/if}

										{#if form?.paymentError}
											<p class="text-sm text-destructive">{form.paymentError}</p>
										{/if}

										<DialogFooter>
											<Button type="submit">Добавить</Button>
										</DialogFooter>
									</form>
								</DialogContent>
							</Dialog>
						</CardAction>
					</CardHeader>
					<CardContent>
						{#if form?.transactionError}
							<p class="mb-3 text-sm text-destructive">{form.transactionError}</p>
						{/if}

						{#if form?.paymentError}
							<p class="mb-3 text-sm text-destructive">{form.paymentError}</p>
						{/if}

						{#await data.detalization}
							<p class="text-muted-foreground">Загрузка истории...</p>
						{:then detalizationResult}
							{#if detalizationResult.error}
								<p class="text-destructive">{detalizationResult.error}</p>
							{:else}
								{#await data.payments}
									<p class="text-muted-foreground">Загрузка истории...</p>
								{:then payments}
									{@const historyTransactions = mergePaymentsIntoTransactions(
										detalizationResult.data?.data.transactions ?? [],
										payments
									)}
									{@const { outgoing, incoming } = splitTransactionsByDirection(
										historyTransactions,
										payments
									)}

									{#snippet transactionRow(transaction: DetalizationTransaction)}
										{@const changeValue = getTransactionChangeValue(transaction)}
										{@const payment = getPaymentForTransaction(transaction, payments)}
										{@const paymentDetails = payment ? getPaymentSubtitle(payment) : null}
										<article
											class="grid grid-cols-[3.5rem_1fr] gap-4 rounded-3xl border border-border bg-muted/30 p-4"
										>
											<div
												class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-base font-bold"
											>
												₽
											</div>

											<div class="flex min-w-0 flex-col gap-3">
												<div class="flex items-start justify-between gap-4">
													<div class="min-w-0">
														<div class="flex flex-wrap items-center gap-2">
															<p class="truncate text-sm font-semibold tracking-wide">
																{capitalizeFirst(transaction.name)}
															</p>
															<span
																class="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground"
															>
																{formatDate(transaction.dateTime)}
															</span>
														</div>
													</div>

													<p
														class:text-primary={changeValue >= 0}
														class:text-destructive={changeValue < 0}
														class="shrink-0 whitespace-nowrap text-right text-xl font-semibold"
													>
														{formatTransactionAmount(changeValue)}
													</p>
												</div>

												<div class="space-y-0.5 text-sm text-muted-foreground">
													{#if payment}
														<p>{getPaymentSourceLabel(payment)}</p>
														{#if paymentDetails}
															<p>Комиссия {paymentDetails.commission}</p>
															<p>Итого {paymentDetails.total}</p>
														{/if}
													{:else}
														<p>{getTransactionSourceLabel(transaction, payments)}</p>
													{/if}
												</div>

												{#if payment || isBeelineTransaction(transaction, payments)}
													<div class="flex flex-wrap justify-end gap-2">
													{#if payment}
														<Dialog>
															<DialogTrigger
																class="inline-flex h-6 items-center justify-center rounded-md border border-border px-2 text-xs font-medium transition hover:bg-muted"
															>
																Изменить
															</DialogTrigger>

															<DialogContent>
																<DialogHeader>
																	<DialogTitle>Изменить платёж</DialogTitle>
																	<DialogDescription>
																		При смене суммы у outgoing комиссия пересчитается автоматически.
																	</DialogDescription>
																</DialogHeader>

																<form
																	method="POST"
																	action="?/updatePayment"
																	class="space-y-5"
																	use:enhance
																>
																	<input type="hidden" name="id" value={payment.id} />
																	<input
																		type="hidden"
																		name="currentDirection"
																		value={payment.direction}
																	/>

																	<div class="space-y-2">
																		<label
																			class="text-sm font-medium"
																			for={`direction-${payment.id}`}
																		>
																			Тип операции
																		</label>
																		<select
																			id={`direction-${payment.id}`}
																			name="direction"
																			class={selectClass}
																			value={payment.direction}
																		>
																			<option value="outgoing">Списание (outgoing)</option>
																			<option value="incoming">Пополнение (incoming)</option>
																		</select>
																	</div>

																	<div class="grid gap-4 sm:grid-cols-2">
																		<div class="space-y-2">
																			<label
																				class="text-sm font-medium"
																				for={`amount-${payment.id}`}
																			>
																				Сумма
																			</label>
																			<Input
																				id={`amount-${payment.id}`}
																				name="amount"
																				type="number"
																				min={payment.direction === 'outgoing' ? 924 : 1}
																				step="1"
																				value={payment.amount}
																				required
																			/>
																		</div>

																		<div class="space-y-2">
																			<label
																				class="text-sm font-medium"
																				for={`paidAt-${payment.id}`}
																			>
																				Дата и время
																			</label>
																			<Input
																				id={`paidAt-${payment.id}`}
																				name="paidAt"
																				type="datetime-local"
																				value={toDateTimeLocal(payment.paidAt)}
																				required
																			/>
																		</div>
																	</div>

																	{#if payment.direction === 'outgoing' || payment.receiverCard}
																		<div class="space-y-2">
																			<label
																				class="text-sm font-medium"
																				for={`receiverCard-${payment.id}`}
																			>
																				Карта получателя
																			</label>
																			<Input
																				id={`receiverCard-${payment.id}`}
																				name="receiverCard"
																				value={payment.receiverCard ?? ''}
																				pattern={RECEIVER_CARD_HTML_PATTERN}
																				title={RECEIVER_CARD_TITLE}
																			/>
																		</div>
																	{/if}

																	<DialogFooter>
																		<Button type="submit">Сохранить</Button>
																	</DialogFooter>
																</form>
															</DialogContent>
														</Dialog>

														<form
															method="POST"
															action="?/deletePayment"
															use:enhance
															onsubmit={(event) => {
																if (!confirm('Удалить этот платёж?')) {
																	event.preventDefault();
																}
															}}
														>
															<input type="hidden" name="id" value={payment.id} />
															<Button type="submit" variant="destructive" size="sm">Удалить</Button>
														</form>
													{:else if isBeelineTransaction(transaction, payments)}
														<form
															method="POST"
															action="?/hideTransaction"
															use:enhance
															onsubmit={(event) => {
																if (
																	!confirm(
																		'Скрыть эту операцию Билайн? Она не вернётся даже после обновления из приложения.'
																	)
																) {
																	event.preventDefault();
																}
															}}
														>
															<input type="hidden" name="id" value={transaction.id} />
															<Button type="submit" variant="destructive" size="sm">Скрыть</Button>
														</form>
													{/if}
													</div>
												{/if}
											</div>
										</article>
									{/snippet}

									{#if outgoing.length === 0 && incoming.length === 0}
										<p class="text-muted-foreground">Операций пока нет.</p>
									{:else}
										<div
											class="mb-4 inline-flex rounded-lg bg-muted p-1"
											role="tablist"
											aria-label="Тип операций"
										>
											<button
												type="button"
												role="tab"
												aria-selected={historyTab === 'outgoing'}
												class={cn(
													'rounded-md px-3 py-1.5 text-sm font-medium transition',
													historyTab === 'outgoing'
														? 'bg-background text-foreground shadow-sm'
														: 'text-muted-foreground hover:text-foreground'
												)}
												onclick={() => (historyTab = 'outgoing')}
											>
												Списания{outgoing.length > 0 ? ` (${outgoing.length})` : ''}
											</button>
											<button
												type="button"
												role="tab"
												aria-selected={historyTab === 'incoming'}
												class={cn(
													'rounded-md px-3 py-1.5 text-sm font-medium transition',
													historyTab === 'incoming'
														? 'bg-background text-foreground shadow-sm'
														: 'text-muted-foreground hover:text-foreground'
												)}
												onclick={() => (historyTab = 'incoming')}
											>
												Пополнения{incoming.length > 0 ? ` (${incoming.length})` : ''}
											</button>
										</div>

										{#if historyTab === 'outgoing'}
											<div role="tabpanel" aria-label="Списания">
												{#if outgoing.length === 0}
													<p class="text-muted-foreground">Списаний пока нет.</p>
												{:else}
													<div class="grid gap-3">
														{#each outgoing.slice(0, visibleOutgoingCount) as transaction, index (getTransactionKey(transaction, index))}
															{@render transactionRow(transaction)}
														{/each}
													</div>
													{#if visibleOutgoingCount < outgoing.length}
														<div class="mt-4">
															<Button
																type="button"
																variant="outline"
																size="sm"
																onclick={() => (visibleOutgoingCount += 50)}
															>
																Показать ещё ({outgoing.length - visibleOutgoingCount})
															</Button>
														</div>
													{/if}
												{/if}
											</div>
										{:else}
											<div role="tabpanel" aria-label="Пополнения">
												{#if incoming.length === 0}
													<p class="text-muted-foreground">Пополнений пока нет.</p>
												{:else}
													<div class="grid gap-3">
														{#each incoming.slice(0, visibleIncomingCount) as transaction, index (getTransactionKey(transaction, index))}
															{@render transactionRow(transaction)}
														{/each}
													</div>
													{#if visibleIncomingCount < incoming.length}
														<div class="mt-4">
															<Button
																type="button"
																variant="outline"
																size="sm"
																onclick={() => (visibleIncomingCount += 50)}
															>
																Показать ещё ({incoming.length - visibleIncomingCount})
															</Button>
														</div>
													{/if}
												{/if}
											</div>
										{/if}
									{/if}
								{/await}
							{/if}
						{/await}
					</CardContent>
				</Card>
			</section>
		{/if}
	</section>
</main>
