# State machines

This document lists the state machines in the gallery Worker and its browser scripts. Most are implicit. Their states come from flags, array contents, storage keys and cache entries, not from named values.

## Server machines

### 1. Photo lifecycle across R2 and the index

Where: the upload, update and delete routes in `src/routes/admin.ts`, `uploadPhoto`, `updatePhoto` and `deletePhoto` in `src/photos/lifecycle.ts`, and the typed index client in `src/do/client.ts`. The client returns `notFound` only when the index answered 404, and `full` only for a 409. A timeout, a throw or any other status is `unavailable`. `src/routes/errors.ts` maps the three kinds to 404, 409 and 503.

| State                          | R2 object | Index meta and order entry | Reachable by                                                            |
| ------------------------------ | --------- | -------------------------- | ----------------------------------------------------------------------- |
| Absent                         | no        | no                         | start, full delete, upload cleanup                                      |
| Stored only (upload in flight) | yes       | no                         | R2 put done, index add pending                                          |
| Live                           | yes       | yes                        | upload success                                                          |
| Index-only (dangling)          | no        | yes                        | delete whose index step failed, or an index add whose response was lost |
| Orphan                         | yes       | no                         | upload cleanup delete fails, or the isolate dies between put and add    |

Invariants:

- A photo is listed only when its meta exists. Its image is served only when the R2 object also exists.
- Retrying the same delete finishes any partial delete.
- A partial upload is either cleaned up or finished by a retry with the same `uploadId`. The exception is a failed cleanup delete, which is logged and leaves an Orphan.
- A route answers 404 only when the index says the photo does not exist. An index failure is a 503. The one 500 is a delete whose R2 or index step failed.

| From        | Event                                     | Guard                                                          | To          | Action                                                           |
| ----------- | ----------------------------------------- | -------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| Absent      | upload                                    | type, size, `uploadId` and text fields valid, no existing meta | Stored only | `IMAGES_BUCKET.put(key)` with `id = uploadId ?? randomUUID()`    |
| Absent      | upload                                    | a text field is over its length limit                          | Absent      | 400 `<field> must be a string of at most N characters`           |
| Absent      | upload                                    | R2 put throws                                                  | Absent      | uncaught, so 500, nothing written                                |
| any         | upload                                    | `uploadId` meta read fails, not a 404                          | unchanged   | 503 `Index unavailable`                                          |
| Stored only | index add returns ok                      |                                                                | Live        | warm 4 variants in `waitUntil`, purge the first list page        |
| Stored only | index add fails                           | includes a throw or a timeout                                  | Absent      | `IMAGES_BUCKET.delete(key)`, 409 `The archive is full`, else 503 |
| Stored only | the cleanup delete also fails             |                                                                | Orphan      | logs `orphan R2 object after failed index add`                   |
| Stored only | index add commits but its response throws |                                                                | Index-only  | the cleanup deletes the R2 object, 503 `Index unavailable`       |
| Live        | upload retry with the same `uploadId`     | meta exists and R2 `head` finds the object                     | Live        | returns the existing meta, writes nothing                        |
| Index-only  | upload retry with the same `uploadId`     | meta exists, object missing                                    | Stored only | re-puts the object, then the add upserts the meta                |
| Live        | update                                    | meta exists                                                    | Live        | `/update` merges the trimmed fields, purge the first list page   |
| Absent      | update                                    | the index answers 404                                          | Absent      | 404 `Not found`                                                  |
| any         | update                                    | the index call fails, not a 404                                | unchanged   | 503 `Index unavailable`                                          |
| Live        | delete                                    | R2 delete ok within 3 attempts, index ok or 404                | Absent      | purge 35 cache keys                                              |
| Live        | delete                                    | R2 delete fails 3 times                                        | Live        | 500 `Failed to delete image file`, index kept, no purge          |
| Live        | delete                                    | R2 delete ok, index remove fails with a non-404                | Index-only  | purge, 500 `Failed to remove index`                              |
| Index-only  | delete retry                              |                                                                | Absent      | R2 delete of a missing key succeeds, then the index entry goes   |
| Absent      | delete                                    | meta read answers 404                                          | Absent      | 404 `Not found`, which the client treats as deleted              |
| any         | delete                                    | meta read fails, not a 404                                     | unchanged   | 503 `Index unavailable`, the client alerts and keeps the row     |

