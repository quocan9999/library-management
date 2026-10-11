# Local auth API collection

Run the Postman collection with Newman against the local backend:

```powershell
npx --yes newman@6.2.2 run docs/features/login_logout/postman/login_logout.postman_collection.json --env-var "baseUrl=http://localhost:8081" --bail --color off
```

The collection covers the browser origin's CORS preflight, normalized invalid credentials, admin login and refresh rotation, cookie policy and clearing, idempotent logout, and demo-member login/logout. Its access-token variable and cookie jar are transient to the Newman run; do not export them.

The Maven integration suite covers the remaining backend cases, including JWT claim sets, 401/403 authorization, disabled accounts, refresh reuse and concurrency, persistence rollback, and permission reloads.
