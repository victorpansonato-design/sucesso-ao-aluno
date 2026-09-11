import { useState } from 'react';
import type { CockpitSnapshot } from '../../lib/cockpit';
import type { PulseModel, SignalMovement } from '../../lib/pulse';
import type { SignalKey } from '../../data/institution';
import { DynamicIsland, IPhone } from '../device/IPhone';
import {
  PulseIslandCompact,
  PulseIslandExpanded,
  PulsePhoneApp,
} from './PulsePhoneApp';
import type { DrillKey } from './PulsePhoneApp';
import { Card } from '../ui/Surfaces';

/* ==========================================================================
   Pulso agora — o aparelho como objeto funcional
   --------------------------------------------------------------------------
   Este arquivo é a DOBRADIÇA: ele decide qual invólucro a aplicação `Pulso`
   recebe, e não sabe nada sobre o que ela mostra.

     · A partir de 1280px, o aparelho inteiro em grandeza natural
       (`components/device/IPhone`), com as medidas publicadas do 16 Pro.
     · Abaixo disso, a MESMA aplicação num card sem chassi.

   Não são duas implementações: é o mesmo `<PulsePhoneApp>` com a moldura
   trocada. Um aparelho que só funciona no desktop seria um enfeite que custa a
   tela do celular — e a ironia de um mockup de iPhone que quebra no celular
   não passaria despercebida.

   O chassi é `aria-hidden` por dentro do `IPhone`: carcaça, botões e reflexo
   são cenografia. Todo número que aparece na tela sai do mesmo snapshot que os
   cartões da página usam, e todo toque tem consequência dentro desta aba.
   ========================================================================== */

export interface PulseDeviceProps {
  snapshot: CockpitSnapshot;
  pulse: PulseModel;
  signals: SignalMovement[];
  scopeLabel: string;
  focusKey: SignalKey | null;
  onToggleSignal: (key: SignalKey) => void;
  onOpenDrill: (key: DrillKey) => void;
}

export function PulseDevice(props: PulseDeviceProps) {
  const { snapshot, pulse, onOpenDrill } = props;

  /* A Live Activity nasce compacta, como no aparelho: a ilha é o lugar do
     estado mais recente, não de um painel permanente. Expandir é uma escolha
     de quem lê, e ela volta a encolher no segundo toque. */
  const [islandOpen, setIslandOpen] = useState(false);
  const compact = PulseIslandCompact({ highRisk: snapshot.cases.highRisk });

  return (
    <>
      {/* Grandeza natural. */}
      <div className="hidden xl:block">
        <IPhone
          label="Pulso — resumo operacional do momento"
          glow={pulse.hero.value}
          island={
            <DynamicIsland
              expanded={islandOpen}
              onToggle={() => setIslandOpen((v) => !v)}
              label="a atividade ao vivo do pulso"
              leading={compact.leading}
              trailing={compact.trailing}
            >
              <PulseIslandExpanded
                pulse={pulse}
                snapshot={snapshot}
                onOpenDrill={onOpenDrill}
              />
            </DynamicIsland>
          }
        >
          <PulsePhoneApp {...props} />
        </IPhone>
      </div>

      {/* Abaixo de 1280px: mesma aplicação, sem chassi. A tela continua escura
          nos dois temas — um aparelho é um objeto com luz própria, e inverter a
          tela junto com a página o faria deixar de parecer um objeto. */}
      <Card className="w-full xl:hidden" padded={false}>
        <div className="relative flex h-[620px] flex-col overflow-hidden rounded-xl bg-[#0b0d11]">
          <span
            aria-hidden="true"
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `radial-gradient(88% 44% at 50% 108%, color-mix(in oklab, var(--vital) ${Math.round(10 + pulse.hero.value * 0.24)}%, transparent) 0%, transparent 70%)`,
            }}
          />
          <div className="relative z-10 flex h-full flex-col">
            <PulsePhoneApp {...props} chrome={false} />
          </div>
        </div>
      </Card>
    </>
  );
}
