# Security Specification: GrajaFood Firestore

This document defines the security parameters, relational constraints, and 12 high-stakes test payloads designed to attack the security layer of GrajaFood.

## 1. Data Invariants & Access Logic

- **Authenticity Integrity**: No user profile `/users/{userId}` can be updated with a custom `tipo` (auth role) or modifications to `pontos` levels, except by authenticating as `dono_master`.
- **Relational Consistency**: An address in `/users/{userId}/addresses/{addressId}` is strictly owned and accessible only by its parent `{userId}`.
- **Master Admin Protection**: Only the `dono_master` role is allowed to view, list, or write invitation tokens `/invites/{token}`.
- **Order Security**: Customers can only read and create orders where `usuario_id == request.auth.uid`. Delivery personnel (`tipo == 'entregador'`) can read active orders and change only the `status` field.
- **Temporal Enforcement**: Timestamps `criado_em` and `atualizado_em` must align with `request.time`.

---

## 2. The "Dirty Dozen" Payloads (Threat Scenarios)

These payloads represent malicious attempts by clients to compromise security. All of them MUST return `PERMISSION_DENIED`:

### Scenario 1: Identity Spoofing - Customer assigns themselves the 'dono_master' role
- **Action**: `create` or `update` on `/users/attackerUID`
- **Payload**:
  ```json
  {
    "id": "attackerUID",
    "nome": "Hacker Master",
    "email": "hacker@gmail.com",
    "tipo": "dono_master",
    "ativo": true
  }
  ```
- **Result**: `PERMISSION_DENIED` (Cannot set a role other than 'cliente' or modify existing verified properties).

### Scenario 2: Score Boosting - Customer attempts to manually set loyalty points to 99999
- **Action**: `update` on `/users/customerUID`
- **Payload**:
  ```json
  {
    "pontos": 99999,
    "nivel": "Diamante"
  }
  ```
- **Result**: `PERMISSION_DENIED` (Only `dono_master` can change points/level fields).

### Scenario 3: Unauthorized PII Harvesting - Authenticated client searches and lists all client profiles
- **Action**: `list` on `/users`
- **Payload**: Querying all user records.
- **Result**: `PERMISSION_DENIED` (No blanket listing of PII: `users` documents can only be fetched directly by their owner or as a single matching record).

### Scenario 4: Cross-User Address Theft - Attacker attempts to write or read someone else's address
- **Action**: `create` on `/users/victimUID/addresses/someAddr`
- **Payload**:
  ```json
  {
    "id": "someAddr",
    "usuario_id": "victimUID",
    "logradouro": "Rua Hacker",
    "numero": "400",
    "bairro": "Grajaú"
  }
  ```
- **Result**: `PERMISSION_DENIED` (Cannot access addresses under another userId's path).

### Scenario 5: Menu Poisoning - Non-admin user attempts to change prices at Graja Burger
- **Action**: `update` on `/restaurants/1/products/2`
- **Payload**:
  ```json
  {
    "preco": 0.01
  }
  ```
- **Result**: `PERMISSION_DENIED` (Only verified 'admin' or 'dono_master' can write restaurant products).

### Scenario 6: Free Food Bypass - Customer modifies order totals to be cheap before checkout
- **Action**: `create` on `/orders/order123`
- **Payload**:
  ```json
  {
    "id": "order123",
    "usuario_id": "customerUID",
    "restaurante_id": "1",
    "total": 0.05,
    "status": "recebido"
  }
  ```
- **Result**: `PERMISSION_DENIED` (Total, subtotal and check elements are client-immutable or must conform to actual validations).

### Scenario 7: State Shortcutting - Customer attempts to mark their order as 'entregue'
- **Action**: `update` on `/orders/order123`
- **Payload**:
  ```json
  {
    "status": "entregue"
  }
  ```
- **Result**: `PERMISSION_DENIED` (Only delivery personnel 'entregador' or system administrators can change status to 'entregue').

### Scenario 8: Token Injection - Attacker crafts an official admin invite
- **Action**: `create` on `/invites/fake_token`
- **Payload**:
  ```json
  {
    "token": "fake_token",
    "email": "attacker@gmail.com",
    "tipo": "admin",
    "criado_em": "2026-05-21T00:00:00Z"
  }
  ```
- **Result**: `PERMISSION_DENIED` (Only `dono_master` has write access to `/invites`).

### Scenario 9: Log Deletion / Audit Tampering - Tampering auditable logs to hide actions
- **Action**: `delete` or `update` on `/logs/log123`
- **Payload**: Attempt to delete log history.
- **Result**: `PERMISSION_DENIED` (Logs are append-only. No updates, no deletes allowed).

### Scenario 10: Email Spoofing Attack - User logs in with non-verified email and acts as admin
- **Action**: `read` on private admin console path
- **Auth Token Claims**: `email: admin@grajafood.com`, `email_verified: false`
- **Result**: `PERMISSION_DENIED` (Requires verified email and role verification directly from db).

### Scenario 11: Denial of Wallet Character Injection - Attacker attempts to write a huge key string
- **Action**: `create` on `/users/LONG_CHARACTER_STRING_OF_OVER_1000_BYTES_abcdef_...`
- **Result**: `PERMISSION_DENIED` (Validates `isValidId` and size length <= 128 characters).

### Scenario 12: Terminal State Locking Bypass - Attempt to update a finalized/cancelled order
- **Action**: `update` on `/orders/orderCompleted` (current status: 'entregue')
- **Payload**:
  ```json
  {
    "status": "preparando"
  }
  ```
- **Result**: `PERMISSION_DENIED` (Terminal state locking prevents modifications once an order is 'entregue' or 'cancelado').
