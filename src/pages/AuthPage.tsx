import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import gymfriendLogo from "@/assets/gymfriend-logo.png";

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await signIn(email, password);

    if (error) {
      toast.error("Erro ao entrar", {
        description:
          error.message === "Invalid login credentials"
            ? "Email ou senha incorretos"
            : error.message,
      });
    } else {
      navigate(from, { replace: true });
    }

    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, name);

    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
    } else {
      toast.success("Conta criada com sucesso!", {
        description: "Verifique seu email para confirmar o cadastro.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-emerald-950">
      {/* Ambient orbs */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-8%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-float"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-8%] right-[-8%] h-72 w-72 rounded-full bg-secondary/15 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[-5%] top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl animate-float"
        style={{ animationDelay: "1s" }}
        aria-hidden
      />

      {/* Content */}
      <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 animate-slide-up">
          <img
            src={gymfriendLogo}
            alt="GymFriend Logo"
            className="h-28 w-auto object-contain drop-shadow-2xl"
          />
          <p className="text-sm font-medium tracking-wide text-white/60 uppercase">
            Seu Parceiro de Treinos
          </p>
        </div>

        {/* Glassmorphism card */}
        <div
          className="glass w-full max-w-md rounded-2xl p-1 animate-slide-up shadow-2xl"
          style={{ animationDelay: "0.1s" }}
        >
          <Tabs defaultValue="login" className="w-full">
            {/* Tab switcher */}
            <div className="px-5 pt-5 pb-4">
              <TabsList className="grid w-full grid-cols-2 bg-white/10 text-white/60">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  Cadastrar
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Login */}
            <TabsContent value="login" className="mt-0 px-5 pb-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-white/80 text-sm">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    disabled={isLoading}
                    className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-white/80 text-sm">
                    Senha
                  </Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/40"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full touch-target mt-2 bg-gradient-to-r from-primary to-emerald-400 font-semibold text-white shadow-lg glow-primary hover:opacity-90 transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            {/* Register */}
            <TabsContent value="register" className="mt-0 px-5 pb-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="register-name" className="text-white/80 text-sm">
                    Nome
                  </Label>
                  <Input
                    id="register-name"
                    name="name"
                    type="text"
                    placeholder="Seu nome"
                    required
                    disabled={isLoading}
                    className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-email" className="text-white/80 text-sm">
                    Email
                  </Label>
                  <Input
                    id="register-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    disabled={isLoading}
                    className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-password" className="text-white/80 text-sm">
                    Senha
                  </Label>
                  <Input
                    id="register-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-confirm" className="text-white/80 text-sm">
                    Confirmar Senha
                  </Label>
                  <Input
                    id="register-confirm"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="border-white/10 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/40"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full touch-target mt-2 bg-gradient-to-r from-primary to-emerald-400 font-semibold text-white shadow-lg glow-primary hover:opacity-90 transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
