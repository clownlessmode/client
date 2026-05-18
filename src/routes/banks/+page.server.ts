type Bank = {
	id: number;
	code: string;
	name: string;
	createdAt: string;
	updatedAt: string;
};

export async function load({ fetch }) {
	const response = await fetch('http://localhost:8080/banks', {
		headers: {
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		return {
			banks: [] as Bank[],
			error: 'Не удалось загрузить список банков'
		};
	}

	return {
		banks: (await response.json()) as Bank[],
		error: null
	};
}
