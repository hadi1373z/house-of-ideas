# Socrates evening review

The owner requested a daily review at **21:00 Europe/Prague**. Its scope is the house's rooms and learning: prepare a next-day exercise from recorded visits, ideas and reflections, then require the user's decision when they return. The review does not edit source, publish a Site, synchronize GitHub, or resume the paused hourly improvement task. Socrates uses deterministic local guidance and no paid API.

## Private service access

Use the same Site identified by `.openai/hosting.json` or the linked task context. Read it with `get_site`; confirm that it is active, published and owner-private. Obtain its current live origin and `siwc_bypass_bearer_token` through the supported Sites service-access flow. Keep the credential in runtime memory or hidden stdin. Never place it in source, files, shell arguments, URLs, schedule prompts, browser code or logs.

Send the credential only to that exact Site origin as `OAI-Sites-Authorization: Bearer <credential>`. Sites dispatch verifies and consumes it. The shared service endpoints rely on the owner-private hosting boundary, so they must be disabled before widening the audience. Service access does not supply a visitor identity or connected-app consent. Never fabricate `oai-authenticated-user-id`, impersonate a visitor, or use `/api/house` as the unattended writer.

## One run and readback

1. Call `POST /api/review/run` with no body, query parameters, Origin header or visitor identity. The server derives today's date in Europe/Prague and resolves enrolled users from its own database.
   For Node fetch, send an explicitly empty string body (zero bytes): this avoids the hosting bridge serializing an omitted POST body. The verified helper `scripts/nightly-review.mjs` handles this transport detail and hidden stdin. Do not send JSON or whitespace.
2. Require HTTP success and retain the returned aggregate result, including `completedAt`. The job processes only houses with `learning.enabled: true` and recorded activity. It inserts pending day snapshots idempotently, rechecks enrollment during insertion, and never writes house content, revisions, approval or application state.
3. Call `GET /api/review/status` with the same service access and no request data. Require HTTP success and deep equality between `status.lastRun` and the POST result. This reads the actual successful-run receipt from D1. A run with no enrolled activity legitimately records zero counts; do not add test users or ideas to prove a write.
4. If access or storage fails, report the concrete failure and retain the approval gate. Retry only transient failures; the proposal key is user plus review date. Do not replace missing access with credentials cached from an earlier authoring session. A changed receipt during readback can indicate another completed run; reconcile it instead of treating mismatched results as verification.

Status returns aggregate counts only. It does not reveal user IDs, room names, notes or proposal contents. The latest successful receipt remains visible across dates.

## Entry and approval

Authenticated entry into the saved app enrolls guided learning by saving `learning.enabled: true`; the public preview does not enroll. `GET /api/house` merges only that user's missing queued reviews, preserving saved decisions and newer reflections. Queue reads do not save or apply improvements. Revoked enrollment excludes queued proposals, and journal bounds remain enforced.

A proposal for a reviewed day is available for confirmation on or after its next day. Approval or decline is saved through the existing authenticated, revision-checked house API. Approval can add one learning book to the reviewed room; a removed or full room receives a clear resolution instead. The next entry can prepare a missed review from recorded prior activity.

## Schedule setup

Publish and verify the service through the intended unattended access before creating the linked Sites schedule. Read the Site's existing automations to avoid duplicates; a missing automation list prevents setup. Use the requested 21:00 cadence with IANA timezone `Europe/Prague`, preserving local time through daylight-saving changes. Leave the separate paused source-improvement schedule paused.

A fresh run must recover this instruction revision through the linked Site source. Its prompt should say to follow `NIGHTLY.md`, prepare pending room and learning suggestions, read back the stored run receipt, and preserve user approval. Store no credentials in the prompt. Confirm activation and any live execution only from the native tool results; these instructions alone do not establish that a schedule is enabled or has run.
