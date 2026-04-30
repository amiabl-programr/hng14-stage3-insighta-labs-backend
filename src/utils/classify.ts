type AgeGroup = 'child' | 'teenager' | 'adult' | 'senior' | 'invalid';

export const getAgeGroup = (age: number): AgeGroup => {
  if (age < 0 || age > 120) return 'invalid';

  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
};
