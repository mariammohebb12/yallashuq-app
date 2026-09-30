# Backend request 024 — Production shows full Python tracebacks in error responses (SECURITY)

**Status:** Open — SECURITY / CONFIGURATION issue. Doesn't block the app, but should be fixed on
production soon.
**Requested:** 2026-09-30
**For:** whoever administers the YallaShuq Odoo production server (yallashuq.com)

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–023 have the same background.

## What was seen (production, 2026-09-30)

An **unauthenticated** JSON-RPC call (no session cookie) to a route that needs a signed-in user:

```
POST https://yallashuq.com/my/wallet/json
Content-Type: application/json
{"jsonrpc":"2.0","method":"call","params":{},"id":1}
```

returns the expected "Odoo Session Expired" error, but `error.data.debug` holds the **full Python
traceback**, including server file paths and the install location, e.g.:

```
File "/home/ubuntu/odoo18_enterprise/odoo/http.py", line 1957, in _transactioning
File "/home/ubuntu/odoo18_enterprise/odoo/addons/base/models/ir_http.py", line 244, in _auth_method_user
```

Anyone on the internet can trigger this without an account. It exposes the OS user (`ubuntu`),
the Odoo install path, the Odoo edition/layout and code line numbers. Other errors (including
from custom addons) are likely just as detailed, which gives an attacker a map of the server.

## What's needed

- On production, error responses must not include tracebacks or server paths (keep the error
  `message` / `name`, which clients use, e.g. to tell "signed out" apart from other errors).
- Note (not verified against this server's code): stock Odoo's JSON-RPC error serializer is
  believed to include this `debug` traceback by default, not only in `--dev` mode. So turning
  debug/dev settings off may not be enough. The fix may need a small override of the error
  serialization, or the reverse proxy stripping `error.data.debug`. Please confirm and choose.
  Either way, confirm `--dev` / `dev_mode` is off on production.
- Check staging too, and check the HTML error pages (500 pages) as well as JSON-RPC.

## Not done

Nothing was changed. Only the one unauthenticated read-only call above was made.
