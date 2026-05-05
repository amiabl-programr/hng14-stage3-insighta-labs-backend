const ageGroups: Record<string, string> = {
  '0-12': 'child',
  '13-17': 'teenager',
  '18-25': 'young adult',
  '26-35': 'adult',
  '36-50': 'middle aged',
  '51-65': 'senior',
  '66+': 'elderly',
};

export function classifyAgeGroup(age: number): string {
  if (age <= 12) return ageGroups['0-12'];
  if (age <= 17) return ageGroups['13-17'];
  if (age <= 25) return ageGroups['18-25'];
  if (age <= 35) return ageGroups['26-35'];
  if (age <= 50) return ageGroups['36-50'];
  if (age <= 65) return ageGroups['51-65'];
  return ageGroups['66+'];
}
