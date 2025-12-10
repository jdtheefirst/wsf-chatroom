"use client";

import { Student } from "@/lib/types/student";
import { createContext, useContext, useState, ReactNode } from "react";

interface StudentContextType {
  student: Student | null;
  setStudent: (profile: Student | null) => void;
}

const studentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const [student, setStudent] = useState<Student | null>(null);

  return (
    <studentContext.Provider value={{ student, setStudent }}>
      {children}
    </studentContext.Provider>
  );
};

export const usestudentContext = () => {
  const context = useContext(studentContext);
  if (context === undefined) {
    throw new Error("usestudentContext must be used within a studentProvider");
  }
  return context;
};
