import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndSubmitPRs, SessionData } from "../lib/pr";

describe("checkAndSubmitPRs", () => {
    let mockSupabase: any;

    beforeEach(() => {
        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn(),
            insert: vi.fn().mockResolvedValue({ error: null }),
        };
    });

    it("should insert a new PR when no existing PR is found", async () => {
        // Mock no existing PR
        mockSupabase.single.mockResolvedValue({ data: null });

        const session: SessionData = {
            id: "session-1",
            exercises: [
                {
                    id: "se-1",
                    exercise_id: "ex-1",
                    exercise_name: "Bench Press",
                    order_index: 0,
                    session_sets: [
                        {
                            id: "ss-1",
                            order_index: 0,
                            weight: 100,
                            reps: 5,
                            is_completed: true,
                        },
                    ],
                },
            ],
        };

        const count = await checkAndSubmitPRs(session, "user-1", mockSupabase);

        expect(count).toBe(1);
        expect(mockSupabase.from).toHaveBeenCalledWith("personal_records");
        expect(mockSupabase.insert).toHaveBeenCalledWith({
            user_id: "user-1",
            exercise_id: "ex-1",
            weight: 100,
            reps: 5,
            volume: 500,
            session_id: "session-1",
        });
    });

    it("should insert a new PR when weight is higher than existing PR", async () => {
        // Mock existing PR of 90kg
        mockSupabase.single.mockResolvedValue({ data: { weight: 90, reps: 5 } });

        const session: SessionData = {
            id: "session-1",
            exercises: [
                {
                    id: "se-1",
                    exercise_id: "ex-1",
                    exercise_name: "Bench Press",
                    order_index: 0,
                    session_sets: [
                        {
                            id: "ss-1",
                            order_index: 0,
                            weight: 100,
                            reps: 5,
                            is_completed: true,
                        },
                    ],
                },
            ],
        };

        const count = await checkAndSubmitPRs(session, "user-1", mockSupabase);

        expect(count).toBe(1);
        expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should NOT insert a PR when weight is lower than existing PR", async () => {
        // Mock existing PR of 110kg
        mockSupabase.single.mockResolvedValue({ data: { weight: 110, reps: 5 } });

        const session: SessionData = {
            id: "session-1",
            exercises: [
                {
                    id: "se-1",
                    exercise_id: "ex-1",
                    exercise_name: "Bench Press",
                    order_index: 0,
                    session_sets: [
                        {
                            id: "ss-1",
                            order_index: 0,
                            weight: 100,
                            reps: 5,
                            is_completed: true,
                        },
                    ],
                },
            ],
        };

        const count = await checkAndSubmitPRs(session, "user-1", mockSupabase);

        expect(count).toBe(0);
        expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it("should ignore uncompleted sets", async () => {
        mockSupabase.single.mockResolvedValue({ data: null });

        const session: SessionData = {
            id: "session-1",
            exercises: [
                {
                    id: "se-1",
                    exercise_id: "ex-1",
                    exercise_name: "Bench Press",
                    order_index: 0,
                    session_sets: [
                        {
                            id: "ss-1",
                            order_index: 0,
                            weight: 100,
                            reps: 5,
                            is_completed: false, // Not completed
                        },
                    ],
                },
            ],
        };

        const count = await checkAndSubmitPRs(session, "user-1", mockSupabase);

        expect(count).toBe(0);
        expect(mockSupabase.insert).not.toHaveBeenCalled();
    });
});
