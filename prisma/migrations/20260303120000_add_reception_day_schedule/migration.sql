-- CreateTable
CREATE TABLE "reception_day_schedules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "doctor_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "slot_duration_minutes" INTEGER NOT NULL,
    "end_time" TEXT NOT NULL,
    CONSTRAINT "reception_day_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "reception_day_schedules_doctor_id_date_key" ON "reception_day_schedules"("doctor_id", "date");

-- CreateIndex
CREATE INDEX "reception_day_schedules_doctor_id_idx" ON "reception_day_schedules"("doctor_id");
