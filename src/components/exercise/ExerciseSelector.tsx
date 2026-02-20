import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Dumbbell } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  is_global: boolean;
  image_url: string | null;
}

interface ExerciseSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string, exerciseName: string, imageUrl: string | null) => void;
}

const MUSCLE_GROUPS = [
  { value: "all", label: "Todos" },
  { value: "chest", label: "Peito" },
  { value: "back", label: "Costas" },
  { value: "shoulders", label: "Ombros" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "legs", label: "Pernas" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "other", label: "Outros" },
];

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  legs: "Pernas",
  core: "Core",
  cardio: "Cardio",
  other: "Outros",
};

export function ExerciseSelector({ open, onClose, onSelect }: ExerciseSelectorProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, muscle_group, is_global, image_url")
        .or(`is_global.eq.true,user_id.eq.${user?.id}`)
        .order("name");

      if (error) throw error;
      return data as Exercise[];
    },
    enabled: open && !!user,
  });

  const filteredExercises = exercises?.filter((exercise) => {
    const matchesSearch = exercise.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGroup =
      selectedGroup === "all" || exercise.muscle_group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise.id, exercise.name, exercise.image_url);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader className="text-left">
          <SheetTitle>Adicionar Exercício</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar exercício..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Muscle Group Filter */}
          <ScrollArea className="w-full">
            <Tabs value={selectedGroup} onValueChange={setSelectedGroup}>
              <TabsList className="inline-flex w-auto">
                {MUSCLE_GROUPS.map((group) => (
                  <TabsTrigger
                    key={group.value}
                    value={group.value}
                    className="whitespace-nowrap"
                  >
                    {group.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </ScrollArea>

          {/* Exercise List */}
          <ScrollArea className="h-[calc(85vh-200px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredExercises?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Dumbbell className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum exercício encontrado
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {filteredExercises?.map((exercise) => (
                  <Button
                    key={exercise.id}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => handleSelect(exercise)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center">
                        {exercise.image_url ? (
                          <img
                            src={exercise.image_url}
                            alt={exercise.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Dumbbell className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{exercise.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {MUSCLE_GROUP_LABELS[exercise.muscle_group] || exercise.muscle_group}
                        </span>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
