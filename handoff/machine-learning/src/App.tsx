import { EmptyState } from './components/ui/Surfaces';

/* Placeholder do kit. O PROMPT_MACHINE_LEARNING.md manda substituir este
   arquivo pelo shell do sistema (Sidebar + Header + rotas). */
export default function App() {
  return (
    <main className="min-h-screen bg-canvas p-8">
      <EmptyState
        title="Kit do design system instalado"
        message="Tokens, primitivos, proxy e contrato da API estão no lugar. Siga o PROMPT_MACHINE_LEARNING.md."
      />
    </main>
  );
}
