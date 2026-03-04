import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, LogOut, Camera, User, Dumbbell, Calendar, Download } from "lucide-react";
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

    // Check if already installed
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

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Formato inválido. Use JPG, PNG ou WebP.");
        event.target.value = "";
        return;
      }

      const maxSizeBytes = 2 * 1024 * 1024; // 2 MB
      if (file.size > maxSizeBytes) {
        toast.error("Arquivo muito grande. Máximo 2MB.");
        event.target.value = "";
        return;
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}/avatar.${fileExt}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile
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
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <div className="glass rounded-2xl shadow-xl">
          <div className="flex flex-col items-center py-8 px-4">
            <div className="relative mb-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                  {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
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
              <div className="flex w-full max-w-xs flex-col gap-2">
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
              <>
                <h2 className="text-xl font-semibold text-white">
                  {profile?.name || "Usuário"}
                </h2>
                <p className="text-sm text-white/60">{user?.email}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setIsEditing(true)}
                >
                  Editar nome
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-2xl shadow-xl p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/60 mb-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              Treinos Criados
            </div>
            <p className="text-3xl font-bold text-white">{stats?.workouts || 0}</p>
          </div>

          <div className="glass rounded-2xl shadow-xl p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/60 mb-2">
              <Calendar className="h-4 w-4 text-primary" />
              Sessões Realizadas
            </div>
            <p className="text-3xl font-bold text-white">{stats?.sessions || 0}</p>
          </div>
        </div>

        {/* Install PWA */}
        {!isInstalled && (
          <Button
            className="w-full touch-target bg-gradient-to-r from-primary to-emerald-400 font-semibold text-white shadow-lg glow-primary hover:opacity-90"
            onClick={deferredPrompt ? handleInstall : undefined}
            disabled={!deferredPrompt}
            title={!deferredPrompt ? "Acesse pela URL publicada para instalar" : undefined}
          >
            <Download className="mr-2 h-4 w-4" />
            {deferredPrompt ? "Instalar App" : "Instalar App (publique e acesse pelo navegador)"}
          </Button>
        )}

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full touch-target border-white/20 bg-white/10 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair da Conta
        </Button>
      </div>
    </div>
  );
}
