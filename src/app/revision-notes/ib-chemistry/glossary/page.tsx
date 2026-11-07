// The glossary: a thin wrapper around the shared course-notes page module.
import { courseGlossaryRoute } from "@/components/course-notes/pages/glossary";

const route = courseGlossaryRoute("ib-chemistry");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
