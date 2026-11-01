import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import {
  getCurrentLocalUser,
  signInLocal,
  signUpLocal,
  signOutLocal,
} from "@/lib/localAuth";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const currentUser = getCurrentLocalUser();
    if (currentUser) {
      navigate("/admin");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }

      if (isLogin) {
        await signInLocal(email, password);
        toast({
          title: "Sucesso",
          description: "Login realizado com sucesso",
        });
      } else {
        await signUpLocal(email, password);
        toast({
          title: "Sucesso",
          description: "Conta criada com sucesso",
        });
      }

      navigate("/admin");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <SEOHead
        title={isLogin ? "Entrar" : "Cadastrar"}
        description={isLogin ? "Entre para gerenciar seus eventos" : "Crie uma conta para gerenciar eventos"}
      />
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-4xl font-normal text-[#1A1A1A] tracking-[-0.02em]">
            {isLogin ? "Entrar" : "Cadastrar"}
          </h2>
          <p className="mt-2 text-sm text-[#1A1A1A] opacity-50">
            {isLogin ? "Entre para gerenciar eventos" : "Crie uma conta para gerenciar eventos"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-[#1A1A1A] text-[#1A1A1A]"
            />
          </div>

          <div>
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-[#1A1A1A] text-[#1A1A1A]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A1A1A] text-white hover:bg-opacity-90"
          >
            {loading ? "Carregando..." : isLogin ? "Entrar" : "Cadastrar"}
          </Button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-[#1A1A1A] hover:opacity-70 transition-opacity"
        >
          {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Entrar"}
        </button>
      </div>
    </div>
  );
};

export default Auth;