### 2. Index order versus meta keys

Where: `src/do/ImageIndex.ts`, with the cap in `LIST_LIMITS` in `src/domain/contract.ts`. The state is the `order` array and the set of `meta:<id>` keys.

Invariants:

- I1. Every id in `order` has a `meta:<id>` key.
- I2. Every `meta:<id>` key has its id in `order`.
- I3. `order` has no duplicates.
- I4. `order.length` is at most `LIST_LIMITS.maxPhotos` (5000).
- I5. The serialized `order` fits the storage value size limit.

Add and delete write both keys in one `Promise.all` with no await between them, so the writes coalesce into one atomic batch. Update cannot create meta, so it returns 404 for a deleted id. I5 holds because the class is SQLite-backed (`new_sqlite_classes` in `wrangler.toml.example`). That allows 2 MB per key plus value, and 5000 ids serialize to about 190 KB.

| From  | Event           | Guard        | To                    | Action                                                           |
| ----- | --------------- | ------------ | --------------------- | ---------------------------------------------------------------- |
| n ids | add new id      | n < 5000     | n+1 ids, new id first | put meta and order                                               |
| n ids | add new id      | n >= 5000    | unchanged             | 409 `Index at capacity`                                          |
| n ids | add existing id |              | n ids, id moved first | meta replaced (upsert), allowed at the cap                       |
| n ids | update          | meta exists  | n ids                 | merge trimmed fields, so `''` clears a field and absent keeps it |
| n ids | delete          | meta exists  | n-1 ids               | delete meta, put filtered order                                  |
| n ids | delete          | meta missing | unchanged             | 404                                                              |

### 3. Keyset cursor pagination

Where: `decodeCursor` and `resumeIndex` in `src/do/ImageIndex.ts`. Callers are the `/api/images` route, the sitemap, the gallery loader, the admin manage table and backfill, all through `listImages` in `src/do/client.ts`.

The cursor is `base64({ after, offset })`. `after` holds the last 5 ids served, newest-served first. `offset` is the position after the page at read time. The next read resumes after the first `after` id still in the list, and falls back to `offset` only when none remain. The sitemap makes one list call of `LIST_LIMITS.maxPageSize` (500) and does not follow cursors.

Invariant: walking the cursors yields each listed id exactly once, unless the offset fallback or an upsert moves the anchor. Deleting the last served id resumes after an older anchor, so nothing is skipped.

| From   | Event                                 | Guard          | To               | Action                                                   |
| ------ | ------------------------------------- | -------------- | ---------------- | -------------------------------------------------------- |
| cursor | m ids added before the read           | anchor present | after the anchor | no repeats                                               |
| cursor | ids deleted before the anchor         | anchor present | after the anchor | no skips                                                 |
| cursor | all 5 anchors deleted                 |                | `offset`         | may repeat or skip, and the gallery client drops repeats |
| cursor | an anchor re-added by an upload retry |                | position 1       | later pages repeat, and the gallery client drops them    |
| any    | malformed cursor                      |                | position 0       | restarts at page 1                                       |

### 4. Access JWKS cache

Where: `src/app/accessJwt.ts`, per isolate, called by `requireAdminAuth` in `src/app/adminAuth.ts`. The state is `jwksCache`, `jwksInFlight` and `jwksLastFailureAt`.

States: Empty (`jwksCache` is null), Fetching (`jwksInFlight` is set), Fresh (under 1 hour old), Stale (1 to 24 hours old, the old keys still verify) and Too old (24 hours or more, which acts like Empty when a fetch fails). Cooling applies on top of any of them for 30 s after a failed fetch. Concurrent callers share the in-flight promise. A 4xx or a malformed key set is not retried.

