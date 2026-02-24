import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface NumberStepperProps {
    value: number | null;
    onChange: (value: number) => void;
    step?: number;
    min?: number;
    max?: number;
    disabled?: boolean;
    className?: string;
    label?: string;
}

export function NumberStepper({
    value,
    onChange,
    step = 1,
    min = 0,
    max = 999,
    disabled = false,
    className = "",
    label,
}: NumberStepperProps) {
    const [internalValue, setInternalValue] = useState<string>(
        value?.toString() ?? ""
    );
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastEmittedRef = useRef<number | null>(value);

    // Sync from parent only when the parent value differs from what we last emitted
    useEffect(() => {
        if (value !== lastEmittedRef.current) {
            setInternalValue(value?.toString() ?? "");
            lastEmittedRef.current = value;
        }
    }, [value]);

    const debouncedOnChange = useCallback(
        (newValue: number) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                lastEmittedRef.current = newValue;
                onChange(newValue);
            }, 500);
        },
        [onChange]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleIncrement = () => {
        if (disabled) return;
        const currentValue = parseFloat(internalValue) || 0;
        const newValue = Math.min(currentValue + step, max);
        setInternalValue(newValue.toString());
        debouncedOnChange(newValue);
    };

    const handleDecrement = () => {
        if (disabled) return;
        const currentValue = parseFloat(internalValue) || 0;
        const newValue = Math.max(currentValue - step, min);
        setInternalValue(newValue.toString());
        debouncedOnChange(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInternalValue(val);
        const num = parseFloat(val);
        if (!isNaN(num)) {
            debouncedOnChange(num);
        }
    };

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={handleDecrement}
                disabled={disabled}
                type="button"
                aria-label={`Decrease ${label || "value"}`}
            >
                <Minus className="h-3 w-3" />
            </Button>
            <Input
                type="number"
                value={internalValue}
                onChange={handleInputChange}
                className="h-8 w-14 border-none bg-transparent text-center font-mono text-lg font-medium shadow-none focus-visible:ring-0 px-0"
                disabled={disabled}
                min={min}
                max={max}
                step={step}
            />
            <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={handleIncrement}
                disabled={disabled}
                type="button"
                aria-label={`Increase ${label || "value"}`}
            >
                <Plus className="h-3 w-3" />
            </Button>
        </div>
    );
}
