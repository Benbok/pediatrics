import { defineConfig } from 'prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: 'file:./prisma/dev.db',
        tables: {
            external: [
                'guideline_chunks_fts',
                'guideline_chunks_fts_config',
                'guideline_chunks_fts_content',
                'guideline_chunks_fts_data',
                'guideline_chunks_fts_docsize',
                'guideline_chunks_fts_idx',
            ],
        },
    },
})
