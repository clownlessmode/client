# Beeline Admin API

Документация REST API для управления SIM-картами Билайн и историей платежей.  
Используется админкой / конфиг-вебом; через этот API данные попадают в MITM-прокси и подменяют ответы мобильного приложения Билайн.

---

## Базовые сведения

| Параметр | Значение |
|----------|----------|
| Base URL | `http://<host>:8080` |
| Prefix | `/banks/beeline` |
| Content-Type | `application/json` |
| Авторизация | **нет** (эндпоинты открыты) |
| Swagger | `GET /swagger/index.html` (теги `beeline sims`, `beeline config`, `beeline payments`) |

Все даты в **ответах** — ISO 8601 UTC (`2026-05-23T09:07:47Z`).  
В **запросах** поле `paidAt` — строка в формате **RFC3339** (можно с offset, напр. `2026-05-23T12:07:47+03:00`).

---

## Номер SIM

- Формат: **10 цифр**, без `+7`, без пробелов.
- Примеры валидных значений: `9680659702`
- Сервер нормализует номер из path/body:
  - убирает `+7`, ведущую `7` или `8` (если 11 цифр)
  - `79680659702` → `9680659702`

Ошибка при неверном формате: `400` + `{ "error": "number must be 10 digits without +7" }`

---

## Модели данных

### Sim

