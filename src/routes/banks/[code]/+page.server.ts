import { fail, redirect } from '@sveltejs/kit';

type ClientInfo = {
	cardNumber: string;
	firstName: string;
	lastName: string;
	middleName: string;
	phoneNumber: string;
};

type HistoryItem = {
	amount: number;
	balanceBefore: number;
	direction: string;
	bankId?: string;
	id: string;
	operationFirstName?: string;
	operationLastName?: string;
	operationMiddleName?: string;
	phoneNumber?: string;
	recipientCardNumber?: string;
	time: string;
	type: string;
};

export type BankConfig = {
	balance: number;
	clientInfo: ClientInfo;
	createdAt: string;
	history: HistoryItem[];
	updatedAt: string;
};

const normalizeName = (value: FormDataEntryValue | null) => {
	const compactValue = String(value ?? '').replace(/\s+/g, '');

	if (!/^[\p{L}-]+$/u.test(compactValue)) {
		return null;
	}

	return compactValue
		.split('-')
		.map((part) => {
			const normalizedPart = part.toLocaleLowerCase('ru-RU');

			return `${normalizedPart.charAt(0).toLocaleUpperCase('ru-RU')}${normalizedPart.slice(1)}`;
		})
		.join('-');
};

const normalizeCardNumber = (value: FormDataEntryValue | null) => {
	const cardNumber = String(value ?? '').replace(/\s+/g, '');

	if (!/^\d{20}$/.test(cardNumber)) {
		return null;
	}

	return cardNumber;
};

const normalizeRecipientCardNumber = (value: FormDataEntryValue | null) => {
	const cardNumber = String(value ?? '').replace(/\s+/g, '');

	if (!/^\d{16,20}$/.test(cardNumber)) {
		return null;
	}

	return cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

const normalizeRequiredString = (value: FormDataEntryValue | null) => {
	const normalizedValue = String(value ?? '').trim();

	return normalizedValue.length > 0 ? normalizedValue : null;
};

const normalizePhoneNumber = (value: FormDataEntryValue | null) => {
	const phoneNumber = String(value ?? '').replace(/[\s()-]/g, '');
	const normalizedPhoneNumber =
		phoneNumber.startsWith('8') && phoneNumber.length === 11
			? `+7${phoneNumber.slice(1)}`
			: phoneNumber.startsWith('7') && phoneNumber.length === 11
				? `+${phoneNumber}`
				: phoneNumber;

	if (!/^\+7\d{10}$/.test(normalizedPhoneNumber)) {
		return null;
	}

	return normalizedPhoneNumber;
};

const normalizeHistoryTime = (value: FormDataEntryValue | null) => {
	const time = String(value ?? '').trim();

	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) {
		return `${time}:00+0700`;
	}

	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(time)) {
		return `${time}+0700`;
	}

	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$/.test(time)) {
		return time;
	}

	return null;
};