| From             | Event               | Guard                                 | To             | Action                                         |
| ---------------- | ------------------- | ------------------------------------- | -------------- | ---------------------------------------------- |
| Empty            | verify              | no in-flight                          | Fetching       | start `loadJwks`                               |
| Fetching         | verify              | same url                              | Fetching       | share the promise                              |
| Fetching         | fetch ok            |                                       | Fresh          | `jwksCache = { url, keys, fetchedAt }`         |
| Fetching         | all attempts fail   | cache under 24 h                      | Stale, cooling | record the failure, warn, verify with old keys |
| Fetching         | all attempts fail   | no cache, or cache 24 h or older      | Empty, cooling | record the failure, `Unable to verify`         |
| Fresh            | verify, kid known   |                                       | Fresh          | use cache                                      |
| Fresh            | verify, kid unknown | age < 30 s, or a failure in last 30 s | Fresh          | use cache, then `signing key not found`        |
| Fresh            | verify, kid unknown | age >= 30 s, no failure in last 30 s  | Fetching       | refetch once                                   |
| Stale            | verify              | no failure in the last 30 s           | Fetching       | refetch                                        |
| Stale, cooling   | verify              | a failure in the last 30 s            | Stale, cooling | use old keys, no fetch                         |
| Empty or Too old | verify              | no failure in the last 30 s           | Fetching       | refetch                                        |
| Empty, cooling   | verify              | a failure in the last 30 s            | Empty, cooling | no fetch, `requireAdminAuth` answers 401       |

### 5. Edge cache entry lifecycle

Where: the `/media/:id` and `/img/:id` routes in `src/routes/media.ts`, `putWhileIndexed` in `src/app/cache.ts`, the list route in `src/routes/gallery.ts`, the purges in `src/photos/lifecycle.ts`, `snapVariant`, `mediaUrl`, `imageCacheKey` and `photoCacheKeys` in `src/domain/imageVariants.ts`, and `firstPageCacheKey` in `src/domain/contract.ts`.

States per cache key: Absent, Filling (a GET missed and will put its response in `waitUntil`) and Cached.

The key set is closed. `/media` keys on `origin + '/media/' + id` and ignores the query. `/img` keys on `origin + '/img/' + id-width-quality-format`. Width and quality snap to a registry size, or to the original size at quality 85, and the key adds the output format. A request outside the registry snaps among the grid, admin and upload variants. The registry has 11 sizes including the original, so `photoCacheKeys` holds 33 image keys and the media key. A delete also purges the first list page (`/api/images?limit=200`). That is 35 Cache API calls, under the free plan's 50 per request. Upload and update purge only the first list page.

Invariants:

- In the colo that ran a delete, no image key for that id is Cached once the delete returns and its `waitUntil` work settles.
- The purge list covers every key a GET can create.
- The list key can hold a deleted id for up to 60 s. This is accepted.

| From    | Event                  | Guard                          | To                   | Action                                                |
| ------- | ---------------------- | ------------------------------ | -------------------- | ----------------------------------------------------- |
| Absent  | GET image              | meta found                     | Filling              | read R2, or resize with a 15 s timeout                |
| Absent  | GET image              | meta 404                       | Absent               | 404 `private, no-store`                               |
| Absent  | GET image              | meta read fails, not a 404     | Absent               | 503 `private, no-store`                               |
| Absent  | GET `/img`             | resize fails or times out      | Absent               | serve the R2 original as `private, no-store`          |
| Filling | put done, re-check     | meta still found               | Cached               | `cache.put` awaited, then `getImageMeta`              |
| Filling | put done, re-check     | meta 404 or the re-check fails | Absent               | `cache.delete(key)`                                   |
| Cached  | GET                    |                                | Cached               | served before any meta check, 304 for a matching ETag |
| Cached  | delete purge           | key is in the purge list       | Absent               | `cache.delete`                                        |
| Filling | list put after a purge | list key                       | Cached, stale ≤ 60 s | not fenced                                            |

