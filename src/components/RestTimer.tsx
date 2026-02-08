import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Minus, Timer } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RestTimerProps {
    initialSeconds: number;
    isOpen: boolean;
    onClose: () => void;
    onAddSeconds?: (seconds: number) => void;
}

export function RestTimer({
    initialSeconds,
    isOpen,
    onClose,
}: RestTimerProps) {
    const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
    const [isVisible, setIsVisible] = useState(isOpen);

    useEffect(() => {
        setIsVisible(isOpen);
        if (isOpen) {
            setSecondsLeft(initialSeconds);
        }
    }, [isOpen, initialSeconds]);

    useEffect(() => {
        if (!isVisible || secondsLeft <= 0) return;

        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // Play sound
                    const audio = new Audio("/notification.mp3"); // Ensure this file exists or use a base64 sound
                    audio.play().catch(() => { }); // Catch error if user hasn't interacted
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isVisible, secondsLeft]);

    if (!isVisible) return null;

    const progress = ((initialSeconds - secondsLeft) / initialSeconds) * 100;

    return (
        <div className="fixed bottom-20 right-4 left-4 z-50 md:left-auto md:w-80">
            <Card className="border-2 border-primary/20 bg-background/95 backdrop-blur shadow-lg">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-primary animate-pulse" />
                            <span className="font-bold text-lg">Descanso</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 -mr-2 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setIsVisible(false);
                                onClose();
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center justify-center py-2">
                        <span className="text-4xl font-mono font-bold tabular-nums text-primary">
                            00:{secondsLeft.toString().padStart(2, "0")}
                        </span>
                    </div>

                    <Progress value={progress} className="h-2 mb-4" />

                    <div className="flex gap-2 justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSecondsLeft((prev) => prev + 30)}
                            className="flex-1"
                        >
                            <Plus className="h-3 w-3 mr-1" /> 30s
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Skip rest
                                setIsVisible(false);
                                onClose();
                            }}
                            className="flex-1"
                        >
                            Pular
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSecondsLeft((prev) => Math.max(0, prev - 10))}
                            className="flex-1"
                        >
                            <Minus className="h-3 w-3 mr-1" /> 10s
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
