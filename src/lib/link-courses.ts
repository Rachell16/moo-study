import { supabase } from "@/integrations/supabase/client";
import { matchCourse } from "@/lib/course-aliases";
import { chunk } from "@/lib/series";
import type { Course } from "@/lib/schedule-utils";

// Hubungkan agenda yang belum punya mata kuliah, dicocokkan dari judulnya (nama, kode, atau singkatan).
// Mengembalikan jumlah agenda yang dihubungkan.
export async function autoLinkSchedules(courses: Course[]): Promise<number> {
  if (!courses.length) return 0;
  const { data, error } = await supabase.from("schedules").select("id,title").is("course_id", null);
  if (error) throw new Error(error.message);

  const byCourse = new Map<string, string[]>();
  for (const s of data ?? []) {
    const c = matchCourse(s.title, courses);
    if (c) byCourse.set(c.id, [...(byCourse.get(c.id) ?? []), s.id]);
  }

  let linked = 0;
  for (const [courseId, ids] of byCourse) {
    for (const part of chunk(ids, 50)) {
      const { error: err } = await supabase
        .from("schedules")
        .update({ course_id: courseId })
        .in("id", part);
      if (err) throw new Error(err.message);
      linked += part.length;
    }
  }
  return linked;
}