```json
{
  "number": "9680659702",
  "balance": 50000,
  "createdAt": "2026-05-22T10:00:00Z",
  "updatedAt": "2026-05-22T12:00:00Z"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `number` | string | 10-значный номер |
| `balance` | number \| null | **Базовый** баланс (задаётся вручную). `null` — не задан |
| `createdAt` | string | Дата создания |
| `updatedAt` | string | Дата обновления |

> В `GET /sims` и `GET /sims/{number}` поле `balance` — это **base balance** из БД, не итоговый баланс с учётом платежей.  
> Итоговый баланс смотри в `GET /sims/{number}/config`.

---

### Config

```json
{
  "number": "9680659702",
  "balance": 23700,
  "baseBalance": 50000,
  "paymentsTotal": 26300,
  "createdAt": "2026-05-22T10:00:00Z",
  "updatedAt": "2026-05-22T12:00:00Z"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `number` | string | Номер SIM |
| `balance` | number \| null | **Эффективный** баланс (то, что видит приложение) |
| `baseBalance` | number \| null | Базовый баланс, заданный вручную |
| `paymentsTotal` | number | Сумма **исходящих** платежей (`total` по direction=outgoing) |
| `createdAt` | string | |
| `updatedAt` | string | |

**Формула эффективного баланса:**

```
balance = baseBalance + sum(incoming.amount) - sum(outgoing.total)
```

Если `baseBalance === null`, то `balance === null`.

---

### Payment

```json
{
  "id": "a1b2c3d4e5f6789012345678901234ab",
  "simNumber": "9680659702",
  "direction": "outgoing",
  "receiverCard": "220094**0028",
  "amount": 13000,
  "commission": 845,
  "total": 13845,
  "source": "manual",
  "paidAt": "2026-05-23T09:07:47Z",
  "createdAt": "2026-05-23T09:08:00Z",
  "updatedAt": "2026-05-23T09:08:00Z"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | UUID-like hex (32 символа), генерируется сервером |
| `simNumber` | string | Номер SIM |
| `direction` | `"outgoing"` \| `"incoming"` | Тип операции |
| `receiverCard` | string | Маска карты получателя. Только для `outgoing`. Формат: `220094**0028` |
| `amount` | number | Сумма платежа (без комиссии для outgoing) |
| `commission` | number | Комиссия 6.5% для outgoing, `0` для incoming |
| `total` | number | `amount + commission` (outgoing) или `amount` (incoming) |
| `source` | `"manual"` \| `"payment_flow"` | `manual` — создан через API; `payment_flow` — перехвачен из реального платежа в приложении |
| `paidAt` | string | Дата/время операции |
| `createdAt` | string | |
| `updatedAt` | string | |

**Комиссия (outgoing):** `commission = round(amount * 0.065, 2)`  
**Минимальная сумма outgoing:** `924` руб.

**Incoming (пополнение):**
- `receiverCard` не нужна (пустая)
- `commission = 0`, `total = amount`
- `amount > 0`

---

### Error

```json
{
  "error": "sim not found"
}
```

---

## Эндпоинты

### SIM-карты

#### `GET /banks/beeline/sims`

Список всех зарегистрированных SIM.

**Response `200`:** массив `Sim[]`, сортировка по номеру ASC.

```http
GET /banks/beeline/sims
```

---

#### `POST /banks/beeline/sims`

Регистрация новой SIM.

**Body:**

```json
{
  "number": "9680659702"
}
```

| Поле | Обязательное | Описание |
|------|--------------|----------|
| `number` | да | 10 цифр |

**Response `201`:** `Sim` (balance будет `null`)

**Ошибки:**

| Code | error |
|------|-------|
| 400 | `invalid request body` |
| 400 | `number must be 10 digits without +7` |
| 409 | `sim already exists` |

---

#### `GET /banks/beeline/sims/{number}`

Получить SIM по номеру.

**Response `200`:** `Sim`

**Ошибки:**

| Code | error |
|------|-------|
| 404 | `sim not found` |

---

#### `DELETE /banks/beeline/sims/{number}`

Удалить SIM и **всю** историю платежей (каскадно).

**Response `204`:** без тела

**Ошибки:**

| Code | error |
|------|-------|
| 404 | `sim not found` |

---

### Конфиг и баланс

#### `GET /banks/beeline/sims/{number}/config`

Конфиг SIM с эффективным балансом.

**Response `200`:** `Config`

**Ошибки:**

| Code | error |
|------|-------|
| 404 | `sim not found` |

---

#### `PATCH /banks/beeline/sims/{number}/config/balance`

Установить **базовый** баланс. Эффективный пересчитывается автоматически.

**Body:**

```json
{
  "balance": 50000
}
```

| Поле | Обязательное | Описание |
|------|--------------|----------|
| `balance` | да | число (можно `0`) |

**Response `200`:** `Config` (с пересчитанным `balance`)

**Ошибки:**

| Code | error |
|------|-------|
| 400 | `invalid request body` |
| 404 | `sim not found` |

---

### Платежи

Список платежей: **новые сверху** (`paidAt DESC`).

#### `GET /banks/beeline/sims/{number}/payments`

**Response `200`:** `Payment[]`

**Ошибки:**

| Code | error |
|------|-------|
| 404 | `sim not found` |

---

#### `POST /banks/beeline/sims/{number}/payments`

Создать платёж вручную.

**Body (outgoing — списание через мобильную коммерцию):**

```json
{
  "direction": "outgoing",
  "receiverCard": "220094**0028",
  "amount": 13000,
  "paidAt": "2026-05-23T12:07:47+03:00"
}
```

**Body (incoming — пополнение баланса):**

```json
{
  "direction": "incoming",
  "amount": 5000,
  "paidAt": "2026-05-23T12:07:47+03:00"
}
```

| Поле | Обязательное | Описание |
|------|--------------|----------|
| `direction` | нет (default: `outgoing`) | `outgoing` или `incoming` |
| `receiverCard` | да для outgoing | `^\d{6}\*\*\d{4}$` |
| `amount` | да | для outgoing ≥ 924 |
| `paidAt` | да | RFC3339 |

**Response `201`:** `Payment`

**Ошибки:**

| Code | error |
|------|-------|
| 400 | `invalid request body` |
| 400 | `invalid paidAt, expected RFC3339` |
| 400 | `invalid direction, expected outgoing or incoming` |
| 400 | `receiverCard must match format 220094**0028` |
| 400 | `amount must be at least 924` |
| 400 | `invalid payment amount` |
| 404 | `sim not found` |

---

#### `GET /banks/beeline/sims/{number}/payments/{id}`

**Response `200`:** `Payment`

**Ошибки:**

| Code | error |
|------|-------|
| 404 | `payment not found` |

---

#### `PATCH /banks/beeline/sims/{number}/payments/{id}`

Частичное обновление. Передаются только изменяемые поля.

**Body (все поля опциональны):**

```json
{
  "direction": "outgoing",
  "receiverCard": "220094**0028",
  "amount": 15000,
  "paidAt": "2026-05-23T14:00:00+03:00"
}
```

При смене `amount` у outgoing комиссия пересчитывается автоматически.  
При смене direction на `incoming` — `receiverCard` очищается, комиссия = 0.

**Response `200`:** `Payment`

**Ошибки:** те же validation-ошибки, что при создании + `404 payment not found`

---

#### `DELETE /banks/beeline/sims/{number}/payments/{id}`

**Response `204`:** без тела

**Ошибки:**

| Code | error |
|------|-------|
| 404 | `payment not found` |

---

## Рекомендуемые экраны для фронтенда

### 1. Список SIM

- `GET /banks/beeline/sims`
- Кнопка «Добавить SIM» → модалка с полем номера → `POST /banks/beeline/sims`
- Клик по SIM → экран деталей
- Swipe / кнопка удаления → `DELETE /banks/beeline/sims/{number}` (confirm)

### 2. Дашборд SIM

- `GET /banks/beeline/sims/{number}/config`
- Показать:
  - **Текущий баланс** (`balance`)
  - **Базовый баланс** (`baseBalance`)
  - **Списано (outgoing)** (`paymentsTotal`)
- Форма «Установить базовый баланс» → `PATCH .../config/balance`

### 3. История платежей

- `GET /banks/beeline/sims/{number}/payments`
- Таблица/список: дата, direction, amount, commission, total, source, receiverCard
- Фильтр/бейдж по `direction`: incoming / outgoing
- Бейдж `source`: manual / auto (payment_flow)

### 4. Создание платежа

- Переключатель direction: outgoing / incoming
- Outgoing: поля amount, receiverCard (маска `XXXXXX**XXXX`), paidAt (datetime picker)
- Incoming: amount, paidAt
- Live-preview: commission и total для outgoing
- Submit → `POST .../payments` → обновить config и список

### 5. Редактирование / удаление платежа

- `GET .../payments/{id}` для формы редактирования
- `PATCH .../payments/{id}`
- `DELETE .../payments/{id}`

---

## Примеры curl

```bash
# Список SIM
curl -s http://localhost:8080/banks/beeline/sims

# Создать SIM
curl -s -X POST http://localhost:8080/banks/beeline/sims \
  -H 'Content-Type: application/json' \
  -d '{"number":"9680659702"}'

# Установить базовый баланс 50000
curl -s -X PATCH http://localhost:8080/banks/beeline/sims/9680659702/config/balance \
  -H 'Content-Type: application/json' \
  -d '{"balance":50000}'

# Конфиг с эффективным балансом
curl -s http://localhost:8080/banks/beeline/sims/9680659702/config

# Создать outgoing платёж
curl -s -X POST http://localhost:8080/banks/beeline/sims/9680659702/payments \
  -H 'Content-Type: application/json' \
  -d '{
    "direction": "outgoing",
    "receiverCard": "220094**0028",
    "amount": 13000,
    "paidAt": "2026-05-23T12:07:47+03:00"
  }'

