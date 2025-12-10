// types/course.ts

import { number } from "zod";

export interface Video {
  id: string;
  title: string;
  cloudinary_public_id: string;
  duration_minutes: number;
  thumbnail: string;
  description: string;
  is_preview_allowed?: boolean;
}

export interface Purchase {
  id: string;
  user_id: string;
  checkout_session_id: string;
  course_id: string;
  provider: string;
  provider_order_id: string;
  status: "pending" | "paid" | "refunded" | "failed";
  amount_cents: number;
  family_name?: string;
  primary_email?: string;
  member_count?: string;
  currency: string;
  created_at: string;
  paid_at?: string;
}

export interface Belt {
  name: string;
  color: string;
  title?: string;
  meaning: string;
  skills: string[];
  duration_weeks: number;
  focus: string;
  description: string;
  objectives: string[];
  components?: Component[];
  techniques?: TechniqueCategory[];
  outcome: string;
  videos?: [];
}

export interface CourseProgress {
  id: string;
  user_id: string;
  course_id: string;
  overall_progress_percentage: number;
  completed_videos_count: number;
  total_videos_count: number;
  is_course_completed: boolean;
  total_watch_time_seconds: number;
}

export interface BeltProgress {
  belt_name: string;
  belt_color: string;
  belt_order: number;
  progress_percentage: number;
  completed_videos_count: number;
  total_videos_count: number;
  is_completed: boolean;
  total_watch_time_seconds: number;
}

export interface Component {
  title: string;
  description: string;
}

export interface TechniqueCategory {
  category: string;
  items: string[];
}

export interface CourseOutcome {
  title: string;
  description: string;
  achievements: string[];
}

export interface AssessmentCriteria {
  practical_exams: string[];
  performance_exams: string[];
  academic_components: string[];
  ethical_requirements: string[];
  mentorship_requirement: string;
}

export interface Course {
  idx: number;
  id: string;
  slug: string;
  title: string;
  description: string;
  belts: Belt[];
  skills: string[];
  course_outcome?: CourseOutcome;
  suggestedDurationWeeks: number;
  colorLight: string;
  colorDark: string;
  courseSlug: string;
  belt_level_required: number;
  prerequisite_course_id: string | null;
  price_cents: number;
  currency: string;
  belt_range: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  thumbnail_url: string;
  duration_minutes: number;
  is_featured: boolean;
  created_at: string;
  objective?: string;
  core_components?: string[];
  completion_title?: string;
  assessment_criteria?: AssessmentCriteria;
}

// Utility types for filtering and sorting
export type CourseLevel = Course["level"];
export type CourseWithAssessment = Course & {
  assessment_criteria: AssessmentCriteria;
};

// Type guard to check if course has assessment criteria
export function hasAssessmentCriteria(
  course: Course
): course is CourseWithAssessment {
  return (
    "assessment_criteria" in course && course.assessment_criteria !== undefined
  );
}

// Helper function to get course by slug
export function getCourseBySlug(
  courses: Course[],
  slug: string
): Course | undefined {
  return courses.find((course) => course.slug === slug);
}

// Helper function to get courses by level
export function getCoursesByLevel(
  courses: Course[],
  level: CourseLevel
): Course[] {
  return courses.filter((course) => course.level === level);
}

// Helper function to get featured courses
export function getFeaturedCourses(courses: Course[]): Course[] {
  return courses.filter((course) => course.is_featured);
}

// Helper function to get prerequisite chain
export function getPrerequisiteChain(
  courses: Course[],
  targetCourse: Course
): Course[] {
  const chain: Course[] = [];
  let currentCourse: Course | null = targetCourse;

  while (currentCourse && currentCourse.prerequisite_course_id) {
    const prerequisite = courses.find(
      (c) => c.id === currentCourse!.prerequisite_course_id
    );
    if (prerequisite) {
      chain.unshift(prerequisite);
      currentCourse = prerequisite;
    } else {
      break;
    }
  }

  return chain;
}
