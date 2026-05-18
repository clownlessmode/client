<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Card,
		CardAction,
		CardContent,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
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
	import type { PageData } from './$types';

	let {
		data,
		form
	}: {
		data: PageData;
		form?: { balanceError?: string; clientInfoError?: string; historyError?: string };
	} = $props();
	let isBalanceDialogOpen = $state(false);
	let isClientInfoDialogOpen = $state(false);
	let isCreateHistoryDialogOpen = $state(false);
	let newHistoryType = $state('cash-transfer');

	const transferBanks = [
		{ id: 'vtb', name: 'ВТБ', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/vtb_square.png' },
		{ id: 'sberbank', name: 'Сбербанк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/sberbank_square.png' },
		{ id: 'tbank', name: 'Т-Банк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/tbank_square.png' },
		{ id: 'ozon', name: 'Озон Банк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/ozon_square.png' },
		{ id: 'psb', name: 'ПСБ', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/unknown_square.png' },
		{ id: 'wb', name: 'Вайлдберриз Банк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/wb-bank_square.png' },
		{ id: 'alfabank', name: 'Альфа-Банк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/alfabank_square.png' },
		{ id: 'sovcombank', name: 'Совкомбанк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/sovcombank_square.png' },
		{ id: 'dvbank', name: 'Дальневосточный Банк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/dvbank_square.png' },
		{ id: 'raiffeisen', name: 'Райффайзен', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/raiffeisen_square.png' },
		{ id: 'promsvyazbank', name: 'Промсвязьбанк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/promsvyazbank_square.png' },
		{ id: 'gazprombank', name: 'Газпромбанк', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/gazprombank_square.png' },
		{ id: 'akbars', name: 'Ак Барс', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/akbars_square.png' },
		{ id: 'other', name: 'Другой', iconUrl: 'https://cdn.lifetechx.ru/icons/banks/icon_square/unknown_square.png' }
	];

	const selectClass =
		'h-9 w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm leading-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30';

	const currencyFormatter = new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0
	});

	const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});

	const getFullName = (clientInfo: NonNullable<PageData['config']>['clientInfo']) =>
		[clientInfo.lastName, clientInfo.firstName, clientInfo.middleName].filter(Boolean).join(' ') ||
		'Не указано';

	const formatMoney = (amount: number) => currencyFormatter.format(amount);

	const formatHistoryAmount = (amount: number, direction: string) => {
		const normalizedDirection = direction.toLowerCase();
		const isOutcome =
			normalizedDirection.includes('out') ||
			normalizedDirection.includes('debit') ||
			normalizedDirection.includes('withdraw');
		const isIncome =
			normalizedDirection.includes('in') ||
			normalizedDirection.includes('credit') ||
			normalizedDirection.includes('deposit');

		return `${isOutcome ? '-' : isIncome || amount > 0 ? '+' : '-'}${formatMoney(Math.abs(amount))}`;
	};

	const formatDate = (value: string) => {
		const date = new Date(value);

		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return dateFormatter.format(date);
	};

	const formatBankName = (code: string) => code.charAt(0).toUpperCase() + code.slice(1);

	const getShortRecipientName = (item: NonNullable<PageData['config']>['history'][number]) => {
		if (!item.operationFirstName || !item.operationLastName) {
			return '';
		}

		return `${item.operationFirstName} ${item.operationLastName.charAt(0)}.`;
	};

	const getCardLastDigits = (cardNumber?: string) => {
		const digits = cardNumber?.replace(/\D/g, '') ?? '';

		return digits.slice(-4);
	};

	const getHistoryTitle = (item: NonNullable<PageData['config']>['history'][number]) => {
		if (item.type === 'cash-transfer') {
			return item.direction === 'INCOMING' ? 'Внесение наличных' : 'Снятие наличных';
		}

		if (item.type === 'card-transfer') {
			const cardDigits =
				item.direction === 'INCOMING'
					? getCardLastDigits(data.config?.clientInfo.cardNumber)
					: getCardLastDigits(item.recipientCardNumber);

			return cardDigits ? `На карту ${cardDigits}` : 'Перевод на карту';
		}

		if (item.type === 'sbp-transfer') {
			return getShortRecipientName(item) || (item.direction === 'INCOMING' ? 'Входящий СБП перевод' : 'СБП перевод');
		}

		return item.type.replaceAll('-', ' ');
	};

	const getTransferBank = (bankId?: string) => transferBanks.find((bank) => bank.id === bankId);

	const getBankName = (bankId?: string) => getTransferBank(bankId)?.name ?? bankId ?? '';

	const getHistoryIcon = (item: NonNullable<PageData['config']>['history'][number]) =>
		getTransferBank(item.bankId)?.iconUrl;

	const toDateTimeLocal = (value: string) => {
		const date = new Date(value);

		if (Number.isNaN(date.getTime())) {
			return '';
		}

		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - offset * 60_000);

		return localDate.toISOString().slice(0, 16);
	};

	const getCurrentDateTimeLocal = () => {
		const now = new Date();
		const offset = now.getTimezoneOffset();
		const localDate = new Date(now.getTime() - offset * 60_000);

		return localDate.toISOString().slice(0, 16);
	};
