# Volunteer Connect — Community Aid Platform Guidelines

- Enforce publication verification, application capacity/deadlines, immutable ownership, and decision notifications with backend triggers; browser controls are not authorization.
- Assign only non-privileged signup roles through the auth lifecycle so registered users immediately obtain the selected account type.
- Reports are submitted under owner permissions and reviewed through a super-admin-checked function, preserving an auditable moderation decision.
- Use the shared page metadata helper for leaf content routes so titles and sharing descriptions remain complete.
- Keep workflow rule regression tests beside shared rule helpers and database tests in tests; keep database structure checks distinct from authenticated behavioral tests.
