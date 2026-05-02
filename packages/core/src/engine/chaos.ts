import type {
  ChaosBlockPlan,
  ChaosMode,
  ProgramTemplate,
  SessionRequirement,
} from "@adaptabuddy/contracts";
import { createRng, deriveSeed } from "./rng";
import { resolveTemplate } from "./template";

export interface ChaosBlockInput {
  templates: ProgramTemplate[];
  weeks: number;
  daysPerWeek: number;
  seed: string;
  mode?: ChaosMode;
  allowSameTemplateConsecutive?: boolean;
}

export interface ChaosSessionDetail {
  weekNumber: number;
  dayIndex: number;
  templateId: string;
  templateName: string;
  sourceDayIndex: number;
  session: SessionRequirement;
}

export interface ChaosBlockPlanDetail extends ChaosBlockPlan {
  sessions: ChaosSessionDetail[];
}

const clampWeeks = (weeks: number) => Math.max(1, Math.floor(weeks));
const clampDays = (days: number) => Math.min(7, Math.max(1, Math.floor(days)));

export function buildChaosBlock(
  input: ChaosBlockInput
): ChaosBlockPlanDetail {
  const weeks = clampWeeks(input.weeks);
  const daysPerWeek = clampDays(input.daysPerWeek);
  const mode: ChaosMode = input.mode ?? "random";
  const allowSameTemplateConsecutive = input.allowSameTemplateConsecutive ?? true;

  if (input.templates.length === 0) {
    return {
      seed: input.seed,
      weeks,
      daysPerWeek,
      sessions: [],
    };
  }

  const rng = createRng(deriveSeed(input.seed));
  const sessions: ChaosSessionDetail[] = [];
  let lastTemplateId: string | null = null;

  for (let week = 1; week <= weeks; week += 1) {
    for (let day = 0; day < daysPerWeek; day += 1) {
      const globalIndex = (week - 1) * daysPerWeek + day;
      let templateIndex =
        mode === "rotate"
          ? globalIndex % input.templates.length
          : Math.floor(rng() * input.templates.length);

      if (!allowSameTemplateConsecutive && input.templates.length > 1) {
        const candidate = input.templates[templateIndex];
        if (candidate.templateId === lastTemplateId) {
          templateIndex = (templateIndex + 1) % input.templates.length;
        }
      }

      const template = input.templates[templateIndex];
      const session = resolveTemplate({
        template,
        weekNumber: week,
        dayNumber: day,
      });

      sessions.push({
        weekNumber: week,
        dayIndex: day,
        templateId: template.templateId,
        templateName: template.name,
        sourceDayIndex: session.dayIndex,
        session,
      });

      lastTemplateId = template.templateId;
    }
  }

  return {
    seed: input.seed,
    weeks,
    daysPerWeek,
    sessions,
  };
}
