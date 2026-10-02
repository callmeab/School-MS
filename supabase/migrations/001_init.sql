-- ============================================================================
-- School Management System - Initial Migration
-- Migration: 001_init.sql
-- Description: Enums, Tables, Triggers, Helper Functions, Indexes, & RLS Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'leave');

-- ----------------------------------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------------------------------

-- PROFILES (Maps 1:1 to auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'student'::public.user_role,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CLASSES
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  section text NOT NULL,
  academic_year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_section_year UNIQUE (name, section, academic_year)
);

-- SUBJECTS
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TEACHERS
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code text NOT NULL UNIQUE,
  qualification text,
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CLASS_SUBJECTS (Teacher assignment to class & subject)
CREATE TABLE public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_subject UNIQUE (class_id, subject_id)
);

-- STUDENTS
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  roll_no integer NOT NULL CHECK (roll_no > 0),
  guardian_name text,
  guardian_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_roll_no UNIQUE (class_id, roll_no)
);

-- STUDENT_ATTENDANCE
CREATE TABLE public.student_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL,
  marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_date UNIQUE (student_id, date)
);

-- TEACHER_ATTENDANCE
CREATE TABLE public.teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL,
  marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_date UNIQUE (teacher_id, date)
);

-- EXAMS
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_exam_dates CHECK (end_date >= start_date)
);

-- EXAM_PAPERS
CREATE TABLE public.exam_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  paper_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  total_marks numeric(5,2) NOT NULL DEFAULT 100.00 CHECK (total_marks > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_paper_times CHECK (end_time > start_time)
);

-- ----------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (SECURITY DEFINER with fixed search_path to prevent RLS recursion)
-- ----------------------------------------------------------------------------

-- Returns current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Returns true if current user is an active admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' AND is_active = true FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Returns true if current user is a teacher assigned to the specified class
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(target_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_subjects cs
    JOIN public.teachers t ON t.id = cs.teacher_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE cs.class_id = target_class_id
      AND t.profile_id = auth.uid()
      AND p.is_active = true
      AND p.role = 'teacher'
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS
-- ----------------------------------------------------------------------------

-- Automatically create student profile when auth.users row is inserted
-- (Role is strictly hardcoded to 'student' to avoid metadata injection attacks)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone, is_active)
  VALUES (
    new.id,
    COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''), 'New User'),
    'student'::public.user_role,
    NULLIF(TRIM(new.raw_user_meta_data->>'phone'), ''),
    true
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Prevent privilege escalation on profiles (only admin can change role or is_active)
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify roles or active status.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- ----------------------------------------------------------------------------
-- 5. INDEXES (Foreign keys, date lookups, attendance queries)
-- ----------------------------------------------------------------------------
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_classes_academic_year ON public.classes(academic_year);
CREATE INDEX idx_teachers_profile_id ON public.teachers(profile_id);
CREATE INDEX idx_students_profile_id ON public.students(profile_id);
CREATE INDEX idx_students_class_id ON public.students(class_id);
CREATE INDEX idx_class_subjects_class_id ON public.class_subjects(class_id);
CREATE INDEX idx_class_subjects_subject_id ON public.class_subjects(subject_id);
CREATE INDEX idx_class_subjects_teacher_id ON public.class_subjects(teacher_id);
CREATE INDEX idx_student_attendance_student_id ON public.student_attendance(student_id);
CREATE INDEX idx_student_attendance_class_id ON public.student_attendance(class_id);
CREATE INDEX idx_student_attendance_date ON public.student_attendance(date);
CREATE INDEX idx_student_attendance_class_date ON public.student_attendance(class_id, date);
CREATE INDEX idx_teacher_attendance_teacher_id ON public.teacher_attendance(teacher_id);
CREATE INDEX idx_teacher_attendance_date ON public.teacher_attendance(date);
CREATE INDEX idx_exams_class_id ON public.exams(class_id);
CREATE INDEX idx_exam_papers_exam_id ON public.exam_papers(exam_id);
CREATE INDEX idx_exam_papers_subject_id ON public.exam_papers(subject_id);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "users_read_own_profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "teachers_read_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "users_update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------
-- CLASSES POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_classes"
  ON public.classes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "students_read_own_class"
  ON public.classes FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND id IN (SELECT s.class_id FROM public.students s WHERE s.profile_id = auth.uid())
  );

