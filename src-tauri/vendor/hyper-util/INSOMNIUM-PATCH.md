# Insomnium hyper-util patch

Upstream: hyper-util 0.1.21, complete published crate retained. Original registry archive SHA256 ddc03d96684f9226b8a787cdb71488417b53ab5ea8fdb1dac946cb9431cc8bff, 126820 bytes.

Only src/client/proxy/matcher.rs differs from the published source. Adds Matcher::from_system_with_no_proxy(&str), delegating to existing Builder::from_system().no(value).build(). It preserves discovery, destination rules, authentication and CGI handling while overriding the exclusion list, without changing any process environment. None handling is owned by reqwest; normal from_system remains unchanged. Existing feature gates determine OS discovery; this patch enables no new platform feature. Keep the extension and the reqwest consumer together on upgrades.

Original LICENSE and all other upstream files remain byte-identical. No upstream tests are modified or new test scripts authored.
