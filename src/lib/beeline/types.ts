export interface Sim {
	number: string;
	createdAt: string;
	updatedAt: string;
}

export interface Config {
	number: string;
	balance: number | null;
	paymentsTotal: number;
	createdAt: string;
	updatedAt: string;
}

export type PaymentDirection = 'outgoing' | 'incoming';
export type PaymentSource = 'manual' | 'payment_flow';

export interface Payment {
	id: string;
	simNumber: string;
	direction: PaymentDirection;
	receiverCard?: string;
	amount: number;
	commission: number;
	total: number;
	source: PaymentSource;
	paidAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface ApiError {
	error: string;
}

export interface CreateSimRequest {
	number: string;
}

export interface CreatePaymentRequest {
	direction?: PaymentDirection;
	receiverCard?: string;
	amount: number;
	paidAt: string;
}

export interface UpdatePaymentRequest {
	direction?: PaymentDirection;
	receiverCard?: string;
	amount?: number;
	paidAt?: string;
}

export type TransactionSource = 'beeline' | 'payment';

export interface DetalizationBalanceEntry {
	changeValue?: number;
	startValue?: number;
	endValue?: number;
}

export interface DetalizationTransaction {
	id: string;
	source?: TransactionSource;
	dateTime: string;
	category?: string;
	name: string;
	balances?: DetalizationBalanceEntry[];
}

export interface DetalizationData {
	transactions: DetalizationTransaction[];
	balances: DetalizationBalanceEntry[];
	categories: unknown[];
}

export interface Detalization {
	number: string;
	periodStart: string;
	periodEnd: string;
	balance: number;
	data: DetalizationData;
	createdAt: string;
	updatedAt: string;
}
