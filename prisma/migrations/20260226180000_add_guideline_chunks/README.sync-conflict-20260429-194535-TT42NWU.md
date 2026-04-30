Migration adds `guideline_chunks` table and `guideline_chunks_fts` (FTS5) virtual table with triggers.

Notes:
- FTS5 is used for fast offline lexical search (BM25).
- Triggers keep FTS table synchronized with `guideline_chunks`.
