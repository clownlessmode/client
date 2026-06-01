import { fail, redirect } from '@sveltejs/kit';
import {
	BEELINE_API_BASE,
	normalizePaymentDirection,
	normalizeReceiverCard,
	normalizeSimNumber,
	parseApiError,
	toPaymentRFC3339
} from '$lib/beeline/utils';
import type { Config, Detalization, Payment, PaymentDirection } from '$lib/beeline/types';

const MIN_OUTGOING_AMOUNT = 924;

const validatePaymentAmount = (amount: number, direction: PaymentDirection) => {
	if (!Number.isFinite(amount)) {
		return 'Введите корректную сумму';
	}

	if (direction === 'outgoing' && amount < MIN_OUTGOING_AMOUNT) {
		return `Минимальная сумма для списания — ${MIN_OUTGOING_AMOUNT} ₽`;
	}

	if (direction === 'incoming' && amount <= 0) {
		return 'Сумма пополнения должна быть больше 0';
	}

	return null;
};

const loadDetalization = async (fetch: typeof globalThis.fetch, number: string) => {
	const response = await fetch(`${BEELINE_API_BASE}/sims/${number}/detalization`, {
		headers: { accept: 'application/json' }
	});

	if (!response.ok) {
		return {
			data: null,
			error: 'Не удалось загрузить детализацию'
		};
	}

	return {
		data: (await response.json()) as Detalization,
		error: null
	};
};

const loadPayments = async (fetch: typeof globalThis.fetch, number: string) => {
	const response = await fetch(`${BEELINE_API_BASE}/sims/${number}/payments`, {
		headers: { accept: 'application/json' }
	});

	if (!response.ok) {
		return [] as Payment[];
	}

	return (await response.json()) as Payment[];
};

export async function load({ fetch, params }) {
	const number = normalizeSimNumber(params.number);

	if (!number) {
		return {
			number: params.number,
			config: null,
			detalization: Promise.resolve({ data: null, error: 'Некорректный номер SIM' }),
			payments: Promise.resolve([] as Payment[]),
			error: 'Некорректный номер SIM'
		};
	}

	const configResponse = await fetch(`${BEELINE_API_BASE}/sims/${number}/config`, {
		headers: { accept: 'application/json' }
	});

	if (!configResponse.ok) {
		return {
			number,
			config: null,
			detalization: Promise.resolve({ data: null, error: null }),
			payments: Promise.resolve([] as Payment[]),
			error: configResponse.status === 404 ? 'SIM-карта не найдена' : 'Не удалось загрузить данные SIM'
		};
	}

	const config = (await configResponse.json()) as Config;

	return {
		number,
		config,
		detalization: loadDetalization(fetch, number),
		payments: loadPayments(fetch, number),
		error: null
	};
}