### 6. Admin path rewrite

Where: `rewriteAdminPrefix` and the `/_admin/*` guard in `src/routes/admin.ts`, and `httpsRedirect` and `securityHeaders` in `src/app/security.ts`.

States per request: Public, Secret-prefix (the path equals `ADMIN_PATH` or starts with `ADMIN_PATH/`), Rewritten (`/_admin/...` and in the `rewrittenRequests` WeakSet) and Direct-admin (`/_admin/...` and not rewritten).

| From          | Event        | Guard                                      | To        | Action                                       |
| ------------- | ------------ | ------------------------------------------ | --------- | -------------------------------------------- |
| any           | http request |                                            | redirect  | 301 to https, with the security headers      |
| Secret-prefix | middleware   | prefix is not `/_admin`                    | Rewritten | new Request, `app.fetch` again               |
| Direct-admin  | middleware   | prefix is not `/_admin`                    | 404       | `c.notFound()`                               |
| Direct-admin  | middleware   | prefix is `/_admin`                        | admin     | continue                                     |
| Public        | middleware   | shares the prefix string but not a segment | Public    | served, so `/media` survives `ADMIN_PATH=/m` |

`securityHeaders` runs first and wraps every response, including 304s, 404s and redirects. Every `/_admin/*` response, including auth failures and 404s, is `Cache-Control: private, no-store`.

## Client machines

### 7. Upload queue and run

Where: `src/pages/admin/upload.ts`.

Item status is explicit: `'Queued'`, `'Uploading'`, `'Done'` or `'Error'`. An item is pending while `getImageMeta` loads it, before it joins `queue`. A pending batch remembers `queueGeneration`. Each item gets an `uploadId` UUID when queued, and every attempt reuses it. Handlers hold the item object, not its index.

The run state is the `uploading` flag. While it is true the Upload button is disabled. Each attempt inside Uploading is Sending (aborted after 30 s with no progress), Awaiting response (60 s after the body is sent) or Backoff (a random delay up to `min(8 s, 1 s * 2^n)`).

Invariants:

- At most one run is active.
- Each request writes its result to the item it uploaded.
- An Uploading item is never removed.
- `uploadDone` is at most the shown total, which is `uploadDone` plus the Queued and Uploading items.

| From                  | Event                      | Guard                               | To                        | Action                                                   |
| --------------------- | -------------------------- | ----------------------------------- | ------------------------- | -------------------------------------------------------- |
| (pending)             | image metadata loaded      | generation unchanged                | Queued                    | `queue.push` with a new `uploadId`, render               |
| (pending)             | image metadata loaded      | Clear All ran since                 | dropped                   | the batch is ignored                                     |
| Idle                  | Start click                | some Queued or Error                | Running                   | Error items become Queued, reset counters, disable Start |
| Running               | Start click                |                                     | Running                   | no-op                                                    |
| Queued                | run picks the first Queued |                                     | Uploading                 | XHR POST with `uploadId`                                 |
| Uploading             | attempt fails              | network, stall or 5xx, < 3 attempts | Uploading                 | back off, resend with the same `uploadId`                |
| Uploading             | 2xx and `data.ok`          |                                     | Done                      | write the item, then the next item                       |
| Uploading             | 4xx, or not `data.ok`      |                                     | Error                     | message by status, 400 and 409 show the server text      |
| Uploading             | third attempt fails        |                                     | Error                     | `uploadErrors++`, the item keeps its details             |
| Queued, Done or Error | Remove click               |                                     | removed                   | filter by identity, revoke the preview                   |
| any                   | Clear All                  |                                     | only Uploading items kept | `queueGeneration++`, revoke previews                     |
| Running               | no Queued item left        |                                     | Idle                      | drop Done items, keep Error items, enable Start          |

### 8. Backfill run

