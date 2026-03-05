import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "gymfriend_offline_queue";

export type QueuedOp =
  | { id: string; timestamp: number; type: "updateSet"; setId: string; updates: Record<string, unknown> }
  | { id: string; timestamp: number; type: "addSet"; sessionExerciseId: string; weight: number | null; reps: number | null; orderIndex: number }
  | { id: string; timestamp: number; type: "removeSet"; setId: string }
  | { id: string; timestamp: number; type: "finishSession"; sessionId: string; completedAt: string; durationSeconds: number };

export function getQueue(): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Queues an updateSet op, merging with any existing op for the same setId. */
export function enqueueUpdateSet(setId: string, updates: Record<string, unknown>) {
  const queue = getQueue();
  const existingIdx = queue.findIndex(
    (op) => op.type === "updateSet" && (op as Extract<QueuedOp, { type: "updateSet" }>).setId === setId
  );
  if (existingIdx >= 0) {
    const existing = queue[existingIdx] as Extract<QueuedOp, { type: "updateSet" }>;
    queue[existingIdx] = { ...existing, updates: { ...existing.updates, ...updates }, timestamp: Date.now() };
  } else {
    queue.push({ id: crypto.randomUUID(), timestamp: Date.now(), type: "updateSet", setId, updates });
  }
  saveQueue(queue);
}

export function enqueueAddSet(
  sessionExerciseId: string,
  weight: number | null,
  reps: number | null,
  orderIndex: number
) {
  const queue = getQueue();
  queue.push({ id: crypto.randomUUID(), timestamp: Date.now(), type: "addSet", sessionExerciseId, weight, reps, orderIndex });
  saveQueue(queue);
}

export function enqueueRemoveSet(setId: string) {
  const queue = getQueue();
  // If this setId was added offline (has a pending addSet), cancel both
  const addIdx = queue.findIndex(
    (op) => op.type === "addSet" && (op as Extract<QueuedOp, { type: "addSet" }>).sessionExerciseId === setId
  );
  if (addIdx >= 0) {
    queue.splice(addIdx, 1);
    // Also remove any updateSet for this temp id
    const filtered = queue.filter(
      (op) => !(op.type === "updateSet" && (op as Extract<QueuedOp, { type: "updateSet" }>).setId === setId)
    );
    saveQueue(filtered);
    return;
  }
  queue.push({ id: crypto.randomUUID(), timestamp: Date.now(), type: "removeSet", setId });
  saveQueue(queue);
}

export function enqueueFinishSession(sessionId: string, completedAt: string, durationSeconds: number) {
  const queue = getQueue();
  // Only one finishSession per sessionId
  const existing = queue.findIndex(
    (op) => op.type === "finishSession" && (op as Extract<QueuedOp, { type: "finishSession" }>).sessionId === sessionId
  );
  const op: QueuedOp = { id: crypto.randomUUID(), timestamp: Date.now(), type: "finishSession", sessionId, completedAt, durationSeconds };
  if (existing >= 0) {
    queue[existing] = op;
  } else {
    queue.push(op);
  }
  saveQueue(queue);
}

export function dequeue(id: string) {
  saveQueue(getQueue().filter((op) => op.id !== id));
}

export function queueSize() {
  return getQueue().length;
}

/** Executes a single queued operation against Supabase. Throws on failure. */
async function executeOp(op: QueuedOp): Promise<void> {
  switch (op.type) {
    case "updateSet": {
      const { error } = await supabase.from("session_sets").update(op.updates).eq("id", op.setId);
      if (error) throw error;
      break;
    }
    case "addSet": {
      const { error } = await supabase.from("session_sets").insert({
        session_exercise_id: op.sessionExerciseId,
        order_index: op.orderIndex,
        weight: op.weight,
        reps: op.reps,
        is_completed: false,
      });
      if (error) throw error;
      break;
    }
    case "removeSet": {
      const { error } = await supabase.from("session_sets").delete().eq("id", op.setId);
      if (error) throw error;
      break;
    }
    case "finishSession": {
      const { error } = await supabase
        .from("training_sessions")
        .update({ completed_at: op.completedAt, duration_seconds: op.durationSeconds })
        .eq("id", op.sessionId);
      if (error) throw error;
      break;
    }
  }
}

/** Flushes all queued operations. Returns number of successfully synced ops. */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      await executeOp(op);
      dequeue(op.id);
      synced++;
    } catch (e) {
      console.error("[OfflineQueue] Failed to sync op:", op.type, e);
      failed++;
    }
  }

  return { synced, failed };
}
