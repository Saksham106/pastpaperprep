// A topic cheat sheet: a thin wrapper around the shared course-notes page module.
import { courseTopicCheatSheetRoute } from "@/components/course-notes/pages/cheat-sheet";

const route = courseTopicCheatSheetRoute("ib-chemistry");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
