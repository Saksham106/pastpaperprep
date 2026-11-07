// A lesson page: a thin wrapper around the shared course-notes page module.
import { courseLessonRoute } from "@/components/course-notes/pages/lesson";

const route = courseLessonRoute("ib-chemistry");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
