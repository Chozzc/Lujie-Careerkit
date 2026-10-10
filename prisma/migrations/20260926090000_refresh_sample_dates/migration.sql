-- Update only untouched built-in sample dates; preserve user-edited values.
UPDATE "Job" SET "deadline" = CAST(strftime('%s', '2026-11-18') AS INTEGER) * 1000 WHERE "id" = 'cmqgzt65k0003a0cwskeetbo1' AND "deadline" = CAST(strftime('%s', '2026-09-18') AS INTEGER) * 1000;
UPDATE "Job" SET "deadline" = CAST(strftime('%s', '2026-11-20') AS INTEGER) * 1000 WHERE "id" = 'cmqgua8t70000a0cwl8o3xqwn' AND "deadline" = CAST(strftime('%s', '2026-09-20') AS INTEGER) * 1000;
UPDATE "Job" SET "deadline" = CAST(strftime('%s', '2026-11-22') AS INTEGER) * 1000 WHERE "id" = 'cmq1p2ksn0006ui8wbyrbxega' AND "deadline" = CAST(strftime('%s', '2026-09-22') AS INTEGER) * 1000;
UPDATE "Job" SET "deadline" = CAST(strftime('%s', '2026-11-25') AS INTEGER) * 1000 WHERE "id" = 'cmq1p21td0003ui8wzce4qda6' AND "deadline" = CAST(strftime('%s', '2026-09-25') AS INTEGER) * 1000;
UPDATE "Job" SET "deadline" = CAST(strftime('%s', '2026-11-15') AS INTEGER) * 1000 WHERE "id" = 'cmq1ox0mq0000ui8wt80spiuh' AND "deadline" = CAST(strftime('%s', '2026-09-15') AS INTEGER) * 1000;
UPDATE "Job" SET "deadline" = CAST(strftime('%s', '2026-11-28') AS INTEGER) * 1000 WHERE "id" = 'job-meituan-backend' AND "deadline" = CAST(strftime('%s', '2026-09-28') AS INTEGER) * 1000;

UPDATE "Application" SET "stageDate" = CAST(strftime('%s', '2026-11-12') AS INTEGER) * 1000 WHERE "id" = 'cmqgzt65v0005a0cw4gpgz37f' AND "stageDate" = CAST(strftime('%s', '2026-09-12') AS INTEGER) * 1000;
UPDATE "Application" SET "nextFollowUpAt" = CAST(strftime('%s', '2026-11-10') AS INTEGER) * 1000 WHERE "id" = 'cmqgua8tg0002a0cwscbuxxq1' AND "nextFollowUpAt" = CAST(strftime('%s', '2026-09-10') AS INTEGER) * 1000;
UPDATE "Application" SET "nextFollowUpAt" = CAST(strftime('%s', '2026-11-09') AS INTEGER) * 1000 WHERE "id" = 'cmq1ox0n40002ui8w0au2hlxb' AND "nextFollowUpAt" = CAST(strftime('%s', '2026-09-09') AS INTEGER) * 1000;
