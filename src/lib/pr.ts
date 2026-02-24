import { SupabaseClient } from "@supabase/supabase-js";

export interface SessionSet {
    id: string;
    order_index: number;
    weight: number | null;
    reps: number | null;
    is_completed: boolean;
    notes?: string | null;
}

export interface SessionExercise {
    id: string;
    exercise_id: string;
    exercise_name: string;
    order_index: number;
    session_sets: SessionSet[];
}

export interface SessionData {
    id: string;
    exercises: SessionExercise[];
}

export async function checkAndSubmitPRs(
    session: SessionData,
    userId: string,
    supabase: SupabaseClient
) {
    // Collect all exercise IDs that have completed sets
    const exerciseIds = new Set<string>();
    for (const exercise of session.exercises) {
        for (const set of exercise.session_sets) {
            if (set.is_completed && set.weight && set.reps) {
                exerciseIds.add(exercise.exercise_id);
            }
        }
    }

    if (exerciseIds.size === 0) return 0;

    // 1. Fetch all existing PRs for these exercises in ONE query
    const { data: existingPRs } = await supabase
        .from("personal_records")
        .select("exercise_id, weight")
        .eq("user_id", userId)
        .in("exercise_id", Array.from(exerciseIds));

    // Build a map of best weight per exercise
    const bestWeightMap = new Map<string, number>();
    if (existingPRs) {
        for (const pr of existingPRs) {
            const current = bestWeightMap.get(pr.exercise_id) ?? 0;
            if (pr.weight > current) {
                bestWeightMap.set(pr.exercise_id, pr.weight);
            }
        }
    }

    // 2. Find new PRs by comparing locally
    const newPRs: Array<{
        user_id: string;
        exercise_id: string;
        weight: number;
        reps: number;
        volume: number;
        session_id: string;
    }> = [];

    for (const exercise of session.exercises) {
        let bestNewWeight = bestWeightMap.get(exercise.exercise_id) ?? 0;

        for (const set of exercise.session_sets) {
            if (set.is_completed && set.weight && set.reps && set.weight > bestNewWeight) {
                bestNewWeight = set.weight;
                newPRs.push({
                    user_id: userId,
                    exercise_id: exercise.exercise_id,
                    weight: set.weight,
                    reps: set.reps,
                    volume: set.weight * set.reps,
                    session_id: session.id,
                });
            }
        }
    }

    // 3. Batch insert all new PRs at once
    if (newPRs.length > 0) {
        await supabase.from("personal_records").insert(newPRs);
    }

    return newPRs.length;
}
