# NeuroSync Persistent Domain Model

NeuroSync will treat the authenticated account as the authoritative owner of all sender-side resources. Receiver profiles are either owned by the account or explicitly listed as shared directory records. Every user-visible lifecycle change will be represented by an immutable job event, while the current job row stores the latest materialized state for fast workspace reads.

| Entity | Purpose | Ownership and key relationships |
| --- | --- | --- |
| User profile | Adds product role and preferences to the managed identity record | One profile per authenticated `users.id` |
| Receiver | Describes an available GPU target, capabilities, price, and availability | Owned by a user or marked directory-visible; referenced by jobs |
| Model catalog entry | Describes an approved base model | Globally visible; referenced by jobs and trained models |
| Training job | Stores immutable submitted configuration plus materialized lifecycle state | Owned by the submitting user; references one receiver and base model |
| Job event | Records status, metrics, provider payload summary, and timestamp | Belongs to one training job; append-only |
| Trained model | Represents a completed adapter or exported artifact | Owned by the submitting user; references its completed job |
| Notification | Stores durable operational messages | Belongs to one user and may reference a job |
| Settlement record | Stores a payment state and auditable amount, never raw payment credentials | Belongs to one job and its owner |
| Provider execution | Maps a training job to an external GPU execution and callback token hash | Belongs to one job; provider identifiers are unique within provider scope |

## Neutral Job States

The server recognizes `draft`, `awaiting_payment`, `queued`, `provisioning`, `loading_dataset`, `running`, `paused`, `cancelling`, `completed`, `failed`, and `cancelled`. Only the server or a verified provider callback may write provider-derived states. A user may request `pause`, `resume`, or `cancel`; the provider adapter validates whether that action is supported before recording the resulting state.

## Provider Callback Security

Provider callbacks will use opaque, random per-execution tokens embedded only in the callback URL. The database stores a one-way hash of the token, records the provider event identifier for idempotency, and limits events to their matching execution. The handler will treat duplicate callbacks as successful without duplicating job events or trained models.
