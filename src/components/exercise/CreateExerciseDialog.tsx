import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Camera, Dumbbell } from "lucide-react";
import { toast } from "sonner";

interface CreateExerciseDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string, imageUrl: string | null) => void;
  initialName?: string;
}

const MUSCLE_GROUPS = [
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

export function CreateExerciseDialog({
  open,
  onClose,
  onCreated,
  initialName = "",
}: CreateExerciseDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initialName when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(initialName);
      setMuscleGroup("");
      setDescription("");
      setImageFile(null);
      setImagePreview(null);
    } else {
      onClose();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      e.target.value = "";
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !muscleGroup || !user) return;

    setIsSubmitting(true);
    try {
      // 1. Insert exercise
      const { data: exercise, error: insertError } = await supabase
        .from("exercises")
        .insert({
          name: name.trim(),
          muscle_group: muscleGroup as any,
          description: description.trim() || null,
          is_global: false,
          user_id: user.id,
        })
        .select("id, name")
        .single();

      if (insertError) throw insertError;

      let imageUrl: string | null = null;

      // 2. Upload image if provided
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const filePath = `${user.id}/${exercise.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("exercise-images")
          .upload(filePath, imageFile, { upsert: true });

        if (uploadError) {
          // Non-fatal: exercise was created, just without image
          console.error("Image upload failed:", uploadError);
          toast.warning("Exercício criado, mas a imagem não pôde ser salva.");
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from("exercise-images").getPublicUrl(filePath);

          imageUrl = publicUrl;

          // Update exercise with image_url
          await supabase
            .from("exercises")
            .update({ image_url: imageUrl })
            .eq("id", exercise.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Exercício criado com sucesso!");
      onCreated(exercise.id, exercise.name, imageUrl);
    } catch (error) {
      console.error("Error creating exercise:", error);
      toast.error("Erro ao criar exercício. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = name.trim().length > 0 && muscleGroup.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Exercício Personalizado</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Image upload */}
          <div className="flex justify-center">
            <div className="relative">
              <div
                className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Dumbbell className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow"
              >
                <Camera className="h-3 w-3" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="exercise-name">Nome *</Label>
            <Input
              id="exercise-name"
              placeholder="Ex: Rosca Martelo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Muscle group */}
          <div className="space-y-1.5">
            <Label htmlFor="muscle-group">Grupo Muscular *</Label>
            <Select value={muscleGroup} onValueChange={setMuscleGroup}>
              <SelectTrigger id="muscle-group">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map((group) => (
                  <SelectItem key={group.value} value={group.value}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="exercise-description">Descrição (opcional)</Label>
            <Textarea
              id="exercise-description"
              placeholder="Ex: Segure o halter verticalmente com as duas mãos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Criar Exercício"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
