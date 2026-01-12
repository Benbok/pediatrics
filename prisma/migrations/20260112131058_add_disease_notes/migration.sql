-- CreateTable
CREATE TABLE "disease_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "disease_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "disease_notes_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "disease_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
