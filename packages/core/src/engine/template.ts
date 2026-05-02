import type { ProgramTemplate, SessionRequirement, TemplateDay } from "@adaptabuddy/contracts";

export interface ResolveTemplateInput {
  template: ProgramTemplate;
  weekNumber: number;
  dayNumber: number;
}

export function resolveTemplate(input: ResolveTemplateInput): SessionRequirement {
  const { template, weekNumber, dayNumber } = input;

  if (template.weekPattern.length === 0) {
    throw new Error("Template weekPattern must contain at least one day.");
  }

  const normalizedDayIndex = dayNumber % template.weekPattern.length;
  const day = template.weekPattern[normalizedDayIndex];

  return {
    templateId: template.templateId,
    dayIndex: day.dayIndex ?? normalizedDayIndex,
    name: day.name ?? `Day ${normalizedDayIndex + 1}`,
    intensityTarget: day.intensityTarget ?? "moderate",
    volumeMultiplier: day.volumeMultiplier ?? 1,
    slots: day.slots,
  };
}

export interface MicrocyclePlan {
  weekNumber: number;
  sessions: SessionRequirement[];
  intensityTarget: "low" | "moderate" | "high";
}

export function buildMicrocycle(
  template: ProgramTemplate,
  weekNumber: number,
  daysPerWeek: number = template.daysPerWeek
): MicrocyclePlan {
  const sessions: SessionRequirement[] = [];
  const totalDays = Math.max(1, daysPerWeek);

  for (let day = 0; day < totalDays; day += 1) {
    sessions.push(
      resolveTemplate({
        template,
        weekNumber,
        dayNumber: day,
      })
    );
  }

  const intensityTargets = sessions.map((session) => session.intensityTarget);
  const intensity: MicrocyclePlan["intensityTarget"] =
    intensityTargets.includes("high") ? "high" : intensityTargets.includes("moderate") ? "moderate" : "low";

  return {
    weekNumber,
    sessions,
    intensityTarget: intensity,
  };
}

export function getTemplateDay(
  template: ProgramTemplate,
  dayNumber: number
): TemplateDay {
  if (template.weekPattern.length === 0) {
    throw new Error("Template weekPattern must contain at least one day.");
  }
  const normalizedDayIndex = dayNumber % template.weekPattern.length;
  return template.weekPattern[normalizedDayIndex];
}
