import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndSubmitPRs, SessionData } from "../lib/pr";

describe("checkAndSubmitPRs", () => {
    let mockSupabase: any;
    let mockSelectResult: any[];

    beforeEach(() => {
        mockSelectResult = [];

        mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        in: vi.fn().mockResolvedValue({ data: mockSelectResult }),
                    })),
                })),
                insert: vi.fn().mockResolvedValue({ error: null }),
            })),
        };
    });

    it("should insert a new PR when no existing PR is found", async () => {
        mockSelectResult = [];

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
        // Second call to .from should be the insert
        const insertCall = mockSupabase.from.mock.results[1]?.value;
        expect(insertCall.insert).toHaveBeenCalledWith([
            {
                user_id: "user-1",
                exercise_id: "ex-1",
                weight: 100,
                reps: 5,
                volume: 500,
                session_id: "session-1",
            },
        ]);
    });

    it("should insert a new PR when weight is higher than existing PR", async () => {
        mockSelectResult = [{ exercise_id: "ex-1", weight: 90 }];

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
    });

    it("should NOT insert a PR when weight is lower than existing PR", async () => {
        mockSelectResult = [{ exercise_id: "ex-1", weight: 110 }];

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
        // Should only have 1 call (the select), no insert call
        expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("should ignore uncompleted sets", async () => {
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
                            is_completed: false,
                        },
                    ],
                },
            ],
        };

        const count = await checkAndSubmitPRs(session, "user-1", mockSupabase);

        expect(count).toBe(0);
        expect(mockSupabase.from).not.toHaveBeenCalled();
    });
});