-- ------------------------------------------------
-- SUBJECTS POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_subjects"
  ON public.subjects FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_subjects"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "students_read_subjects"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND id IN (
      SELECT cs.subject_id
      FROM public.class_subjects cs
      JOIN public.students s ON s.class_id = cs.class_id
      WHERE s.profile_id = auth.uid()
    )
  );

-- ------------------------------------------------
-- TEACHERS POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_teachers"
  ON public.teachers FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_teachers"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "students_read_class_teachers"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND id IN (
      SELECT cs.teacher_id
      FROM public.class_subjects cs
      JOIN public.students s ON s.class_id = cs.class_id
      WHERE s.profile_id = auth.uid()
    )
  );

-- ------------------------------------------------
-- CLASS_SUBJECTS POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_class_subjects"
  ON public.class_subjects FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_class_subjects"
  ON public.class_subjects FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "students_read_class_subjects"
  ON public.class_subjects FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND class_id IN (SELECT s.class_id FROM public.students s WHERE s.profile_id = auth.uid())
  );

-- ------------------------------------------------
-- STUDENTS POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_students"
  ON public.students FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_students"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "students_read_own_student_record"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND profile_id = auth.uid()
  );

-- ------------------------------------------------
-- STUDENT_ATTENDANCE POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_student_attendance"
  ON public.student_attendance FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_class_attendance"
  ON public.student_attendance FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND public.is_teacher_of_class(class_id)
  );

CREATE POLICY "teachers_insert_class_attendance"
  ON public.student_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND public.is_teacher_of_class(class_id)
    AND marked_by = auth.uid()
  );

CREATE POLICY "teachers_update_class_attendance"
  ON public.student_attendance FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND public.is_teacher_of_class(class_id)
  )
  WITH CHECK (
    public.get_my_role() = 'teacher'
    AND public.is_teacher_of_class(class_id)
  );

CREATE POLICY "students_read_own_attendance"
  ON public.student_attendance FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND student_id IN (SELECT s.id FROM public.students s WHERE s.profile_id = auth.uid())
  );

-- ------------------------------------------------
-- TEACHER_ATTENDANCE POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_teacher_attendance"
  ON public.teacher_attendance FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_own_attendance"
  ON public.teacher_attendance FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'teacher'
    AND teacher_id IN (SELECT t.id FROM public.teachers t WHERE t.profile_id = auth.uid())
  );

-- ------------------------------------------------
-- EXAMS POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_exams"
  ON public.exams FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_exams"
  ON public.exams FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "students_read_own_class_exams"
  ON public.exams FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND class_id IN (SELECT s.class_id FROM public.students s WHERE s.profile_id = auth.uid())
  );

-- ------------------------------------------------
-- EXAM_PAPERS POLICIES
-- ------------------------------------------------
CREATE POLICY "admin_all_exam_papers"
  ON public.exam_papers FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "teachers_read_exam_papers"
  ON public.exam_papers FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'teacher');

CREATE POLICY "students_read_own_class_exam_papers"
  ON public.exam_papers FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND exam_id IN (
      SELECT e.id
      FROM public.exams e
      JOIN public.students s ON s.class_id = e.class_id
      WHERE s.profile_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. MINIMAL SUMMARY VIEW (Security Invoker respects RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.monthly_class_attendance_summary
WITH (security_invoker = true)
AS
SELECT
  sa.class_id,
  c.name AS class_name,
  c.section AS class_section,
  to_char(sa.date, 'YYYY-MM') AS attendance_month,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE sa.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE sa.status = 'absent') AS absent_count,
  COUNT(*) FILTER (WHERE sa.status = 'late') AS late_count,
  COUNT(*) FILTER (WHERE sa.status = 'leave') AS leave_count
FROM public.student_attendance sa
JOIN public.classes c ON c.id = sa.class_id
GROUP BY sa.class_id, c.name, c.section, to_char(sa.date, 'YYYY-MM');
