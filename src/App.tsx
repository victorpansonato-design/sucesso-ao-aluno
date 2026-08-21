import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './state/AppContext';
import { useRoute } from './lib/router';
import type { RouteName } from './lib/router';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CommandPalette } from './components/layout/CommandPalette';
import { Toaster } from './components/layout/Toaster';
import { InteractionModal } from './components/modals/InteractionModal';
import type { InteractionTarget } from './components/modals/InteractionModal';
import { CopilotModal } from './components/modals/CopilotModal';
import {
  CloseCaseModal,
  CreateCaseModal,
  FollowUpModal,
  ForwardCaseModal,
  ReopenCaseModal,
} from './components/modals/CaseModals';
import { CockpitView } from './views/CockpitView';
import { DashboardView } from './views/DashboardView';
import { QueueView } from './views/QueueView';
import { StudentsView } from './views/StudentsView';
import { Student360View } from './views/Student360View';
import { RadarsView } from './views/RadarsView';
import { OnboardingView } from './views/OnboardingView';
import { JourneyView } from './views/JourneyView';
import { IndicatorsView } from './views/IndicatorsView';
import { TeamView } from './views/TeamView';
import { PlaybookView } from './views/PlaybookView';
import { GovernanceView } from './views/GovernanceView';

/* ==========================================================================
   Shell
   --------------------------------------------------------------------------
   Owns routing and every overlay, so a modal opened from the queue, from a
   dossier or from a notification is the same component with the same behaviour.
   The action callbacks are threaded down to the views, which keeps the views
   free of overlay state and makes every path — including the ones that cross
   screens, like copilot → registro → caso encerrado — a single flow.
   ========================================================================== */

export interface ShellActions {
  goto: (route: RouteName, param?: string | null) => void;
  openStudent: (studentId: string) => void;
  openCase: (caseId: string) => void;
  register: (target: InteractionTarget) => void;
  copilot: (studentId: string, caseId?: string) => void;
  forward: (caseId: string) => void;
  closeCase: (caseId: string, mode: 'retido' | 'perdido' | 'descartar') => void;
  reopen: (caseId: string) => void;
  followUp: (studentId: string, caseId?: string) => void;
  createCase: (studentId?: string) => void;
}

function Shell() {
  const { route, navigate } = useRoute();
  const { students } = useApp();

  /* -- Overlay state ---------------------------------------------------- */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [interactionTarget, setInteractionTarget] = useState<InteractionTarget | null>(null);
  const [copilotTarget, setCopilotTarget] = useState<{ studentId: string; caseId?: string } | null>(null);
  const [forwardId, setForwardId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<{
    id: string;
    mode: 'retido' | 'perdido' | 'descartar';
  } | null>(null);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<{ studentId: string; caseId?: string } | null>(null);
  const [createFor, setCreateFor] = useState<{ open: boolean; studentId?: string }>({ open: false });

  /* -- ⌘K ---------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* -- Actions ----------------------------------------------------------- */
  const goto = useCallback(
    (name: RouteName, param?: string | null) => navigate(name, param ?? null),
    [navigate],
  );

  const openStudent = useCallback((studentId: string) => navigate('alunos', studentId), [navigate]);
  const openCase = useCallback((caseId: string) => navigate('fila', caseId), [navigate]);

  const actions: ShellActions = {
    goto,
    openStudent,
    openCase,
    register: setInteractionTarget,
    copilot: (studentId, caseId) => setCopilotTarget({ studentId, caseId }),
    forward: setForwardId,
    closeCase: (id, mode) => setCloseTarget({ id, mode }),
    reopen: setReopenId,
    followUp: (studentId, caseId) => setFollowUpTarget({ studentId, caseId }),
    createCase: (studentId) => setCreateFor({ open: true, studentId }),
  };

  /* -- Route → view ------------------------------------------------------ */
  const renderView = () => {
    switch (route.name) {
      case 'cockpit':
        return <CockpitView key="cockpit" actions={actions} />;
      case 'dashboard':
        return <DashboardView key="dashboard" actions={actions} />;
      case 'fila':
        return <QueueView key="fila" actions={actions} selectedCaseId={route.param} />;
      case 'alunos':
        // A student id in the path turns the directory into the 360° dossier.
        return route.param && students.some((s) => s.id === route.param) ? (
          <Student360View key={`aluno-${route.param}`} studentId={route.param} actions={actions} />
        ) : (
          // Anything else in the slot is a Health Score band slug, sent by the
          // cockpit donut so the base opens already filtered to that faixa.
          <StudentsView key="alunos" actions={actions} bandParam={route.param} />
        );
      case 'radares':
        return <RadarsView key="radares" actions={actions} radarParam={route.param} />;
      case 'onboarding':
        return <OnboardingView key="onboarding" actions={actions} />;
      case 'jornada':
        return <JourneyView key="jornada" actions={actions} />;
      case 'indicadores':
        return <IndicatorsView key="indicadores" actions={actions} />;
      case 'equipe':
        return <TeamView key="equipe" actions={actions} />;
      case 'playbook':
        return <PlaybookView key="playbook" actions={actions} />;
      case 'governanca':
        return <GovernanceView key="governanca" />;
      default:
        return <CockpitView key="fallback" actions={actions} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar route={route.name} onNavigate={(name) => goto(name)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenCase={openCase}
          onOpenStudent={openStudent}
          onCreateCase={() => setCreateFor({ open: true })}
          // O Dashboard tem a sua própria barra com os cinco recortes; o
          // Cockpit usa modalidade e coorte daqui.
          hideScopeControls={route.name === 'dashboard'}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <AnimatePresence mode="wait">{renderView()}</AnimatePresence>
          </div>
        </main>
      </div>

      {/* ---- Overlays ---------------------------------------------------- */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenStudent={openStudent}
        onOpenCase={openCase}
        onNavigate={(name, param) => goto(name, param)}
      />

      <InteractionModal target={interactionTarget} onClose={() => setInteractionTarget(null)} />

      <CopilotModal
        studentId={copilotTarget?.studentId ?? null}
        caseId={copilotTarget?.caseId}
        onClose={() => setCopilotTarget(null)}
        onUseApproach={(target) => {
          setCopilotTarget(null);
          setInteractionTarget(target);
        }}
      />

      <ForwardCaseModal caseId={forwardId} onClose={() => setForwardId(null)} />

      <CloseCaseModal
        caseId={closeTarget?.id ?? null}
        mode={closeTarget?.mode ?? 'retido'}
        onClose={() => setCloseTarget(null)}
      />

      <ReopenCaseModal caseId={reopenId} onClose={() => setReopenId(null)} />

      <FollowUpModal target={followUpTarget} onClose={() => setFollowUpTarget(null)} />

      <CreateCaseModal
        open={createFor.open}
        presetStudentId={createFor.studentId}
        onClose={() => setCreateFor({ open: false })}
        onCreated={(caseId) => openCase(caseId)}
      />

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
