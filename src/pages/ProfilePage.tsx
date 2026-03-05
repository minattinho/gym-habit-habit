import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, LogOut, Camera, Dumbbell, Calendar, Download, Pencil, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      toast.success("App instalado com sucesso!");
    }
    setDeferredPrompt(null);
  };

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setName(data.name || "");
      return data as Profile;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["user_stats"],
    queryFn: async () => {
      const [workoutsResult, sessionsResult] = await Promise.all([
        supabase
          .from("workouts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user?.id),
        supabase
          .from("training_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user?.id),
      ]);

      return {
        workouts: workoutsResult.count || 0,
        sessions: sessionsResult.count || 0,
      };
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ name: newName })
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado!");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar perfil");
    },
  });

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Formato inválido. Use JPG, PNG ou WebP.");
        event.target.value = "";
        return;
      }

      const maxSizeBytes = 2 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        toast.error("Arquivo muito grande. Máximo 2MB.");
        event.target.value = "";
        return;
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user?.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-28">

      {/* Hero Card */}
      <div className="glass rounded-2xl shadow-2xl overflow-hidden mb-5 animate-slide-up">
        {/* Banner gradient */}
        <div className="h-28 bg-gradient-to-br from-emerald-600/50 via-primary/30 to-secondary/40 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -top-6 -right-6 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-4 left-8 h-20 w-20 rounded-full bg-secondary/20 blur-xl" />
        </div>

        {/* Avatar + info */}
        <div className="flex flex-col items-center px-6 pb-8 -mt-14">
          <div className="relative mb-4">
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-emerald-400 blur-lg opacity-50 scale-110" />
            <Avatar className="h-28 w-28 relative ring-4 ring-black/40 shadow-2xl">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-emerald-400 text-3xl font-bold text-white">
                {profile?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110 glow-primary"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadAvatar}
              disabled={uploading}
            />
          </div>

          {isEditing ? (
            <div className="flex w-full max-w-xs flex-col gap-3 mt-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="text-center border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setIsEditing(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-primary to-emerald-400 font-semibold text-white shadow-lg glow-primary hover:opacity-90"
                  onClick={() => updateMutation.mutate(name)}
                  disabled={updateMutation.isPending}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center mt-1">
              <h2 className="text-2xl font-bold gradient-text">
                {profile?.name || "Usuário"}
              </h2>
              <p className="text-sm text-white/50 mt-1">{user?.email}</p>
              <button
                className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-white/40 hover:text-primary transition-colors"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3" />
                Editar nome
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-2 gap-4 mb-5 animate-slide-up"
        style={{ animationDelay: "0.07s" }}
      >
        <div className="glass rounded-2xl shadow-xl p-5 relative overflow-hidden">
          <div className="pointer-events-none absolute top-0 right-0 h-20 w-20 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/20 blur-xl" />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-3">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
            Treinos
          </div>
          <p className="text-5xl font-bold text-white tabular-nums leading-none">
            {stats?.workouts || 0}
          </p>
          <p className="text-xs text-white/40 mt-2">criados</p>
        </div>

        <div className="glass rounded-2xl shadow-xl p-5 relative overflow-hidden">
          <div className="pointer-events-none absolute top-0 right-0 h-20 w-20 -translate-y-1/2 translate-x-1/2 rounded-full bg-secondary/20 blur-xl" />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-3">
            <Calendar className="h-3.5 w-3.5 text-secondary" />
            Sessões
          </div>
          <p className="text-5xl font-bold text-white tabular-nums leading-none">
            {stats?.sessions || 0}
          </p>
          <p className="text-xs text-white/40 mt-2">realizadas</p>
        </div>
      </div>

      {/* Actions */}
      <div
        className="space-y-3 animate-slide-up"
        style={{ animationDelay: "0.12s" }}
      >
        {!isInstalled && (
          <button
            className="w-full glass rounded-2xl p-4 flex items-center gap-4 border border-white/10 hover:bg-white/[0.08] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={deferredPrompt ? handleInstall : undefined}
            disabled={!deferredPrompt}
            title={!deferredPrompt ? "Acesse pela URL publicada para instalar" : undefined}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-white text-sm">Instalar App</p>
              <p className="text-xs text-white/40 mt-0.5">
                {deferredPrompt ? "Adicionar à tela inicial" : "Publique e acesse pelo navegador"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
          </button>
        )}

        <button
          className="w-full glass rounded-2xl p-4 flex items-center gap-4 border border-red-500/20 hover:bg-red-500/10 transition-all group"
          onClick={handleLogout}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
            <LogOut className="h-5 w-5 text-red-400" />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-red-400 text-sm">Sair da Conta</p>
            <p className="text-xs text-white/40 mt-0.5">Encerrar sessão atual</p>
          </div>
        </button>
      </div>
    </div>
  );
}
