import React from "react";
import { useCreativeLink } from "@/features/criativos/link";
import { useIa, type IaTask } from "@/features/ia/porTarefa";
import { CHAT_AGENTS, type ChatAgentId } from "@/features/space/chat/protocol";
import { cn } from "@/lib/utils";
import { modelName } from "./modelos";
import { ModelSelect } from "./ModelSelect";

/**
 * Claude ou Codex para uma tarefa (a mesma escolha de Operações › IA de cada trabalho), e o modelo dele. A IA que
 * não está neste computador aparece desligada. Sem modelo próprio, a tarefa usa o escolhido no chat.
 */
export const IaSwitch: React.FC<{
  task: IaTask;
  label: string;
  compact?: boolean;
  noModel?: boolean;
}> = ({ task, label, compact, noModel }) => {
  const agents = useCreativeLink((s) => s.agents);
  const { ia, pick, model, chatModel, pickModel } = useIa(task);
  const listed = agents.find((a) => a.id === ia)?.models;
  const sites = task === "sites";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <div
        className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5"
        role="group"
        aria-label={`IA para ${label}`}
      >
        {(["claude", "codex"] as ChatAgentId[]).map((id) => {
          const ok = !!agents.find((a) => a.id === id)?.available;
          return (
            <button
              key={id}
              type="button"
              disabled={!ok}
              aria-pressed={ia === id && ok}
              onClick={() => pick(id)}
              title={
                ok
                  ? `${label}: ${CHAT_AGENTS[id].name}`
                  : `${CHAT_AGENTS[id].name} não foi encontrado neste computador`
              }
              className={cn(
                "rounded-md font-semibold disabled:opacity-40",
                compact ? "h-6 px-2 text-[11px]" : "h-7 px-3 text-xs",
                ia === id && ok
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800",
              )}
            >
              {CHAT_AGENTS[id].name}
            </button>
          );
        })}
      </div>
      {!noModel && (
        <ModelSelect
          agent={ia}
          listed={listed}
          label={`Modelo do ${CHAT_AGENTS[ia].name} para ${label}`}
          // Sites e páginas são o próprio chat: o modelo é o da caixa
          value={sites ? chatModel : model}
          fallback={
            sites
              ? ia === "codex"
                ? "Padrão"
                : undefined
              : `Do chat (${modelName(ia, chatModel, listed)})`
          }
          onChange={pickModel}
        />
      )}
    </div>
  );
};
