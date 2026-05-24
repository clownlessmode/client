import { fail, redirect } from '@sveltejs/kit';
import { BEELINE_API_BASE, normalizeSimNumber, parseApiError } from '$lib/beeline/utils';
import type { Sim } from '$lib/beeline/types';

export async function load({ fetch }) {
	const response = await fetch(`${BEELINE_API_BASE}/sims`, {
		headers: {
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		return {
			sims: [] as Sim[],
			error: 'Не удалось загрузить список SIM-карт'
		};
	}

	return {
		sims: (await response.json()) as Sim[],
		error: null
	};
}

export const actions = {
	createSim: async ({ fetch, request }) => {
		const formData = await request.formData();
		const number = normalizeSimNumber(formData.get('number'));

		if (!number) {
			return fail(400, {
				createSimError: 'Номер должен содержать 10 цифр без +7'
			});
		}

		const response = await fetch(`${BEELINE_API_BASE}/sims`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: JSON.stringify({ number })
		});

		if (!response.ok) {
			return fail(response.status, {
				createSimError: await parseApiError(response)
			});
		}

		redirect(303, `/banks/beeline/${number}`);
	},
	deleteSim: async ({ fetch, request }) => {
		const formData = await request.formData();
		const number = normalizeSimNumber(formData.get('number'));

		if (!number) {
			return fail(400, {
				deleteSimError: 'Не найдена SIM-карта для удаления'
			});
		}

		const response = await fetch(`${BEELINE_API_BASE}/sims/${number}`, {
			method: 'DELETE',
			headers: {
				accept: 'application/json'
			}
		});

		if (!response.ok) {
			return fail(response.status, {
				deleteSimError: await parseApiError(response)
			});
		}

		redirect(303, '/banks/beeline');
	}
};