Where: the backfill block in `src/pages/admin/manage.ts`. The state comes from `backfillRunning`, `backfillCancelled` and the button.

| State        | `backfillRunning` | `backfillCancelled` | Button                     |
| ------------ | ----------------- | ------------------- | -------------------------- |
| Idle         | false             | any                 | `Backfill colors`, enabled |
| Loading list | true              | false               | `Working…`, disabled       |
| Running      | true              | false               | `Cancel`, enabled          |
| Cancelling   | true              | true                | `Cancelling…`, disabled    |

Running uses 3 workers. Each takes the next photo without a placeholder, decodes a color from its thumbnail and posts an update. Cancel stops workers from taking new photos. Photos already in flight finish.

| From         | Event            | Guard         | To           | Action                                         |
| ------------ | ---------------- | ------------- | ------------ | ---------------------------------------------- |
| Idle         | click            |               | Loading list | `loadAllManage` with `cache: 'no-store'`       |
| Loading list | list ok          |               | Running      | start 3 workers, show `Processed n/m`          |
| Loading list | list fails       |               | Idle         | alert that no colors were added                |
| Running      | click            |               | Cancelling   | set the flag, disable the button               |
| Running      | all workers done | not cancelled | Idle         | alert `Added placeholder colors to N photos`   |
| Cancelling   | all workers done |               | Idle         | alert `Stopped. Added colors to N of M photos` |

### 9. Manage table rows

Where: `renderManage`, `toggleEditRow`, `saveEdit` and `loadManagePage` in `src/pages/admin/manage.ts`. Row state lives in `editingId`, `drafts` and `rowsById`.

Row states: View, Editing (`editingId === id`), Saving (`drafts[id].saving`, Save reads `Saving…`) and Deleting (the delete button is disabled). Table states: Loading, Loaded, Empty, Search-empty, Load-error and Sign-in-expired (401). `loadSeq` drops a response that a newer load replaced.

Invariant: after each render, `editingId` is non-null exactly when its row is on the page, with the edit row attached after it. A draft survives re-renders while its row stays on the page, and survives Cancel while its save is in flight.

| From     | Event                                  | Guard                 | To       | Action                                                  |
| -------- | -------------------------------------- | --------------------- | -------- | ------------------------------------------------------- |
| View     | Edit click                             |                       | Editing  | close any other editor and drop its draft unless saving |
| Editing  | Edit click on the same row, or Cancel  |                       | View     | drop the draft unless saving                            |
| Editing  | input                                  |                       | Editing  | write the field into `drafts[id]`                       |
| Editing  | Save                                   |                       | Saving   | POST update, 2 attempts                                 |
| Saving   | ok                                     |                       | View     | delete the draft, replace the item, `renderManage()`    |
| Saving   | 404                                    |                       | Editing  | rebuild the editor if still open, alert `SAVE_GONE`     |
| Saving   | other failure                          |                       | Editing  | rebuild the editor if still open, alert `SAVE_FAILED`   |
| Editing  | `renderManage()` or `loadManagePage()` | row still on the page | Editing  | re-attach the same editor and restore focus             |
| Editing  | `renderManage()` or `loadManagePage()` | row not on the page   | View     | close the editor, drop the draft unless saving          |
| View     | Delete, confirm                        |                       | Deleting | POST delete, 2 attempts                                 |
| Deleting | ok or 404                              |                       | removed  | `renderManage()`                                        |
| Deleting | other failure, including a 503         |                       | View     | alert, re-enable                                        |

### 10. Gallery loader and carousel

Where: `src/pages/gallery/script.ts`, with the page walker from `emitBrowserPageWalker` in `src/pages/shared/script.ts`.

Loader states: Loading first page, Appending (the next page is in flight), Done, Empty, Error-empty and Error-partial. The chain stops at the first rejection, so no page arrives after an error.

