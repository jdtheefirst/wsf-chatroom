
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