# Создать incoming (пополнение)
curl -s -X POST http://localhost:8080/banks/beeline/sims/9680659702/payments \
  -H 'Content-Type: application/json' \
  -d '{
    "direction": "incoming",
    "amount": 5000,
    "paidAt": "2026-05-23T12:07:47+03:00"
  }'

# Список платежей
curl -s http://localhost:8080/banks/beeline/sims/9680659702/payments

# Удалить платёж
curl -s -X DELETE http://localhost:8080/banks/beeline/sims/9680659702/payments/{id}
```

---

## TypeScript типы (для фронтенда)

```typescript
export interface Sim {
  number: string;
  balance: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Config {
  number: string;
  balance: number | null;
  baseBalance: number | null;
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

export interface UpdateBalanceRequest {
  balance: number;
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
```

---

## Связь с приложением Билайн (контекст для UI)

Эти данные не просто хранятся в БД — прокси подменяет ответы API Билайн:

- **Баланс** в приложении берётся из snapshot детализации + расчёт по платежам
- **Детализация** (`/mobile/api/v2/detalization`) дополняется платежами из БД
- Платежи с `source: "payment_flow"` создаются автоматически при реальной оплате через приложение (API их только читает/редактирует/удаляет)

Фронтенду достаточно работать только с REST API выше; прокси настраивается отдельно на сервере.

---

## Чеклист валидации на клиенте

- [ ] Номер SIM: ровно 10 цифр
- [ ] `receiverCard`: regex `^\d{6}\*\*\d{4}$` для outgoing
- [ ] `amount` ≥ 924 для outgoing
- [ ] `amount` > 0 для incoming
- [ ] `paidAt`: валидный ISO datetime (RFC3339)
- [ ] Preview commission: `Math.round(amount * 0.065 * 100) / 100`
- [ ] Preview total (outgoing): `amount + commission`