export const actions = {
	createPayment: async ({ fetch, request, params }) => {
		const number = normalizeSimNumber(params.number);

		if (!number) {
			return fail(400, { paymentError: 'Некорректный номер SIM' });
		}

		const formData = await request.formData();
		const direction = normalizePaymentDirection(formData.get('direction')) ?? 'outgoing';
		const amount = Number(formData.get('amount'));
		const paidAt = toPaymentRFC3339(formData.get('paidAt'));
		const receiverCard =
			direction === 'outgoing' ? normalizeReceiverCard(formData.get('receiverCard')) : '';

		const amountError = validatePaymentAmount(amount, direction);

		if (amountError) {
			return fail(400, { paymentError: amountError });
		}

		if (!paidAt) {
			return fail(400, { paymentError: 'Введите корректную дату и время операции' });
		}

		if (direction === 'outgoing' && !receiverCard) {
			return fail(400, {
				paymentError: 'Карта получателя должна быть в формате 220094**0028'
			});
		}

		const payload: Record<string, string | number> = {
			direction,
			amount,
			paidAt
		};

		if (direction === 'outgoing' && receiverCard) {
			payload.receiverCard = receiverCard;
		}

		const response = await fetch(`${BEELINE_API_BASE}/sims/${number}/payments`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			return fail(response.status, {
				paymentError: await parseApiError(response)
			});
		}

		const tab = direction === 'incoming' ? '?tab=incoming' : '';
		redirect(303, `/banks/beeline/${number}${tab}`);
	},
	updatePayment: async ({ fetch, request, params }) => {
		const number = normalizeSimNumber(params.number);

		if (!number) {
			return fail(400, { paymentError: 'Некорректный номер SIM' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');

		if (!id) {
			return fail(400, { paymentError: 'Не найден платёж для изменения' });
		}

		const payload: Record<string, string | number> = {};
		const directionValue = formData.get('direction');
		const direction = directionValue ? normalizePaymentDirection(directionValue) : null;
		const amountValue = formData.get('amount');
		const paidAtValue = formData.get('paidAt');
		const receiverCardValue = formData.get('receiverCard');

		if (direction) {
			payload.direction = direction;
		}

		if (amountValue !== null && amountValue !== '') {
			const amount = Number(amountValue);
			const effectiveDirection = direction ?? normalizePaymentDirection(formData.get('currentDirection'));

			if (effectiveDirection) {
				const amountError = validatePaymentAmount(amount, effectiveDirection);

				if (amountError) {
					return fail(400, { paymentError: amountError });
				}
			}

			payload.amount = amount;
		}

		if (paidAtValue !== null && paidAtValue !== '') {
			const paidAt = toPaymentRFC3339(paidAtValue);

			if (!paidAt) {
				return fail(400, { paymentError: 'Введите корректную дату и время операции' });
			}

			payload.paidAt = paidAt;
		}

		if (receiverCardValue !== null && receiverCardValue !== '') {
			const receiverCard = normalizeReceiverCard(receiverCardValue);

			if (!receiverCard && (direction === 'outgoing' || !direction)) {
				return fail(400, {
					paymentError: 'Карта получателя должна быть в формате 220094**0028'
				});
			}

			if (receiverCard) {
				payload.receiverCard = receiverCard;
			}
		}

		const response = await fetch(`${BEELINE_API_BASE}/sims/${number}/payments/${id}`, {
			method: 'PATCH',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			return fail(response.status, {
				paymentError: await parseApiError(response)
			});
		}

		redirect(303, `/banks/beeline/${number}`);
	},
	deletePayment: async ({ fetch, request, params }) => {
		const number = normalizeSimNumber(params.number);

		if (!number) {
			return fail(400, { paymentError: 'Некорректный номер SIM' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');

		if (!id) {
			return fail(400, { paymentError: 'Не найден платёж для удаления' });
		}

		const response = await fetch(`${BEELINE_API_BASE}/sims/${number}/payments/${id}`, {
			method: 'DELETE',
			headers: { accept: 'application/json' }
		});

		if (!response.ok) {
			return fail(response.status, {
				paymentError: await parseApiError(response)
			});
		}

		redirect(303, `/banks/beeline/${number}`);
	},
	hideTransaction: async ({ fetch, request, params }) => {
		const number = normalizeSimNumber(params.number);

		if (!number) {
			return fail(400, { transactionError: 'Некорректный номер SIM' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');

		if (!id) {
			return fail(400, { transactionError: 'Не найдена операция для скрытия' });
		}

		const response = await fetch(
			`${BEELINE_API_BASE}/sims/${number}/detalization/transactions/${encodeURIComponent(id)}`,
			{
				method: 'DELETE',
				headers: { accept: 'application/json' }
			}
		);

		if (!response.ok) {
			return fail(response.status, {
				transactionError: await parseApiError(response)
			});
		}

		redirect(303, `/banks/beeline/${number}`);
	},
	deleteSim: async ({ fetch, params }) => {
		const number = normalizeSimNumber(params.number);

		if (!number) {
			return fail(400, { simError: 'Некорректный номер SIM' });
		}

		const response = await fetch(`${BEELINE_API_BASE}/sims/${number}`, {
			method: 'DELETE',
			headers: { accept: 'application/json' }
		});

		if (!response.ok) {
			return fail(response.status, {
				simError: await parseApiError(response)
			});
		}

		redirect(303, '/banks/beeline');
	}
};
