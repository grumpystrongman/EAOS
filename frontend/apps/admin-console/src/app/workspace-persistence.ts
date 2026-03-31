export interface WorkspacePersistableState {
  activePersona: string;
  trackedExecutionIds: string[];
  integrations: unknown[];
  directoryUsers: unknown[];
}

export const workspacePersistSnapshot = (state: WorkspacePersistableState) => ({
  activePersona: state.activePersona,
  trackedExecutionIds: state.trackedExecutionIds,
  integrations: state.integrations,
  directoryUsers: state.directoryUsers
});
