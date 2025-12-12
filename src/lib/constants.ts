
export const getBeltColor = (level: number) => {
const colors = [
  "bg-gray-200 text-gray-800",
  "bg-yellow-100 text-yellow-800",
  "bg-orange-100 text-orange-800",
  "bg-green-100 text-green-800",
  "bg-blue-100 text-blue-800",
  "bg-purple-100 text-purple-800",
  "bg-red-100 text-red-800",
  "bg-black text-white",                 // 1st
  "bg-black text-white border border-yellow-400", // 2nd
  "bg-black text-white border-2 border-yellow-500", // 3rd
  "bg-black text-white border-2 border-yellow-600", // 4th
];
return colors[Math.min(level, colors.length - 1)] || colors[0];
};

export const beltOptions = [
  {
    name: "White Belt",
    color: "#ffffff",
    program: "Beginner Program",
    level: 0,
  },
  {
    name: "Yellow Belt",
    color: "#facc15",
    program: "Beginner Program",
    level: 1,
  },
  {
    name: "Orange Belt",
    color: "#fb923c",
    program: "Beginner Program",
    level: 2,
  },
  {
    name: "Green Belt",
    color: "#22c55e",
    program: "Intermediate Program",
    level: 3,
  },
  {
    name: "Blue Belt",
    color: "#3b82f6",
    program: "Intermediate Program",
    level: 4,
  },
  {
    name: "Purple Belt",
    color: "#8b5cf6",
    program: "Intermediate Program",
    level: 5,
  },
  {
    name: "Brown Belt",
    color: "#92400e",
    program: "Advanced Program",
    level: 6,
  },
  {
    name: "Black 1st Shahada",
    color: "#000000",
    program: "Advanced Program",
    level: 7,
  },
  {
    name: "Black 2nd Shahada",
    color: "#111111",
    program: "Elite Program",
    level: 8,
  },
  {
    name: "Black 3rd Shahada",
    color: "#222222",
    program: "Elite Program",
    level: 9,
  },
  {
    name: "Black 4th Shahada",
    color: "#333333",
    program: "Elite Program",
    level: 10,
  },
];

export const programLevels = [
  {
    slug: "beginner-program",
    title: "Beginner",
    belt_range: "White – Yellow – Orange",
    suggestedDurationWeeks: 8,
    level: "beginner" as const,
  },
  {
    slug: "intermediate-program",
    title: "Intermediate",
    belt_range: "Red – Purple – Green",
    suggestedDurationWeeks: 12,
    level: "intermediate" as const,
  },
  {
    slug: "advanced-program",
    title: "Advanced",
    belt_range: "Blue – Brown – Black 1st Shahada",
    suggestedDurationWeeks: 20,
    level: "advanced" as const,
  },
  {
    slug: "elite-program",
    title: "Elite",
    belt_range: "Black 2nd – 4th Shahada",
    suggestedDurationWeeks: 40,
    level: "expert" as const,
  },
];

// Helper function to get belt info
export const getBeltInfo = (level: number) => {
  return beltOptions.find(belt => belt.level === level) || beltOptions[0];
};

export function getCurrentProgram(beltLevel: number) {
  return programLevels[beltLevel] || programLevels[0];
}

// Helper function to get progress percentage (0-100)
export const getProgressPercentage = (beltLevel: number) => {
  const maxLevel = beltOptions.length - 1;
  return (beltLevel / maxLevel) * 100;
};

// Helper function to get next belt
export const getNextBelt = (currentLevel: number) => {
  return beltOptions.find(belt => belt.level === currentLevel + 1) || null;
};