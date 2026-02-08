import { SupabaseClient } from "@supabase/supabase-js";

export interface SessionSet {
    id: string;
    order_index: number;
    weight: number | null;
    reps: number | null;
    is_completed: boolean;
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
    let newPRCount = 0;

    for (const exercise of session.exercises) {
        for (const set of exercise.session_sets) {
            if (set.is_completed && set.weight && set.reps) {
                // Check if this is a PR
                const { data: existingPR } = await supabase
                    .from("personal_records")
                    .select("weight, reps")
                    .eq("user_id", userId)
                    .eq("exercise_id", exercise.exercise_id)
                    .order("weight", { ascending: false })
                    .limit(1)
                    .single();

                if (!existingPR || set.weight > existingPR.weight) {
                    // New PR!
                    await supabase.from("personal_records").insert({
                        user_id: userId,
                        exercise_id: exercise.exercise_id,
                        weight: set.weight,
                        reps: set.reps,
                        volume: set.weight * set.reps,
                        session_id: session.id,
                    });
                    newPRCount++;
                }
            }
        }
    }

    return newPRCount;
}
