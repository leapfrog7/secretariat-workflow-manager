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
      aiPreferences: existing?.aiPreferences,
      reminders: existing?.reminders,
      appearance: existing?.appearance,
    }) !== JSON.stringify({
      aiPreferences: settings?.aiPreferences,
      reminders: settings?.reminders,
      appearance: settings?.appearance,
    }),
  };
}
