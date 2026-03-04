import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
}

const muscleGroupLabels: Record<string, string> = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  legs: "Pernas",
  core: "Core",
  cardio: "Cardio",
  other: "Outro",
};

interface ExerciseSearchSelectProps {
  exercises: Exercise[];
  recentExerciseIds: string[];
  value: string;
  onSelect: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciseSearchSelect({
  exercises,
  recentExerciseIds,
  value,
  onSelect,
  open,
  onOpenChange,
}: ExerciseSearchSelectProps) {
  const selected = exercises.find((e) => e.id === value);
  const recentExercises = recentExerciseIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter(Boolean) as Exercise[];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 text-left font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {selected.name}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {muscleGroupLabels[selected.muscle_group] || selected.muscle_group}
              </Badge>
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione um exercício...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar exercício..." />
          <CommandList>
            <CommandEmpty>Nenhum exercício encontrado.</CommandEmpty>
            {recentExercises.length > 0 && (
              <>
                <CommandGroup heading="Recentes">
                  {recentExercises.map((ex) => (
                    <CommandItem
                      key={`recent-${ex.id}`}
                      value={ex.name}
                      onSelect={() => {
                        onSelect(ex.id);
                        onOpenChange(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === ex.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">{ex.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-2">
                        {muscleGroupLabels[ex.muscle_group] || ex.muscle_group}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading="Todos os exercícios">
              {exercises.map((ex) => (
                <CommandItem
                  key={ex.id}
                  value={ex.name}
                  onSelect={() => {
                    onSelect(ex.id);
                    onOpenChange(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === ex.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{ex.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-2">
                    {muscleGroupLabels[ex.muscle_group] || ex.muscle_group}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
