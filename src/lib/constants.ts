export const getBeltColor = (level: number) => {
  const colors = [
    "bg-gray-200 text-gray-800",
    "bg-yellow-100 text-yellow-800",
    "bg-orange-100 text-orange-800",
    "bg-green-100 text-green-800",
    "bg-blue-100 text-blue-800",
    "bg-purple-100 text-purple-800",
    "bg-red-100 text-red-800",
    "bg-black text-white", // 1st
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
  return beltOptions.find((belt) => belt.level === level) || beltOptions[0];
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
  return beltOptions.find((belt) => belt.level === currentLevel + 1) || null;
};

// Helper funstion to get chatroom types
// possible types: "wsf_fans", "wsf_students", "wsf_club_owners", "psa", "nsa", "wsf_committee"
export const chatrooms = [
  {
    id: "wsf_fans",
    title: "WSF Fans Chat",
    visibility: "public",
    subtitle: "Chat with fellow WSF fans from around the world.",
    access: "Open to all WSF community members.",
    features: ["General Discussion", "Event Updates", "Fan Interactions"],
    color: "bg-blue-500",
  },
  {
    id: "wsf_students",
    title: "WSF Students Chat",
    visibility: "private",
    subtitle: "Connect with other WSF students and share your journey.",
    access: "Exclusive to enrolled WSF students.",
    features: ["Study Groups", "Course Discussions", "Student Support"],
    color: "bg-green-500",
  },
  {
    id: "wsf_club_owners",
    title: "WSF Club Owners Chat",
    visibility: "private",
    subtitle: "Network with other WSF club owners and share best practices.",
    access: "For verified WSF club owners only.",
    features: ["Business Strategies", "Marketing Tips", "Operational Support"],
    color: "bg-purple-500",
  },
  {
    id: "psa",
    title: "Professional Staff Association Chat",
    visibility: "private",
    subtitle: "Discuss matters related to the Professional Staff Association.",
    access: "Members of the Professional Staff Association.",
    features: ["Policy Discussions", "Staff Resources", "Event Planning"],
    color: "bg-red-500",
  },
  {
    id: "nsa",
    title: "National Staff Association Chat",
    visibility: "private",
    subtitle:
      "A space for members of the National Staff Association to connect.",
    access: "Open to all National Staff Association members.",
    features: [
      "National Initiatives",
      "Staff Collaboration",
      "Resource Sharing",
    ],
    color: "bg-yellow-500",
  },
  {
    id: "wsf_committee",
    title: "WSF Committee Chat",
    visibility: "private",
    subtitle: "Private discussions for WSF committee members.",
    access: "Restricted to WSF committee members only.",
    features: ["Committee Meetings", "Decision Making", "Strategic Planning"],
    color: "bg-gray-700",
  },
];
export const chatroomTypes = chatrooms.map((room) => room.id);
export type ChatroomType = (typeof chatroomTypes)[number];
// Helper function to get chatroom definition by type
export const getChatroomDefinition = (type: ChatroomType) => {
  return chatrooms.find((room) => room.id === type) || null;
};

// GET TITLES OF CHATROOMS
export const getChatroomTitle = (type: ChatroomType) => {
  const room = chatrooms.find((room) => room.id === type);
  return room ? room.title : "Unknown Chatroom";
};