| From          | Event                                   | Guard           | To                           | Action                                     |
| ------------- | --------------------------------------- | --------------- | ---------------------------- | ------------------------------------------ |
| Loading first | page ok                                 | cursor          | Appending                    | drop seen ids, shuffle, append             |
| Loading first | page ok                                 | no cursor       | Done or Empty                | message when empty                         |
| Appending     | page ok                                 | cursor not seen | Appending                    | drop seen ids, append, refresh the counter |
| Appending     | page ok                                 | cursor seen     | Done                         | stop                                       |
| any           | non-ok, JSON error or 3 failed attempts |                 | Error-empty or Error-partial | message only when nothing rendered         |

The carousel is Closed (`carousel.open` is false) or Open at index i (`currentIndex`). `currentIndex` is not reset on close. A stale `decode()` result is ignored by the `currentIndex !== idx` check.

| From      | Event                            | Guard    | To                    | Action                                  |
| --------- | -------------------------------- | -------- | --------------------- | --------------------------------------- |
| Closed    | tile click or Enter              | id found | Open at i             | `showModal`, lock scroll                |
| Open at i | Right, Next or swipe left        |          | Open at (i+1) mod n   | wraps at the last loaded item           |
| Open at i | Left, Prev or swipe right        |          | Open at (i-1+n) mod n | wraps at 0                              |
| Open at i | page appended                    |          | Open at i             | `n` grows, `updateMeta` shows the total |
| Open      | Escape, close button or backdrop |          | Closed                | restore scroll and focus                |

### 11. Theme and admin sidebar

Theme: `emitThemeBootstrap` and `emitThemeToggle` in `src/pages/shared/theme.ts`. The bootstrap runs in the head of both pages, before every stylesheet. `localStorage.theme` holds `dark`, `light` or nothing. Blocked storage counts as unset. An unset theme follows `prefers-color-scheme` once, at load, and a toggle stores the opposite theme.

Sidebar: `setSidebarOpen` in `src/pages/admin/script.ts` keeps the `open` class and `aria-expanded` in step. The class matters only at widths of 960 px or less. The menu toggle flips it. A tab click, Escape, or the viewport crossing 960 px in either direction closes it. Escape also returns focus to the menu button.

## Issues

Ranked by user impact. Every issue below is fixed or accepted in the current code.

