import { Prisma } from "@prisma/client";
import { database } from "./db";

export const trashKinds = ["resumeVersion", "application", "interviewSession", "interviewPreparation", "agentThread", "snapshot"] as const;
export type TrashKind = typeof trashKinds[number];
type RecordKind = Exclude<TrashKind, "snapshot">;
type Stored = { id: string; deletedAt: Date | null; name?: string; title?: string; job?: { company: string; title: string } | null };
// All five tables implement these operations. Keep the dynamic dispatch confined here.
type Delegate = {
  findMany(args: unknown): Promise<Stored[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
};
function records(client: Prisma.TransactionClient, kind: RecordKind) {
  return client[kind] as unknown as Delegate;
}

export function moveToTrash(kind: RecordKind, id: string) {
  return moveManyToTrash(kind, [id]);
}

export function moveManyToTrash(kind: RecordKind, ids?: string[]) {
  return records(database, kind).updateMany({
    where: { deletedAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { deletedAt: new Date() },
  });
}

export function saveTrashSnapshot(client: Prisma.TransactionClient, kind: string, recordId: string, name: string, content: unknown) {
  return client.trashSnapshot.create({ data: { kind, recordId, name, content: JSON.parse(JSON.stringify(content)) } });
}

export async function moveWorkspaceToTrash(tx?: Prisma.TransactionClient): Promise<void> {
  if (!tx) return database.$transaction((transaction) => moveWorkspaceToTrash(transaction));
  const jobs = await tx.job.findMany();
  for (const job of jobs) {
    if (!job.jd && job.analysis === null) continue;
    await saveTrashSnapshot(tx, "job-analysis", job.id, `${job.company} · ${job.title}`, { jd: job.jd, analysis: job.analysis });
    await tx.job.update({ where: { id: job.id }, data: { jd: "", analysis: Prisma.DbNull } });
  }
  for (const kind of trashKinds) {
    if (kind !== "snapshot") await records(tx, kind).updateMany({ where: { deletedAt: null }, data: { deletedAt: new Date() } });
  }
  await tx.settings.upsert({ where: { id: "singleton" }, create: { sampleDataCleared: true }, update: { sampleDataCleared: true } });
}

export async function listTrash() {
  const groups = await Promise.all(trashKinds.filter((kind) => kind !== "snapshot").map(async (kind) => {
    const rows = await records(database, kind).findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, deletedAt: true, ...(kind === "resumeVersion" ? { name: true } : kind === "agentThread" ? { title: true } : { job: { select: { company: true, title: true } } }) },
    });
    return rows.map((row) => ({ id: row.id, kind, name: row.name || row.title || (row.job ? `${row.job.company} · ${row.job.title}` : row.id), deletedAt: row.deletedAt!.toISOString() }));
  }));
  const snapshots = await database.trashSnapshot.findMany({ select: { id: true, name: true, kind: true, deletedAt: true } });
  return [...groups.flat(), ...snapshots.map((row) => ({ id: row.id, kind: "snapshot" as const, name: row.name, section: row.kind, deletedAt: row.deletedAt.toISOString() }))]
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function restoreTrash(kind: TrashKind, id: string) {
  return database.$transaction(async (tx) => {
    if (kind === "snapshot") return restoreSnapshot(tx, id);
    await records(tx, kind).updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
  });
}

export async function restoreAllTrash() {
  return database.$transaction(async (tx) => {
    for (const kind of trashKinds) {
      if (kind !== "snapshot") await records(tx, kind).updateMany({ where: { deletedAt: { not: null } }, data: { deletedAt: null } });
    }
    const snapshots = await tx.trashSnapshot.findMany({ select: { id: true }, orderBy: [{ deletedAt: "desc" }, { id: "desc" }] });
    for (const { id } of snapshots) await restoreSnapshot(tx, id, true);
  });
}

async function restoreSnapshot(tx: Prisma.TransactionClient, id: string, skipConflicts = false) {
  const snapshot = await tx.trashSnapshot.findUniqueOrThrow({ where: { id } });
  const content = snapshot.content as Record<string, Prisma.InputJsonValue>;
  function conflict(message: string) {
    if (!skipConflicts) throw new Error(message);
  }
  if (snapshot.kind === "job-analysis") {
    const job = await tx.job.findUnique({ where: { id: snapshot.recordId } });
    if (!job) return conflict("找不到这份资料原来所属的岗位。");
    if (job.jd || job.analysis !== null) return conflict("岗位已有新的内容，恢复会覆盖新修改。请先保存或移走新内容，再恢复。");
    await tx.job.update({ where: { id: job.id }, data: { jd: String(content.jd), analysis: content.analysis ?? Prisma.DbNull } });
  } else {
    const session = await tx.interviewSession.findUnique({ where: { id: snapshot.recordId, deletedAt: null } });
    if (!session) return conflict("请先从回收站恢复这次模拟面试，再恢复其中的资料。");
    if (snapshot.kind === "questions") {
      if ((Array.isArray(session.questions) && session.questions.length) || Object.keys(session.answers as object).length) return conflict("已有新的问答，恢复会覆盖新修改。请先保存或移走新内容。");
      await tx.interviewSession.update({ where: { id: session.id }, data: { questions: content.questions, answers: content.answers, currentQuestionIndex: Number(content.currentQuestionIndex) } });
    } else {
      if (session.feedback && Object.keys(session.feedback as object).length) return conflict("已有新的复盘，恢复会覆盖新修改。请先保存或移走新内容。");
      await tx.interviewSession.update({ where: { id: session.id }, data: { feedback: content.feedback } });
    }
  }
  await tx.trashSnapshot.delete({ where: { id } });
}

async function purge(client: Prisma.TransactionClient, kind: TrashKind, id?: string) {
  if (kind === "snapshot") return client.trashSnapshot.deleteMany({ where: id ? { id } : {} });
  if (kind === "interviewSession") {
    const sessions = await client.interviewSession.findMany({ where: { deletedAt: { not: null }, ...(id ? { id } : {}) }, select: { id: true } });
    // Partial deletions belong to the same session; don't leave unrestorable entries behind.
    const snapshots = await client.trashSnapshot.count({ where: { kind: { in: ["questions", "feedback"] }, recordId: { in: sessions.map((row) => row.id) } } });
    if (snapshots) throw new Error("这次面试还有单独删除的问答或复盘。请先恢复它们，或在回收站永久删除它们。");
  }
  return records(client, kind).deleteMany({ where: { deletedAt: { not: null }, ...(id ? { id } : {}) } });
}

export async function permanentlyDeleteTrash(kind?: TrashKind, id?: string) {
  return database.$transaction(async (tx) => {
    if (kind) await purge(tx, kind, id);
    else {
      await purge(tx, "snapshot");
      for (const item of trashKinds) if (item !== "snapshot") await purge(tx, item);
    }
  });
}
