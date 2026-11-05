// The whole-course cheat sheet: a thin wrapper around the shared course-notes page module.
import { courseCheatSheetRoute } from "@/components/course-notes/pages/cheat-sheet";

const route = courseCheatSheetRoute("igcse-maths-0580");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