| #   | Issue                                                          | Impact                                                  | Status                                      | Regression test                                                                                                  |
| --- | -------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Upload completions wrote to a stale queue index                | A queued photo marked Done but never uploaded           | fixed                                       | `adminClient.test.ts` `admin upload queue`                                                                       |
| 2   | Cache puts could land after the delete purge                   | Deleted photo resurrected for 1 day                     | fixed for images, 60 s list window accepted | `cacheCoherence.test.ts` `edge cache after a delete`                                                             |
| 3   | Open-ended edge cache keys escaped the purge list              | Deleted photo resurrected for 1 day                     | fixed                                       | `cacheCoherence.test.ts`, `imageVariants.test.ts`, `imageRoute.test.ts`                                          |
| 4   | R2 and index steps did not converge on failure                 | R2 orphan with no retry path                            | fixed                                       | `lifecycle.test.ts` `delete converges after partial failure`, `repairs a lost index-add response`                |
| 5   | Offset cursors shifted under add and delete                    | Duplicate or missing tiles                              | fixed                                       | `do.test.ts` `GET /list`, `galleryClient.test.ts`                                                                |
| 6   | Manage edit state lived outside the render                     | Typed edits lost, Edit needed two clicks                | fixed                                       | `adminClient.test.ts` `admin manage table`                                                                       |
| 7   | Upload was not idempotent                                      | Duplicate photo after a lost response                   | fixed                                       | `lifecycle.test.ts` `upload`, `adminClient.test.ts`                                                              |
| 8   | `order` could outgrow the storage value limit                  | Uploads fail at scale                                   | not an issue on SQLite-backed storage       | `do.test.ts` `fits LIST_LIMITS.maxPhotos ids in one SQLite-backed storage value`                                 |
| 9   | Admin read lists through the browser-cacheable public endpoint | Stale rows for 30 s after a mutation                    | fixed                                       | `galleryClient.test.ts` `page walker`, `adminClient.test.ts`                                                     |
| 10  | Theme applied after first paint, with no system default        | Dark flash for light users                              | fixed                                       | `galleryClient.test.ts` `theme bootstrap`                                                                        |
| 11  | Backfill cancel had no distinct state                          | Misleading label and alert                              | fixed                                       | `adminClient.test.ts` `admin backfill`                                                                           |
| 12  | Carousel counter missed appended pages                         | Wrong total shown                                       | fixed                                       | `galleryClient.test.ts` `carousel while pages append`                                                            |
| 13  | Sidebar ignored resize and Escape                              | Stale overlay and `aria-expanded`                       | fixed                                       | `adminClient.test.ts` `admin sidebar`                                                                            |
| 14  | Admin prefix match had no segment boundary                     | Public routes 404 under some `ADMIN_PATH` values        | fixed                                       | `lifecycle.test.ts` `admin path boundary`                                                                        |
| 15  | JWKS had no stale fallback when a refetch failed               | Admin locked out during an Access certs outage          | fixed                                       | `security.test.ts` `Access JWKS cache`                                                                           |
| 16  | A concurrent second delete reported a connection error         | Misleading alert                                        | fixed                                       | `lifecycle.test.ts` `two concurrent deletes of the same photo both succeed`                                      |
| 17  | The delete route reported an index outage as 404               | A photo that still exists vanished from the admin table | fixed                                       | `lifecycle.test.ts` `index outage`, `adminClient.test.ts` `keeps the row and alerts when the delete answers 503` |
| 18  | Updating a deleted photo returned 500, not 404                 | Generic connection alert and one wasted retry           | fixed                                       | `lifecycle.test.ts` `answers 404 for a photo that is not in the index`                                           |

## Remaining known limits

- **First-page list staleness.** The cached first list page can omit a new photo or keep a deleted one for up to 60 s at the edge, plus 30 s in the browser. A purge clears only the local colo, so other data centers wait out the full window.
- **Deleted photo in other caches.** The Cache API is per data center, so a purge clears only the colo that ran the delete. Other colos can serve the image for up to 1 day (`s-maxage=86400`). A browser that already viewed it can show it for up to 1 year (`max-age=31536000, immutable`).
- **R2 put.** The upload streams the request body into R2 once. The put has no timeout or retry and cannot be aborted. If the isolate dies between the put and the index add, the object becomes an Orphan with no log line.
- **Lost index-add response.** The cleanup deletes the R2 object and leaves an Index-only entry. A client retry with the same `uploadId` repairs it. Until then the gallery lists a photo whose image returns 404.
- **Concurrent attempts with one `uploadId`.** A stall abort does not stop the server request, so a retry can run beside it. Both write the same key and upsert the same meta, so they normally converge. A failed add in one can still delete the object the other just wrote (inferred).
- **Cursor fallback.** If all 5 anchor ids are deleted between pages, or an anchor is re-added by an upload retry, the cursor falls back to a position. The gallery hides repeats by id. The admin table and backfill do not dedupe.
- **JWKS cold isolate.** With no cached key set, admin requests fail with 401 during an Access certs outage. One request every 30 s refetches, with up to 3 attempts of 3 s each.
- **Index outage.** Stats, list, update, upload, `/media` and `/img` return an uncached 503 `Index unavailable` when the index fails after retries. The sitemap returns 503 with `Retry-After: 60`. Only a delete whose R2 or index step fails returns 500.
- **Archive cap.** The index holds at most `LIST_LIMITS.maxPhotos` (5000) photos. A 409 tells the admin to delete photos first.
- **Theme and sidebar.** An unset theme follows the system preference only at load, not a later change. An outside click does not close the open sidebar.
- **Gallery partial failure.** If a later page fails after all retries, the gallery keeps what it showed and gives no message.
