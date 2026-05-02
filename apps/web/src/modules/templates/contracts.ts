// Re-export all template-related contracts from packages/contracts
export {
  // Template structure types
  TemplateSlotSchema,
  type TemplateSlot,
  TemplateDaySchema,
  type TemplateDay,
  ProgramTemplateSchema,
  type ProgramTemplate,

  // Resolved session requirements
  SessionRequirementSchema,
  type SessionRequirement,

  // API contracts
  ResolveTemplateRequestSchema,
  type ResolveTemplateRequest,
  ResolveTemplateResponseSchema,
  type ResolveTemplateResponse,
} from "@adaptabuddy/contracts";
