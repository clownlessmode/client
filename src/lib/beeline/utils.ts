import type { DetalizationTransaction, Payment, PaymentDirection } from './types';

export const BEELINE_API_BASE = 'http://localhost:8080/banks/beeline';

export const RECEIVER_CARD_HTML_PATTERN = '[0-9]{6}[*][*][0-9]{4}';
export const RECEIVER_CARD_TITLE = 'Формат: 220094**0028 (6 цифр + ** + 4 цифры)';

export const normalizeSimNumber = (value: FormDataEntryValue | null) => {
	const digits = String(value ?? '').replace(/\D/g, '');

	if (digits.length === 10) {
		return digits;
	}

	if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
		return digits.slice(1);
	}

	return null;
};

export const formatSimNumber = (number: string) => {
	if (number.length !== 10) {
		return number;
	}

	return `+7 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6, 8)}-${number.slice(8)}`;
};

export const normalizeReceiverCard = (value: FormDataEntryValue | null) => {
	const card = String(value ?? '')
		.replace(/\s+/g, '')
		.replace(/[＊∗]/g, '*');

	if (!/^\d{6}\*\*\d{4}$/.test(card)) {
		return null;
	}

	return card;
};

export const normalizePaymentDirection = (value: FormDataEntryValue | null): PaymentDirection | null => {
	const direction = String(value ?? '').trim();

	if (direction === 'outgoing' || direction === 'incoming') {
		return direction;
	}

	return null;
};

const PAYMENT_TIME_SHIFT_HOURS = 2;
const PAYMENT_RFC3339_OFFSET = '+03:00';

const parseNaiveDateTimeLocal = (value: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());

	if (!match) {
		return null;
	}

	const [, year, month, day, hour, minute] = match;

	return {
		year: Number(year),
		month: Number(month),
		day: Number(day),
		hour: Number(hour),
		minute: Number(minute)
	};
};

const formatNaiveDateTimeLocal = (date: Date) => {
	const pad = (part: number) => String(part).padStart(2, '0');

	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

const shiftNaiveDateTimeLocal = (
	value: string,
	hours: number
) => {
	const parsed = parseNaiveDateTimeLocal(value);

	if (!parsed) {
		return null;
	}

	return formatNaiveDateTimeLocal(
		new Date(
			Date.UTC(
				parsed.year,
				parsed.month - 1,
				parsed.day,
				parsed.hour + hours,
				parsed.minute,
				0
			)
		)
	);
};

/** datetime-local из формы → RFC3339 для API (ввод 17:24 → отправка 15:24+03:00). */
export const toPaymentRFC3339 = (value: FormDataEntryValue | null) => {
	const shifted = shiftNaiveDateTimeLocal(String(value ?? ''), -PAYMENT_TIME_SHIFT_HOURS);

	if (!shifted) {
		return null;
	}

	return `${shifted}:00${PAYMENT_RFC3339_OFFSET}`;
};

/** RFC3339 из API → datetime-local для формы (15:24+03:00 → 17:24). */
export const toPaymentDateTimeLocal = (value: string) =>
	shiftNaiveDateTimeLocal(value, PAYMENT_TIME_SHIFT_HOURS) ?? '';

export const toRFC3339 = (value: FormDataEntryValue | null) => {
	const time = String(value ?? '').trim();

	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) {
		return null;
	}

	const date = new Date(time);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	const pad = (part: number) => String(part).padStart(2, '0');
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? '+' : '-';
	const absoluteOffset = Math.abs(offsetMinutes);

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
};

export const toDateTimeLocal = (value: string) => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return '';
	}

	const offset = date.getTimezoneOffset();
	const localDate = new Date(date.getTime() - offset * 60_000);

	return localDate.toISOString().slice(0, 16);
};

export const getCurrentDateTimeLocal = () => toDateTimeLocal(new Date().toISOString());

export const getCurrentPaymentDateTimeLocal = () => {
	const parts = new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'Europe/Moscow',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(new Date());

	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? '00';

	return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

export const calcCommission = (amount: number) => Math.round(amount * 0.065 * 100) / 100;

export const calcTotal = (amount: number, direction: PaymentDirection) =>
	direction === 'outgoing' ? amount + calcCommission(amount) : amount;

export const currencyFormatter = new Intl.NumberFormat('ru-RU', {
	style: 'currency',
	currency: 'RUB',
	maximumFractionDigits: 2
});

export const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});

export const formatMoney = (amount: number | null) =>
	amount === null ? '—' : currencyFormatter.format(amount);

export const formatDate = (value: string) => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return dateFormatter.format(date);
};

export const parseApiError = async (response: Response) => {
	try {
		const payload = (await response.json()) as { error?: string };

		return payload.error ?? 'Неизвестная ошибка';
	} catch {
		return 'Неизвестная ошибка';
	}
};

export const getTransactionChangeValue = (transaction: DetalizationTransaction) =>
	transaction.balances?.[0]?.changeValue ?? 0;

export const getTransactionKey = (transaction: DetalizationTransaction, index: number) =>
	`${transaction.id}:${transaction.dateTime}:${index}`;

export const paymentToTransaction = (payment: Payment): DetalizationTransaction => ({
	id: payment.id,
	source: 'payment',
	dateTime: payment.paidAt,
	name: payment.direction === 'incoming' ? 'Пополнение' : 'Мобильная коммерция',
	balances: [
		{
			changeValue: payment.direction === 'incoming' ? payment.amount : -payment.total
		}
	]
});

export const mergePaymentsIntoTransactions = (
	transactions: DetalizationTransaction[],
	payments: Payment[]
) => {
	const ids = new Set(transactions.map((transaction) => transaction.id));
	const merged = [...transactions];

	for (const payment of payments) {
		if (!ids.has(payment.id)) {
			merged.push(paymentToTransaction(payment));
		}
	}

	return merged.sort(
		(a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
	);
};

export const getPaymentForTransaction = (
	transaction: DetalizationTransaction,
	payments: Payment[]
) => payments.find((payment) => payment.id === transaction.id) ?? null;

export const splitTransactionsByDirection = (
	transactions: DetalizationTransaction[],
	payments: Payment[] = []
) => {
	const outgoing: DetalizationTransaction[] = [];
	const incoming: DetalizationTransaction[] = [];

	for (const transaction of transactions) {
		const payment = getPaymentForTransaction(transaction, payments);
		const changeValue = getTransactionChangeValue(transaction);

		if (payment) {
			if (payment.direction === 'incoming') {
				incoming.push(transaction);
			} else {
				outgoing.push(transaction);
			}
			continue;
		}

		if (changeValue === 0) {
			continue;
		}

		if (changeValue < 0) {
			outgoing.push(transaction);
		} else {
			incoming.push(transaction);
		}
	}

	return { outgoing, incoming };
};

export const formatTransactionAmount = (changeValue: number) => {
	const prefix = changeValue >= 0 ? '+' : '-';

	return `${prefix}${formatMoney(Math.abs(changeValue))}`;
};

export const isBeelineTransaction = (
	transaction: DetalizationTransaction,
	payments: Payment[]
) => transaction.source === 'beeline' && !getPaymentForTransaction(transaction, payments);

export const getTransactionSourceLabel = (
	transaction: DetalizationTransaction,
	payments: Payment[]
) => {
	if (getPaymentForTransaction(transaction, payments)) {
		return 'Наш платёж';
	}

	return transaction.source === 'beeline' ? 'Билайн' : 'Наш платёж';
};

export const capitalizeFirst = (value: string) =>
	value ? `${value.charAt(0).toLocaleUpperCase('ru-RU')}${value.slice(1)}` : value;