export async function load({ fetch, params }) {
	const response = await fetch(`http://localhost:8080/banks/${params.code}/config`, {
		headers: {
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		return {
			bankCode: params.code,
			config: null,
			error: 'Не удалось загрузить конфигурацию банка'
		};
	}

	return {
		bankCode: params.code,
		config: (await response.json()) as BankConfig,
		error: null
	};
}

export const actions = {
	updateBalance: async ({ fetch, request, params }) => {
		const formData = await request.formData();
		const balance = Number(formData.get('balance'));

		if (!Number.isFinite(balance)) {
			return fail(400, {
				balanceError: 'Введите корректный баланс'
			});
		}

		const response = await fetch(`http://localhost:8080/banks/${params.code}/config/balance`, {
			method: 'PATCH',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: JSON.stringify({ balance })
		});

		if (!response.ok) {
			return fail(response.status, {
				balanceError: 'Не удалось изменить баланс'
			});
		}

		redirect(303, `/banks/${params.code}`);
	},
	updateClientInfo: async ({ fetch, request, params }) => {
		const formData = await request.formData();
		const firstName = normalizeName(formData.get('firstName'));
		const lastName = normalizeName(formData.get('lastName'));
		const middleName = normalizeName(formData.get('middleName'));
		const cardNumber = normalizeCardNumber(formData.get('cardNumber'));
		const phoneNumber = normalizePhoneNumber(formData.get('phoneNumber'));

		if (!firstName || !lastName || !middleName) {
			return fail(400, {
				clientInfoError: 'ФИО должно содержать только буквы, без пробелов и лишних символов'
			});
		}

		if (!cardNumber) {
			return fail(400, {
				clientInfoError: 'Номер карты должен содержать ровно 20 цифр'
			});
		}

		if (!phoneNumber) {
			return fail(400, {
				clientInfoError: 'Телефон должен быть в формате +79001234567'
			});
		}

		const response = await fetch(`http://localhost:8080/banks/${params.code}/config/client-info`, {
			method: 'PATCH',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				cardNumber,
				firstName,
				lastName,
				middleName,
				phoneNumber
			})
		});

		if (!response.ok) {
			return fail(response.status, {
				clientInfoError: 'Не удалось изменить информацию о клиенте'
			});
		}

		redirect(303, `/banks/${params.code}`);
	},
	updateHistoryItem: async ({ fetch, request, params }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		const transferType = String(formData.get('transferType') ?? '');
		const amount = Number(formData.get('amount'));
		const balanceBefore = Number(formData.get('balanceBefore'));
		const direction = String(formData.get('direction') ?? '');
		const time = normalizeHistoryTime(formData.get('time'));
		const bankId = normalizeRequiredString(formData.get('bankId'));

		if (!id) {
			return fail(400, {
				historyError: 'Не найдена операция для изменения'
			});
		}

		if (!Number.isFinite(amount) || amount < 0) {
			return fail(400, {
				historyError: 'Введите корректную сумму операции'
			});
		}

		if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
			return fail(400, {
				historyError: 'Введите корректный баланс до операции'
			});
		}

		if (direction !== 'INCOMING' && direction !== 'OUTGOING') {
			return fail(400, {
				historyError: 'Выберите направление операции'
			});
		}

		if (!time) {
			return fail(400, {
				historyError: 'Введите корректное время операции'
			});
		}

		if (
			transferType !== 'cash-transfer' &&
			transferType !== 'card-transfer' &&
			transferType !== 'sbp-transfer'
		) {
			return fail(400, {
				historyError: 'Неизвестный тип операции'
			});
		}

		const payload: Record<string, number | string> = {
			amount,
			balanceBefore,
			direction,
			time
		};

		if (transferType === 'card-transfer') {
			const recipientCardNumber = normalizeRecipientCardNumber(formData.get('recipientCardNumber'));

			if (!bankId) {
				return fail(400, {
					historyError: 'Выберите банк для перевода на карту'
				});
			}

			if (!recipientCardNumber) {
				return fail(400, {
					historyError: 'Введите корректный номер карты получателя'
				});
			}

			payload.bankId = bankId;
			payload.recipientCardNumber = recipientCardNumber;
		}

		if (transferType === 'sbp-transfer') {
			const operationFirstName = normalizeName(formData.get('operationFirstName'));
			const operationLastName = normalizeName(formData.get('operationLastName'));
			const operationMiddleName = normalizeName(formData.get('operationMiddleName'));
			const phoneNumber = normalizePhoneNumber(formData.get('phoneNumber'));

			if (!bankId) {
				return fail(400, {
					historyError: 'Выберите банк для СБП перевода'
				});
			}

			if (!operationFirstName || !operationLastName || !operationMiddleName) {
				return fail(400, {
					historyError: 'ФИО получателя должно содержать только буквы'
				});
			}

			if (!phoneNumber) {
				return fail(400, {
					historyError: 'Телефон получателя должен быть в формате +79001234567'
				});
			}

			payload.bankId = bankId;
			payload.operationFirstName = operationFirstName;
			payload.operationLastName = operationLastName;
			payload.operationMiddleName = operationMiddleName;
			payload.phoneNumber = phoneNumber;
		}

		const response = await fetch(
			`http://localhost:8080/banks/${params.code}/config/history/items/${encodeURIComponent(id)}/${transferType}`,
			{
				method: 'PATCH',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			}
		);

		if (!response.ok) {
			return fail(response.status, {
				historyError: 'Не удалось изменить операцию'
			});
		}

		redirect(303, `/banks/${params.code}`);
	},
	createHistoryItem: async ({ fetch, request, params }) => {
		const formData = await request.formData();
		const transferType = String(formData.get('transferType') ?? '');
		const amount = Number(formData.get('amount'));
		const balanceBefore = Number(formData.get('balanceBefore'));
		const direction = String(formData.get('direction') ?? '');
		const time = normalizeHistoryTime(formData.get('time'));
		const bankId = normalizeRequiredString(formData.get('bankId'));

		if (!Number.isFinite(amount) || amount < 0) {
			return fail(400, {
				historyError: 'Введите корректную сумму операции'
			});
		}

		if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
			return fail(400, {
				historyError: 'Введите корректный баланс до операции'
			});
		}

		if (direction !== 'INCOMING' && direction !== 'OUTGOING') {
			return fail(400, {
				historyError: 'Выберите направление операции'
			});
		}

		if (!time) {
			return fail(400, {
				historyError: 'Введите корректное время операции'
			});
		}

		const payload: Record<string, number | string> = {
			amount,
			balanceBefore,
			direction,
			time
		};

		if (transferType === 'card-transfer') {
			const recipientCardNumber = normalizeRecipientCardNumber(formData.get('recipientCardNumber'));

			if (!bankId) {
				return fail(400, {
					historyError: 'Введите банк для перевода на карту'
				});
			}

			if (!recipientCardNumber) {
				return fail(400, {
					historyError: 'Введите корректный номер карты получателя'
				});
			}

			payload.bankId = bankId;
			payload.recipientCardNumber = recipientCardNumber;
		} else if (transferType === 'sbp-transfer') {
			const operationFirstName = normalizeName(formData.get('operationFirstName'));
			const operationLastName = normalizeName(formData.get('operationLastName'));
			const operationMiddleName = normalizeName(formData.get('operationMiddleName'));
			const phoneNumberValue = String(formData.get('operationPhoneNumber') ?? '').trim();
			const phoneNumber = phoneNumberValue ? normalizePhoneNumber(phoneNumberValue) : null;

			if (!bankId) {
				return fail(400, {
					historyError: 'Введите банк для СБП перевода'
				});
			}

			if (!operationFirstName || !operationLastName || !operationMiddleName) {
				return fail(400, {
					historyError: 'ФИО получателя должно содержать только буквы'
				});
			}

			if (phoneNumberValue && !phoneNumber) {
				return fail(400, {
					historyError: 'Телефон получателя должен быть в формате +79001234567'
				});
			}

			payload.bankId = bankId;
			payload.operationFirstName = operationFirstName;
			payload.operationLastName = operationLastName;
			payload.operationMiddleName = operationMiddleName;

			if (phoneNumber) {
				payload.phoneNumber = phoneNumber;
			}
		} else if (transferType !== 'cash-transfer') {
			return fail(400, {
				historyError: 'Выберите тип операции'
			});
		}

		const response = await fetch(
			`http://localhost:8080/banks/${params.code}/config/history/${transferType}`,
			{
				method: 'POST',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			}
		);

		if (!response.ok) {
			return fail(response.status, {
				historyError: 'Не удалось добавить операцию'
			});
		}

		redirect(303, `/banks/${params.code}`);
	},
	deleteHistoryItem: async ({ fetch, request, params }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');

		if (!id) {
			return fail(400, {
				historyError: 'Не найдена операция для удаления'
			});
		}

		const response = await fetch(
			`http://localhost:8080/banks/${params.code}/config/history/items/${encodeURIComponent(id)}`,
			{
				method: 'DELETE',
				headers: {
					accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			return fail(response.status, {
				historyError: 'Не удалось удалить операцию'
			});
		}

		redirect(303, `/banks/${params.code}`);
	},
	clearHistory: async ({ fetch, params }) => {
		const response = await fetch(`http://localhost:8080/banks/${params.code}/config/history`, {
			method: 'DELETE',
			headers: {
				accept: 'application/json'
			}
		});

		if (!response.ok) {
			return fail(response.status, {
				historyError: 'Не удалось очистить историю'
			});
		}

		redirect(303, `/banks/${params.code}`);
	}
};
