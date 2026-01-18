-- CreateTable
CREATE TABLE "pdf_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pdf_path" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pdf_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "pdf_notes_pdf_path_page_idx" ON "pdf_notes"("pdf_path", "page");
