---
name: processbase-site-assistant
description: Use the local Superelements POC to consult ProcessBase brand knowledge and create reversible Elementor page drafts without publishing to WordPress.
---

# ProcessBase site assistant

Use this workflow only for the ProcessBase project in this POC.

1. Call `get_processbase_project` before creating a page so the user can see the available scope.
2. Call `search_processbase_knowledge` for the topic, CTA or section being written. Treat returned source lines as evidence; do not invent absent contact data, claims, prices or results.
3. Call `create_processbase_page_draft` only after the title and goal are known.
4. State clearly that the result is a local Elementor JSON draft and was not sent to WordPress.

The POC has no authentication, remote database, WordPress write access or publishing tool. Never imply otherwise.