</script>

<svelte:head>
	<title>{data.bankCode} · Банк</title>
</svelte:head>

<main class="min-h-screen bg-background">
	<section class="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-10">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-2">
				<a class="text-sm text-muted-foreground transition hover:text-foreground" href="/banks">← К банкам</a>
				<div>
					<p class="text-sm font-medium text-primary">{data.bankCode}</p>
					<h1 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						{formatBankName(data.bankCode)}
					</h1>
				</div>
			</div>
		</header>

		{#if data.error || !data.config}
			<Card class="border-destructive/30 bg-destructive/5">
				<CardHeader>
					<CardTitle class="text-destructive">{data.error}</CardTitle>
				</CardHeader>
			</Card>
		{:else}
			<section class="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]" aria-label="Сводка банка">
				<Card size="sm" class="bg-primary text-primary-foreground">
					<CardHeader>
						<CardTitle id="balance-title" class="text-xs uppercase tracking-[0.22em] opacity-80">
							Баланс
						</CardTitle>
						<CardAction>
							<Dialog bind:open={isBalanceDialogOpen}>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									class="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
									onclick={() => (isBalanceDialogOpen = true)}
								>
									Изменить
								</Button>

								<DialogContent>
									<DialogHeader>
										<DialogTitle>Изменить баланс</DialogTitle>
										<DialogDescription>
											Укажите новый баланс банка. Изменяется только значение баланса.
										</DialogDescription>
									</DialogHeader>

									<form
										method="POST"
										action="?/updateBalance"
										class="space-y-5"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();

												if (result.type === 'success') {
													isBalanceDialogOpen = false;
												}
											};
										}}
									>
										<div class="space-y-2">
											<label class="text-sm font-medium" for="balance">Баланс</label>
											<Input
												id="balance"
												name="balance"
												type="number"
												min="0"
												step="1"
												value={data.config.balance}
												required
											/>
											{#if form?.balanceError}
												<p class="text-sm text-destructive">{form.balanceError}</p>
											{/if}
										</div>

										<DialogFooter>
											<Button type="button" variant="ghost" onclick={() => (isBalanceDialogOpen = false)}>
												Отмена
											</Button>
											<Button type="submit">Сохранить</Button>
										</DialogFooter>
									</form>
								</DialogContent>
							</Dialog>
						</CardAction>
					</CardHeader>
					<CardContent class="space-y-6">
						<p class="text-4xl font-semibold tracking-tight">{formatMoney(data.config.balance)}</p>
						<div class="grid gap-3 text-xs text-primary-foreground/70">
							<div>
								<p>Создано</p>
								<p class="mt-1 font-medium text-primary-foreground">{formatDate(data.config.createdAt)}</p>
							</div>
							<div>
								<p>Обновлено</p>
								<p class="mt-1 font-medium text-primary-foreground">{formatDate(data.config.updatedAt)}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card size="sm">
					<CardHeader>
						<CardTitle>Информация о клиенте</CardTitle>
						<CardAction>
							<Dialog bind:open={isClientInfoDialogOpen}>
								<Button type="button" variant="outline" size="sm" onclick={() => (isClientInfoDialogOpen = true)}>
									Изменить
								</Button>

								<DialogContent>
									<DialogHeader>
										<DialogTitle>Изменить данные клиента</DialogTitle>
										<DialogDescription>
											ФИО будет сохранено с большой буквы, карта и телефон — в рабочем формате.
										</DialogDescription>
									</DialogHeader>

									<form
										method="POST"
										action="?/updateClientInfo"
										class="space-y-5"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();

												if (result.type === 'success') {
													isClientInfoDialogOpen = false;
												}
											};
										}}
									>
										<div class="grid gap-4 sm:grid-cols-3">
											<div class="space-y-2">
												<label class="text-sm font-medium" for="lastName">Фамилия</label>
												<Input
													id="lastName"
													name="lastName"
													value={data.config.clientInfo.lastName ?? ''}
													required
												/>
											</div>
											<div class="space-y-2">
												<label class="text-sm font-medium" for="firstName">Имя</label>
												<Input
													id="firstName"
													name="firstName"
													value={data.config.clientInfo.firstName ?? ''}
													required
												/>
											</div>
											<div class="space-y-2">
												<label class="text-sm font-medium" for="middleName">Отчество</label>
												<Input
													id="middleName"
													name="middleName"
													value={data.config.clientInfo.middleName ?? ''}
													required
												/>
											</div>
										</div>

										<div class="grid gap-4 sm:grid-cols-2">
											<div class="space-y-2">
												<label class="text-sm font-medium" for="cardNumber">Номер карты</label>
												<Input
													id="cardNumber"
													name="cardNumber"
													inputmode="numeric"
													placeholder="40817810000000000000"
													value={data.config.clientInfo.cardNumber}
													required
												/>
											</div>
											<div class="space-y-2">
												<label class="text-sm font-medium" for="phoneNumber">Телефон</label>
												<Input
													id="phoneNumber"
													name="phoneNumber"
													type="tel"
													placeholder="+79001234567"
													value={data.config.clientInfo.phoneNumber}
													required
												/>
											</div>
										</div>

										{#if form?.clientInfoError}
											<p class="text-sm text-destructive">{form.clientInfoError}</p>
										{/if}

										<DialogFooter>
											<Button type="button" variant="ghost" onclick={() => (isClientInfoDialogOpen = false)}>
												Отмена
											</Button>
											<Button type="submit">Сохранить</Button>
										</DialogFooter>
									</form>
								</DialogContent>
							</Dialog>
						</CardAction>
					</CardHeader>
					<CardContent class="grid gap-4 sm:grid-cols-2">
						<div class="rounded-3xl bg-muted/60 p-4 sm:col-span-2">
							<p class="text-xs text-muted-foreground">ФИО</p>
							<p class="mt-1 text-lg font-medium">{getFullName(data.config.clientInfo)}</p>
						</div>

						<div class="rounded-3xl bg-muted/60 p-4">
							<p class="text-xs text-muted-foreground">Карта</p>
							{#if data.config.clientInfo.cardNumber}
								<p class="mt-1 break-all font-mono text-sm">{data.config.clientInfo.cardNumber}</p>
							{:else}
								<p class="mt-1 text-sm text-muted-foreground">Не указана</p>
							{/if}
						</div>

						<div class="rounded-3xl bg-muted/60 p-4">
							<p class="text-xs text-muted-foreground">Телефон</p>
							{#if data.config.clientInfo.phoneNumber}
								<p class="mt-1 text-sm font-medium">{data.config.clientInfo.phoneNumber}</p>
							{:else}
								<p class="mt-1 text-sm text-muted-foreground">Не указан</p>
							{/if}
						</div>
					</CardContent>
				</Card>
			</section>

			<section aria-labelledby="history-title">
				<Card size="sm">
					<CardHeader>
						<CardTitle id="history-title">История</CardTitle>
						<CardAction>
							<div class="flex items-center gap-2">
								<form
									method="POST"
									action="?/clearHistory"
									use:enhance
									onsubmit={(event) => {
										if (!confirm('Очистить всю историю?')) {
											event.preventDefault();
										}
									}}
								>
									<Button type="submit" variant="destructive" size="sm">Очистить</Button>
								</form>

							<Dialog bind:open={isCreateHistoryDialogOpen}>
								<DialogTrigger
									class="inline-flex h-6 items-center justify-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/80"
								>
									Добавить
								</DialogTrigger>

								<DialogContent>
									<DialogHeader>
										<DialogTitle>Добавить операцию</DialogTitle>
										<DialogDescription>
											Время выбирается в обычном формате, при сохранении отправляется с часовым поясом +0700.
										</DialogDescription>
									</DialogHeader>

									<form
										method="POST"
										action="?/createHistoryItem"
										class="space-y-5"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();

												if (result.type !== 'failure' && result.type !== 'error') {
													isCreateHistoryDialogOpen = false;
												}
											};
										}}
									>
										<div class="space-y-2">
											<label class="text-sm font-medium" for="new-transferType">Тип операции</label>
											<select
												id="new-transferType"
												name="transferType"
												class={selectClass}
												bind:value={newHistoryType}
												required
											>
												<option value="cash-transfer">Наличные</option>
												<option value="card-transfer">Перевод на карту</option>
												<option value="sbp-transfer">СБП перевод</option>
											</select>
										</div>

										<div class="grid gap-4 sm:grid-cols-2">
											<div class="space-y-2">
												<label class="text-sm font-medium" for="new-amount">Сумма</label>
												<Input
													id="new-amount"
													name="amount"
													type="number"
													min="0"
													step="0.01"
													placeholder="8000"
													required
												/>
											</div>

											<div class="space-y-2">
												<label class="text-sm font-medium" for="new-balanceBefore">
													Баланс до операции
												</label>
												<Input
													id="new-balanceBefore"
													name="balanceBefore"
													type="number"
													min="0"
													step="0.01"
													value={data.config.balance}
													required
												/>
											</div>
										</div>

										<div class="grid gap-4 sm:grid-cols-2">
											<div class="space-y-2">
												<label class="text-sm font-medium" for="new-direction">Направление</label>
												<select
													id="new-direction"
													name="direction"
													class={selectClass}
													value="OUTGOING"
													required
												>
													<option value="INCOMING">Внесение</option>
													<option value="OUTGOING">Снятие</option>
												</select>
											</div>

											<div class="space-y-2">
												<label class="text-sm font-medium" for="new-time">Время</label>
												<Input
													id="new-time"
													name="time"
													type="datetime-local"
													value={getCurrentDateTimeLocal()}
													required
												/>
											</div>
										</div>

										{#if newHistoryType === 'card-transfer' || newHistoryType === 'sbp-transfer'}
											<div class="space-y-2">
												<label class="text-sm font-medium" for="new-bankId">Банк</label>
												<select id="new-bankId" name="bankId" class={selectClass} required>
													<option value="" disabled selected>Выберите банк</option>
													{#each transferBanks as bank}
														<option value={bank.id}>{bank.name}</option>
													{/each}
												</select>
											</div>
										{/if}

										{#if newHistoryType === 'card-transfer'}
											<div class="space-y-2">
												<label class="text-sm font-medium" for="new-recipientCardNumber">
													Карта получателя
												</label>
												<Input
													id="new-recipientCardNumber"
													name="recipientCardNumber"
													inputmode="numeric"
													placeholder="1234 5678 9100 0000"
													required
												/>
											</div>
										{/if}

										{#if newHistoryType === 'sbp-transfer'}
											<div class="grid gap-4 sm:grid-cols-3">
												<div class="space-y-2">
													<label class="text-sm font-medium" for="new-operationLastName">Фамилия</label>
													<Input
														id="new-operationLastName"
														name="operationLastName"
														placeholder="Гайнутдинов"
														required
													/>
												</div>
												<div class="space-y-2">
													<label class="text-sm font-medium" for="new-operationFirstName">Имя</label>
													<Input
														id="new-operationFirstName"
														name="operationFirstName"
														placeholder="Азат"
														required
													/>
												</div>
												<div class="space-y-2">
													<label class="text-sm font-medium" for="new-operationMiddleName">
														Отчество
													</label>
													<Input
														id="new-operationMiddleName"
														name="operationMiddleName"
														placeholder="Аликович"
														required
													/>
												</div>
											</div>

											<div class="space-y-2">
												<label class="text-sm font-medium" for="new-operationPhoneNumber">
													Телефон получателя
												</label>
												<Input
													id="new-operationPhoneNumber"
													name="operationPhoneNumber"
													type="tel"
													placeholder="+79099334005"
												/>
											</div>
										{/if}

										<DialogFooter>
											<Button type="submit">Добавить</Button>
										</DialogFooter>
									</form>
								</DialogContent>
							</Dialog>
							</div>
						</CardAction>
					</CardHeader>
					<CardContent>
						{#if form?.historyError}
							<p class="mb-3 text-sm text-destructive">{form.historyError}</p>
						{/if}

						{#if data.config.history.length === 0}
							<p class="text-muted-foreground">Операций пока нет.</p>
						{:else}
							<div class="grid gap-3">
								{#each data.config.history as item (item.id)}
									<article class="relative grid grid-cols-[3.5rem_1fr] gap-4 rounded-3xl border border-border bg-muted/30 p-4">
										<div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-base font-bold">
											{#if getHistoryIcon(item)}
												<img
													class="size-full object-cover"
													src={getHistoryIcon(item)}
													alt={getBankName(item.bankId)}
												/>
											{:else}
												₽
											{/if}
										</div>

										<div class="min-w-0">
											<div class="flex items-start justify-between gap-4">
												<div class="min-w-0">
													<div class="flex flex-wrap items-center gap-2">
														<p class="truncate text-sm font-semibold tracking-wide">
															{getHistoryTitle(item)}
														</p>
														<span class="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
															{formatDate(item.time)}
														</span>
													</div>
												</div>

												<p
													class:text-primary={formatHistoryAmount(item.amount, item.direction).startsWith('+')}
													class:text-destructive={formatHistoryAmount(item.amount, item.direction).startsWith('-')}
													class="whitespace-nowrap text-right text-xl font-semibold"
												>
													{formatHistoryAmount(item.amount, item.direction)}
												</p>
											</div>

											<div class="mt-2 min-w-0 pr-32 sm:pr-40">
												<p class="truncate text-sm text-muted-foreground">
													Баланс до операции: {formatMoney(item.balanceBefore)}
												</p>
											</div>

											<div class="absolute right-4 bottom-4 flex gap-2">
												<Dialog>
													<DialogTrigger
														class="inline-flex h-6 items-center justify-center rounded-md border border-border px-2 text-xs font-medium transition hover:bg-muted"
													>
														Изменить
													</DialogTrigger>

													<DialogContent>
														<DialogHeader>
															<DialogTitle>Изменить операцию</DialogTitle>
															<DialogDescription>
																После сохранения история загрузится заново, потому что id операции может измениться.
															</DialogDescription>
														</DialogHeader>

														<form
															method="POST"
															action="?/updateHistoryItem"
															class="space-y-5"
															use:enhance
														>
															<input type="hidden" name="id" value={item.id} />
															<input type="hidden" name="transferType" value={item.type} />

															<div class="grid gap-4 sm:grid-cols-2">
																<div class="space-y-2">
																	<label class="text-sm font-medium" for={`amount-${item.id}`}>Сумма</label>
																	<Input
																		id={`amount-${item.id}`}
																		name="amount"
																		type="number"
																		min="0"
																		step="0.01"
																		value={item.amount}
																		required
																	/>
																</div>

																<div class="space-y-2">
																	<label class="text-sm font-medium" for={`balanceBefore-${item.id}`}>
																		Баланс до операции
																	</label>
																	<Input
																		id={`balanceBefore-${item.id}`}
																		name="balanceBefore"
																		type="number"
																		min="0"
																		step="0.01"
																		value={item.balanceBefore}
																		required
																	/>
																</div>
															</div>

															<div class="grid gap-4 sm:grid-cols-2">
																<div class="space-y-2">
																	<label class="text-sm font-medium" for={`direction-${item.id}`}>
																		Направление
																	</label>
																	<select
																		id={`direction-${item.id}`}
																		name="direction"
																		class={selectClass}
																		value={item.direction}
																		required
																	>
																		<option value="INCOMING">Внесение</option>
																		<option value="OUTGOING">Снятие</option>
																	</select>
																</div>

																<div class="space-y-2">
																	<label class="text-sm font-medium" for={`time-${item.id}`}>Время</label>
																	<Input
																		id={`time-${item.id}`}
																		name="time"
																		type="datetime-local"
																		value={toDateTimeLocal(item.time)}
																		required
																	/>
																</div>
															</div>

															{#if item.type === 'card-transfer' || item.type === 'sbp-transfer'}
																<div class="space-y-2">
																	<label class="text-sm font-medium" for={`bankId-${item.id}`}>Банк</label>
																	<select id={`bankId-${item.id}`} name="bankId" class={selectClass} required>
																		{#each transferBanks as bank}
																			<option value={bank.id} selected={bank.id === item.bankId}>
																				{bank.name}
																			</option>
																		{/each}
																	</select>
																</div>
															{/if}

															{#if item.type === 'card-transfer'}
																<div class="space-y-2">
																	<label class="text-sm font-medium" for={`recipientCardNumber-${item.id}`}>
																		Карта получателя
																	</label>
																	<Input
																		id={`recipientCardNumber-${item.id}`}
																		name="recipientCardNumber"
																		inputmode="numeric"
																		value={item.recipientCardNumber ?? ''}
																		required
																	/>
																</div>
															{/if}

															{#if item.type === 'sbp-transfer'}
																<div class="grid gap-4 sm:grid-cols-3">
																	<div class="space-y-2">
																		<label class="text-sm font-medium" for={`operationLastName-${item.id}`}>
																			Фамилия
																		</label>
																		<Input
																			id={`operationLastName-${item.id}`}
																			name="operationLastName"
																			value={item.operationLastName ?? ''}
																			required
																		/>
																	</div>
																	<div class="space-y-2">
																		<label class="text-sm font-medium" for={`operationFirstName-${item.id}`}>
																			Имя
																		</label>
																		<Input
																			id={`operationFirstName-${item.id}`}
																			name="operationFirstName"
																			value={item.operationFirstName ?? ''}
																			required
																		/>
																	</div>
																	<div class="space-y-2">
																		<label class="text-sm font-medium" for={`operationMiddleName-${item.id}`}>
																			Отчество
																		</label>
																		<Input
																			id={`operationMiddleName-${item.id}`}
																			name="operationMiddleName"
																			value={item.operationMiddleName ?? ''}
																			required
																		/>
																	</div>
																</div>

																<div class="space-y-2">
																	<label class="text-sm font-medium" for={`phoneNumber-${item.id}`}>
																		Телефон получателя
																	</label>
																	<Input
																		id={`phoneNumber-${item.id}`}
																		name="phoneNumber"
																		type="tel"
																		value={item.phoneNumber ?? ''}
																		required
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
													action="?/deleteHistoryItem"
													use:enhance
													onsubmit={(event) => {
														if (!confirm('Удалить эту операцию?')) {
															event.preventDefault();
														}
													}}
												>
													<input type="hidden" name="id" value={item.id} />
													<Button type="submit" variant="destructive" size="sm">Удалить</Button>
												</form>
											</div>
										</div>
									</article>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>
			</section>
		{/if}
	</section>
</main>
