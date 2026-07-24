export function settingsScopeChanges(existing, settings) {
  return {
    workspaceChanged: JSON.stringify({
      categories: existing?.categories,
      officeProfile: existing?.officeProfile,
    }) !== JSON.stringify({
      categories: settings?.categories,
      officeProfile: settings?.officeProfile,
    }),
    userChanged: JSON.stringify({
      localAI: existing?.localAI,
      aiPreferences: existing?.aiPreferences,
      reminders: existing?.reminders,
    }) !== JSON.stringify({
      localAI: settings?.localAI,
      aiPreferences: settings?.aiPreferences,
      reminders: settings?.reminders,
    }),
  };
}
