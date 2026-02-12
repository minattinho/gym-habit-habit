import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <h1 className="text-2xl font-bold">Perfil</h1>
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <Card>
          <CardContent className="flex flex-col items-center py-8">
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
                  className="text-center"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => updateMutation.mutate(name)}
                    disabled={updateMutation.isPending}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold">
                  {profile?.name || "Usuário"}
                </h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setIsEditing(true)}
                >
                  Editar nome
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Dumbbell className="h-4 w-4 text-primary" />
                Treinos Criados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.workouts || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                Sessões Realizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.sessions || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Install PWA */}
        {!isInstalled && (
          <Button
            className="w-full touch-target"
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
          className="w-full touch-target text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair da Conta
        </Button>
      </div>
    </div>
  );
}
